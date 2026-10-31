import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';

interface Group {
    id: string;
    name: string;
    memberCount: number;
    supervisorId?: string;
    supervisorName?: string;
}

interface Supervisor {
    id: string;
    name: string;
    currentGroups: number;
}

export default function SupervisorAssignment() {
    const [groups, setGroups] = useState<Group[]>([]);
    const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
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

            for (const groupDoc of groupsSnapshot.docs) {
                const data = groupDoc.data();
                let supervisorName = 'Unassigned';

                // Fetch supervisor name if assigned
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
                    memberCount: data.members?.length || 0,
                    supervisorId: data.supervisorId,
                    supervisorName
                });
            }

            setGroups(groupsList);

            // Fetch all supervisors
            const supervisorsQuery = query(
                collection(db, 'users'),
                where('role', '==', 'supervisor')
            );
            const supervisorsSnapshot = await getDocs(supervisorsQuery);

            const supervisorsList: Supervisor[] = supervisorsSnapshot.docs.map(doc => {
                const data = doc.data();
                // Count how many groups this supervisor has
                const currentGroups = groupsList.filter(g => g.supervisorId === doc.id).length;

                return {
                    id: doc.id,
                    name: data.name,
                    currentGroups
                };
            });

            setSupervisors(supervisorsList);
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleAssign = async (groupId: string, supervisorId: string) => {
        try {
            await updateDoc(doc(db, 'groups', groupId), {
                supervisorId
            });

            // Update local state
            const supervisorName = supervisors.find(s => s.id === supervisorId)?.name || 'Unknown';
            setGroups(prev => prev.map(g =>
                g.id === groupId ? { ...g, supervisorId, supervisorName } : g
            ));

            // Update supervisor counts
            setSupervisors(prev => prev.map(s => ({
                ...s,
                currentGroups: groups.filter(g =>
                    g.supervisorId === s.id || (g.id === groupId && supervisorId === s.id)
                ).length
            })));

            toast.success('Supervisor assigned successfully');
        } catch (error) {
            console.error('Error assigning supervisor:', error);
            toast.error('Failed to assign supervisor');
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader title="Supervisor Assignment" description="Manually assign or reassign supervisors to project groups" />

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>Group Allocations</CardTitle>
                        <CardDescription>Manage supervisor allocations for all active groups</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Group Name</TableHead>
                                    <TableHead>Members</TableHead>
                                    <TableHead>Current Supervisor</TableHead>
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
                                            <TableCell className="font-medium">{group.name}</TableCell>
                                            <TableCell>{group.memberCount} members</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    {group.supervisorId ? (
                                                        <Badge variant="secondary">{group.supervisorName}</Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-muted-foreground">Unassigned</Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 max-w-[200px]">
                                                    <Select onValueChange={(val) => handleAssign(group.id, val)} defaultValue={group.supervisorId}>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Assign Supervisor" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {supervisors.map(s => (
                                                                <SelectItem key={s.id} value={s.id}>
                                                                    {s.name} ({s.currentGroups} groups)
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
