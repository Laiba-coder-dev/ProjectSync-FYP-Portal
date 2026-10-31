import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Loader2, Users, CheckCircle, XCircle, Clock, FileText, Send } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DocumentViewerList } from '@/components/shared/DocumentViewerList';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

interface GroupData {
    id: string;
    name: string;
    leader: string;
    memberCount: number;
    supervisorName: string;
    projectTitle: string;
    projectStatus: 'submitted' | 'approved' | 'rejected' | 'none';
    isFinalized: boolean;
    isMarksShared: boolean;
}

export default function GroupOverview() {
    const [groups, setGroups] = useState<GroupData[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedGroup, setSelectedGroup] = useState<GroupData | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [publishingId, setPublishingId] = useState<string | null>(null);

    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        setLoading(true);
        try {
            const groupsSnapshot = await getDocs(collection(db, 'groups'));
            const groupsList: GroupData[] = [];

            for (const groupDoc of groupsSnapshot.docs) {
                const data = groupDoc.data();

                // Fetch leader name
                let leaderName = 'Unknown';
                if (data.leader) {
                    const leaderQuery = query(
                        collection(db, 'users'),
                        where('__name__', '==', data.leader)
                    );
                    const leaderSnapshot = await getDocs(leaderQuery);
                    if (!leaderSnapshot.empty) {
                        leaderName = leaderSnapshot.docs[0].data().name;
                    }
                }

                // Fetch supervisor name
                let supervisorName = 'Unassigned';
                if (data.supervisorId) {
                    const supervisorQuery = query(
                        collection(db, 'users'),
                        where('__name__', '==', data.supervisorId)
                    );
                    const supervisorSnapshot = await getDocs(supervisorQuery);
                    if (!supervisorSnapshot.empty) {
                        supervisorName = supervisorSnapshot.docs[0].data().name;
                    }
                }

                // Fetch evaluation state
                const evSnap = await getDocs(query(collection(db, 'evaluations'), where('groupId', '==', groupDoc.id)));
                const evs = evSnap.docs.map(d => d.data());
                const isFinalized = evs.length > 0 && evs.every(e => e.isFinalized === true);

                groupsList.push({
                    id: groupDoc.id,
                    name: data.name || 'Unnamed Group',
                    leader: leaderName,
                    memberCount: data.members?.length || 0,
                    supervisorName,
                    projectTitle: data.projectIdea?.title || 'No Project',
                    projectStatus: data.projectIdea?.status || 'none',
                    isFinalized,
                    isMarksShared: data.isMarksShared === true,
                });
            }

            setGroups(groupsList);
        } catch (error) {
            console.error('Error fetching groups:', error);
            toast.error('Failed to load groups');
        } finally {
            setLoading(false);
        }
    };

    const handlePublishResults = async (groupId: string) => {
        setPublishingId(groupId);
        try {
            const groupRef = doc(db, 'groups', groupId);
            await updateDoc(groupRef, { isMarksShared: true });
            setGroups(prev => prev.map(g => g.id === groupId ? { ...g, isMarksShared: true } : g));
            toast.success('Results published to students!');
        } catch (err) {
            toast.error('Failed to publish results');
        } finally {
            setPublishingId(null);
        }
    };

    const filteredGroups = groups.filter(g =>
        g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.leader.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.projectTitle.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'approved':
                return <CheckCircle className="h-4 w-4 text-green-500" />;
            case 'rejected':
                return <XCircle className="h-4 w-4 text-red-500" />;
            case 'submitted':
                return <Clock className="h-4 w-4 text-yellow-500" />;
            default:
                return null;
        }
    };

    const getStatusBadge = (status: string) => {
        const variants: Record<string, any> = {
            approved: 'default',
            rejected: 'destructive',
            submitted: 'secondary',
            none: 'outline'
        };
        return <Badge variant={variants[status]}>{status.toUpperCase()}</Badge>;
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Group Overview"
                description="View all project groups and their details"
            />

            <div className="flex gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search by group name, leader, or project..."
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
                <Card>
                    <CardHeader>
                        <CardTitle>All Groups ({filteredGroups.length})</CardTitle>
                        <CardDescription>Complete list of project groups</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Group Name</TableHead>
                                    <TableHead>Leader</TableHead>
                                    <TableHead>Members</TableHead>
                                    <TableHead>Supervisor</TableHead>
                                    <TableHead>Project Title</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Results</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredGroups.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                                            No groups found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredGroups.map((group) => (
                                        <TableRow key={group.id}>
                                            <TableCell className="font-medium">{group.name}</TableCell>
                                            <TableCell>{group.leader}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Users className="h-4 w-4 text-muted-foreground" />
                                                    {group.memberCount}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary">{group.supervisorName}</Badge>
                                            </TableCell>
                                            <TableCell className="max-w-xs truncate">
                                                {group.projectTitle}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    {getStatusIcon(group.projectStatus)}
                                                    {getStatusBadge(group.projectStatus)}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {group.isMarksShared ? (
                                                    <Badge variant="default" className="bg-green-600 text-white gap-1">
                                                        <CheckCircle className="h-3 w-3" /> Published
                                                    </Badge>
                                                ) : group.isFinalized ? (
                                                    <Badge variant="secondary" className="gap-1">
                                                        <Clock className="h-3 w-3" /> Ready
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline">Pending</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm"
                                                        onClick={() => setSelectedGroup(group)}
                                                    >
                                                        <FileText className="h-4 w-4 mr-2" /> Docs
                                                    </Button>
                                                    {group.isFinalized && (
                                                        <Button
                                                            size="sm"
                                                            variant={group.isMarksShared ? 'secondary' : 'default'}
                                                            disabled={group.isMarksShared || publishingId === group.id}
                                                            onClick={() => handlePublishResults(group.id)}
                                                        >
                                                            {publishingId === group.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                                                            {group.isMarksShared ? 'Published ✓' : 'Publish to Students'}
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {selectedGroup && (
                <Dialog open={!!selectedGroup} onOpenChange={(open) => !open && setSelectedGroup(null)}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{selectedGroup.name} Documents</DialogTitle>
                            <DialogDescription>Full document history for this group.</DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                            <DocumentViewerList groupId={selectedGroup.id} />
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
