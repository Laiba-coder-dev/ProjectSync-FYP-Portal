import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getCountFromServer, query, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { Users, Layers, Clock } from 'lucide-react';

export default function AdminDashboard() {
    const [userCount, setUserCount] = useState<number>(0);
    const [groupCount, setGroupCount] = useState<number>(0);
    const [pendingCount, setPendingCount] = useState<number>(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // Fetch User Count
                const usersSnapshot = await getCountFromServer(collection(db, 'users'));
                setUserCount(usersSnapshot.data().count);

                // Fetch Group Count
                const groupsSnapshot = await getCountFromServer(collection(db, 'groups'));
                setGroupCount(groupsSnapshot.data().count);

                // Fetch Pending Approvals Count
                const pendingQuery = query(collection(db, 'supervisionRequests'), where('status', '==', 'pending'));
                const pendingSnapshot = await getCountFromServer(pendingQuery);
                setPendingCount(pendingSnapshot.data().count);

            } catch (error) {
                console.error("Error fetching admin stats:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    return (
        <div className="space-y-6">
            <PageHeader title="Admin Dashboard" description="System administration and configuration" />

            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Active Groups</CardTitle>
                        <Layers className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{loading ? "..." : groupCount}</div>
                        <p className="text-xs text-muted-foreground">Formed groups</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {loading ? "..." : userCount}
                        </div>
                        <p className="text-xs text-muted-foreground">Registered users</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
                        <Clock className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{loading ? "..." : pendingCount}</div>
                        <p className="text-xs text-muted-foreground">Supervision requests</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
