import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatsCard } from '@/components/shared/StatsCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Users, FileText, Clock, CheckCircle, ArrowRight, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSupervisorGroups } from '@/hooks/useSupervisorGroups';
import { useSupervisorSubmissions } from '@/hooks/useSupervisorSubmissions';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function SupervisorDashboard() {
  const { user } = useAuth();
  const { groups, loading: groupsLoading } = useSupervisorGroups();
  const { pendingReviews, loading: submissionsLoading } = useSupervisorSubmissions();
  const [pendingRequests, setPendingRequests] = useState(0);
  const [requestsLoading, setRequestsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchPendingRequests = async () => {
      try {
        const requestsQuery = query(
          collection(db, 'supervisionRequests'),
          where('supervisorId', '==', user.id),
          where('status', '==', 'pending')
        );
        const snapshot = await getDocs(requestsQuery);
        setPendingRequests(snapshot.size);
      } catch (error) {
        console.error('[SUPERVISOR_DASHBOARD] Error fetching requests:', error);
      } finally {
        setRequestsLoading(false);
      }
    };

    fetchPendingRequests();
  }, [user]);

  const loading = groupsLoading || submissionsLoading || requestsLoading;

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Supervisor Dashboard"
          description="Manage your supervision requests, groups, and reviews"
        />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supervisor Dashboard"
        description="Manage your supervision requests, groups, and reviews"
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Assigned Groups" value={groups.length} icon={Users} description="Active groups" />
        <StatsCard title="Pending Requests" value={pendingRequests} icon={Clock} description="Awaiting response" />
        <StatsCard title="Pending Reviews" value={pendingReviews} icon={FileText} description="Documents to review" />
        <StatsCard title="Completed Evaluations" value={0} icon={CheckCircle} description="This semester" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">My Groups</CardTitle>
              <CardDescription>Groups under your supervision</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/supervisor/groups">View All <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {groups.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No groups assigned yet</p>
              ) : (
                groups.slice(0, 3).map((group) => (
                  <div key={group.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div>
                      <p className="font-medium">{group.name}</p>
                      <p className="text-sm text-muted-foreground">{group.members.length} members</p>
                    </div>
                    <Badge variant="secondary">active</Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Pending Reviews</CardTitle>
              <CardDescription>Documents awaiting your review</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/supervisor/documents">View All <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingReviews === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No pending reviews</p>
              ) : (
                <div className="text-center py-4">
                  <p className="text-2xl font-bold">{pendingReviews}</p>
                  <p className="text-sm text-muted-foreground">documents waiting for review</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
