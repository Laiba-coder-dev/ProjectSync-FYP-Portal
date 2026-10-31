import { useState } from 'react';
import { useForm } from 'react-hook-form';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Upload, FileSpreadsheet, Download, CheckCircle, XCircle } from 'lucide-react';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { setDoc, doc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { db, getSecondaryAuth } from '@/lib/firebase';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import Papa from 'papaparse';
import { Progress } from '@/components/ui/progress';

interface StudentImportRow {
    name: string;
    email: string;
    enrollmentNumber: string;
    semester: number;
    department: string;
}

interface ImportResult {
    success: boolean;
    row: StudentImportRow;
    error?: string;
}

interface BulkImportStudentDialogProps {
    onSuccess?: () => void;
}

export function BulkImportStudentDialog({ onSuccess }: BulkImportStudentDialogProps) {
    const [open, setOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [parsedData, setParsedData] = useState<StudentImportRow[]>([]);
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [results, setResults] = useState<ImportResult[]>([]);
    const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'results'>('upload');
    const { user: currentUser } = useAuth();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        // Validate file type
        const validTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
        if (!validTypes.includes(selectedFile.type) && !selectedFile.name.endsWith('.csv')) {
            toast.error('Please upload a CSV file');
            return;
        }

        setFile(selectedFile);
        parseCSV(selectedFile);
    };

    const parseCSV = (file: File) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const data = results.data as any[];
                const students: StudentImportRow[] = data.map((row: any) => ({
                    name: row.Name || row.name || '',
                    email: row.Email || row.email || '',
                    enrollmentNumber: row['Enrollment Number'] || row.enrollmentNumber || row['Enrollment'] || '',
                    semester: parseInt(row.Semester || row.semester || '8'),
                    department: row.Department || row.department || 'Computer Science',
                })).filter(s => s.name && s.email && s.enrollmentNumber);

                if (students.length === 0) {
                    toast.error('No valid student data found in file');
                    return;
                }

                setParsedData(students);
                setStep('preview');
                toast.success(`Parsed ${students.length} students from file`);
            },
            error: (error) => {
                console.error('CSV parse error:', error);
                toast.error('Failed to parse CSV file');
            },
        });
    };

    const handleImport = async () => {
        if (parsedData.length === 0) return;

        setImporting(true);
        setStep('importing');
        setProgress(0);

        const importResults: ImportResult[] = [];
        const secondaryAuth = getSecondaryAuth();
        const defaultPassword = 'Student'; // Default password for all students

        for (let i = 0; i < parsedData.length; i++) {
            const student = parsedData[i];

            try {
                // Validate email domain
                if (!student.email.endsWith('@uskt.edu.pk')) {
                    throw new Error('Email must end with @uskt.edu.pk');
                }

                // Create Firebase Auth account
                const { user: newUser } = await createUserWithEmailAndPassword(
                    secondaryAuth,
                    student.email,
                    defaultPassword
                );

                // Create Firestore document
                await setDoc(doc(db, 'users', newUser.uid), {
                    name: student.name,
                    email: student.email,
                    role: 'student',
                    enrollmentNumber: student.enrollmentNumber,
                    semester: student.semester,
                    department: student.department,
                    isActive: true,
                    createdAt: serverTimestamp(),
                });

                importResults.push({ success: true, row: student });
            } catch (error: any) {
                console.error(`Failed to import ${student.email}:`, error);
                let errorMsg = 'Unknown error';
                if (error.code === 'auth/email-already-in-use') {
                    errorMsg = 'Email already exists';
                } else if (error.message) {
                    errorMsg = error.message;
                }
                importResults.push({ success: false, row: student, error: errorMsg });
            }

            // Update progress
            setProgress(((i + 1) / parsedData.length) * 100);
        }

        // Sign out from secondary auth
        await signOut(secondaryAuth);

        // Create audit log
        if (currentUser) {
            const successCount = importResults.filter(r => r.success).length;
            const failCount = importResults.filter(r => !r.success).length;

            await addDoc(collection(db, 'audit_logs'), {
                userId: currentUser.id,
                userName: currentUser.name,
                userRole: currentUser.role,
                action: 'BULK_IMPORT_STUDENTS',
                details: `Imported ${successCount} students successfully, ${failCount} failed`,
                timestamp: serverTimestamp(),
            });
        }

        setResults(importResults);
        setStep('results');
        setImporting(false);

        const successCount = importResults.filter(r => r.success).length;
        toast.success(`Successfully imported ${successCount} out of ${parsedData.length} students`);

        if (successCount > 0) {
            onSuccess?.();
        }
    };

    const downloadResults = () => {
        const successRows = results.filter(r => r.success);
        const failedRows = results.filter(r => !r.success);

        let content = 'BULK STUDENT IMPORT RESULTS\n';
        content += `Generated on: ${new Date().toLocaleString()}\n`;
        content += `Total: ${results.length} | Success: ${successRows.length} | Failed: ${failedRows.length}\n`;
        content += '='.repeat(80) + '\n\n';

        content += '--- SUCCESSFULLY IMPORTED ---\n';
        successRows.forEach(r => {
            content += `✓ ${r.row.name} (${r.row.email}) - ${r.row.enrollmentNumber}\n`;
        });

        if (failedRows.length > 0) {
            content += '\n--- FAILED IMPORTS ---\n';
            failedRows.forEach(r => {
                content += `✗ ${r.row.name} (${r.row.email}) - Error: ${r.error}\n`;
            });
        }

        content += '\n--- DEFAULT CREDENTIALS ---\n';
        content += 'Default Password for all students: Student\n';
        content += 'Students should change their password after first login.\n';

        const blob = new Blob([content], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `import_results_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    };

    const downloadTemplate = () => {
        const template = 'Name,Email,Enrollment Number,Semester,Department\n' +
            'Ali Khan,22104338@uskt.edu.pk,22104338,8,Computer Science\n' +
            'Sara Ahmed,22104339@uskt.edu.pk,22104339,8,Computer Science';

        const blob = new Blob([template], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'student_import_template.csv';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Template downloaded');
    };

    const resetDialog = () => {
        setFile(null);
        setParsedData([]);
        setResults([]);
        setProgress(0);
        setStep('upload');
    };

    const handleOpenChange = (newOpen: boolean) => {
        if (importing) return;

        if (!newOpen) {
            resetDialog();
        }
        setOpen(newOpen);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Upload className="mr-2 h-4 w-4" />
                    Import Students (CSV)
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Bulk Import Students</DialogTitle>
                    <DialogDescription>
                        Upload a CSV file to create multiple student accounts at once.
                    </DialogDescription>
                </DialogHeader>

                {step === 'upload' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label>Upload CSV File</Label>
                            <Button variant="ghost" size="sm" onClick={downloadTemplate}>
                                <Download className="mr-2 h-4 w-4" />
                                Download Template
                            </Button>
                        </div>
                        <div className="border-2 border-dashed rounded-lg p-8 text-center">
                            <FileSpreadsheet className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                            <Input
                                type="file"
                                accept=".csv"
                                onChange={handleFileChange}
                                className="max-w-xs mx-auto"
                            />
                            <p className="text-sm text-muted-foreground mt-2">
                                CSV file with columns: Name, Email, Enrollment Number, Semester, Department
                            </p>
                        </div>
                    </div>
                )}

                {step === 'preview' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                                Preview: {parsedData.length} students ready to import
                            </p>
                            <Button variant="ghost" size="sm" onClick={resetDialog}>
                                Change File
                            </Button>
                        </div>
                        <div className="border rounded-lg max-h-[400px] overflow-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Enrollment #</TableHead>
                                        <TableHead>Sem</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {parsedData.slice(0, 10).map((student, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell>{student.name}</TableCell>
                                            <TableCell className="text-xs">{student.email}</TableCell>
                                            <TableCell>{student.enrollmentNumber}</TableCell>
                                            <TableCell>{student.semester}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        {parsedData.length > 10 && (
                            <p className="text-xs text-muted-foreground text-center">
                                Showing first 10 of {parsedData.length} students
                            </p>
                        )}
                        <div className="bg-muted p-3 rounded-lg text-sm">
                            <p><strong>Default Password:</strong> Student</p>
                            <p className="text-muted-foreground text-xs mt-1">
                                All students will be created with this password. They should change it after first login.
                            </p>
                        </div>
                    </div>
                )}

                {step === 'importing' && (
                    <div className="space-y-4 py-8">
                        <div className="text-center">
                            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
                            <p className="text-lg font-medium">Importing Students...</p>
                            <p className="text-sm text-muted-foreground">Please wait, this may take a few minutes</p>
                        </div>
                        <Progress value={Math.min(Math.max(progress, 0), 100)} className="w-full" />
                        <p className="text-center text-sm text-muted-foreground">
                            {Math.round(progress)}% complete
                        </p>
                    </div>
                )}

                {step === 'results' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">Import Complete</p>
                                <p className="text-sm text-muted-foreground">
                                    {results.filter(r => r.success).length} succeeded, {results.filter(r => !r.success).length} failed
                                </p>
                            </div>
                            <Button variant="outline" size="sm" onClick={downloadResults}>
                                <Download className="mr-2 h-4 w-4" />
                                Download Report
                            </Button>
                        </div>
                        <div className="border rounded-lg max-h-[400px] overflow-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-12">Status</TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Details</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {results.map((result, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell>
                                                {result.success ? (
                                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                                ) : (
                                                    <XCircle className="h-4 w-4 text-destructive" />
                                                )}
                                            </TableCell>
                                            <TableCell>{result.row.name}</TableCell>
                                            <TableCell className="text-xs">{result.row.email}</TableCell>
                                            <TableCell className="text-xs">
                                                {result.success ? (
                                                    <span className="text-green-600">Created successfully</span>
                                                ) : (
                                                    <span className="text-destructive">{result.error}</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    {step === 'upload' && (
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                    )}
                    {step === 'preview' && (
                        <>
                            <Button variant="outline" onClick={resetDialog}>
                                Back
                            </Button>
                            <Button onClick={handleImport} disabled={importing}>
                                Import {parsedData.length} Students
                            </Button>
                        </>
                    )}
                    {step === 'results' && (
                        <Button onClick={() => handleOpenChange(false)}>
                            Done
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
