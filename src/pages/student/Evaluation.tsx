import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { Award, Lock, Eye, Loader2, GraduationCap, TrendingUp } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { EmptyState } from '@/components/shared/EmptyState';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, onSnapshot } from 'firebase/firestore';
import { ComputedScore, LegacyEvaluation } from '@/types';

// ─── Semester helper ──────────────────────────────────────────────────────────

function parseSemesterType(raw: any): 'SEM_7' | 'SEM_8' {
  const s = String(raw ?? '').trim().toUpperCase();
  if (s === '7' || s === 'SEM_7' || s === '7TH' || s.includes('SEMESTER 7') || s.startsWith('7'))
    return 'SEM_7';
  return 'SEM_8';
}

// ─── Score bar component ──────────────────────────────────────────────────────

function ScoreBar({ label, score, max, color }: {
  label: string; score: number; max: number; color: string;
}) {
  const pct = max > 0 ? Math.min((score / max) * 100, 100) : 0;
  const roundedScore = typeof score === 'number' ? score.toFixed(2) : score;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className={`font-mono font-semibold ${color}`}>
          {roundedScore}<span className="text-xs text-muted-foreground font-normal">/{max}</span>
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: `hsl(var(--primary) / 0.8)` }}
        />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Evaluation() {
  const { user } = useAuth();
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

  const [loading, setLoading] = useState(true);
  const [isShared, setIsShared] = useState<boolean | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [groupSemester, setGroupSemester] = useState<any>(null);
  const [computed, setComputed] = useState<ComputedScore | null>(null);
  const [legacy, setLegacy] = useState<LegacyEvaluation | null>(null);

  // ── Step 1: Find group + listen for isMarksShared in real-time ─────────────

  useEffect(() => {
    if (!user) return;
    let unsubscribe: (() => void) | null = null;

    const findGroup = async () => {
      try {
        const gSnap = await getDocs(collection(db, 'groups'));
        const myGroupDoc = gSnap.docs.find(d => {
          const members = d.data().members || [];
          return members.some((m: any) => m.userId === user.id);
        });

        if (!myGroupDoc) {
          setIsShared(false);
          setLoading(false);
          return;
        }

        setGroupId(myGroupDoc.id);
        setGroupSemester(myGroupDoc.data().semester);

        // Real-time listener so it auto-unlocks when Exam Cell publishes
        unsubscribe = onSnapshot(doc(db, 'groups', myGroupDoc.id), (snap) => {
          const shared = snap.data()?.isMarksShared === true;
          setIsShared(shared);
          setLoading(false);
        });
      } catch {
        setIsShared(false);
        setLoading(false);
      }
    };

    findGroup();
    return () => { if (unsubscribe) unsubscribe(); };
  }, [user]);

  // ── Step 2: Fetch evaluation data once marks are shared ────────────────────

  useEffect(() => {
    if (!isShared || !groupId) return;

    const fetchEvaluation = async () => {
      try {
        // Try v2 computed endpoint first
        const idToken = await auth.currentUser?.getIdToken();
        const res = await fetch(`${backendUrl}/api/evaluations/v2/group/${groupId}/computed`, {
          headers: { 'Authorization': `Bearer ${idToken}` }
        });

        if (res.ok) {
          const data = await res.json() as ComputedScore;
          setComputed(data);
        } else {
          // Legacy fallback: read from old evaluations collection
          const legSnap = await getDocs(
            query(collection(db, 'evaluations'), where('groupId', '==', groupId), where('studentId', '==', null))
          );
          if (legSnap.docs.length > 0) {
            setLegacy({ id: legSnap.docs[0].id, ...legSnap.docs[0].data() } as LegacyEvaluation);
          }
        }
      } catch {
        // Last resort: legacy fallback
        try {
          const legSnap = await getDocs(
            query(collection(db, 'evaluations'), where('groupId', '==', groupId), where('studentId', '==', null))
          );
          if (legSnap.docs.length > 0) {
            setLegacy({ id: legSnap.docs[0].id, ...legSnap.docs[0].data() } as LegacyEvaluation);
          }
        } catch { /* nothing */ }
      }
    };

    fetchEvaluation();
  }, [isShared, groupId]);

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  // ── Locked state ───────────────────────────────────────────────────────────

  if (!isShared) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Evaluation" description="View your FYP assessment results" />
        <Card>
          <CardContent className="py-20 flex flex-col items-center gap-4 text-center">
            <div className="p-4 rounded-full bg-muted/60">
              <Lock className="h-10 w-10 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Results Not Yet Published</h3>
              <p className="text-muted-foreground text-sm mt-1 max-w-xs">
                Your evaluation results are being compiled. This page will unlock automatically
                once the Exam Cell publishes your marks.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Results view ───────────────────────────────────────────────────────────

  const semType = parseSemesterType(groupSemester);
  const isSem7 = semType === 'SEM_7';
  const myStudentData = computed?.students?.find(s => s.studentId === user?.id);

  return (
    <div className="space-y-6">
      <PageHeader title="My Evaluation" description="Your official FYP assessment results" />

      {/* Semester badge */}
      <div className="flex items-center gap-3">
        <Badge variant="outline" className="gap-1.5 text-sm px-3 py-1">
          <GraduationCap className="h-4 w-4" />
          {isSem7 ? 'FYP-1 (Semester 7)' : 'FYP-2 (Semester 8)'} — Internal {isSem7 ? '1' : '2'}
          {!isSem7 && ' + External'}
        </Badge>
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 gap-1.5">
          <TrendingUp className="h-3.5 w-3.5" /> Published
        </Badge>
      </div>

      {computed && myStudentData ? (
        <>
          {/* Total score hero card */}
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Total Score</p>
                  <div className="flex items-end gap-1 mt-1">
                    <span className="text-5xl font-bold text-primary">{myStudentData.grandTotal.toFixed(2)}</span>
                    <span className="text-xl text-muted-foreground mb-1">/100</span>
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-primary/10">
                  <Award className="h-12 w-12 text-primary" />
                </div>
              </div>
              <div className="mt-4">
                <Progress value={Math.min(Math.max(myStudentData.grandTotal, 0), 100)} className="h-3" />
              </div>
            </CardContent>
          </Card>

          {/* Breakdown cards */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* SEM_7 breakdown */}
            {isSem7 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Internal 1 Breakdown</CardTitle>
                  <CardDescription>Semester 7 — Total /100</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ScoreBar label="PMO Compliance" score={myStudentData.pmoScore} max={5} color="text-primary" />
                  <ScoreBar label="Supervisor Assessment" score={myStudentData.supervisorScore} max={30} color="text-primary" />
                  <ScoreBar
                    label={`Panel Evaluation (${myStudentData.breakdown.panelSubmissionsCount} evaluator${myStudentData.breakdown.panelSubmissionsCount !== 1 ? 's' : ''}, averaged)`}
                    score={myStudentData.panelAvg}
                    max={65}
                    color="text-primary"
                  />
                  <div className="border-t pt-3">
                    <ScoreBar label="Total" score={myStudentData.grandTotal} max={100} color="text-primary font-bold" />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* SEM_8 breakdown */}
            {!isSem7 && (
              <>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Internal 2</CardTitle>
                    <CardDescription>Semester 8 — PMO + Supervisor + Panel</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ScoreBar label="PMO Compliance" score={myStudentData.pmoScore} max={5} color="text-primary" />
                    <ScoreBar label="Supervisor Assessment" score={myStudentData.supervisorScore} max={10} color="text-primary" />
                    <ScoreBar
                      label={`Panel Avg (${myStudentData.breakdown.panelSubmissionsCount} members)`}
                      score={myStudentData.panelAvg}
                      max={35}
                      color="text-primary"
                    />
                    <div className="border-t pt-3">
                      <ScoreBar label="Internal 2 Subtotal" score={myStudentData.internalTotal} max={50} color="text-primary font-bold" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">External Evaluation</CardTitle>
                    <CardDescription>Semester 8 — External Examiner</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ScoreBar label="External Score" score={myStudentData.externalScore} max={50} color="text-primary" />
                    <div className="border-t pt-3">
                      <ScoreBar label="Grand Total" score={myStudentData.grandTotal} max={100} color="text-primary font-bold" />
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Individual panel member scores */}
            {computed.panelScores && computed.panelScores.length > 0 && (
              <Card className="md:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Panel Member Scores (Averaged)</CardTitle>
                  <CardDescription>Individual marks from each panel member</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {computed.allScores.filter(s => s.studentId === user?.id && s.evaluatorRole.includes('PANEL')).map((ps: any, i: number) => (
                      <div key={i} className="rounded-lg border bg-muted/30 p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">
                          {ps.evaluatorName || `Panel Member ${i + 1}`}
                        </p>
                        <p className="text-2xl font-bold text-primary">{ps.score}</p>
                        <p className="text-xs text-muted-foreground">
                          /{isSem7 ? 65 : 35}
                        </p>
                      </div>
                    ))}
                    <div className="rounded-lg border bg-primary/10 p-3 text-center col-span-1">
                      <p className="text-xs text-primary/70 font-medium mb-1">Average</p>
                      <p className="text-2xl font-bold text-primary">{myStudentData.panelAvg.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">/{isSem7 ? 65 : 35}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      ) : legacy ? (
        // ── Legacy fallback display ───────────────────────────────────────────
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Evaluation Results</CardTitle>
              <Badge variant="outline" className="text-xs gap-1">
                <Eye className="h-3 w-3" /> Legacy Format
              </Badge>
            </div>
            <CardDescription>
              These results are from the archived evaluation system (read-only).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div>
                <p className="text-sm text-muted-foreground">Total Score</p>
                <p className="text-3xl font-bold text-primary">{legacy.totalMarks}<span className="text-lg text-muted-foreground font-normal">/100</span></p>
              </div>
              <Award className="h-8 w-8 text-primary/50" />
            </div>
            {legacy.marks && Object.entries(legacy.marks).map(([key, val]) => (
              <ScoreBar key={key} label={key.charAt(0).toUpperCase() + key.slice(1)} score={Number(val)} max={25} color="text-primary" />
            ))}
            {legacy.feedback && (
              <div className="rounded-lg bg-muted/30 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Evaluator Feedback</p>
                <p>{legacy.feedback}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          icon={Award}
          title="Evaluation Data Loading"
          description="Your results have been published. Please wait a moment and refresh."
        />
      )}
    </div>
  );
}
