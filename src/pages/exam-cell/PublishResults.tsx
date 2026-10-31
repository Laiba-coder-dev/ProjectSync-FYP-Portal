import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Lock, Unlock, Upload, Eye } from 'lucide-react';
import { toast } from 'sonner';

export default function PublishResults() {
    const [isPublished, setIsPublished] = useState(false);

    const handlePublish = () => {
        setIsPublished(true);
        toast.success('Results have been published to students');
    };

    return (
        <div className="space-y-6">
            <PageHeader title="Publish Results" description="Finalize and release results to students" />

            <Alert variant={isPublished ? "default" : "destructive"}>
                {isPublished ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                <AlertTitle>{isPublished ? 'Results Public' : 'Results Private'}</AlertTitle>
                <AlertDescription>
                    {isPublished
                        ? 'Final results are currently visible to all students on their dashboards.'
                        : 'Results are currently hidden. Students cannot see their final grades.'}
                </AlertDescription>
            </Alert>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Final Verification</CardTitle>
                        <CardDescription>Steps to clear before publishing</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-2">
                            <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center text-[10px] text-white">✓</div>
                            <span>Supervisor marks locked</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center text-[10px] text-white">✓</div>
                            <span>External marks locked</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center text-[10px] text-white">✓</div>
                            <span>Exam cell audit complete</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        <Button variant="outline" className="w-full">
                            <Eye className="mr-2 h-4 w-4" />
                            Preview Student View
                        </Button>
                        <Button
                            size="lg"
                            variant={isPublished ? "secondary" : "default"}
                            onClick={handlePublish}
                            disabled={isPublished}
                        >
                            {isPublished ? 'Published' : 'Publish Results Now'}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
