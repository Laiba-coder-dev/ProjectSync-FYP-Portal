import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/PageHeader';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Users, Mail, ExternalLink, Loader2, UserX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSupervisorGroups } from '@/hooks/useSupervisorGroups';
import { DocumentViewerList } from '@/components/shared/DocumentViewerList';

export default function AssignedGroups() {
  const { groups, loading } = useSupervisorGroups();

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Assigned Groups" description="Manage and monitor your supervised student groups" />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Assigned Groups" description="Manage and monitor your supervised student groups" />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <UserX className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No Groups Assigned</p>
            <p className="text-sm text-muted-foreground">You don't have any supervised groups yet</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Assigned Groups" description="Manage and monitor your supervised student groups" />
      <div className="grid gap-6">
        {groups.map((group) => (
          <Card key={group.id}>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">{group.name}<Badge variant="secondary">Active</Badge></CardTitle>
                  <CardDescription>Project ID: {group.projectId || 'Not assigned'}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm"><Mail className="mr-2 h-4 w-4" />Contact</Button>
                  <Button size="sm" asChild><Link to={`/supervisor/groups/${group.id}`}><ExternalLink className="mr-2 h-4 w-4" />View Details</Link></Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2"><Users className="h-4 w-4" />Team Members ({group.members.length}/{group.maxMembers})</h4>
                <div className="flex flex-wrap gap-3">
                  {group.members.map((member) => (
                    <div key={member.userId} className="flex items-center gap-2 p-2 rounded-lg border bg-card">
                      <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">{member?.name?.split(' ').map(n => n[0]).join('') || 'U'}</AvatarFallback></Avatar>
                      <div>
                        <p className="text-sm font-medium">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.enrollmentNumber}</p>
                      </div>
                      {member.role === 'leader' && <Badge variant="secondary" className="text-xs">Leader</Badge>}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-3">Project Progress</h4>
                <Progress value={Math.min(Math.max(group.projectId ? 65 : 0, 0), 100)} className="h-2" />
                <p className="text-xs text-muted-foreground mt-2">{group.projectId ? '65% complete' : 'No project assigned'}</p>
              </div>
              <div className="pt-4 border-t mt-4">
                <DocumentViewerList groupId={group.id} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
