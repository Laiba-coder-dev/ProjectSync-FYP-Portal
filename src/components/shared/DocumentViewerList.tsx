import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExternalLink, FileText, Loader2, AlertCircle, Download, User, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface DocumentSubmission {
    id: string;
    groupId: string;
    milestoneType: string;
    fileUrl: string;
    fileName?: string;
    submittedBy: string;
    status: string;
    submittedAt?: any;
    uploaderName?: string;
}

interface DocumentViewerListProps {
    groupId?: string;
    phase?: string;
}

export function DocumentViewerList({ groupId, phase }: DocumentViewerListProps) {
    const { user } = useAuth();
    const [documents, setDocuments] = useState<DocumentSubmission[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchDocuments = async () => {
            if (!user) return;

            // STRICT GUARD: If groupId is missing and user is not PMO/Admin, block the request
            // This prevents students from accidentally fetching all submissions.
            if (!groupId) {
                setLoading(false);
                setError("No Group ID provided. Cannot fetch documents.");
                return;
            }
            
            try {
                setLoading(true);
                setError(null);
                const token = await auth.currentUser?.getIdToken();
                const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
                
                // Construct the secure group-specific endpoint
                const endpoint = `${backendUrl}/api/submissions/group/${groupId}`;

                const response = await fetch(endpoint, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.status === 403) {
                    throw new Error("You do not have permission to view these documents.");
                }

                if (!response.ok) {
                    throw new Error("Failed to fetch documents. Ensure backend is running.");
                }

                let data: DocumentSubmission[] = await response.json();

                // Optional phase filtering
                if (phase) {
                    data = data.filter(doc => doc.milestoneType === phase);
                }

                // Resolve uploader names
                const uploaderIds = Array.from(new Set(data.map(d => d.submittedBy).filter(Boolean)));
                if (uploaderIds.length > 0) {
                    const nameMap: Record<string, string> = {};
                    // Batch by 10 for Firestore 'in' limit
                    for (let i = 0; i < uploaderIds.length; i += 10) {
                        const batch = uploaderIds.slice(i, i + 10);
                        const usersSnap = await getDocs(query(collection(db, 'users'), where('__name__', 'in', batch)));
                        usersSnap.docs.forEach(u => {
                            nameMap[u.id] = u.data().name || 'Unknown User';
                        });
                    }
                    data = data.map(d => ({
                        ...d,
                        uploaderName: nameMap[d.submittedBy] || d.submittedBy
                    }));
                }

                setDocuments(data);
            } catch (err: any) {
                console.error("Document fetch error:", err);
                setError(err.message || "An unexpected error occurred.");
            } finally {
                setLoading(false);
            }
        };

        fetchDocuments();
    }, [user, groupId, phase]);

    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'N/A';
        if (timestamp._seconds) {
            return new Date(timestamp._seconds * 1000).toLocaleString();
        }
        return new Date(timestamp).toLocaleString();
    };

    const handleDownload = (url: string, fileName: string) => {
        // For Cloudinary images (including PDFs uploaded as images), fl_attachment forces download
        const downloadUrl = url.includes('/upload/') && !url.includes('/raw/')
            ? url.replace('/upload/', '/upload/fl_attachment/') 
            : url;
            
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.setAttribute('download', fileName || 'document');
        link.setAttribute('target', '_blank');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Uploaded Documents</CardTitle>
                    <CardDescription>Fetching securely hosted documents...</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center py-6">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        );
    }

    if (documents.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Uploaded Documents</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed rounded-md bg-muted/20">
                        <FileText className="h-10 w-10 text-muted-foreground mb-3" />
                        <h3 className="font-medium">No Documents Found</h3>
                        <p className="text-sm text-muted-foreground">
                            No uploaded documents are available for this context.
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Uploaded Documents</CardTitle>
                <CardDescription>Access and review securely hosted project documents.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Phase / Type</TableHead>
                            {!groupId && <TableHead>Group ID</TableHead>}
                            <TableHead>Uploaded By</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Uploaded At</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {documents.map((doc) => (
                            <TableRow key={doc.id}>
                                <TableCell className="font-medium capitalize">
                                    {doc.milestoneType}
                                </TableCell>
                                {!groupId && (
                                    <TableCell>
                                        <Badge variant="outline">{doc.groupId}</Badge>
                                    </TableCell>
                                )}
                                <TableCell className="text-muted-foreground text-sm">
                                    <div className="flex items-center gap-2">
                                        <User className="h-3 w-3" />
                                        {doc.uploaderName || 'Unknown'}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={doc.status === 'approved' ? 'default' : 'secondary'} className="capitalize">
                                        {doc.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-3 w-3" />
                                        {formatDate(doc.submittedAt)}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button 
                                            variant="ghost" 
                                            size="sm"
                                            onClick={() => window.open(doc.fileUrl, '_blank')}
                                            title="View in Browser"
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                        </Button>
                                        <Button 
                                            variant="outline" 
                                            size="sm"
                                            onClick={() => handleDownload(doc.fileUrl, doc.fileName || 'submission.pdf')}
                                        >
                                            <Download className="mr-2 h-4 w-4" />
                                            Download
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
