import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Mail, Edit2 } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import { toast } from 'sonner';
import { User, Student } from '@/types';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface EditUserDialogProps {
    user: User | Student | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export function EditUserDialog({ user, open, onOpenChange, onSuccess }: EditUserDialogProps) {
    const [loading, setLoading] = useState(false);
    const [sendingEmail, setSendingEmail] = useState(false);
    
    const [name, setName] = useState('');
    const [department, setDepartment] = useState('');
    const [enrollmentNumber, setEnrollmentNumber] = useState('');
    const [semester, setSemester] = useState('');

    useEffect(() => {
        if (user) {
            setName(user.name || '');
            setDepartment(user.department || '');
            
            if (user.role === 'student') {
                const student = user as Student;
                setEnrollmentNumber(student.enrollmentNumber || '');
                setSemester(student.semester?.toString() || '8');
            }
        }
    }, [user, open]);

    if (!user) return null;

    const handleUpdate = async () => {
        if (!name.trim()) {
            toast.error('Name is required');
            return;
        }

        setLoading(true);
        try {
            const updates: any = {
                name: name.trim(),
                department: department.trim(),
            };

            if (user.role === 'student') {
                updates.enrollmentNumber = enrollmentNumber.trim();
                updates.semester = parseInt(semester);
            }

            await updateDoc(doc(db, 'users', user.id), updates);
            toast.success('User details updated successfully');
            onSuccess?.();
            onOpenChange(false);
        } catch (error) {
            console.error('Failed to update user:', error);
            toast.error('Failed to update user details');
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordReset = async () => {
        setSendingEmail(true);
        try {
            await sendPasswordResetEmail(auth, user.email);
            toast.success(`Password reset email sent to ${user.email}`);
        } catch (error) {
            console.error('Failed to send reset email:', error);
            toast.error('Failed to send password reset email. Ensure Firebase Auth is configured correctly.');
        } finally {
            setSendingEmail(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Edit2 className="h-5 w-5" />
                        Edit User Profile
                    </DialogTitle>
                    <DialogDescription>
                        Update user details or send a password reset link. Email address cannot be changed.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Email (Read-only)</Label>
                        <Input value={user.email} disabled className="bg-muted" />
                    </div>

                    <div className="space-y-2">
                        <Label>Full Name</Label>
                        <Input 
                            value={name} 
                            onChange={(e) => setName(e.target.value)} 
                            placeholder="John Doe"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Department</Label>
                        <Input 
                            value={department} 
                            onChange={(e) => setDepartment(e.target.value)} 
                            placeholder="Computer Science"
                        />
                    </div>

                    {user.role === 'student' && (
                        <>
                            <div className="space-y-2">
                                <Label>Enrollment Number / Roll No</Label>
                                <Input 
                                    value={enrollmentNumber} 
                                    onChange={(e) => setEnrollmentNumber(e.target.value)} 
                                    placeholder="22104000"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Semester</Label>
                                <Select value={semester} onValueChange={setSemester}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Semester" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                                            <SelectItem key={s} value={s.toString()}>
                                                Semester {s}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </>
                    )}

                    <div className="pt-4 border-t mt-4">
                        <p className="text-sm font-medium mb-2">Security</p>
                        <Button 
                            type="button" 
                            variant="secondary" 
                            className="w-full"
                            onClick={handlePasswordReset}
                            disabled={sendingEmail}
                        >
                            {sendingEmail ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Mail className="mr-2 h-4 w-4" />
                            )}
                            Send Password Reset Email
                        </Button>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleUpdate} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
