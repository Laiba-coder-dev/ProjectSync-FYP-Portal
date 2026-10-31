import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Loader2, Users, FolderKanban, User, ArrowRight } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface GroupData {
    id: string;
    name: string;
    projectTitle: string;
    projectDescription: string;
    members: Array<{ name: string; role: string }>;
    supervisorName: string;
    projectStatus: string;
}

export default function GroupView() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [groups, setGroups] = useState<GroupData[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

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
            const groupsList: GroupData[] = [];

            for (const groupDoc of groupsSnapshot.docs) {
                const data = groupDoc.data();

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

                groupsList.push({
                    id: groupDoc.id,
                    name: data.name || 'Unnamed Group',
                    projectTitle: data.projectIdea?.title || 'No Project',
                    projectDescription: data.projectIdea?.description || 'No description available',
                    members: data.members || [],
                    supervisorName,
                    projectStatus: data.projectIdea?.status || 'none'
                });
            }

            setGroups(groupsList);
        } catch (error) {
            console.error('Error fetching assigned groups:', error);
            toast.error('Failed to load assigned groups');
        } finally {
            setLoading(false);
        }
    };

    const filteredGroups = groups.filter(g =>
        g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.projectTitle.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                title="Assigned Groups"
                description="View project groups assigned to you for evaluation"
            />

            <div className="flex gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search by group name or project title..."
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
            ) : filteredGroups.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <FolderKanban className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-lg font-medium text-muted-foreground">
                            {groups.length === 0 ? 'No groups assigned yet' : 'No groups match your search'}
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                            {groups.length === 0 ? 'Contact PMO to get groups assigned for evaluation' : 'Try a different search term'}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {filteredGroups.map((group) => (
                        <Card key={group.id} className="hover:shadow-md transition-shadow">
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                        <CardTitle className="flex items-center gap-2">
                                            <Users className="h-5 w-5 text-primary" />
                                            {group.name}
                                        </CardTitle>
                                        <CardDescription className="text-base font-medium">
                                            {group.projectTitle}
                                        </CardDescription>
                                    </div>
                                    {getStatusBadge(group.projectStatus)}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                        {group.projectDescription}
                                    </p>
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                    <div>
                                        <p className="text-sm font-medium mb-2">Members ({group.members.length})</p>
                                        <div className="space-y-1">
                                            {group.members.slice(0, 3).map((member, idx) => (
                                                <div key={idx} className="flex items-center gap-2 text-sm">
                                                    <User className="h-3 w-3 text-muted-foreground" />
                                                    <span>{member.name}</span>
                                                    {member.role === 'leader' && (
                                                        <Badge variant="outline" className="text-xs">Leader</Badge>
                                                    )}
                                                </div>
                                            ))}
                                            {group.members.length > 3 && (
                                                <p className="text-xs text-muted-foreground">
                                                    +{group.members.length - 3} more
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-sm font-medium mb-2">Supervisor</p>
                                        <Badge variant="secondary">{group.supervisorName}</Badge>
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => navigate('/external/documents', { state: { groupId: group.id } })}
                                    >
                                        View Documents
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={() => navigate('/external/evaluate', { state: { groupId: group.id } })}
                                    >
                                        Evaluate Group
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
