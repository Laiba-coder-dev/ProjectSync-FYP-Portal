import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { ProgressTimeline, TimelineItem } from '@/components/shared/ProgressTimeline';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useStudentData } from '@/hooks/useStudentData';
import { useMilestones } from '@/hooks/useMilestones';
import { BarChart3, Calendar, Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { format, differenceInDays, isBefore } from 'date-fns';
import { Progress } from '@/components/ui/progress';
import { EmptyState } from '@/components/shared/EmptyState';
import { FolderKanban } from 'lucide-react';
import { DocumentViewerList } from '@/components/shared/DocumentViewerList';

export default function ProgressTracking() {
  const { group, project, loading: dataLoading } = useStudentData();
  const { milestones, loading: milestonesLoading } = useMilestones(project?.id);

  const isLoading = dataLoading || milestonesLoading;

  const completedMilestones = milestones.filter(m => m.status === 'completed').length;
  const totalMilestones = milestones.length;
  const progressPercentage = totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0;

  // Find next deadline
  const upcomingMilestone = milestones.find(m => m.status === 'upcoming' || m.status === 'in_progress');
  const daysUntilDeadline = upcomingMilestone
    ? differenceInDays(upcomingMilestone.dueDate, new Date())
    : null;

  const timelineItems: TimelineItem[] = milestones.map(m => ({
    id: m.id,
    title: m.title,
    description: m.description,
    date: m.dueDate,
    status: m.status,
  }));

  if (isLoading) {
    return (
      <div className="space-y-6 pb-16 lg:pb-0">
        <PageHeader
          title="Progress Tracking"
          description="Track your project milestones and deadlines"
        />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!group || !project) {
    return (
      <div className="space-y-6 pb-16 lg:pb-0">
        <PageHeader
          title="Progress Tracking"
          description="Track your project milestones and deadlines"
        />
        <EmptyState
          icon={FolderKanban}
          title="No project found"
          description="You need to be part of a group with an approved project to track progress"
          action={{
            label: 'Go to Project Idea',
            onClick: () => window.location.href = '/student/project-idea',
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16 lg:pb-0">
      <PageHeader
        title="Progress Tracking"
        description="Track your project milestones and deadlines"
      />

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{Math.round(progressPercentage)}%</p>
                <p className="text-sm text-muted-foreground">Overall Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completedMilestones}/{totalMilestones}</p>
                <p className="text-sm text-muted-foreground">Milestones Done</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {daysUntilDeadline !== null ? `${daysUntilDeadline}d` : 'N/A'}
                </p>
                <p className="text-sm text-muted-foreground">Until Next Deadline</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10">
                <Calendar className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {upcomingMilestone ? format(upcomingMilestone.dueDate, 'MMM d') : 'N/A'}
                </p>
                <p className="text-sm text-muted-foreground">Next Deadline</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Project Completion</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span className="font-medium">{Math.round(progressPercentage)}%</span>
            </div>
            <Progress value={Math.min(Math.max(progressPercentage, 0), 100)} className="h-3" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Milestone Timeline</CardTitle>
            <CardDescription>Your project journey</CardDescription>
          </CardHeader>
          <CardContent>
            {timelineItems.length > 0 ? (
              <ProgressTimeline items={timelineItems} />
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No milestones available</p>
                <p className="text-sm text-muted-foreground">Milestones will be created when your project is approved</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Milestone Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Milestone Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {milestones.length > 0 ? (
              milestones.map((milestone) => (
                <div
                  key={milestone.id}
                  className="flex items-start justify-between rounded-lg border p-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{milestone.title}</h4>
                      <StatusBadge status={milestone.status} size="sm" />
                    </div>
                    <p className="text-sm text-muted-foreground">{milestone.description}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Due: {format(milestone.dueDate, 'MMM d, yyyy')}
                      </span>
                      {milestone.completedAt && (
                        <span className="flex items-center gap-1 text-success">
                          <CheckCircle2 className="h-3 w-3" />
                          Completed: {format(milestone.completedAt, 'MMM d, yyyy')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No milestones available</p>
                <p className="text-sm text-muted-foreground">Milestones will be created when your project is approved</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <DocumentViewerList groupId={group.id} />
      </div>
    </div>
  );
}
