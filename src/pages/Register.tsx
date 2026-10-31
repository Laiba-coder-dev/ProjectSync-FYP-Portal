import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { getEmailValidationMessage, getEmailRole } from '@/lib/emailValidation';

export default function Register() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { register } = useAuth();
    const navigate = useNavigate();

    // Get real-time email validation feedback
    const emailValidation = getEmailValidationMessage(email);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            await register(email, password, name);
            toast.success('Registration successful. Welcome!');

            // Navigate based on role using already-imported static function
            const role = getEmailRole(email);
            navigate(role === 'student' ? '/student' : '/supervisor');
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Failed to register');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
                    <CardDescription>
                        Register with your @uskt.edu.pk email address
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {/* Info Alert */}
                    <Alert className="mb-4 border-blue-200 bg-blue-50/50">
                        <Info className="h-4 w-4 text-blue-600" />
                        <AlertDescription className="text-sm text-blue-900">
                            Your role will be automatically assigned based on your email:
                            <ul className="mt-1 ml-4 list-disc text-xs">
                                <li><strong>Students:</strong> Email starts with numbers (e.g., 5633455@uskt.edu.pk)</li>
                                <li><strong>Teachers/Staff:</strong> Email starts with letters (e.g., ali.ahmed@uskt.edu.pk)</li>
                            </ul>
                        </AlertDescription>
                    </Alert>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Full Name</Label>
                            <Input
                                id="name"
                                placeholder="Ali Khan"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <div className="space-y-2">
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="your.email@uskt.edu.pk"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className={
                                        emailValidation.type === 'error' && email
                                            ? 'border-red-500 focus-visible:ring-red-500'
                                            : emailValidation.type === 'success'
                                                ? 'border-green-500 focus-visible:ring-green-500'
                                                : ''
                                    }
                                />

                                {/* Email Validation Feedback */}
                                {email && emailValidation.type && (
                                    <div className="flex items-center gap-2 text-sm">
                                        {emailValidation.type === 'success' ? (
                                            <>
                                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                                <span className="text-green-700">{emailValidation.message}</span>
                                                {emailValidation.role && (
                                                    <Badge variant="default" className="ml-auto">
                                                        {emailValidation.role}
                                                    </Badge>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <AlertCircle className="h-4 w-4 text-red-600" />
                                                <span className="text-red-700">{emailValidation.message}</span>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                required
                                minLength={6}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                Must be at least 6 characters
                            </p>
                        </div>
                        <Button
                            className="w-full"
                            type="submit"
                            disabled={isLoading || (emailValidation.type === 'error' && !!email)}
                        >
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create account
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                    <div className="text-sm text-muted-foreground text-center">
                        Already have an account?{' '}
                        <Link to="/login" className="text-primary hover:underline">
                            Sign in
                        </Link>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}
