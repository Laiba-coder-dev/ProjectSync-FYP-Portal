import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, FileText, Search, Filter, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { createNotification } from '@/lib/services';

interface Project {
    id: string;
    title: string;
    abstract: string;
    domain: string;
    status: 'submitted' | 'approved' | 'rejected';
    groupId: string;
    groupName?: string;
    rejectionReason?: string;
}

export default function ProjectApproval() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedProject, setSelectedProject] = useState<any>(null);
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        setLoading(true);
        try {
            // Fetch all groups with project ideas
            const groupsQuery = query(collection(db, 'groups'));
            const groupsSnapshot = await getDocs(groupsQuery);

            const projectsList: Project[] = [];

            for (const groupDoc of groupsSnapshot.docs) {
                const groupData = groupDoc.data();

                // Check if group has a project idea
                if (groupData.projectIdea) {
                    projectsList.push({
                        id: groupDoc.id,
                        title: groupData.projectIdea.title || 'Untitled Project',
                        abstract: groupData.projectIdea.description || 'No description provided',
                        domain: groupData.projectIdea.domain || 'General',
                        status: groupData.projectIdea.status || 'submitted',
                        groupId: groupDoc.id,
                        groupName: groupData.name || 'Unknown Group',
                        rejectionReason: groupData.projectIdea.rejectionReason
                    });
                }
            }

            setProjects(projectsList);
        } catch (error) {
            console.error('Error fetching projects:', error);
            toast.error('Failed to load projects');
        } finally {
            setLoading(false);
        }
    };

    const pendingProjects = projects.filter(p =>
        p.status === 'submitted' &&
        (searchTerm === '' ||
            p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.groupName?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleApprove = async (projectId: string) => {
        try {
            await updateDoc(doc(db, 'groups', projectId), {
                'projectIdea.status': 'approved'
            });

            setProjects(prev => prev.map(p =>
                p.id === projectId ? { ...p, status: 'approved' as const } : p
            ));

            // Notify all group members
            try {
                const groupSnap = await getDoc(doc(db, 'groups', projectId));
                if (groupSnap.exists()) {
                    const members: any[] = groupSnap.data().members || [];
                    await Promise.all(members.map(m =>
                        createNotification({
                            userId: m.userId,
                            type: 'project_approved',
                            title: '?? Project Approved!',
                            message: 'Your project proposal has been approved by the PMO. You can now proceed.',
                            link: '/student/project',
                        })
                    ));
                }
            } catch (notifErr) {
                console.error('Approval notification failed:', notifErr);
            }

            toast.success('Project approved successfully');
        } catch (error) {
            console.error('Error approving project:', error);
            toast.error('Failed to approve project');
        }
    };

    const handleRejectClick = (project: any) => {
        setSelectedProject(project);
        setRejectDialogOpen(true);
    };

    const confirmReject = async () => {
        if (!selectedProject || !rejectionReason.trim()) {
            toast.error('Please provide a rejection reason');
            return;
        }

        try {
            await updateDoc(doc(db, 'groups', selectedProject.id), {
                'projectIdea.status': 'rejected',
                'projectIdea.rejectionReason': rejectionReason
            });

            setProjects(prev => prev.map(p =>
                p.id === selectedProject.id ? { ...p, status: 'rejected' as const, rejectionReason } : p
            ));

            // Notify all group members
            try {
                const groupSnap = await getDoc(doc(db, 'groups', selectedProject.id));
                if (groupSnap.exists()) {
                    const members: any[] = groupSnap.data().members || [];
                    await Promise.all(members.map(m =>
                        createNotification({
                            userId: m.userId,
                            type: 'project_rejected',
                            title: '? Project Proposal Rejected',
                            message: `Your project was rejected. Reason: ${rejectionReason}`,
                            link: '/student/project',
                        })
                    ));
                }
            } catch (notifErr) {
                console.error('Rejection notification failed:', notifErr);
            }

            toast.warning('Project rejected');
            setRejectDialogOpen(false);
            setRejectionReason('');
            setSelectedProject(null);
        } catch (error) {
            console.error('Error rejecting project:', error);
            toast.error('Failed to reject project');
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader title="Project Approval" description="Review and approve project ideas submitted by student groups" />

            <div className="flex gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search projects..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <div className="grid gap-4">
                    {pendingProjects.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">No pending project proposals found.</div>
                    ) : (
                        pendingProjects.map(project => (
                            <Card key={project.id}>
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <CardTitle>{project.title}</CardTitle>
                                            <CardDescription>{project.groupName} • {project.domain}</CardDescription>
                                        </div>
                                        <StatusBadge status={project.status} />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        <div className="bg-muted p-4 rounded-md">
                                            <p className="text-sm">{project.abstract}</p>
                                        </div>
                                        <div className="flex justify-end gap-3">
                                            <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => handleRejectClick(project)}>
                                                <XCircle className="mr-2 h-4 w-4" />
                                                Reject
                                            </Button>
                                            <Button onClick={() => handleApprove(project.id)}>
                                                <CheckCircle className="mr-2 h-4 w-4" />
                                                Approve
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            )}

            <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject Project Proposal</DialogTitle>
                        <DialogDescription>Please provide a reason for rejecting this proposal.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label htmlFor="reason">Rejection Reason</Label>
                        <Textarea
                            id="reason"
                            placeholder="e.g., Scope is too small, Topic not relevant..."
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            rows={4}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={confirmReject}>Reject Proposal</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
