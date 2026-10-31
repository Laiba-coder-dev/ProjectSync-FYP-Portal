import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FileText, Download, CheckCircle, XCircle, Eye, Clock, Calendar, Users, Loader2, FileQuestion, Sparkles, ThumbsUp, ThumbsDown, Lightbulb } from 'lucide-react';
import { Submission, DocumentStatus } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useSupervisorSubmissions } from '@/hooks/useSupervisorSubmissions';
import { db, auth } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { createNotification } from '@/lib/services';
import { DocumentViewerList } from '@/components/shared/DocumentViewerList';


export default function DocumentReview() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { submissions, loading } = useSupervisorSubmissions();
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<Record<string, any>>({});
  const [loadingFeedback, setLoadingFeedback] = useState<string | null>(null);

  const pendingSubmissions = submissions.filter(s => s.status === 'uploaded');
  const reviewedSubmissions = submissions.filter(s => s.status === 'approved' || s.status === 'rejected');

  const handleAction = (submission: Submission, action: 'approve' | 'reject') => {
    setSelectedSubmission(submission);
    setActionType(action);
    setFeedback('');
  };

  const confirmAction = async () => {
    if (!selectedSubmission || !actionType || !user) return;

    try {
      setSubmitting(true);
      console.log('[DOCUMENT_REVIEW] Updating submission:', selectedSubmission.id, 'Action:', actionType);

      const submissionRef = doc(db, 'submissions', selectedSubmission.id);
      const newStatus: DocumentStatus = actionType === 'approve' ? 'approved' : 'rejected';

      await updateDoc(submissionRef, {
        status: newStatus,
        reviewedBy: user.id,
        reviewedAt: serverTimestamp(),
        feedback: feedback.trim() || undefined,
      });

      console.log('[DOCUMENT_REVIEW] Submission updated successfully');

      // Notify the student who submitted the document
      try {
        await createNotification({
          userId: selectedSubmission.submittedBy,
          type: 'document_feedback',
          title: actionType === 'approve'
            ? '✅ Document Approved'
            : '❌ Document Needs Revision',
          message: actionType === 'approve'
            ? `Your "${selectedSubmission.title}" has been approved by your supervisor.`
            : `Your "${selectedSubmission.title}" needs revision. Feedback: ${feedback.trim() || 'See documents page.'}`,
          link: '/student/documents',
        });
      } catch (notifErr) {
        console.error('[DOCUMENT_REVIEW] Notification failed:', notifErr);
      }
      toast({
        title: actionType === 'approve' ? 'Document Approved' : 'Document Rejected',
        description: `${selectedSubmission.title} has been ${actionType === 'approve' ? 'approved' : 'rejected'}.`,
      });

      setSelectedSubmission(null);
      setActionType(null);
      setFeedback('');
      // No page reload — useSupervisorSubmissions will reflect the change
      // on the next re-render since submissions is updated optimistically below
    } catch (error) {
      console.error('[DOCUMENT_REVIEW] Error updating submission:', error);
      toast({
        title: 'Error',
        description: 'Failed to update document. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleGetAIFeedback = async (submission: Submission) => {
    setLoadingFeedback(submission.id);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
      const response = await fetch(`${backendUrl}/api/ai/generate-feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          title: submission.title,
          abstract: submission.description || submission.title,
          milestoneType: submission.milestoneType
        })
      });

      if (!response.ok) throw new Error('Failed to get AI feedback');

      const data = await response.json();
      setAiFeedback(prev => ({ ...prev, [submission.id]: data }));
      toast({ title: 'AI Analysis Complete', description: 'Smart feedback has been generated.' });
    } catch (error: any) {
      console.error('AI feedback error:', error);
      toast({ title: 'AI Error', description: 'Failed to generate smart feedback.', variant: 'destructive' });
    } finally {
      setLoadingFeedback(null);
    }
  };

  const SubmissionCard = ({ submission }: { submission: Submission }) => {
    const feedback = aiFeedback[submission.id];
    return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><FileText className="h-5 w-5 text-primary" /></div>
              <div>
                <h4 className="font-semibold">{submission.title}</h4>
                <p className="text-sm text-muted-foreground">Version {submission.version} • {submission.milestoneType}</p>
              </div>
            </div>
            <StatusBadge status={submission.status} />
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Users className="h-4 w-4" />{submission.groupId}</span>
            <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />{new Date(submission.submittedAt).toLocaleDateString()}</span>
            <Badge variant="outline">{submission.milestoneType}</Badge>
          </div>
          {submission.feedback && (
            <div className="p-3 rounded-lg bg-muted/50 border">
              <h4 className="text-sm font-medium mb-1">Feedback</h4>
              <p className="text-sm">{submission.feedback}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" size="sm" asChild>
              <a href={submission.fileUrl} target="_blank" rel="noopener noreferrer">
                <Eye className="mr-2 h-4 w-4" />Preview
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={submission.fileUrl} download>
                <Download className="mr-2 h-4 w-4" />Download
              </a>
            </Button>
            {submission.status === 'uploaded' && (
              <>
                <Button size="sm" variant="outline" onClick={() => handleGetAIFeedback(submission)} disabled={loadingFeedback === submission.id || !!feedback}>
                  {loadingFeedback === submission.id ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing...</>
                  ) : (
                    <><Sparkles className="mr-2 h-4 w-4 text-amber-500" />Smart Assist</>
                  )}
                </Button>
                <Button size="sm" onClick={() => handleAction(submission, 'approve')}><CheckCircle className="mr-2 h-4 w-4" />Approve</Button>
                <Button variant="destructive" size="sm" onClick={() => handleAction(submission, 'reject')}><XCircle className="mr-2 h-4 w-4" />Reject</Button>
              </>
            )}
          </div>

          {/* AI Project Quality Analyzer Panel */}
          {feedback && (
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 p-4 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">Project Quality Analyzer</span>
                <Badge variant={feedback.decision?.status === 'READY FOR REVIEW' ? 'default' : 'destructive'} className="ml-auto text-xs">
                  {feedback.decision?.status || 'ANALYZED'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground italic font-medium">Recommendation: {feedback.decision?.action}</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Idea Analysis */}
                {feedback.idea_analysis && (
                  <div className="bg-white/50 dark:bg-black/20 p-3 rounded-lg border border-amber-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Lightbulb className="h-4 w-4 text-yellow-600" />
                      <span className="text-xs font-semibold">Idea & Title Analysis</span>
                      <span className="text-xs ml-auto font-bold">{feedback.idea_analysis.score}/10</span>
                    </div>
                    <ul className="text-xs space-y-1 list-disc pl-4 text-muted-foreground">
                      {feedback.idea_analysis.feedback?.map((f: string, i: number) => <li key={i}>{f}</li>)}
                    </ul>
                  </div>
                )}

                {/* Document Structure */}
                {feedback.document_structure && (
                  <div className="bg-white/50 dark:bg-black/20 p-3 rounded-lg border border-amber-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-blue-600" />
                      <span className="text-xs font-semibold">Document Structure</span>
                      <span className="text-xs ml-auto font-bold">{feedback.document_structure.completeness}%</span>
                    </div>
                    {feedback.document_structure.missing?.length > 0 && (
                       <p className="text-xs text-red-500 mb-1">Missing: {feedback.document_structure.missing.join(', ')}</p>
                    )}
                    <ul className="text-xs space-y-1 list-disc pl-4 text-muted-foreground">
                      {feedback.document_structure.feedback?.map((f: string, i: number) => <li key={i}>{f}</li>)}
                    </ul>
                  </div>
                )}

                {/* Content Quality */}
                {feedback.content_quality && (
                  <div className="bg-white/50 dark:bg-black/20 p-3 rounded-lg border border-amber-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <ThumbsUp className="h-4 w-4 text-green-600" />
                      <span className="text-xs font-semibold">Content Quality</span>
                      <span className="text-xs ml-auto font-bold">{feedback.content_quality.score}/10</span>
                    </div>
                    <ul className="text-xs space-y-1 list-disc pl-4 text-muted-foreground">
                      {feedback.content_quality.feedback?.map((f: string, i: number) => <li key={i}>{f}</li>)}
                    </ul>
                  </div>
                )}

                {/* Grammar Check */}
                {feedback.grammar_check && (
                  <div className="bg-white/50 dark:bg-black/20 p-3 rounded-lg border border-amber-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <span className="text-xs font-semibold">Grammar & Syntax</span>
                      <Badge variant="outline" className="ml-auto text-[10px] h-4">{feedback.grammar_check.status}</Badge>
                    </div>
                    <ul className="text-xs space-y-1 list-disc pl-4 text-muted-foreground">
                      {feedback.grammar_check.issues?.length > 0 
                        ? feedback.grammar_check.issues.map((iss: string, i: number) => <li key={i}>{iss}</li>)
                        : <li>No major issues found.</li>}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Document Review" description="Review submitted documents from your supervised groups" />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Document Review" description="Review submitted documents from your supervised groups" />
      <div className="flex gap-2 flex-wrap">
        <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> {pendingSubmissions.length} Pending</Badge>
        <Badge variant="outline" className="gap-1 text-status-approved"><CheckCircle className="h-3 w-3" /> {reviewedSubmissions.filter(s => s.status === 'approved').length} Approved</Badge>
      </div>
      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList><TabsTrigger value="pending">Pending ({pendingSubmissions.length})</TabsTrigger><TabsTrigger value="reviewed">Reviewed ({reviewedSubmissions.length})</TabsTrigger></TabsList>
        <TabsContent value="pending">
          {pendingSubmissions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileQuestion className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No Pending Submissions</p>
                <p className="text-sm text-muted-foreground">All documents have been reviewed</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">{pendingSubmissions.map(s => <SubmissionCard key={s.id} submission={s} />)}</div>
          )}
        </TabsContent>
        <TabsContent value="reviewed">
          {reviewedSubmissions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileQuestion className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No Reviewed Submissions</p>
                <p className="text-sm text-muted-foreground">No documents have been reviewed yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">{reviewedSubmissions.map(s => <SubmissionCard key={s.id} submission={s} />)}</div>
          )}
        </TabsContent>
      </Tabs>
      <Dialog open={!!selectedSubmission && !!actionType} onOpenChange={() => setSelectedSubmission(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionType === 'approve' ? 'Approve' : 'Reject'} Document</DialogTitle>
            <DialogDescription>
              {actionType === 'approve'
                ? 'Approve this document submission.'
                : 'Reject this document and provide feedback for improvement.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedSubmission?.groupId && (
              <div className="border rounded-lg p-4 bg-muted/20">
                <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Group Document History
                </h4>
                <DocumentViewerList groupId={selectedSubmission.groupId} />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="feedback">Feedback {actionType === 'reject' && '(Required)'}</Label>
            <Textarea
              id="feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Provide feedback..."
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedSubmission(null)} disabled={submitting}>Cancel</Button>
            <Button
              variant={actionType === 'reject' ? 'destructive' : 'default'}
              onClick={confirmAction}
              disabled={submitting || (actionType === 'reject' && !feedback.trim())}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {actionType === 'approve' ? 'Approving...' : 'Rejecting...'}
                </>
              ) : (
                actionType === 'approve' ? 'Approve' : 'Reject'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
