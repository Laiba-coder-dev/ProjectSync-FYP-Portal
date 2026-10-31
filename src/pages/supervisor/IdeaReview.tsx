import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Lightbulb, CheckCircle, XCircle, Loader2, FileQuestion } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSupervisorProjects } from '@/hooks/useSupervisorProjects';
import { db } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { Project } from '@/types';

export default function IdeaReview() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { pendingProjects, reviewedProjects, loading, refetch } = useSupervisorProjects();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const confirmAction = async () => {
    if (!selectedProject || !actionType || !user) return;

    try {
      setSubmitting(true);
      console.log('[IDEA_REVIEW] Updating project:', selectedProject.id, 'Action:', actionType);

      const projectRef = doc(db, 'projects', selectedProject.id);
      const updateData: any = {
        status: actionType === 'approve' ? 'approved' : 'rejected',
        updatedAt: serverTimestamp(),
      };

      if (actionType === 'approve') {
        updateData.approvedAt = serverTimestamp();
      }

      if (feedback.trim()) {
        updateData.feedback = feedback.trim();
      }

      await updateDoc(projectRef, updateData);

      console.log('[IDEA_REVIEW] Project updated successfully');
      toast({
        title: actionType === 'approve' ? 'Project Approved' : 'Project Rejected',
        description: `${selectedProject.title} has been ${actionType === 'approve' ? 'approved' : 'rejected'}.`,
      });

      setSelectedProject(null);
      setActionType(null);
      setFeedback('');

      // Trigger refetch instead of full page reload
      if (refetch) refetch();
    } catch (error) {
      console.error('[IDEA_REVIEW] Error updating project:', error);
      toast({
        title: 'Error',
        description: 'Failed to update project. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const IdeaCard = ({ project }: { project: any }) => (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              {project.title}
              <StatusBadge status={project.status} />
            </CardTitle>
            <CardDescription className="mt-1">
              <div className="flex items-center gap-4 text-sm">
                <span>{project.groupName || 'Unknown Group'}</span>
                <span>•</span>
                <span>{project.domain}</span>
              </div>
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="text-sm font-medium mb-2">Abstract</h4>
          <p className="text-sm text-muted-foreground">{project.abstract}</p>
        </div>
        {project.feedback && (
          <div className="p-3 rounded-lg bg-muted/50 border">
            <h4 className="text-sm font-medium mb-1">Feedback</h4>
            <p className="text-sm">{project.feedback}</p>
          </div>
        )}
        {project.status === 'submitted' && (
          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => {
                setSelectedProject(project);
                setActionType('approve');
                setFeedback('');
              }}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Approve
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setSelectedProject(project);
                setActionType('reject');
                setFeedback('');
              }}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Idea Review" description="Review project ideas from your supervised groups" />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Idea Review" description="Review project ideas from your supervised groups" />
      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pendingProjects.length})</TabsTrigger>
          <TabsTrigger value="reviewed">Reviewed ({reviewedProjects.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="space-y-4">
          {pendingProjects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileQuestion className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No Pending Projects</p>
                <p className="text-sm text-muted-foreground">All project ideas have been reviewed</p>
              </CardContent>
            </Card>
          ) : (
            pendingProjects.map(project => <IdeaCard key={project.id} project={project} />)
          )}
        </TabsContent>
        <TabsContent value="reviewed" className="space-y-4">
          {reviewedProjects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileQuestion className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No Reviewed Projects</p>
                <p className="text-sm text-muted-foreground">No projects have been reviewed yet</p>
              </CardContent>
            </Card>
          ) : (
            reviewedProjects.map(project => <IdeaCard key={project.id} project={project} />)
          )}
        </TabsContent>
      </Tabs>
      <Dialog open={!!selectedProject && !!actionType} onOpenChange={() => setSelectedProject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionType === 'approve' ? 'Approve' : 'Reject'} Project Idea</DialogTitle>
            <DialogDescription>
              {actionType === 'approve'
                ? 'Approve this project idea and allow the group to proceed.'
                : 'Reject this project idea and provide feedback for improvement.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Label htmlFor="feedback">Feedback {actionType === 'reject' && '(Required)'}</Label>
            <Textarea
              id="feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Provide feedback to the group..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedProject(null)} disabled={submitting}>
              Cancel
            </Button>
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
