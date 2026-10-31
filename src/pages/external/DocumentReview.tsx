import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { Loader2, Info } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { DocumentViewerList } from '@/components/shared/DocumentViewerList';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function DocumentReview() {
    const { user } = useAuth();
    const [assignedGroupIds, setAssignedGroupIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            fetchAssignedGroups();
        }
    }, [user]);

    const fetchAssignedGroups = async () => {
        if (!user) return;
        setLoading(true);
        try {
            // Fetch groups assigned to this external panel member
            const groupsQuery = query(
                collection(db, 'groups'),
                where('externalPanelId', '==', user.id)
            );

            const groupsSnapshot = await getDocs(groupsQuery);
            const groupIds = groupsSnapshot.docs.map(doc => doc.id);
            setAssignedGroupIds(groupIds);
        } catch (error) {
            console.error('Error fetching assigned groups:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse">Loading assigned project documents...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Document Review"
                description="Review final year project documents from your assigned groups"
            />

            <Alert className="bg-primary/5 border-primary/20">
                <Info className="h-4 w-4 text-primary" />
                <AlertTitle>Assigned Groups</AlertTitle>
                <AlertDescription>
                    You are currently assigned to review documents for {assignedGroupIds.length} project groups.
                </AlertDescription>
            </Alert>

            {assignedGroupIds.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="bg-muted rounded-full p-4 mb-4">
                            <Info className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold">No Assignments Found</h3>
                        <p className="text-muted-foreground max-w-sm">
                            You haven't been assigned any groups for review yet. Please contact the PMO if this is an error.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-10">
                    {assignedGroupIds.map((groupId) => (
                        <div key={groupId} className="space-y-4">
                            <DocumentViewerList groupId={groupId} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
