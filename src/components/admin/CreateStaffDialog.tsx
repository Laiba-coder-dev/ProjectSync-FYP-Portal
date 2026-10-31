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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus } from 'lucide-react';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { setDoc, doc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { db, getSecondaryAuth } from '@/lib/firebase';
import { UserRole } from '@/types';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const staffSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address').endsWith('@uskt.edu.pk', 'Email must belong to @uskt.edu.pk domain'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    role: z.enum(['supervisor', 'pmo', 'external_panel', 'exam_cell', 'admin'] as const),
    designation: z.string().optional(),
    department: z.string().optional(),
});

type StaffFormValues = z.infer<typeof staffSchema>;

interface CreateStaffDialogProps {
    onSuccess?: () => void;
}

export function CreateStaffDialog({ onSuccess }: CreateStaffDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const { user: currentUser } = useAuth(); // for audit logs

    const form = useForm<StaffFormValues>({
        resolver: zodResolver(staffSchema),
        defaultValues: {
            role: 'supervisor',
            department: 'Computer Science',
        },
    });

    const onSubmit = async (data: StaffFormValues) => {
        setLoading(true);
        try {
            // 1. Create Auth User
            // Note: In a real app, you might want to use a secondary firebase app instance 
            // to create users without logging out the current admin. 
            // However, strictly following the prompt "Admin creates user", we will use the current auth instance
            // BUT this will log the admin out and log the new user in. 
            // 
            // CRITICAL FIX FOR PRODUCTION:
            // Client-side SDK `createUserWithEmailAndPassword` automatically signs in the new user.
            // This is bad for an Admin panel. 
            // Since we don't have a backend function (yet), we will warn the admin or use a workaround?
            // WORKAROUND: We can't easily avoid the auto-login on client SDK.
            // OPTION: We will proceed, but note that this might log the admin out.
            // ACTUALLY, a better way for a client-side only app is to ask the user to sign up themselves, 
            // OR we accept that Admin gets logged out (clunky).
            // OR use a secondary app instance. 
            // Let's try the secondary app instance approach if possible, but that requires more config.
            // 
            // SIMPLER APPROACH for this MVP:
            // Just create the user. If it logs out, so be it? No, that's annoying.
            // 
            // Let's use the secondary app trick safely?
            // Actually, let's just create it and handled the session?
            //
            // WAIT - The prompt said "System sends invite email" (Option A) implies backend.
            // But we are client side only.
            //
            // Let's stick to the simplest interpretation: Admin creates account.
            // We will use a secondary "dummy" app instance to create users without signing out the admin.

            /* 
               We will just use the main auth for now. If it signs out, re-login is needed. 
               BUT for a "Production Grade" feel, that's bad.
               Let's try to just do it and see.
               Actually, `createUserWithEmailAndPassword` DOES sign in immediately.
               
               Let's skip the "Secondary App" complexity for this specific step unless necessary.
               Using a secondary app instance is the standard client-side work-around.
            */

            // 1. Create Auth User using Secondary App
            const secondaryAuth = getSecondaryAuth();
            const { user: newUser } = await createUserWithEmailAndPassword(secondaryAuth, data.email, data.password);

            // Immediately sign out to clear secondary session
            await signOut(secondaryAuth);

            // 2. Create Firestore Document
            await setDoc(doc(db, 'users', newUser.uid), {
                name: data.name,
                email: data.email,
                role: data.role,
                designation: data.designation || '',
                department: data.department || '',
                isActive: true,
                createdAt: serverTimestamp(),
            });

            // 3. Create Audit Log
            if (currentUser) {
                await addDoc(collection(db, 'audit_logs'), {
                    userId: currentUser.id,
                    userName: currentUser.name,
                    userRole: currentUser.role,
                    action: 'CREATED_USER',
                    details: `Created new ${data.role}: ${data.email}`,
                    timestamp: serverTimestamp(),
                });
            }

            toast.success(`Staff member ${data.name} created successfully`);

            // Since we might have been logged out, we can't easily run onSuccess.
            // But wait, if we are logged out, the AuthContext will trigger and redirect to login.
            // That is acceptable for "Option A" without a backend.
            // 
            // IF we want to avoid logout, we need a backend. 
            // Since the user emphasized "The developer's job is to build the capability", 
            // we will implement it this way. 

            setOpen(false);
            form.reset();
            onSuccess?.();

        } catch (error: any) {
            console.error('Error creating staff:', error);
            if (error.code === 'auth/email-already-in-use') {
                toast.error('Email is already registered');
            } else {
                toast.error('Failed to create staff member');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Staff Member
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add New Staff Member</DialogTitle>
                    <DialogDescription>
                        Create a new account for a Supervisor, PMO, or other staff.
                        Note: This will create a new login.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input id="name" {...form.register('name')} placeholder="Dr. Name" />
                        {form.formState.errors.name && (
                            <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" {...form.register('email')} placeholder="name@uskt.edu.pk" />
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

                    <div className="space-y-2">
                        <Label htmlFor="role">Role</Label>
                        <Select
                            onValueChange={(value) => form.setValue('role', value as any)}
                            defaultValue={form.getValues('role')}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="supervisor">Supervisor</SelectItem>
                                <SelectItem value="pmo">PMO</SelectItem>
                                <SelectItem value="external_panel">External Panel</SelectItem>
                                <SelectItem value="exam_cell">Exam Cell</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="designation">Designation</Label>
                            <Input id="designation" {...form.register('designation')} placeholder="Professor" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="department">Department</Label>
                            <Input id="department" {...form.register('department')} placeholder="CS" />
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
