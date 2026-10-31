import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { UserRole } from '@/types';

export default function SeedDatabase() {
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);

    const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

    const createRoleUser = async (role: UserRole, email: string) => {
        try {
            addLog(`Creating ${role} (${email})...`);

            // 1. Create Auth User
            // Note: If user exists, this throws error, so we try-catch specifically
            let uid = '';
            try {
                const { user } = await createUserWithEmailAndPassword(auth, email, 'password');
                uid = user.uid;
                addLog(`✅ Auth user created: ${uid}`);
            } catch (e: any) {
                if (e.code === 'auth/email-already-in-use') {
                    addLog(`ℹ️ User already exists in Auth. Attempting to sign in to get UID...`);
                    const { user } = await signInWithEmailAndPassword(auth, email, 'password');
                    uid = user.uid;
                } else {
                    throw e;
                }
            }

            // 2. Create Firestore Doc (Overwrite to ensure correct role)
            await setDoc(doc(db, 'users', uid), {
                email,
                name: `Demo ${role.charAt(0).toUpperCase() + role.slice(1)}`,
                role,
                isActive: true,
                createdAt: serverTimestamp(),
            });
            addLog(`✅ Firestore document set for ${role}`);

        } catch (error: any) {
            addLog(`❌ Error creating ${role}: ${error.message}`);
            toast.error(`Failed to seed ${role}`);
        }
    };

    const handleSeed = async () => {
        setLoading(true);
        setLogs([]);
        try {
            await createRoleUser('student', '22104338@uskt.edu.pk');
            await createRoleUser('supervisor', 'tanveer.hussain@uskt.edu.pk');
            await createRoleUser('pmo', 'ayesha.siddiqui@uskt.edu.pk');
            await createRoleUser('external_panel', 'kamran.ahmed@uskt.edu.pk');
            await createRoleUser('exam_cell', 'hina.rabbani@uskt.edu.pk');
            await createRoleUser('admin', 'javed.sheikh@uskt.edu.pk');

            addLog('🎉 SEEDING COMPLETE!');
            toast.success('Database seeded successfully!');
        } catch (error) {
            console.error(error);
            toast.error('Seeding failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen p-8 bg-background flex items-center justify-center">
            <Card className="w-full max-w-2xl">
                <CardHeader>
                    <CardTitle>Database Seeder (Dev Only)</CardTitle>
                    <CardDescription>
                        Click the button below to force-create all demo accounts in Firebase.
                        <br />
                        <strong>Password for all accounts:</strong> <code>password</code>
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button
                        onClick={handleSeed}
                        disabled={loading}
                        size="lg"
                        className="w-full text-lg"
                    >
                        {loading ? 'Seeding...' : '🌱 Seed Database Now'}
                    </Button>

                    <div className="bg-muted p-4 rounded-lg h-64 overflow-y-auto font-mono text-xs">
                        {logs.length === 0 ? (
                            <span className="text-muted-foreground">Waiting to start...</span>
                        ) : (
                            logs.map((log, i) => <div key={i}>{log}</div>)
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
