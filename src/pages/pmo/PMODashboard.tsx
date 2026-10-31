import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatsCard } from '@/components/shared/StatsCard';
import { FolderGit2, Users, FileCheck, CheckCircle2, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

export default function PMODashboard() {
  const [stats, setStats] = useState({
    totalProjects: 0,
    pendingApprovals: 0,
    activeGroups: 0,
    completedProjects: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Fetch all groups
      const groupsSnapshot = await getDocs(collection(db, 'groups'));
      const groups = groupsSnapshot.docs.map(d => d.data());

      const totalProjects = groups.filter(g => g.projectIdea).length;
      const pendingApprovals = groups.filter(g => g.projectIdea?.status === 'submitted').length;
      const activeGroups = groups.length;
      const completedProjects = 0; // TODO: Add completion tracking

      setStats({ totalProjects, pendingApprovals, activeGroups, completedProjects });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="PMO Dashboard"
        description="Department overview and project management"
      />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard title="Total Projects" value={stats.totalProjects} icon={FolderGit2} description="All sessions" />
            <StatsCard title="Pending Approvals" value={stats.pendingApprovals} icon={FileCheck} description="Needs review" />
            <StatsCard title="Active Groups" value={stats.activeGroups} icon={Users} description="Currently active" />
            <StatsCard title="Completed" value={stats.completedProjects} icon={CheckCircle2} description="Successfully finished" />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common management tasks</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <Button asChild className="w-full justify-start" variant="outline">
                  <Link to="/pmo/approvals">
                    <FileCheck className="mr-2 h-4 w-4" />
                    Review Project Proposals
                  </Link>
                </Button>
                <Button asChild className="w-full justify-start" variant="outline">
                  <Link to="/pmo/users">
                    <Users className="mr-2 h-4 w-4" />
                    Manage Users
                  </Link>
                </Button>
                <Button asChild className="w-full justify-start" variant="outline">
                  <Link to="/pmo/groups">
                    <FolderGit2 className="mr-2 h-4 w-4" />
                    View All Groups
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest system updates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <div>
                      <p className="text-sm font-medium">System active</p>
                      <p className="text-xs text-muted-foreground">{stats.activeGroups} groups working</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                    <div>
                      <p className="text-sm font-medium">Pending reviews</p>
                      <p className="text-xs text-muted-foreground">{stats.pendingApprovals} proposals awaiting approval</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
