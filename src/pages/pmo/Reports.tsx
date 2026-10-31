import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { FileSpreadsheet, Download } from 'lucide-react';

export default function Reports() {
    const reports = [
        { title: 'Project Status Report', desc: 'Overview of all project statuses', type: 'PDF' },
        { title: 'Supervisor Load Report', desc: 'Number of groups per supervisor', type: 'CSV' },
        { title: 'Evaluation Summary', desc: 'Consolidated marks for all groups', type: 'Excel' },
    ];

    return (
        <div className="space-y-6">
            <PageHeader title="Reports" description="Generate and export system reports" />

            <div className="grid gap-4">
                {reports.map((report, idx) => (
                    <Card key={idx}>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-primary/10 rounded-lg">
                                    <FileSpreadsheet className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <CardTitle className="text-base">{report.title}</CardTitle>
                                    <CardDescription>{report.desc}</CardDescription>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm">
                                <Download className="mr-2 h-4 w-4" />
                                Export {report.type}
                            </Button>
                        </CardHeader>
                    </Card>
                ))}
            </div>
        </div>
    );
}
