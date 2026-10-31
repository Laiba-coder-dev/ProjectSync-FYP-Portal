import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function AcademicConfig() {
    return (
        <div className="space-y-6">
            <PageHeader title="Academic Configuration" description="Set global deadlines and academic session settings" />

            <Card>
                <CardHeader>
                    <CardTitle>Milestone Deadlines</CardTitle>
                    <CardDescription>Configure auto-lock dates for student submissions</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Project Proposal Deadline</Label>
                            <Input type="date" />
                        </div>
                        <div className="space-y-2">
                            <Label>Mid-Term Evaluation Start</Label>
                            <Input type="date" />
                        </div>
                        <div className="space-y-2">
                            <Label>Final Report Submission</Label>
                            <Input type="date" />
                        </div>
                        <div className="space-y-2">
                            <Label>Final Viva Week</Label>
                            <Input type="week" />
                        </div>
                    </div>
                    <Button>Save Configuration</Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Session Settings</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4">
                        <div className="w-full space-y-2">
                            <Label>Active Academic Session</Label>
                            <Input defaultValue="Fall 2024" />
                        </div>
                        <div className="w-full space-y-2">
                            <Label>Max Group Size</Label>
                            <Input type="number" defaultValue="3" />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
