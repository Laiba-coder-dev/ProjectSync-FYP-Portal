import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { Progress } from '@/components/ui/progress';
import { BarChart3, CloudUpload, Lock } from 'lucide-react';

export default function ExamCellDashboard() {
    return (
        <div className="space-y-6">
            <PageHeader title="Exam Cell Dashboard" description="Result processing and publication center" />

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Results Compiled</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">75%</div>
                        <Progress value={75} className="mt-2 h-2" />
                        <p className="text-xs text-muted-foreground mt-2">12/16 Groups processed</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Pending External Marks</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-600">4</div>
                        <p className="text-xs text-muted-foreground mt-2">Groups awaiting external viva</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Result Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-muted-foreground">Unpublished</div>
                        <p className="text-xs text-muted-foreground mt-2">Final results are hidden</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Recent Activity</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-3">
                            <CloudUpload className="h-5 w-5 text-blue-500" />
                            <div className="text-sm">
                                <p className="font-medium">Supervisor Marks Imported</p>
                                <p className="text-muted-foreground">Yesterday at 10:00 AM</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Lock className="h-5 w-5 text-orange-500" />
                            <div className="text-sm">
                                <p className="font-medium">Result Compilation Started</p>
                                <p className="text-muted-foreground">2 hours ago</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
