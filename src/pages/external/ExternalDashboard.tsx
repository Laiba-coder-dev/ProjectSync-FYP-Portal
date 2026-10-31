import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatsCard } from '@/components/shared/StatsCard';
import { Users, FileText, Award, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';

export default function ExternalDashboard() {
    const { user } = useAuth();
    const [stats, setStats] = useState({
        assignedGroups: 0,
        pendingEvaluations: 0,
        completedEvaluations: 0,
        totalDocuments: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            fetchStats();
        }
    }, [user]);

    const fetchStats = async () => {
        if (!user) return;

        try {
            // Fetch assigned groups
            const groupsQuery = query(
                collection(db, 'groups'),
                where('externalPanelId', '==', user.id)
            );
            const groupsSnapshot = await getDocs(groupsQuery);
            const assignedGroups = groupsSnapshot.size;
            const groupIds = groupsSnapshot.docs.map(doc => doc.id);

            // Fetch evaluations by this external panel member
            const evaluationsQuery = query(
                collection(db, 'evaluations'),
                where('evaluatorId', '==', user.id)
            );
            const evaluationsSnapshot = await getDocs(evaluationsQuery);
            const completedEvaluations = evaluationsSnapshot.size;
            const pendingEvaluations = assignedGroups - completedEvaluations;

            // Fetch documents from assigned groups
            let totalDocuments = 0;
            if (groupIds.length > 0) {
                const submissionsSnapshot = await getDocs(collection(db, 'submissions'));
                totalDocuments = submissionsSnapshot.docs.filter(doc =>
                    groupIds.includes(doc.data().groupId)
                ).length;
            }

            setStats({
                assignedGroups,
                pendingEvaluations: Math.max(0, pendingEvaluations),
                completedEvaluations,
                totalDocuments
            });
        } catch (error) {
            console.error('Error fetching stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const totalGroupsForProgress = stats.pendingEvaluations + stats.completedEvaluations;
    const rawPercentage = totalGroupsForProgress > 0 
        ? Math.round((stats.completedEvaluations / totalGroupsForProgress) * 100) 
        : 0;
    const safePercentage = Math.max(0, Math.min(100, rawPercentage));

    return (
        <div className="space-y-6">
            <PageHeader
                title="External Panel Dashboard"
                description="View assigned groups and manage evaluations"
            />

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <StatsCard
                            title="Assigned Groups"
                            value={stats.assignedGroups}
                            icon={Users}
                            description="Groups to evaluate"
                        />
                        <StatsCard
                            title="Pending Evaluations"
                            value={stats.pendingEvaluations}
                            icon={Award}
                            description="Not yet evaluated"
                        />
                        <StatsCard
                            title="Completed"
                            value={stats.completedEvaluations}
                            icon={CheckCircle2}
                            description="Evaluations submitted"
                        />
                        <StatsCard
                            title="Documents"
                            value={stats.totalDocuments}
                            icon={FileText}
                            description="Available for review"
                        />
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Quick Actions</CardTitle>
                                <CardDescription>Common evaluation tasks</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-4">
                                <Button asChild className="w-full justify-start" variant="outline">
                                    <Link to="/external/groups">
                                        <Users className="mr-2 h-4 w-4" />
                                        View Assigned Groups
                                    </Link>
                                </Button>
                                <Button asChild className="w-full justify-start" variant="outline">
                                    <Link to="/external/documents">
                                        <FileText className="mr-2 h-4 w-4" />
                                        Review Documents
                                    </Link>
                                </Button>
                                <Button asChild className="w-full justify-start" variant="outline">
                                    <Link to="/external/evaluate">
                                        <Award className="mr-2 h-4 w-4" />
                                        Evaluate Groups
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Evaluation Progress</CardTitle>
                                <CardDescription>Your evaluation status</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {stats.assignedGroups === 0 ? (
                                        <div className="text-center py-4 text-muted-foreground">
                                            <p className="text-sm">No groups assigned yet</p>
                                            <p className="text-xs mt-1">Contact PMO for group assignments</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center justify-between">
                                                <div className="space-y-1">
                                                    <p className="text-sm font-medium">Total Progress</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {stats.completedEvaluations} of {totalGroupsForProgress} groups evaluated
                                                    </p>
                                                </div>
                                                <div className="text-2xl font-bold text-primary">
                                                    {safePercentage}%
                                                </div>
                                            </div>

                                            <div className="w-full bg-secondary rounded-full h-2">
                                                <div
                                                    className="bg-primary h-2 rounded-full transition-all"
                                                    style={{ width: `${safePercentage}%` }}
                                                />
                                            </div>

                                            {stats.pendingEvaluations > 0 && (
                                                <Button asChild className="w-full mt-4">
                                                    <Link to="/external/evaluate">
                                                        Complete Pending Evaluations
                                                        <ArrowRight className="ml-2 h-4 w-4" />
                                                    </Link>
                                                </Button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}
        </div>
    );
}
