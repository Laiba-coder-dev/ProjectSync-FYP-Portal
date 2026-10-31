import { useState, useEffect, useCallback } from 'react';
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
  Award, Save, CheckCircle, Loader2, AlertCircle, FileText,
  Sparkles, ThumbsUp, ThumbsDown, Lightbulb, RefreshCw, Lock, Eye, Users
} from 'lucide-react';
import { toast } from 'sonner';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { ProjectGroup, Project, LegacyEvaluation } from '@/types';
import { useLocation } from 'react-router-dom';
import { DocumentViewerList } from '@/components/shared/DocumentViewerList';

// ─── Criteria configurations ──────────────────────────────────────────────────

type CriteriaConfig = { key: string; label: string; max: number };

const PANEL_CRITERIA: Record<string, CriteriaConfig[]> = {
  SEM_7: [
    { key: 'defense', label: 'Defense Presentation', max: 25 },
    { key: 'srs_design', label: 'SRS / Design Document', max: 20 },
    { key: 'prototype', label: 'Prototype Demo', max: 20 },
  ],
  SEM_8: [
    { key: 'final_defense', label: 'Final Internal Defense', max: 15 },
    { key: 'code_execution', label: 'Code Execution Quality', max: 10 },
    { key: 'architecture', label: 'System Architecture', max: 10 },
  ],
};

const EXTERNAL_CRITERIA: CriteriaConfig[] = [
  { key: 'viva', label: 'Comprehensive Viva', max: 20 },
  { key: 'demonstration', label: 'Project Demonstration', max: 15 },
  { key: 'feasibility', label: 'Commercial Feasibility', max: 15 },
];

// ─── Semester helpers ─────────────────────────────────────────────────────────

function parseSemesterType(raw: any): 'SEM_7' | 'SEM_8' {
  const s = String(raw ?? '').trim().toUpperCase();
  if (s === '7' || s === 'SEM_7' || s === '7TH' || s.includes('SEMESTER 7') || s.startsWith('7'))
    return 'SEM_7';
  return 'SEM_8';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CriteriaRow({ label, max, value, onChange, disabled }: {
  label: string; max: number; value: number;
  onChange: (v: number) => void; disabled: boolean;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">{label}</Label>
        <span className="text-xs text-muted-foreground font-mono">{value}/{max}</span>
      </div>
      <Input
        type="number" min={0} max={max} value={value} disabled={disabled}
        onChange={e => onChange(Math.min(max, Math.max(0, Number(e.target.value) || 0)))}
        className="h-8 text-sm"
      />
      <Progress value={Math.min(Math.max(pct, 0), 100)} className="h-1" />
    </div>
  );
}

// ─── Eval Dialog Component ──────────────────────────────────────────────────

function EvalDialog({ 
  group, projects, onClose, onComplete, backendUrl, user 
}: { 
  group: ProjectGroup & { semester?: any }; 
  projects: Record<string, Project>; 
  onClose: () => void; 
  onComplete: () => void; 
  backendUrl: string; 
  user: any; 
}) {
  const semType = parseSemesterType(group.semester);
  const evalRole = (group as any).externalPanelId === user?.id ? 'EXTERNAL' : 'PANEL';
  const cfg = evalRole === 'EXTERNAL' ? EXTERNAL_CRITERIA : (PANEL_CRITERIA[semType] ?? []);
  const maxScore = cfg.reduce((a, c) => a + c.max, 0);

  const [studentCriteriaValues, setStudentCriteriaValues] = useState<Record<string, Record<string, number>>>({});
  const [studentFeedback, setStudentFeedback] = useState<Record<string, string>>({});
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [aiFeedback, setAiFeedback] = useState<any | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!group) return;
    const initialCriteria: Record<string, Record<string, number>> = {};
    const initialFeedback: Record<string, string> = {};
    group.members?.forEach((m: any) => {
      initialCriteria[m.userId] = {};
      cfg.forEach(c => { initialCriteria[m.userId][c.key] = 0; });
      initialFeedback[m.userId] = '';
    });
    setStudentCriteriaValues(initialCriteria);
    setStudentFeedback(initialFeedback);
    setSelectedStudentId(group.members?.[0]?.userId ?? null);
    setAiFeedback(null);
  }, [group]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCopyScores = () => {
    if (!selectedStudentId) return;
    const sourceCriteria = studentCriteriaValues[selectedStudentId];
    const sourceFeedback = studentFeedback[selectedStudentId];
    setStudentCriteriaValues(prev => {
      const next = { ...prev };
      group.members?.forEach((m: any) => {
        if (m.userId !== selectedStudentId) next[m.userId] = { ...sourceCriteria };
      });
      return next;
    });
    setStudentFeedback(prev => {
      const next = { ...prev };
      group.members?.forEach((m: any) => {
        if (m.userId !== selectedStudentId) next[m.userId] = sourceFeedback;
      });
      return next;
    });
    toast.success("Scores copied to all members!");
  };

  const fetchAiFeedback = async () => {
    setLoadingAI(true);
    try {
      const proj = projects[group.id];
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch(`${backendUrl}/api/ai/generate-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({
          title: proj?.title || group.name,
          abstract: proj?.abstract || proj?.title || 'No abstract available',
          milestoneType: 'final'
        })
      });
      if (!res.ok) throw new Error('AI failed');
      setAiFeedback(await res.json());
    } catch {
      toast.error('Failed to generate AI feedback');
    } finally {
      setLoadingAI(false);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const evaluations = (group.members || []).map((m: any) => ({
        studentId: m.userId,
        studentName: m.name,
        studentRollNo: m.rollNumber || m.email || '',
        criteria: studentCriteriaValues[m.userId] || {},
        feedback: studentFeedback[m.userId] || ''
      }));

      const res = await fetch(`${backendUrl}/api/evaluations/v2/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({
          groupId: group.id,
          evaluatorRole: evalRole,
          evaluations,
        })
      });
      const body = await res.json();
      if (!res.ok) { toast.error(body?.error ?? 'Submission failed'); return; }
      toast.success(`${evalRole} individual marks saved!`);
      onComplete();
    } catch (err) {
      toast.error('Failed to submit evaluation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeCriteria = selectedStudentId ? studentCriteriaValues[selectedStudentId] : {};
  const totalEntered = Object.values(activeCriteria || {}).reduce((a, v) => a + v, 0);
  const isAnyExceeded = (group.members || []).some((m: any) => {
    const criteria = studentCriteriaValues[m.userId] || {};
    const sum = Object.values(criteria).reduce((a, v) => a + v, 0);
    return sum > maxScore;
  });

  return (
    <Dialog open={true} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {evalRole === 'EXTERNAL' ? 'External Examiner Evaluation' : `Panel Evaluation (` + (semType === 'SEM_7' ? 'FYP-1' : 'FYP-2') + `)`}
          </DialogTitle>
          <DialogDescription>
            {group.name} · {projects[group.id]?.title || 'No Project'} · Max {maxScore} marks
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="border rounded-lg p-4 bg-muted/20 max-h-[220px] overflow-y-auto">
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-primary" /> Project Documents
            </h3>
            <DocumentViewerList groupId={group.id} phase="final" />
          </div>

          <div className="border rounded-lg p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border-amber-500/30">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" /> AI Smart Assist
              </h3>
              <Button size="sm" variant="outline" onClick={fetchAiFeedback} disabled={loadingAI || !!aiFeedback}>
                {loadingAI ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Analyzing...</> : <><Sparkles className="mr-2 h-3.5 w-3.5" />Generate Feedback</>}
              </Button>
            </div>
            {aiFeedback ? (
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{aiFeedback.overallScore}/10</Badge>
                  <span className="text-muted-foreground italic">{aiFeedback.summary}</span>
                </div>
                {aiFeedback.strengths?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <ThumbsUp className="h-3 w-3 text-green-600" />
                      <span className="font-semibold text-green-700 dark:text-green-400">Strengths</span>
                    </div>
                    <ul className="pl-4 list-disc text-muted-foreground space-y-0.5">
                      {aiFeedback.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
                {aiFeedback.weaknesses?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <ThumbsDown className="h-3 w-3 text-red-500" />
                      <span className="font-semibold text-red-600 dark:text-red-400">Weaknesses</span>
                    </div>
                    <ul className="pl-4 list-disc text-muted-foreground space-y-0.5">
                      {aiFeedback.weaknesses.map((w: string, i: number) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                )}
                {aiFeedback.suggestions?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <Lightbulb className="h-3 w-3 text-blue-500" />
                      <span className="font-semibold text-blue-600 dark:text-blue-400">Suggestions</span>
                    </div>
                    <ul className="pl-4 list-disc text-muted-foreground space-y-0.5">
                      {aiFeedback.suggestions.map((s: string, i: number) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Click the button above to get AI-powered insights before scoring.</p>
            )}
          </div>

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
              {group.members?.map((m: any) => (
                <Button key={m.userId} size="sm" variant={selectedStudentId === m.userId ? "default" : "outline"} onClick={() => setSelectedStudentId(m.userId)}>
                  {m.name}
                </Button>
              ))}
            </div>
          </div>

          {selectedStudentId && (
            <div className="border rounded-xl p-4 bg-muted/20 space-y-4">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Award className="h-4 w-4 text-primary" /> Evaluation Criteria
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

              <div className={`flex items-center justify-between rounded-lg p-3 font-semibold text-sm ${totalEntered > maxScore ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
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

          {selectedStudentId && (
            <div className="space-y-2">
              <Label className="text-xs">Written Feedback (optional)</Label>
              <Textarea rows={3} placeholder="Evaluation notes..." value={studentFeedback[selectedStudentId] ?? ''}
                onChange={e => setStudentFeedback(prev => ({...prev, [selectedStudentId]: e.target.value}))} disabled={isSubmitting} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || isAnyExceeded}>
            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <><Save className="mr-2 h-4 w-4" />Submit All Students</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EvaluateGroups() {
  const { user } = useAuth();
  const location = useLocation();
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

  const [groups, setGroups] = useState<(ProjectGroup & { semester?: any })[]>([]);
  const [projects, setProjects] = useState<Record<string, Project>>({});
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set());
  const [myScores, setMyScores] = useState<Record<string, { score: number; maxScore: number }>>({});
  const [legacyEvals, setLegacyEvals] = useState<Record<string, LegacyEvaluation>>({});
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedGroup, setSelectedGroup] = useState<(ProjectGroup & { semester?: any }) | null>(null);

  const getEvalRole = useCallback((g: ProjectGroup & { semester?: any }): 'PANEL' | 'EXTERNAL' => {
    if ((g as any).externalPanelId === user?.id) return 'EXTERNAL';
    return 'PANEL';
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      const gQ = query(collection(db, 'groups'), where('externalPanelId', '==', user.id));
      const gSnap = await getDocs(gQ);
      let fetchedGroups = gSnap.docs.map(d => ({ id: d.id, ...d.data() } as ProjectGroup & { semester?: any }));

      const panelSnap = await getDocs(query(collection(db, 'panels'), where('memberIds', 'array-contains', user.id)));
      const panelIds = panelSnap.docs.map(d => d.id);
      if (panelIds.length > 0) {
        const panelGroupSnap = await getDocs(query(collection(db, 'groups'), where('assignedPanelId', 'in', panelIds)));
        const panelGroups = panelGroupSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as ProjectGroup & { semester?: any }))
          .filter(g => !fetchedGroups.find(fg => fg.id === g.id));
        fetchedGroups = [...fetchedGroups, ...panelGroups];
      }

      setGroups(fetchedGroups);

      if (fetchedGroups.length > 0) {
        const pSnap = await getDocs(query(collection(db, 'projects'), where('groupId', 'in', fetchedGroups.map(g => g.id))));
        const pMap: Record<string, Project> = {};
        pSnap.docs.forEach(d => { const p = { id: d.id, ...d.data() } as Project; pMap[p.groupId] = p; });
        setProjects(pMap);
      }

      const idToken = await auth.currentUser?.getIdToken();
      const submittedSet = new Set<string>();
      const scoreMap: Record<string, { score: number; maxScore: number }> = {};
      const legacyMap: Record<string, LegacyEvaluation> = {};
      const lockedSet = new Set<string>();

      await Promise.all(fetchedGroups.map(async (g) => {
        try {
          const res = await fetch(`${backendUrl}/api/evaluations/v2/group/${g.id}/computed`, {
            headers: { 'Authorization': `Bearer ${idToken}` }
          });
          if (res.ok) {
            const data = await res.json();
            if (data.isLocked) lockedSet.add(g.id);

            const myEntry = data.allScores?.find(
              (s: any) => s.evaluatorId === user.id && (s.evaluatorRole === 'PANEL' || s.evaluatorRole === 'EXTERNAL')
            );
            if (myEntry) {
              submittedSet.add(g.id);
              scoreMap[g.id] = { score: myEntry.score, maxScore: myEntry.maxScore };
            }
          }
        } catch { /* backend offline */ }

        try {
          const legSnap = await getDocs(query(
            collection(db, 'evaluations'),
            where('groupId', '==', g.id),
            where('evaluatorId', '==', user.id)
          ));
          if (legSnap.docs.length > 0) {
            legacyMap[g.id] = { id: legSnap.docs[0].id, ...legSnap.docs[0].data() } as LegacyEvaluation;
          }
        } catch { /* ignore */ }
      }));

      setSubmittedIds(submittedSet);
      setMyScores(scoreMap);
      setLegacyEvals(legacyMap);
      setLockedIds(lockedSet);

      if (location.state?.groupId) {
        const fg = fetchedGroups.find(g => g.id === location.state.groupId);
        if (fg) setSelectedGroup(fg);
      }
    } catch (err) {
      toast.error('Failed to load evaluation data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, [user, location.state]);

  if (loading) return (
    <div className="flex justify-center items-center min-h-[400px]">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );

  const pending = groups.filter(g => !submittedIds.has(g.id));
  const submitted = groups.filter(g => submittedIds.has(g.id));

  const renderGroupCard = (g: ProjectGroup & { semester?: any }) => {
    const proj = projects[g.id];
    const semType = parseSemesterType(g.semester);
    const evalRole = getEvalRole(g);
    const done = submittedIds.has(g.id);
    const score = myScores[g.id];
    const legacy = legacyEvals[g.id];
    const isLocked = lockedIds.has(g.id);

    return (
      <Card key={g.id}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-full bg-primary/10 shrink-0">
                <Award className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{g.name}</p>
                <p className="text-xs text-muted-foreground truncate">{proj?.title || 'No Project Assigned'}</p>
              </div>
            </div>
            <div className="flex flex-col gap-1 items-end shrink-0">
              <Badge variant="outline" className="text-xs">
                {semType === 'SEM_7' ? 'FYP-1' : 'FYP-2'}
              </Badge>
              <Badge variant={evalRole === 'EXTERNAL' ? 'secondary' : 'outline'} className="text-xs">
                {evalRole}
              </Badge>
              {isLocked && (
                <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs gap-1">
                  <Lock className="h-2.5 w-2.5" /> Locked
                </Badge>
              )}
            </div>
          </div>

          {done && score && (
            <div className="rounded-lg bg-muted/40 p-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-muted-foreground">Your Score</span>
                <span className="text-sm font-bold text-primary">{score.score}/{score.maxScore}</span>
              </div>
              <Progress value={Math.min(Math.max(score.maxScore > 0 ? (score.score / score.maxScore) * 100 : 0, 0), 100)} className="h-1.5" />
            </div>
          )}

          {!done && !score && legacy && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400">
              <Eye className="h-3.5 w-3.5 shrink-0" />
              Legacy score: {legacy.totalMarks}/100 (read-only)
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant={done ? 'outline' : 'default'}
              className={done ? 'flex-1' : 'w-full'}
              disabled={isLocked}
              onClick={() => setSelectedGroup(g)}
            >
              {isLocked ? <><Lock className="h-3.5 w-3.5 mr-2" />Locked</>
                : done ? <><RefreshCw className="h-3.5 w-3.5 mr-2" />Update</>
                  : <><Award className="h-3.5 w-3.5 mr-2" />Evaluate</>
              }
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Evaluate Groups" description="Conduct evaluation and submit marks for assigned groups">
        <Button variant="outline" size="sm" onClick={loadData} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </PageHeader>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">No groups assigned</p>
            <p className="text-sm text-muted-foreground mt-2">Contact PMO to get groups assigned for evaluation</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
            <TabsTrigger value="submitted">Evaluated ({submitted.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="pending">
            <div className="grid gap-4 md:grid-cols-2 mt-4">
              {pending.map(g => renderGroupCard(g))}
              {pending.length === 0 && (
                <p className="col-span-2 text-center py-8 text-sm text-muted-foreground">
                  All groups evaluated ✓
                </p>
              )}
            </div>
          </TabsContent>
          <TabsContent value="submitted">
            <div className="grid gap-4 md:grid-cols-2 mt-4">
              {submitted.map(g => renderGroupCard(g))}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {selectedGroup && (
        <EvalDialog
          group={selectedGroup}
          projects={projects}
          onClose={() => setSelectedGroup(null)}
          onComplete={() => { setSelectedGroup(null); loadData(); }}
          backendUrl={backendUrl}
          user={user}
        />
      )}
    </div>
  );
}

export { EvaluateGroups };
