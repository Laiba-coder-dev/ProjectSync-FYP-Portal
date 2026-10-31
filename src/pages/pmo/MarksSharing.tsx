import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/PageHeader';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { db, auth } from '@/lib/firebase';
import { collection, query, getDocs } from 'firebase/firestore';
import { ProjectGroup, Project, ComputedScore, LegacyEvaluation } from '@/types';
import { Share, Lock, CheckCircle, Loader2, RefreshCw, AlertTriangle, Eye, Users } from 'lucide-react';
import { toast } from 'sonner';

// ─── Semester helper ──────────────────────────────────────────────────────────

function parseSemesterLabel(raw: any): { type: 'SEM_7' | 'SEM_8'; label: string } {
  const s = String(raw ?? '').trim().toUpperCase();
  const isSem7 = s === '7' || s === 'SEM_7' || s === '7TH' || s.includes('SEMESTER 7') || s.startsWith('7');
  return { type: isSem7 ? 'SEM_7' : 'SEM_8', label: isSem7 ? 'FYP-1 (Sem 7)' : 'FYP-2 (Sem 8)' };
}

// ─── Stakeholder status pill ──────────────────────────────────────────────────

function StatusPill({ submitted, label, score, max }: {
  submitted: boolean; label: string; score: number; max: number;
}) {
  return (
    <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs
      ${submitted ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
        : 'bg-muted/30 border border-dashed'}`}>
      <div className="flex items-center gap-1.5">
        {submitted
          ? <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
          : <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
        }
        <span className={`font-medium ${submitted ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground'}`}>
          {label}
        </span>
      </div>
      <span className={`font-mono font-semibold ${submitted ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground'}`}>
        {submitted ? `${score}/${max}` : 'Pending'}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface GroupData {
  group: ProjectGroup & { semester?: any };
  project: Project | null;
  computed: ComputedScore | null;
  legacy: LegacyEvaluation | null;
  isLocked: boolean;
}

export default function PMOMarksSharing() {
  const { user } = useAuth();
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

  const [data, setData] = useState<GroupData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lockingId, setLockingId] = useState<string | null>(null);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadData = async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      const gSnap = await getDocs(query(collection(db, 'groups')));
      const groups = gSnap.docs.map(d => ({ id: d.id, ...d.data() } as ProjectGroup & { semester?: any }));

      if (groups.length === 0) { setData([]); return; }

      const pSnap = await getDocs(query(collection(db, 'projects')));
      const projectsMap: Record<string, Project> = {};
      pSnap.docs.forEach(d => {
        const p = { id: d.id, ...d.data() } as Project;
        projectsMap[p.groupId] = p;
      });

      const idToken = await auth.currentUser?.getIdToken();
      const compiled: GroupData[] = await Promise.all(groups.map(async (g) => {
        let comp: ComputedScore | null = null;
        let leg: LegacyEvaluation | null = null;

        // Try v2 computed
        try {
          const res = await fetch(`${backendUrl}/api/evaluations/v2/group/${g.id}/computed`, {
            headers: { 'Authorization': `Bearer ${idToken}` }
          });
          if (res.ok) comp = await res.json() as ComputedScore;
        } catch { /* backend offline */ }

        // Legacy fallback
        if (!comp) {
          try {
            const legSnap = await getDocs(
              query(collection(db, 'evaluations'))
            );
            const groupLeg = legSnap.docs
              .map(d => ({ id: d.id, ...d.data() } as LegacyEvaluation))
              .find(e => e.groupId === g.id && e.evaluatorRole === 'supervisor');
            leg = groupLeg ?? null;
          } catch { /* ignore */ }
        }

        return {
          group: g,
          project: projectsMap[g.id] || null,
          computed: comp,
          legacy: leg,
          isLocked: comp?.isLocked ?? false,
        };
      }));

      // Only show groups that have at least some evaluation activity
      setData(compiled.filter(c => c.computed !== null || c.legacy !== null));
    } catch (err) {
      toast.error('Failed to load marks sharing data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, [user]);

  // ── Lock & Forward ────────────────────────────────────────────────────────

  const handleLockAndForward = async (groupId: string) => {
    setLockingId(groupId);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch(`${backendUrl}/api/evaluations/v2/group/${groupId}/lock`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body?.error ?? 'Failed to lock evaluation');
        return;
      }
      toast.success('Evaluation locked and forwarded to Exam Cell!');
      await loadData();
    } catch (err) {
      toast.error('Failed to lock evaluation');
    } finally {
      setLockingId(null);
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <Loader2 className="w-8 h-8 animate-spin" />
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marks Sharing"
        description="Review stakeholder evaluations, verify completeness, and forward to Exam Cell"
      >
        <Button variant="outline" size="sm" onClick={loadData} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </PageHeader>

      {data.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No evaluations submitted yet.</p>
            <p className="text-sm mt-1">Evaluations will appear once stakeholders begin submitting marks.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {data.map(item => {
            const { group, project, computed: comp, legacy, isLocked } = item;
            const sem = parseSemesterLabel(group.semester);

            // Determine what's submitted based on students
            const students = comp?.students ?? [];
            const isSem7 = sem.type === 'SEM_7';
            const isSem8 = sem.type === 'SEM_8';

            const pmoSubmitted = students.length > 0 && students.every(s => s.pmoScore > 0);
            const supSubmitted = students.length > 0 && students.every(s => s.supervisorScore > 0);
            const panelCount = students.length > 0 ? students[0].breakdown?.panelSubmissionsCount ?? 0 : 0;
            const panelExpected = students.length > 0 ? students[0].breakdown?.panelTotalExpected ?? 0 : 0;
            const panelReady = panelCount > 0;
            const extSubmitted = isSem8 && students.length > 0 && students.every(s => s.externalScore > 0);

            const readyToLock = comp
              ? (supSubmitted && panelReady && (isSem7 || extSubmitted))
              : false;

            return (
              <Card key={group.id} className={isLocked ? 'ring-2 ring-green-500/30 bg-green-50/30 dark:bg-green-900/10' : ''}>
                <CardContent className="p-5 space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="font-semibold text-sm">{group.name}</h4>
                        <Badge variant="outline" className="text-xs">{sem.label}</Badge>
                        {isLocked && (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs gap-1">
                            <Lock className="h-2.5 w-2.5" /> Forwarded
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {project?.title || 'No Project Assigned'}
                      </p>
                    </div>
                    {comp && (
                      <div className="text-right shrink-0">
                        <p className="text-2xl font-bold text-primary">{total.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">/100</p>
                      </div>
                    )}
                  </div>

                  {/* Stakeholder status list */}
                  {comp ? (
                    <div className="space-y-4">
                      {/* Overall Status summary */}
                      <div className="grid grid-cols-2 gap-2">
                        <StatusPill submitted={pmoSubmitted} label="PMO" score={5} max={5} />
                        <StatusPill submitted={supSubmitted} label="Supervisor" score={isSem7 ? 30 : 10} max={isSem7 ? 30 : 10} />
                        <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs col-span-2
                          ${panelReady ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                            : 'bg-muted/30 border border-dashed'}`}>
                          <div className="flex items-center gap-1.5">
                            {panelReady
                              ? <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                              : <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
                            }
                            <span className={`font-medium ${panelReady ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground'}`}>
                              Panel Avg ({panelCount}/{panelExpected} submitted)
                            </span>
                          </div>
                        </div>
                        {isSem8 && (
                          <div className="col-span-2">
                            <StatusPill submitted={extSubmitted} label="External" score={50} max={50} />
                          </div>
                        )}
                      </div>

                      {/* Individual Student Breakdowns */}
                      <div className="pt-3 border-t space-y-3">
                        <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Student Breakdowns</h5>
                        {students.map(s => (
                           <div key={s.studentId} className="border rounded-md p-3 text-sm space-y-2 bg-background/50">
                              <div className="flex justify-between font-medium items-center">
                                 <span className="truncate pr-2">{s.studentName} <span className="text-muted-foreground font-normal text-xs">({s.studentRollNo || 'No ID'})</span></span>
                                 <span className="text-primary font-bold">{s.grandTotal.toFixed(1)}/100</span>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
                                 <div>PMO: <span className="text-foreground">{s.pmoScore}</span></div>
                                 <div>Sup: <span className="text-foreground">{s.supervisorScore}</span></div>
                                 <div>Panel: <span className="text-foreground">{s.panelAvg}</span></div>
                                 {isSem8 && <div>Ext: <span className="text-foreground">{s.externalScore}</span></div>}
                              </div>
                              <Progress value={Math.min(Math.max(s.grandTotal, 0), 100)} className="h-1.5" />
                           </div>
                        ))}
                      </div>
                    </div>
                  ) : legacy ? (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-400">
                      <Eye className="h-4 w-4 shrink-0" />
                      <div>
                        <p className="font-medium">Legacy evaluation found</p>
                        <p className="text-xs">Total: {legacy.totalMarks}/100 (read-only, old schema)</p>
                      </div>
                    </div>
                  ) : null}

                  {/* Warning if not all required submitted */}
                  {!isLocked && comp && !readyToLock && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 text-xs text-orange-700 dark:text-orange-400">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      {sem.type === 'SEM_8' && !extSubmitted
                        ? 'Waiting for External evaluator submission'
                        : 'Waiting for all required evaluations to be submitted'
                      }
                    </div>
                  )}

                  {/* Action button */}
                  <Button
                    className="w-full"
                    variant={isLocked ? 'secondary' : 'default'}
                    disabled={isLocked || !readyToLock || lockingId === group.id}
                    onClick={() => handleLockAndForward(group.id)}
                  >
                    {lockingId === group.id
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Locking...</>
                      : isLocked
                        ? <><CheckCircle className="w-4 h-4 mr-2" />Forwarded to Exam Cell</>
                        : !readyToLock
                          ? <><Share className="w-4 h-4 mr-2" />Lock & Forward (incomplete)</>
                          : <><Lock className="w-4 h-4 mr-2" />Lock & Forward to Exam Cell</>
                    }
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
