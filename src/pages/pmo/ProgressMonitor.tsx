import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, FileText } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { toast } from 'sonner';
import { DocumentViewerList } from '@/components/shared/DocumentViewerList';

interface GroupProgress {
    id: string;
    name: string;
    projectTitle?: string;
    projectStatus?: string;
    progress: number;
}

export default function ProgressMonitor() {
    const [groups, setGroups] = useState<GroupProgress[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDocsGroup, setSelectedDocsGroup] = useState<GroupProgress | null>(null);

    useEffect(() => {
        fetchGroupProgress();
    }, []);

    const fetchGroupProgress = async () => {
        setLoading(true);
        try {
            const groupsSnapshot = await getDocs(collection(db, 'groups'));

            const groupsList: GroupProgress[] = groupsSnapshot.docs.map(doc => {
                const data = doc.data();

                // Calculate progress based on project status
                let progress = 0;
                if (data.projectIdea) {
                    if (data.projectIdea.status === 'submitted') progress = 25;
                    if (data.projectIdea.status === 'approved') progress = 45;
                }

                return {
                    id: doc.id,
                    name: data.name || 'Unnamed Group',
                    projectTitle: data.projectIdea?.title,
                    projectStatus: data.projectIdea?.status,
                    progress
                };
            });

            setGroups(groupsList);
        } catch (error) {
            console.error('Error fetching group progress:', error);
            toast.error('Failed to load progress data');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader title="Progress Monitor" description="Track progress of all project groups across milestones" />

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <div className="grid gap-4">
                    {groups.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            No groups found
                        </div>
                    ) : (
                        groups.map(group => (
                            <Card key={group.id}>
                                <CardContent className="p-6">
                                    <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
                                        <div>
                                            <h3 className="font-semibold text-lg">{group.name}</h3>
                                            <p className="text-sm text-muted-foreground">
                                                {group.projectTitle || 'No Project Started'}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button variant="outline" size="sm" onClick={() => setSelectedDocsGroup(group)}>
                                                <FileText className="h-4 w-4 mr-2" /> Documents
                                            </Button>
                                            <Badge variant={group.projectStatus === 'approved' ? 'default' : 'secondary'}>
                                                {group.projectStatus?.toUpperCase() || 'NO STATUS'}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span>Completion Progress</span>
                                            <span className="font-medium">{group.progress}%</span>
                                        </div>
                                        <Progress value={Math.min(Math.max(group.progress, 0), 100)} className="h-2" />
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            )}
            
            {selectedDocsGroup && (
                <Dialog open={!!selectedDocsGroup} onOpenChange={(open) => !open && setSelectedDocsGroup(null)}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{selectedDocsGroup.name} Documents</DialogTitle>
                            <DialogDescription>Review documents submitted by this group.</DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                            <DocumentViewerList groupId={selectedDocsGroup.id} />
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
