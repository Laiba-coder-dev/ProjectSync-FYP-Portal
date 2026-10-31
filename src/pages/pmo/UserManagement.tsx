import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/PageHeader';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Mail, Loader2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { User, Student } from '@/types';
import { toast } from 'sonner';

export default function UserManagement() {
    const [searchTerm, setSearchTerm] = useState('');
    const [students, setStudents] = useState<Student[]>([]);
    const [supervisors, setSupervisors] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            // Fetch Students
            const studentQuery = query(collection(db, 'users'), where('role', '==', 'student'));
            const studentSnapshot = await getDocs(studentQuery);
            const loadedStudents = studentSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Student));
            setStudents(loadedStudents);

            // Fetch Supervisors
            const supervisorQuery = query(collection(db, 'users'), where('role', '==', 'supervisor'));
            const supervisorSnapshot = await getDocs(supervisorQuery);
            const loadedSupervisors = supervisorSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as User));
            setSupervisors(loadedSupervisors);
        } catch (error) {
            console.error('Error fetching users:', error);
            toast.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const filterUsers = (users: any[]) => users.filter(u =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const UserList = ({ users, type }: { users: any[], type: 'Student' | 'Supervisor' }) => (
        <div className="grid gap-4">
            {users.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                    No {type.toLowerCase()}s found
                </div>
            ) : (
                users.map(user => (
                    <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-4">
                            <Avatar>
                                <AvatarImage src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`} />
                                <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-medium">{user.name}</p>
                                <p className="text-sm text-muted-foreground">{user.email}</p>
                                {type === 'Student' && user.enrollmentNumber && (
                                    <p className="text-xs text-muted-foreground mt-1">Enrollment: {user.enrollmentNumber}</p>
                                )}
                                {type === 'Supervisor' && user.designation && (
                                    <p className="text-xs text-muted-foreground mt-1">{user.designation}</p>
                                )}
                                {type === 'Supervisor' && user.department && (
                                    <p className="text-xs text-muted-foreground">{user.department}</p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline">{type}</Badge>
                            {!user.isActive && <Badge variant="destructive">Disabled</Badge>}
                            <Button variant="ghost" size="icon"><Mail className="h-4 w-4" /></Button>
                        </div>
                    </div>
                ))
            )}
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <PageHeader title="User Management" description="Manage system access for students and supervisors" />
                <Button><Plus className="mr-2 h-4 w-4" /> Add User</Button>
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    placeholder="Search by name or email..."
                    className="pl-10 max-w-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <Tabs defaultValue="students" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="students">Students ({students.length})</TabsTrigger>
                        <TabsTrigger value="supervisors">Supervisors ({supervisors.length})</TabsTrigger>
                    </TabsList>

                    <TabsContent value="students">
                        <Card>
                            <CardHeader>
                                <CardTitle>Students</CardTitle>
                                <CardDescription>Enrolled students in the system</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <UserList users={filterUsers(students)} type="Student" />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="supervisors">
                        <Card>
                            <CardHeader>
                                <CardTitle>Supervisors</CardTitle>
                                <CardDescription>Academic staff and supervisors</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <UserList users={filterUsers(supervisors)} type="Supervisor" />
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
}
