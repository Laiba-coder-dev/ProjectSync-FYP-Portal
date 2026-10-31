import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/PageHeader';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import {
  Award, Save, CheckCircle, Loader2, Lock, RefreshCw,
  Users, AlertCircle, BookOpen, ChevronDown, ChevronUp, Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, getDocs, onSnapshot, doc } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { ProjectGroup, Project, ComputedScore, LegacyEvaluation } from '@/types';

// ─── Semester-specific criteria configs ──────────────────────────────────────

type CriteriaConfig = { key: string; label: string; max: number }[];

const CRITERIA: Record<string, Record<string, CriteriaConfig>> = {
  SEM_7: {
    SUPERVISOR: [
      { key: 'effort', label: 'Effort & Dedication', max: 10 },
      { key: 'progress', label: 'Regular Progress', max: 10 },
      { key: 'technical', label: 'Technical Development', max: 10 },
    ],
    PMO: [
      { key: 'documentation', label: 'Documentation Submission', max: 2 },
      { key: 'deadlines', label: 'Deadline Compliance', max: 2 },
      { key: 'milestones', label: 'Milestone Adherence', max: 1 },
    ],
  },
  SEM_8: {
    SUPERVISOR: [
      { key: 'readiness', label: 'Final Product Readiness', max: 4 },
      { key: 'research', label: 'Research Paper Quality', max: 3 },
      { key: 'consistency', label: 'Overall Consistency', max: 3 },
    ],
    PMO: [
      { key: 'final_report', label: 'Final Report Submission', max: 2 },
      { key: 'formatting', label: 'Formatting & Standards', max: 2 },
      { key: 'clearance', label: 'Administrative Clearance', max: 1 },
    ],
  },
};

// ─── Semester helpers ─────────────────────────────────────────────────────────

function parseSemesterType(raw: any): 'SEM_7' | 'SEM_8' {
  const s = String(raw ?? '').trim().toUpperCase();
  if (s === '7' || s === 'SEM_7' || s === '7TH' || s.includes('SEMESTER 7') || s.startsWith('7'))
    return 'SEM_7';
  return 'SEM_8';
}

function semLabel(t: 'SEM_7' | 'SEM_8') {
  return t === 'SEM_7' ? 'FYP-1 (Sem 7)' : 'FYP-2 (Sem 8)';
}

// ─── Score input row component ────────────────────────────────────────────────

function CriteriaRow({
  label, max, value, onChange, disabled,
}: { label: string; max: number; value: number; onChange: (v: number) => void; disabled: boolean }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">{label}</Label>
        <span className="text-xs text-muted-foreground font-mono">{value}/{max}</span>
      </div>
      <Input
        type="number"
        min={0}
        max={max}
        value={value}
        disabled={disabled}
        onChange={e => onChange(Math.min(max, Math.max(0, Number(e.target.value) || 0)))}
        className="h-8 text-sm"
      />
      <Progress value={Math.min(Math.max(pct, 0), 100)} className="h-1" />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SupervisorEvaluation() {
  const { user } = useAuth();
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

  const [groups, setGroups] = useState<(ProjectGroup & { semester?: any })[]>([]);
  const [projects, setProjects] = useState<Record<string, Project>>({});
  const [computed, setComputed] = useState<Record<string, ComputedScore>>({});
  const [legacyEvals, setLegacyEvals] = useState<Record<string, LegacyEvaluation>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedGroup, setSelectedGroup] = useState<(ProjectGroup & { semester?: any }) | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form: criteria values keyed by studentId and criteria key
  const [studentCriteriaValues, setStudentCriteriaValues] = useState<Record<string, Record<string, number>>>({});
  const [studentFeedback, setStudentFeedback] = useState<Record<string, string>>({});
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadData = async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      const groupsRef = collection(db, 'groups');
      const gQ = user.role === 'pmo' || user.role === 'admin'
        ? query(groupsRef)
        : query(groupsRef, where('supervisorId', '==', user.id));
      const gSnap = await getDocs(gQ);
      const fetchedGroups = gSnap.docs.map(d => ({ id: d.id, ...d.data() } as ProjectGroup & { semester?: any }));
      setGroups(fetchedGroups);

      if (fetchedGroups.length > 0) {
        const pSnap = await getDocs(query(collection(db, 'projects'), where('groupId', 'in', fetchedGroups.map(g => g.id))));
        const pMap: Record<string, Project> = {};
        pSnap.docs.forEach(d => { const p = { id: d.id, ...d.data() } as Project; pMap[p.groupId] = p; });
        setProjects(pMap);
      }

      // Fetch v2 computed scores + legacy fallback for each group
      const idToken = await auth.currentUser?.getIdToken();
      const computedMap: Record<string, ComputedScore> = {};
      const legacyMap: Record<string, LegacyEvaluation> = {};

      await Promise.all(fetchedGroups.map(async (g) => {
        try {
          const res = await fetch(`${backendUrl}/api/evaluations/v2/group/${g.id}/computed`, {
            headers: { 'Authorization': `Bearer ${idToken}` }
          });
          if (res.ok) {
            computedMap[g.id] = await res.json() as ComputedScore;
          }
        } catch { /* backend might not be up */ }

        // Legacy fallback: check old evaluations collection
        try {
          const legSnap = await getDocs(query(
            collection(db, 'evaluations'),
            where('groupId', '==', g.id),
            where('studentId', '==', null)
          ));
          if (legSnap.docs.length > 0) {
            legacyMap[g.id] = { id: legSnap.docs[0].id, ...legSnap.docs[0].data() } as LegacyEvaluation;
          }
        } catch { /* ignore */ }
      }));

      setComputed(computedMap);
      setLegacyEvals(legacyMap);
    } catch (err) {
      toast.error('Failed to load evaluation data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, [user]);

  // ── Open evaluation dialog ──────────────────────────────────────────────────

  const openEval = (g: ProjectGroup & { semester?: any }) => {
    const semType = parseSemesterType(g.semester);
    const role = user?.role === 'pmo' ? 'PMO' : 'SUPERVISOR';
    const cfg = CRITERIA[semType]?.[role] ?? [];

    // Pre-fill initialized state
    const initialCriteria: Record<string, Record<string, number>> = {};
    const initialFeedback: Record<string, string> = {};
    
    g.members?.forEach(m => {
      initialCriteria[m.userId] = {};
      cfg.forEach(c => { initialCriteria[m.userId][c.key] = 0; });
      initialFeedback[m.userId] = '';
    });

    // We no longer pre-fill from `computed` here because `computed` currently groups by student but `allScores` isn't fully robust for partial student fetches client-side, 
    // and a robust pre-fill would require matching student ID inside allScores. For simplicity, we initialize to 0.

    setStudentCriteriaValues(initialCriteria);
    setStudentFeedback(initialFeedback);
    setSelectedStudentId(g.members?.[0]?.userId ?? null);
    setSelectedGroup(g);
  };

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!selectedGroup || !user) return;
    setIsSubmitting(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const role = user.role === 'pmo' ? 'PMO' : 'SUPERVISOR';

      const evaluations = (selectedGroup.members || []).map(m => ({
        studentId: m.userId,
        studentName: m.name,
        studentRollNo: (m as any).rollNumber || (m as any).email || '',
        criteria: studentCriteriaValues[m.userId] || {},
        feedback: studentFeedback[m.userId] || ''
      }));

      const res = await fetch(`${backendUrl}/api/evaluations/v2/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({
          groupId: selectedGroup.id,
          evaluatorRole: role,
          evaluations,
        })
      });

      const body = await res.json();
      if (!res.ok) {
        toast.error(body?.error ?? 'Submission failed');
        return;
      }

      toast.success(`${role === 'PMO' ? 'PMO' : 'Supervisor'} individual marks saved!`);
      setSelectedGroup(null);
      await loadData();
    } catch (err) {
      toast.error('Failed to submit evaluation');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render helpers ──────────────────────────────────────────────────────────

  const getEvalRole = () => (user?.role === 'pmo' ? 'PMO' : 'SUPERVISOR');

  const hasSubmitted = (g: ProjectGroup) => {
    const role = getEvalRole();
    return computed[g.id]?.allScores?.some(
      s => s.evaluatorId === user?.id && s.evaluatorRole === role
    ) ?? false;
  };

  const getMyScore = (g: ProjectGroup): number => {
    const role = getEvalRole();
    return computed[g.id]?.allScores?.find(
      s => s.evaluatorId === user?.id && s.evaluatorRole === role
    )?.score ?? 0;
  };

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  const pending = groups.filter(g => !hasSubmitted(g));
  const submitted = groups.filter(g => hasSubmitted(g));

  // ── Group Card ──────────────────────────────────────────────────────────────

  const renderGroupCard = (g: ProjectGroup & { semester?: any }) => {
    const proj = projects[g.id];
    const semType = parseSemesterType(g.semester);
    const comp = computed[g.id];
    const legacy = legacyEvals[g.id];
    const done = hasSubmitted(g);
    const myScore = getMyScore(g);
    const role = getEvalRole();
    const cfg = CRITERIA[semType]?.[role] ?? [];
    const maxScore = cfg.reduce((a, c) => a + c.max, 0);
    const isLocked = comp?.isLocked ?? false;

    return (
      <Card className={`transition-all ${isLocked ? 'opacity-75' : ''}`}>
        <CardContent className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-full bg-primary/10 shrink-0">
                <Award className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{g.name}</p>
                <p className="text-xs text-muted-foreground truncate">{proj?.title || 'No Project'}</p>
                <p className="text-xs text-muted-foreground">{g.members?.length ?? 0} members</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <Badge variant="outline" className="text-xs">
                {semLabel(semType)}
              </Badge>
              {isLocked && (
                <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 text-xs gap-1">
                  <Lock className="h-2.5 w-2.5" /> Locked
                </Badge>
              )}
            </div>
          </div>

          {/* Score display */}
          {done && (
            <div className="rounded-lg bg-muted/40 p-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium text-muted-foreground">Your {role} Score</span>
                <span className="text-sm font-bold text-primary">{myScore}/{maxScore}</span>
              </div>
              <Progress value={Math.min(Math.max(maxScore > 0 ? (myScore / maxScore) * 100 : 0, 0), 100)} className="h-1.5" />
            </div>
          )}

          {/* Computed breakdown (PMO view) */}
          {user?.role === 'pmo' && comp && (
            <div className="rounded-lg border p-3 space-y-1.5 text-xs">
              <p className="font-semibold text-muted-foreground mb-2">Computed Totals</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <span className="text-muted-foreground">PMO</span>
                <span className="font-mono text-right">{comp.pmoScore}/5</span>
                <span className="text-muted-foreground">Supervisor</span>
                <span className="font-mono text-right">{comp.supervisorScore}/{semType === 'SEM_7' ? 30 : 10}</span>
                <span className="text-muted-foreground">Panel Avg</span>
                <span className="font-mono text-right">
                  {comp.panelAvg}/{semType === 'SEM_7' ? 65 : 35}
                  <span className="text-muted-foreground ml-1">({comp.panelSubmittedCount}/{comp.panelTotalExpected})</span>
                </span>
                {semType === 'SEM_8' && (
                  <>
                    <span className="text-muted-foreground">External</span>
                    <span className="font-mono text-right">{comp.externalScore}/50</span>
                  </>
                )}
                <span className="font-semibold border-t pt-1 mt-1">Total</span>
                <span className="font-bold text-primary font-mono border-t pt-1 mt-1 text-right">{comp.total}/100</span>
              </div>
            </div>
          )}

          {/* Legacy fallback badge */}
          {!comp && legacy && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400">
              <Eye className="h-3.5 w-3.5 shrink-0" />
              Legacy: {legacy.totalMarks}/100 (read-only, old schema)
            </div>
          )}

          {/* Actions */}
          <Button
            variant={done ? 'outline' : 'default'}
            className="w-full"
            disabled={isLocked}
            onClick={() => openEval(g)}
          >
            {isLocked
              ? <><Lock className="h-3.5 w-3.5 mr-2" />Locked</>
              : done
                ? <><RefreshCw className="h-3.5 w-3.5 mr-2" />Update Score</>
                : <><Award className="h-3.5 w-3.5 mr-2" />Evaluate</>
            }
          </Button>
        </CardContent>
      </Card>
    );
  };

  // ── Dialog ──────────────────────────────────────────────────────────────────

  const renderDialogForm = () => {
    if (!selectedGroup) return null;
    const semType = parseSemesterType(selectedGroup.semester);
    const role = user?.role === 'pmo' ? 'PMO' : 'SUPERVISOR';
    const cfg = CRITERIA[semType]?.[role] ?? [];
    const maxScore = cfg.reduce((a, c) => a + c.max, 0);
    
    const handleCopyScores = () => {
      if (!selectedStudentId) return;
      const sourceCriteria = studentCriteriaValues[selectedStudentId];
      const sourceFeedback = studentFeedback[selectedStudentId];

      setStudentCriteriaValues(prev => {
        const next = { ...prev };
        selectedGroup.members?.forEach(m => {
          if (m.userId !== selectedStudentId) {
            next[m.userId] = { ...sourceCriteria };
          }
        });
        return next;
      });
      setStudentFeedback(prev => {
        const next = { ...prev };
        selectedGroup.members?.forEach(m => {
          if (m.userId !== selectedStudentId) {
            next[m.userId] = sourceFeedback;
          }
        });
        return next;
      });
      toast.success("Scores copied to all members!");
    };

    // calculate total entered for the currently selected student
    const activeCriteria = selectedStudentId ? studentCriteriaValues[selectedStudentId] : {};
    const totalEntered = Object.values(activeCriteria || {}).reduce((a, v) => a + v, 0);
    
    // check if ANY student has exceeded the max score
    const isAnyExceeded = (selectedGroup.members || []).some(m => {
      const criteria = studentCriteriaValues[m.userId] || {};
      const sum = Object.values(criteria).reduce((a, v) => a + v, 0);
      return sum > maxScore;
    });

    return (
      <Dialog open={!!selectedGroup} onOpenChange={open => { if (!open) setSelectedGroup(null); }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              {role === 'PMO' ? 'PMO Evaluation' : 'Supervisor Evaluation'}
            </DialogTitle>
            <DialogDescription>
              {selectedGroup.name} · {semLabel(semType)} · Max {maxScore} marks
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Student selection tabs */}
            <div className="border rounded-xl p-4 bg-muted/20">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" /> Select Student
                </h4>
                <Button size="sm" variant="outline" onClick={handleCopyScores} title="Copy current scores to all other students in this group">
                  <RefreshCw className="mr-2 h-3.5 w-3.5" /> Copy to All
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedGroup.members?.map(m => (
                  <Button 
                    key={m.userId}
                    size="sm"
                    variant={selectedStudentId === m.userId ? "default" : "outline"}
                    onClick={() => setSelectedStudentId(m.userId)}
                  >
                    {m.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* Criteria inputs */}
            {selectedStudentId && (
              <div className="space-y-4 rounded-xl border p-4 bg-muted/20">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Assessment Criteria
                </h4>
                {cfg.map(c => (
                  <CriteriaRow
                    key={c.key}
                    label={`${c.label} (/${c.max})`}
                    max={c.max}
                    value={studentCriteriaValues[selectedStudentId]?.[c.key] ?? 0}
                    onChange={v => setStudentCriteriaValues(prev => ({
                      ...prev,
                      [selectedStudentId]: { ...prev[selectedStudentId], [c.key]: v }
                    }))}
                    disabled={isSubmitting}
                  />
                ))}

                {/* Live total */}
                <div className={`flex items-center justify-between rounded-lg p-3 font-semibold text-sm
                  ${totalEntered > maxScore ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
                  <span>Total</span>
                  <span className="text-lg font-bold">{totalEntered}/{maxScore}</span>
                </div>

                {totalEntered > maxScore && (
                  <div className="flex items-center gap-2 text-destructive text-xs">
                    <AlertCircle className="h-3.5 w-3.5" />
                    This student exceeds maximum score
                  </div>
                )}
              </div>
            )}

            {/* Feedback */}
            {selectedStudentId && (
              <div className="space-y-2">
                <Label className="text-xs">Written Feedback (optional)</Label>
                <Textarea
                  rows={3}
                  placeholder="Observations, strengths, areas to improve..."
                  value={studentFeedback[selectedStudentId] ?? ''}
                  onChange={e => setStudentFeedback(prev => ({...prev, [selectedStudentId]: e.target.value}))}
                  disabled={isSubmitting}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedGroup(null)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || isAnyExceeded}
            >
              {isSubmitting
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
                : <><Save className="mr-2 h-4 w-4" />Submit All Students</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // ── Page ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title={user?.role === 'pmo' ? 'PMO Evaluation' : 'Group Evaluations'}
        description={
          user?.role === 'pmo'
            ? 'Submit PMO compliance scores and view aggregate totals'
            : 'Submit supervisor marks for your assigned FYP groups'
        }
      >
        <Button variant="outline" size="sm" onClick={loadData} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </PageHeader>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>No assigned groups found.</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
            <TabsTrigger value="submitted">Submitted ({submitted.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="pending">
            <div className="grid gap-4 md:grid-cols-2 mt-4">
              {pending.map(g => (
                <div key={g.id}>{renderGroupCard(g)}</div>
              ))}
              {pending.length === 0 && (
                <p className="col-span-2 text-center text-sm text-muted-foreground py-8">
                  All groups evaluated ✓
                </p>
              )}
            </div>
          </TabsContent>
          <TabsContent value="submitted">
            <div className="grid gap-4 md:grid-cols-2 mt-4">
              {submitted.map(g => (
                <div key={g.id}>{renderGroupCard(g)}</div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {renderDialogForm()}
    </div>
  );
}
