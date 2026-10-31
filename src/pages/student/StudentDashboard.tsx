import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Loader2,
  FolderKanban,
  Users,
  UserCheck,
  FileText,
  ChevronRight,
  Bell
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatsCard } from '@/components/shared/StatsCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ProgressTimeline, TimelineItem } from '@/components/shared/ProgressTimeline';
import { useStudentData } from '@/hooks/useStudentData';
import { useAuth } from '@/contexts/AuthContext';

export default function StudentDashboard() {
  const { user } = useAuth();
  const { group, project, supervisor, announcements, milestones, loading } = useStudentData();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const timelineItems: TimelineItem[] = milestones.map(m => ({
    id: m.id,
    title: m.title,
    description: m.description,
    date: m.dueDate,
    status: m.status,
  }));

  return (
    <div className="space-y-6 pb-16 lg:pb-0">
      <PageHeader
        title={`Welcome back, ${user?.name?.split(' ')[0] || 'Student'}!`}
        description="Here's an overview of your FYP progress"
      />

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Project Status"
          value={project?.status ? project.status.charAt(0).toUpperCase() + project.status.slice(1) : 'Not Started'}
          icon={FolderKanban}
          description={project?.title?.substring(0, 30) + '...' || 'Submit your project idea'}
        />
        <StatsCard
          title="Group"
          value={group?.name || 'No Group'}
          icon={Users}
          description={group ? `${group.members.length}/${group.maxMembers} members` : 'Create or join a group'}
        />
        <StatsCard
          title="Supervisor"
          value={supervisor ? 'Assigned' : 'Pending'}
          icon={UserCheck}
          description={supervisor?.name || 'Request a supervisor'}
        />
        <StatsCard
          title="Documents"
          value="0/0"
          icon={FileText}
          description="Submissions completed"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Progress Timeline */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Project Progress</CardTitle>
              <CardDescription>Your milestone timeline</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/student/progress">
                View All <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {timelineItems.length > 0 ? (
              <ProgressTimeline items={timelineItems} />
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-muted-foreground">No milestones yet</p>
                <p className="text-sm text-muted-foreground">Milestones appear after project approval</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Announcements */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Announcements
              </CardTitle>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/student/announcements">
                View All
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {announcements.length > 0 ? (
              announcements.map((announcement) => (
                <div
                  key={announcement.id}
                  className={`rounded-lg border p-3 ${!announcement.isRead ? 'bg-accent/50' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-medium text-sm line-clamp-1">{announcement.title}</h4>
                    <StatusBadge
                      status={announcement.priority === 'high' ? 'pending' : 'upcoming'}
                      showIcon={false}
                      size="sm"
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {announcement.content}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {announcement.publishedAt ? format(announcement.publishedAt instanceof Date ? announcement.publishedAt : new Date((announcement.publishedAt as any).seconds * 1000), 'MMM d, yyyy') : 'Recently'}
                  </p>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No active announcements
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks you might want to do</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {!group && (
              <Button variant="outline" className="h-auto flex-col gap-2 py-4" asChild>
                <Link to="/student/group">
                  <Users className="h-5 w-5" />
                  <span>Create Group</span>
                </Link>
              </Button>
            )}
            {!supervisor && (
              <Button variant="outline" className="h-auto flex-col gap-2 py-4" asChild>
                <Link to="/student/supervisor">
                  <UserCheck className="h-5 w-5" />
                  <span>Request Supervisor</span>
                </Link>
              </Button>
            )}
            {!project && (
              <Button variant="outline" className="h-auto flex-col gap-2 py-4" asChild>
                <Link to="/student/project">
                  <FolderKanban className="h-5 w-5" />
                  <span>Submit Idea</span>
                </Link>
              </Button>
            )}
            <Button variant="outline" className="h-auto flex-col gap-2 py-4" asChild>
              <Link to="/student/documents">
                <FileText className="h-5 w-5" />
                <span>Upload Document</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
