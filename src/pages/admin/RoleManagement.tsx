import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { User, UserRole, Student } from '@/types';
import { Loader2, ShieldAlert, Users, GraduationCap, Download, Trash2, Search, Filter, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { CreateStaffDialog } from '@/components/admin/CreateStaffDialog';
import { CreateStudentDialog } from '@/components/admin/CreateStudentDialog';
import { BulkImportStudentDialog } from '@/components/admin/BulkImportStudentDialog';
import { EditUserDialog } from '@/components/admin/EditUserDialog';
import { useAuth } from '@/contexts/AuthContext';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function RoleManagement() {
    const { user: currentUser } = useAuth();
    const [staff, setStaff] = useState<User[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<{ id: string; name: string; email: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    
    // Edit state
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [userToEdit, setUserToEdit] = useState<User | Student | null>(null);

    // Filters
    const [staffSearchQuery, setStaffSearchQuery] = useState('');
    const [staffRoleFilter, setStaffRoleFilter] = useState('all');
    const [staffDeptFilter, setStaffDeptFilter] = useState('all');
    
    const [studentSearchQuery, setStudentSearchQuery] = useState('');
    const [studentSemesterFilter, setStudentSemesterFilter] = useState('all');
    const [studentDeptFilter, setStudentDeptFilter] = useState('all');

    const fetchData = async () => {
        try {
            setLoading(true);

            // Fetch Staff (Non-Students)
            const staffQuery = query(collection(db, 'users'), where('role', '!=', 'student'));
            const staffSnapshot = await getDocs(staffQuery);
            const loadedStaff = staffSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as User));
            setStaff(loadedStaff);

            // Fetch Students
            const studentQuery = query(collection(db, 'users'), where('role', '==', 'student'));
            const studentSnapshot = await getDocs(studentQuery);
            const loadedStudents = studentSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Student));
            setStudents(loadedStudents);

        } catch (error) {
            console.error('Failed to fetch users:', error);
            toast.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleRoleUpdate = async (userId: string, newRole: UserRole, currentRole: UserRole) => {
        if (newRole === currentRole) return;

        if (newRole === 'student') {
            toast.error("Cannot downgrade staff to student role");
            return;
        }

        setUpdatingId(userId);
        try {
            await updateDoc(doc(db, 'users', userId), { role: newRole });

            // Audit Log
            if (currentUser) {
                await addDoc(collection(db, 'audit_logs'), {
                    userId: currentUser.id,
                    userName: currentUser.name,
                    userRole: currentUser.role,
                    action: 'ROLE_CHANGED',
                    details: `Changed role from ${currentRole} to ${newRole} for user ${userId}`,
                    timestamp: serverTimestamp(),
                });
            }

            toast.success('Role updated successfully');
            fetchData();
        } catch (error) {
            console.error(error);
            toast.error('Failed to update role');
        } finally {
            setUpdatingId(null);
        }
    };

    const handleAccountStatusToggle = async (userId: string, currentStatus: boolean, userName: string) => {
        const newStatus = !currentStatus;
        setUpdatingId(userId);

        try {
            await updateDoc(doc(db, 'users', userId), { isActive: newStatus });

            // Audit Log
            if (currentUser) {
                await addDoc(collection(db, 'audit_logs'), {
                    userId: currentUser.id,
                    userName: currentUser.name,
                    userRole: currentUser.role,
                    action: newStatus ? 'ACCOUNT_ENABLED' : 'ACCOUNT_DISABLED',
                    details: `${newStatus ? 'Enabled' : 'Disabled'} account for ${userName} (${userId})`,
                    timestamp: serverTimestamp(),
                });
            }

            toast.success(`Account ${newStatus ? 'enabled' : 'disabled'} successfully`);

            // Update local state instead of refetching all data
            setStaff(prev => prev.map(user =>
                user.id === userId ? { ...user, isActive: newStatus } : user
            ));
            setStudents(prev => prev.map(student =>
                student.id === userId ? { ...student, isActive: newStatus } : student
            ));
        } catch (error) {
            console.error(error);
            toast.error('Failed to update account status');
        } finally {
            setUpdatingId(null);
        }
    };

    const handleDeleteAccount = async () => {
        if (!userToDelete) return;

        setUpdatingId(userToDelete.id);
        try {
            // Delete from Firestore
            await deleteDoc(doc(db, 'users', userToDelete.id));

            // Note: Firebase Auth user deletion requires Admin SDK (backend)
            // For now, we only delete the Firestore document
            // The Auth account will remain but won't be able to access the app

            // Audit Log
            if (currentUser) {
                await addDoc(collection(db, 'audit_logs'), {
                    userId: currentUser.id,
                    userName: currentUser.name,
                    userRole: currentUser.role,
                    action: 'ACCOUNT_DELETED',
                    details: `Deleted account for ${userToDelete.name} (${userToDelete.email})`,
                    timestamp: serverTimestamp(),
                });
            }

            // Update local state
            setStaff(prev => prev.filter(user => user.id !== userToDelete.id));
            setStudents(prev => prev.filter(student => student.id !== userToDelete.id));

            toast.success(`Account deleted successfully`);
            setDeleteDialogOpen(false);
            setUserToDelete(null);
        } catch (error) {
            console.error(error);
            toast.error('Failed to delete account');
        } finally {
            setUpdatingId(null);
        }
    };

    const confirmDelete = (id: string, name: string, email: string) => {
        setUserToDelete({ id, name, email });
        setDeleteDialogOpen(true);
    };

    const openEditDialog = (user: User | Student) => {
        setUserToEdit(user);
        setEditDialogOpen(true);
    };

    const handleExportUsers = async () => {
        setExporting(true);
        try {
            const usersRef = collection(db, 'users');
            const snapshot = await getDocs(usersRef);

            let content = "FYP Portal User List\n";
            content += "Generated on: " + new Date().toLocaleString() + "\n";
            content += "==========================================\n\n";

            // Staff Section
            content += "--- STAFF MEMBERS ---\n";
            const staff = snapshot.docs.filter(d => d.data().role !== 'student');
            staff.forEach(doc => {
                const u = doc.data();
                content += `Name: ${u.name}\nEmail: ${u.email}\nRole: ${u.role}\nUID: ${doc.id}\n-------------------\n`;
            });

            // Student Section
            content += "\n\n--- STUDENTS ---\n";
            const students = snapshot.docs.filter(d => d.data().role === 'student');
            students.forEach(doc => {
                const u = doc.data();
                content += `Name: ${u.name}\nEmail: ${u.email}\nEnrollment: ${u.enrollmentNumber || 'N/A'}\nSemester: ${u.semester || 'N/A'}\nUID: ${doc.id}\n-------------------\n`;
            });

            // Create Blob and Download
            const blob = new Blob([content], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `users_export_${new Date().toISOString().split('T')[0]}.txt`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast.success("User list downloaded successfully");
        } catch (error) {
            console.error("Export failed", error);
            toast.error("Failed to export users");
        } finally {
            setExporting(false);
        }
    };

    const uniqueDepartments = Array.from(new Set([...staff, ...students].map(u => u.department).filter(Boolean))) as string[];

    const filteredStaff = staff.filter(user => {
        const matchesQuery = user.name.toLowerCase().includes(staffSearchQuery.toLowerCase()) || 
                             user.email.toLowerCase().includes(staffSearchQuery.toLowerCase());
        const matchesRole = staffRoleFilter === 'all' || user.role === staffRoleFilter;
        const matchesDept = staffDeptFilter === 'all' || user.department === staffDeptFilter;
        return matchesQuery && matchesRole && matchesDept;
    });

    const filteredStudents = students.filter(student => {
        const matchesQuery = student.name.toLowerCase().includes(studentSearchQuery.toLowerCase()) || 
                             student.email.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
                             (student.enrollmentNumber && student.enrollmentNumber.toLowerCase().includes(studentSearchQuery.toLowerCase()));
        const matchesSemester = studentSemesterFilter === 'all' || student.semester?.toString() === studentSemesterFilter;
        const matchesDept = studentDeptFilter === 'all' || student.department === studentDeptFilter;
        return matchesQuery && matchesSemester && matchesDept;
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader title="User Management" description="Manage all users, roles, and accounts from a central dashboard.">
                <Button variant="outline" onClick={handleExportUsers} disabled={exporting}>
                    <Download className="mr-2 h-4 w-4" />
                    {exporting ? 'Exporting...' : 'Export All Users'}
                </Button>
            </PageHeader>

            <Tabs defaultValue="staff" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="staff" className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Staff Members
                    </TabsTrigger>
                    <TabsTrigger value="students" className="flex items-center gap-2">
                        <GraduationCap className="h-4 w-4" />
                        Students
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="staff" className="space-y-4">
                    <div className="flex justify-between items-center bg-card p-4 rounded-lg border shadow-sm">
                        <div>
                            <h3 className="text-lg font-medium">Staff Accounts</h3>
                            <p className="text-sm text-muted-foreground">Manage administrative and academic staff roles</p>
                        </div>
                        <CreateStaffDialog onSuccess={fetchData} />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 mb-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by name or email..."
                                className="pl-8"
                                value={staffSearchQuery}
                                onChange={(e) => setStaffSearchQuery(e.target.value)}
                            />
                        </div>
                        <Select value={staffRoleFilter} onValueChange={setStaffRoleFilter}>
                            <SelectTrigger className="w-[180px]">
                                <Filter className="mr-2 h-4 w-4 shrink-0" />
                                <SelectValue placeholder="Filter by Role" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Roles</SelectItem>
                                <SelectItem value="supervisor">Supervisor</SelectItem>
                                <SelectItem value="pmo">PMO</SelectItem>
                                <SelectItem value="external_panel">External Panel</SelectItem>
                                <SelectItem value="exam_cell">Exam Cell</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={staffDeptFilter} onValueChange={setStaffDeptFilter}>
                            <SelectTrigger className="w-[180px]">
                                <Filter className="mr-2 h-4 w-4 shrink-0" />
                                <SelectValue placeholder="Department" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Departments</SelectItem>
                                {uniqueDepartments.map(dept => (
                                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Staff List</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {filteredStaff.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">No staff members found matching your filters.</div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Role</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredStaff.map(user => (
                                            <TableRow key={user.id} className={!user.isActive ? 'opacity-60' : ''}>
                                                <TableCell className="font-medium">
                                                    <div className="flex flex-col">
                                                        <span>{user.name}</span>
                                                        {user.department && (
                                                            <span className="text-xs text-muted-foreground">{user.department}</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>{user.email}</TableCell>
                                                <TableCell>
                                                    <Badge variant={user.role === 'admin' ? 'destructive' : 'secondary'}>
                                                        {user?.role?.replace('_', ' ')?.toUpperCase() || 'USER'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Switch
                                                            checked={user.isActive ?? true}
                                                            onCheckedChange={() => handleAccountStatusToggle(user.id, user.isActive ?? true, user.name)}
                                                            disabled={updatingId === user.id}
                                                        />
                                                        <span className="text-sm text-muted-foreground">
                                                            {user.isActive ?? true ? 'Active' : 'Disabled'}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Select
                                                            defaultValue={user.role}
                                                            onValueChange={(val) => handleRoleUpdate(user.id, val as UserRole, user.role)}
                                                            disabled={updatingId === user.id}
                                                        >
                                                            <SelectTrigger className="w-[140px] h-8">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="supervisor">Supervisor</SelectItem>
                                                                <SelectItem value="pmo">PMO</SelectItem>
                                                                <SelectItem value="external_panel">External Panel</SelectItem>
                                                                <SelectItem value="exam_cell">Exam Cell</SelectItem>
                                                                <SelectItem value="admin">Admin</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                                                            onClick={() => openEditDialog(user)}
                                                            disabled={updatingId === user.id}
                                                        >
                                                            <Edit2 className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                            onClick={() => confirmDelete(user.id, user.name, user.email)}
                                                            disabled={updatingId === user.id}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                        {updatingId === user.id && <Loader2 className="h-4 w-4 animate-spin" />}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="bg-muted/50 border-dashed">
                        <CardContent className="pt-6">
                            <div className="flex items-start gap-4 text-sm text-muted-foreground">
                                <ShieldAlert className="h-5 w-5 mt-0.5 shrink-0" />
                                <p>
                                    <strong>Role Policy:</strong> Roles grant specific permissions in the dashboard.
                                    Do not assign elevated privileges (e.g., PMO, Admin) without authorization.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="students" className="space-y-4">
                    <div className="flex justify-between items-center bg-card p-4 rounded-lg border shadow-sm">
                        <div>
                            <h3 className="text-lg font-medium">Student Accounts</h3>
                            <p className="text-sm text-muted-foreground">Manage enrolled students and their accounts</p>
                        </div>
                        <div className="flex gap-2">
                            <BulkImportStudentDialog onSuccess={fetchData} />
                            <CreateStudentDialog onSuccess={fetchData} />
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 mb-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by name, email or enrollment #..."
                                className="pl-8"
                                value={studentSearchQuery}
                                onChange={(e) => setStudentSearchQuery(e.target.value)}
                            />
                        </div>
                        <Select value={studentSemesterFilter} onValueChange={setStudentSemesterFilter}>
                            <SelectTrigger className="w-[180px]">
                                <Filter className="mr-2 h-4 w-4 shrink-0" />
                                <SelectValue placeholder="Filter by Semester" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Semesters</SelectItem>
                                {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                                    <SelectItem key={sem} value={sem.toString()}>Semester {sem}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={studentDeptFilter} onValueChange={setStudentDeptFilter}>
                            <SelectTrigger className="w-[180px]">
                                <Filter className="mr-2 h-4 w-4 shrink-0" />
                                <SelectValue placeholder="Department" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Departments</SelectItem>
                                {uniqueDepartments.map(dept => (
                                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Enrolled Students</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {filteredStudents.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">No students found matching your filters.</div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Enrollment #</TableHead>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Semester</TableHead>
                                            <TableHead>Department</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredStudents.map(s => (
                                            <TableRow key={s.id} className={!s.isActive ? 'opacity-60' : ''}>
                                                <TableCell className="font-mono">{s.enrollmentNumber || 'N/A'}</TableCell>
                                                <TableCell className="font-medium">{s.name}</TableCell>
                                                <TableCell>{s.email}</TableCell>
                                                <TableCell>{s.semester ? `Sem ${s.semester}` : '-'}</TableCell>
                                                <TableCell>{s.department || '-'}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Switch
                                                            checked={s.isActive ?? true}
                                                            onCheckedChange={() => handleAccountStatusToggle(s.id, s.isActive ?? true, s.name)}
                                                            disabled={updatingId === s.id}
                                                        />
                                                        <span className="text-sm text-muted-foreground">
                                                            {s.isActive ?? true ? 'Active' : 'Disabled'}
                                                        </span>
                                                        {updatingId === s.id && <Loader2 className="h-4 w-4 animate-spin" />}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                                                            onClick={() => openEditDialog(s)}
                                                            disabled={updatingId === s.id}
                                                        >
                                                            <Edit2 className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                            onClick={() => confirmDelete(s.id, s.name, s.email)}
                                                            disabled={updatingId === s.id}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Edit User Dialog */}
            <EditUserDialog 
                user={userToEdit}
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                onSuccess={fetchData}
            />

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Account?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to permanently delete the account for{' '}
                            <strong>{userToDelete?.name}</strong> ({userToDelete?.email})?
                            <br /><br />
                            This action cannot be undone. All user data will be permanently removed.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteAccount}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete Account
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
