import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';

interface Group {
    id: string;
    name: string;
    memberCount: number;
    projectTitle: string;
    externalPanelId?: string;
    externalPanelName?: string;
}

interface ExternalPanelMember {
    id: string;
    name: string;
    currentGroups: number;
}

export default function ExternalAssignment() {
    const [groups, setGroups] = useState<Group[]>([]);
    const [panelMembers, setPanelMembers] = useState<ExternalPanelMember[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch all groups
            const groupsSnapshot = await getDocs(collection(db, 'groups'));
            const groupsList: Group[] = [];

            // Helper to get panel member name if assigned
            // We'll fetch all panel members first to make mapping easier
            const panelQuery = query(
                collection(db, 'users'),
                where('role', '==', 'external_panel')
            );
            const panelSnapshot = await getDocs(panelQuery);
            const panelMap = new Map<string, string>();
            const panelList: ExternalPanelMember[] = [];

            panelSnapshot.docs.forEach(doc => {
                const data = doc.data();
                panelMap.set(doc.id, data.name);
                panelList.push({
                    id: doc.id,
                    name: data.name,
                    currentGroups: 0 // Will calculate below
                });
            });

            for (const groupDoc of groupsSnapshot.docs) {
                const data = groupDoc.data();
                const externalPanelName = data.externalPanelId ? panelMap.get(data.externalPanelId) || 'Unknown' : undefined;

                groupsList.push({
                    id: groupDoc.id,
                    name: data.name || 'Unnamed Group',
                    memberCount: data.members?.length || 0,
                    projectTitle: data.projectIdea?.title || 'No Project',
                    externalPanelId: data.externalPanelId,
                    externalPanelName
                });
            }

            setGroups(groupsList);

            // Calculate current group counts for each panel member
            const updatedPanelList = panelList.map(member => ({
                ...member,
                currentGroups: groupsList.filter(g => g.externalPanelId === member.id).length
            }));

            setPanelMembers(updatedPanelList);

        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleAssign = async (groupId: string, externalPanelId: string) => {
        try {
            await updateDoc(doc(db, 'groups', groupId), {
                externalPanelId
            });

            // Update local state
            const externalPanelName = panelMembers.find(p => p.id === externalPanelId)?.name || 'Unknown';

            setGroups(prev => prev.map(g =>
                g.id === groupId ? { ...g, externalPanelId, externalPanelName } : g
            ));

            // Update panel member counts
            setPanelMembers(prev => prev.map(p => ({
                ...p,
                currentGroups: groups.filter(g =>
                    (g.id !== groupId && g.externalPanelId === p.id) || // Existing groups not changing
                    (g.id === groupId && p.id === externalPanelId)      // New assignment
                ).length + (p.id === externalPanelId ? 1 : 0) - (groups.find(g => g.id === groupId)?.externalPanelId === p.id ? 1 : 0) // Adjust logic simply re-calculate based on new state prediction is safer but complex in one line.
                // Let's just re-calculate from the updated groups state logic conceptually or just refresh.
                // Simplified: We know we just added 1 to the new assignee and removed 1 from old assignee if strictly swapping. 
                // But for safety and simplicity in this UI update without re-fetch:
            })));

            // Re-calculate counts cleanly
            setPanelMembers(prev => {
                const newGroups = groups.map(g => g.id === groupId ? { ...g, externalPanelId } : g);
                return prev.map(p => ({
                    ...p,
                    currentGroups: newGroups.filter(g => g.externalPanelId === p.id).length
                }));
            });

            toast.success('Group assigned to external panel member');
        } catch (error) {
            console.error('Error assigning group:', error);
            toast.error('Failed to assign group');
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader title="External Panel Assignment" description="Assign project groups to external panel members for evaluation" />

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>Group Assignments</CardTitle>
                        <CardDescription>Manage external panel allocations</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Group Name</TableHead>
                                    <TableHead>Project Title</TableHead>
                                    <TableHead>Current Assignment</TableHead>
                                    <TableHead>Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {groups.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                                            No groups found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    groups.map((group) => (
                                        <TableRow key={group.id}>
                                            <TableCell className="font-medium">
                                                <div>{group.name}</div>
                                                <div className="text-xs text-muted-foreground">{group.memberCount} members</div>
                                            </TableCell>
                                            <TableCell className="max-w-xs truncate" title={group.projectTitle}>
                                                {group.projectTitle}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    {group.externalPanelId ? (
                                                        <Badge variant="secondary">{group.externalPanelName}</Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-muted-foreground">Unassigned</Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 max-w-[200px]">
                                                    <Select onValueChange={(val) => handleAssign(group.id, val)} value={group.externalPanelId}>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Assign Member" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {panelMembers.map(p => (
                                                                <SelectItem key={p.id} value={p.id}>
                                                                    {p.name} ({p.currentGroups})
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
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
        </div>
    );
}
