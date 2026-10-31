import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { FileSpreadsheet, Lock, CheckCircle, Loader2, FileText, RefreshCw, AlertTriangle, Eye } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, query } from 'firebase/firestore';
import { ProjectGroup, Project, ComputedScore, LegacyEvaluation } from '@/types';
import { toast } from 'sonner';
import { DocumentViewerList } from '@/components/shared/DocumentViewerList';

// ─── Semester helper ──────────────────────────────────────────────────────────

function parseSemesterType(raw: any): 'SEM_7' | 'SEM_8' {
  const s = String(raw ?? '').trim().toUpperCase();
  if (s === '7' || s === 'SEM_7' || s === '7TH' || s.includes('SEMESTER 7') || s.startsWith('7'))
    return 'SEM_7';
  return 'SEM_8';
}

// ─── Row data ─────────────────────────────────────────────────────────────────

interface RowData {
  group: ProjectGroup & { semester?: any };
  project: Project | null;
  computed: ComputedScore | null;
  legacy: LegacyEvaluation | null;
  semType: 'SEM_7' | 'SEM_8';
  isPublished: boolean;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CompileResults() {
  const { user } = useAuth();
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

  const [rows, setRows] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [selectedDocsGroup, setSelectedDocsGroup] = useState<string | null>(null);

  const loadData = async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      const gSnap = await getDocs(query(collection(db, 'groups')));
      const groups = gSnap.docs.map(d => ({ id: d.id, ...d.data() } as ProjectGroup & { semester?: any; isMarksShared?: boolean }));

      const pSnap = await getDocs(query(collection(db, 'projects')));
      const projectsMap: Record<string, Project> = {};
      pSnap.docs.forEach(d => {
        const p = { id: d.id, ...d.data() } as Project;
        projectsMap[p.groupId] = p;
      });

      const idToken = await auth.currentUser?.getIdToken();

      const compiled: RowData[] = await Promise.all(groups.map(async (g) => {
        let comp: ComputedScore | null = null;
        let leg: LegacyEvaluation | null = null;

        try {
          const res = await fetch(`${backendUrl}/api/evaluations/v2/group/${g.id}/computed`, {
            headers: { 'Authorization': `Bearer ${idToken}` }
          });
          if (res.ok) comp = await res.json() as ComputedScore;
        } catch { /* backend offline */ }

        // Legacy fallback
        if (!comp) {
          try {
            const legSnap = await getDocs(query(collection(db, 'evaluations')));
            const groupLeg = legSnap.docs
              .map(d => ({ id: d.id, ...d.data() } as LegacyEvaluation))
              .find(e => e.groupId === g.id && !e.evaluatorRole?.includes('external'));
            leg = groupLeg ?? null;
          } catch { /* ignore */ }
        }

        return {
          group: g,
          project: projectsMap[g.id] || null,
          computed: comp,
          legacy: leg,
          semType: parseSemesterType(g.semester),
          isPublished: (g as any).isMarksShared === true,
        };
      }));

      // Only show rows with some evaluation data
      setRows(compiled.filter(r => r.computed !== null || r.legacy !== null));
    } catch (err) {
      toast.error('Failed to load compilation data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, [user]);

  const handlePublish = async (groupId: string) => {
    setPublishingId(groupId);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch(`${backendUrl}/api/evaluations/v2/publish/${groupId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body?.error ?? 'Failed to publish results');
        return;
      }
      toast.success('Results finalized and published to students!');
      await loadData();
    } catch (err) {
      toast.error('Failed to publish results');
    } finally {
      setPublishingId(null);
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center min-h-[400px]">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <PageHeader
          title="Compile Results"
          description="Consolidated view of all assessments — review, verify, and publish final marks"
        />
        <Button variant="outline" size="sm" onClick={loadData} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Group & Details</TableHead>
                <TableHead>Student</TableHead>
                <TableHead className="text-center">PMO<br /><span className="font-normal text-[10px]">/5</span></TableHead>
                <TableHead className="text-center">Supervisor<br /><span className="font-normal text-[10px]">/30 or /10</span></TableHead>
                <TableHead className="text-center">Panel Avg<br /><span className="font-normal text-[10px]">/65 or /35</span></TableHead>
                <TableHead className="text-center">External<br /><span className="font-normal text-[10px]">/50</span></TableHead>
                <TableHead className="text-center font-bold">Total<br /><span className="font-normal text-[10px]">/100</span></TableHead>
                <TableHead className="text-right">Group Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const { group, project, computed: comp, legacy, semType, isPublished } = row;
                const isLocked = comp?.isLocked ?? false;
                const canPublish = isLocked && !isPublished;

                const students = comp?.students ?? [];
                
                if (students.length > 0) {
                  return students.map((s, idx) => {
                    const pmo = s.pmoScore;
                    const sup = s.supervisorScore;
                    const panel = s.panelAvg;
                    const ext = s.externalScore;
                    const total = s.grandTotal;
                    const panelInfo = `(${s.breakdown.panelSubmissionsCount}/${s.breakdown.panelTotalExpected})`;

                    return (
                      <TableRow key={`${group.id}_${s.studentId}`} className={isPublished ? 'bg-green-50/30 dark:bg-green-900/10' : ''}>
                        {idx === 0 && (
                          <TableCell rowSpan={students.length} className="align-top border-r">
                            <div>
                              <p className="font-medium text-sm">{group.name}</p>
                              <Badge variant="outline" className="text-[10px] mt-1 whitespace-nowrap">
                                {semType === 'SEM_7' ? 'FYP-1' : 'FYP-2'}
                              </Badge>
                              {isLocked && !isPublished && (
                                <Badge className="mt-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] block w-fit">
                                  <Lock className="inline h-2.5 w-2.5 mr-1" /> Locked
                                </Badge>
                              )}
                              {isPublished && (
                                <Badge className="mt-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px] block w-fit">
                                  <CheckCircle className="inline h-2.5 w-2.5 mr-1" /> Published
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                        )}
                        
                        <TableCell>
                          <div className="font-medium text-sm truncate max-w-[150px]">{s.studentName}</div>
                          <div className="text-[10px] text-muted-foreground">{s.studentRollNo || 'No ID'}</div>
                        </TableCell>

                        {/* PMO */}
                        <TableCell className="text-center">
                          <span className={`font-mono font-semibold text-sm ${pmo > 0 ? 'text-primary' : 'text-muted-foreground'}`}>{pmo}</span>
                        </TableCell>

                        {/* Supervisor */}
                        <TableCell className="text-center">
                          <span className={`font-mono font-semibold text-sm ${sup > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                            {sup}<span className="text-[10px] text-muted-foreground">/{maxSup}</span>
                          </span>
                        </TableCell>

                        {/* Panel */}
                        <TableCell className="text-center">
                          <div>
                            <span className={`font-mono font-semibold text-sm ${panel > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                              {panel}<span className="text-[10px] text-muted-foreground">/{maxPanel}</span>
                            </span>
                            <p className="text-[10px] text-muted-foreground">{panelInfo}</p>
                          </div>
                        </TableCell>

                        {/* External */}
                        <TableCell className="text-center">
                          {semType === 'SEM_8'
                            ? (ext > 0
                                ? <span className="font-mono font-semibold text-sm text-primary">{ext}<span className="text-[10px] text-muted-foreground">/50</span></span>
                                : <Badge variant="outline" className="text-xs">Pending</Badge>
                              )
                            : <span className="text-xs text-muted-foreground">N/A</span>
                          }
                        </TableCell>

                        {/* Total */}
                        <TableCell className="text-center">
                          <span className={`font-mono font-bold text-base ${isPublished ? 'text-green-600' : 'text-primary'}`}>
                            {total.toFixed(1)}
                          </span>
                        </TableCell>

                        {/* Actions (Group level) */}
                        {idx === 0 && (
                          <TableCell rowSpan={students.length} className="text-right align-middle border-l">
                            <div className="flex flex-col items-end gap-2">
                              {canPublish && (
                                <Button
                                  size="sm"
                                  onClick={() => handlePublish(group.id)}
                                  disabled={publishingId === group.id}
                                >
                                  {publishingId === group.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Publish'}
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedDocsGroup(group.id)}
                              >
                                <FileText className="h-4 w-4 mr-2" /> Docs
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  });
                } else if (legacy) {
                  return (
                    <TableRow key={group.id} className="bg-amber-50/20">
                      <TableCell className="border-r">
                        <p className="font-medium text-sm">{group.name}</p>
                        <Badge variant="outline" className="text-[10px] mt-1 whitespace-nowrap">Legacy Data</Badge>
                      </TableCell>
                      <TableCell colSpan={5} className="text-center text-muted-foreground italic text-sm">
                        Group-level legacy evaluation
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-mono font-bold text-base text-amber-700">
                          {legacy.totalMarks}
                        </span>
                      </TableCell>
                      <TableCell className="text-right border-l">
                         <Badge variant="secondary">Archived</Badge>
                      </TableCell>
                    </TableRow>
                  )
                }
                return null;
               })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                    No locked evaluations ready for publishing yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Docs Dialog */}
      {selectedDocsGroup && (
        <Dialog open={!!selectedDocsGroup} onOpenChange={open => !open && setSelectedDocsGroup(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Audit Documents</DialogTitle>
              <DialogDescription>Review student submissions for auditing purposes.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <DocumentViewerList groupId={selectedDocsGroup} />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
