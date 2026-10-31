import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, GraduationCap } from 'lucide-react';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { setDoc, doc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { db, getSecondaryAuth } from '@/lib/firebase';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const studentSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address').endsWith('@uskt.edu.pk', 'Email must belong to @uskt.edu.pk domain'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    enrollmentNumber: z.string().min(1, 'Enrollment number is required'),
    semester: z.number().min(1).max(8),
    department: z.string().min(1, 'Department is required'),
});

type StudentFormValues = z.infer<typeof studentSchema>;

interface CreateStudentDialogProps {
    onSuccess?: () => void;
}

export function CreateStudentDialog({ onSuccess }: CreateStudentDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const { user: currentUser } = useAuth();

    const form = useForm<StudentFormValues>({
        resolver: zodResolver(studentSchema),
        defaultValues: {
            semester: 8,
            department: 'Computer Science',
        },
    });

    const onSubmit = async (data: StudentFormValues) => {
        setLoading(true);
        try {
            // 1. Create Auth User
            // 1. Create Auth User (Secondary App)
            const secondaryAuth = getSecondaryAuth();
            const { user: newUser } = await createUserWithEmailAndPassword(secondaryAuth, data.email, data.password);
            await signOut(secondaryAuth);

            // 2. Create Firestore Document (Student Role)
            await setDoc(doc(db, 'users', newUser.uid), {
                name: data.name,
                email: data.email,
                role: 'student',
                enrollmentNumber: data.enrollmentNumber,
                semester: data.semester,
                department: data.department,
                isActive: true,
                createdAt: serverTimestamp(),
            });

            // 3. Audit Log
            if (currentUser) {
                await addDoc(collection(db, 'audit_logs'), {
                    userId: currentUser.id,
                    userName: currentUser.name,
                    userRole: currentUser.role,
                    action: 'CREATED_USER',
                    details: `Created new student: ${data.email} (${data.enrollmentNumber})`,
                    timestamp: serverTimestamp(),
                });
            }

            toast.success(`Student ${data.name} created successfully`);

            setOpen(false);
            form.reset();
            onSuccess?.();

        } catch (error: any) {
            console.error('Error creating student:', error);
            if (error.code === 'auth/email-already-in-use') {
                toast.error('Email is already registered');
            } else {
                toast.error('Failed to create student account');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Student
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add New Student</DialogTitle>
                    <DialogDescription>
                        Create a new student account.
                        Email must be in `rollno@uskt.edu.pk` format.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input id="name" {...form.register('name')} placeholder="Ali Khan" />
                        {form.formState.errors.name && (
                            <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">Email (Roll No)</Label>
                        <Input id="email" {...form.register('email')} placeholder="22104338@uskt.edu.pk" />
                        {form.formState.errors.email && (
                            <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">Initial Password</Label>
                        <Input id="password" type="password" {...form.register('password')} />
                        {form.formState.errors.password && (
                            <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="enrollmentNumber">Enrollment #</Label>
                            <Input id="enrollmentNumber" {...form.register('enrollmentNumber')} placeholder="22104338" />
                            {form.formState.errors.enrollmentNumber && (
                                <p className="text-sm text-destructive">{form.formState.errors.enrollmentNumber.message}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="semester">Semester</Label>
                            <Input
                                id="semester"
                                type="number"
                                {...form.register('semester', { valueAsNumber: true })}
                            />
                            {form.formState.errors.semester && (
                                <p className="text-sm text-destructive">{form.formState.errors.semester.message}</p>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Account
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
