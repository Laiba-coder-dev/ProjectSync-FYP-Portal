import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Loader2, Download, FileText, Calendar } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Submission {
    id: string;
    groupName: string;
    documentType: string;
    fileName: string;
    fileUrl: string;
    uploadedAt: Date;
    uploadedBy: string;
}

export default function DocumentRepository() {
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<string>('all');

    useEffect(() => {
        fetchSubmissions();
    }, []);

    const fetchSubmissions = async () => {
        setLoading(true);
        try {
            const submissionsSnapshot = await getDocs(
                query(collection(db, 'submissions'), orderBy('submittedAt', 'desc'))
            );

            if (submissionsSnapshot.empty) {
                setSubmissions([]);
                return;
            }

            // Collect unique groupIds to avoid N+1 queries — fetch all needed groups in one pass
            const groupIdSet = new Set<string>();
            submissionsSnapshot.docs.forEach(doc => {
                const gid = doc.data().groupId;
                if (gid) groupIdSet.add(gid);
            });

            // Build a groupId → name map from a single query (batch by 10 for Firestore 'in' limit)
            const groupNameMap: Record<string, string> = {};
            const groupIds = Array.from(groupIdSet);
            for (let i = 0; i < groupIds.length; i += 10) {
                const batch = groupIds.slice(i, i + 10);
                const groupsSnap = await getDocs(
                    query(collection(db, 'groups'), where('__name__', 'in', batch))
                );
                groupsSnap.docs.forEach(g => {
                    groupNameMap[g.id] = g.data().name || 'Unknown Group';
                });
            }

            // Collect unique userIds to fetch names
            const userIdSet = new Set<string>();
            submissionsSnapshot.docs.forEach(doc => {
                const uid = doc.data().submittedBy || doc.data().uploadedBy;
                if (uid) userIdSet.add(uid);
            });

            // Build a userId → name map
            const userNameMap: Record<string, string> = {};
            const userIds = Array.from(userIdSet);
            for (let i = 0; i < userIds.length; i += 10) {
                const batch = userIds.slice(i, i + 10);
                const usersSnap = await getDocs(
                    query(collection(db, 'users'), where('__name__', 'in', batch))
                );
                usersSnap.docs.forEach(u => {
                    userNameMap[u.id] = u.data().name || 'Unknown User';
                });
            }

            const seen = new Set<string>();
            const submissionsList: Submission[] = [];

            submissionsSnapshot.docs.forEach(doc => {
                const data = doc.data();
                const groupId = data.groupId || 'unknown';
                const docType = data.milestoneType || data.documentType || 'General';
                const uniqueKey = `${groupId}_${docType}`;
                const uploaderId = data.submittedBy || data.uploadedBy;

                if (!seen.has(uniqueKey)) {
                    seen.add(uniqueKey);
                    submissionsList.push({
                        id: doc.id,
                        groupName: data.groupId ? (groupNameMap[data.groupId] || 'Unknown Group') : 'Unknown Group',
                        documentType: docType,
                        fileName: data.fileName || 'Untitled Document',
                        fileUrl: data.fileUrl || '',
                        uploadedAt: data.submittedAt?.toDate() || data.uploadedAt?.toDate() || new Date(),
                        uploadedBy: uploaderId ? (userNameMap[uploaderId] || uploaderId) : 'Unknown',
                    });
                }
            });

            setSubmissions(submissionsList);
        } catch (error) {
            console.error('Error fetching submissions:', error);
            toast.error('Failed to load submissions');
        } finally {
            setLoading(false);
        }
    };

    const filteredSubmissions = submissions.filter(s => {
        const matchesSearch =
            s.groupName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.documentType.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesFilter = filterType === 'all' || s.documentType === filterType;

        return matchesSearch && matchesFilter;
    });

    const documentTypes = Array.from(new Set(submissions.map(s => s.documentType)));

    const handleDownload = (url: string, fileName: string) => {
        window.open(url, '_blank');
        toast.success(`Downloading ${fileName}`);
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Document Repository"
                description="Access and view all student submissions and documents"
            />

            <div className="flex gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search by group, file name, or document type..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        {documentTypes.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>All Submissions ({filteredSubmissions.length})</CardTitle>
                        <CardDescription>Complete repository of student documents</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Group Name</TableHead>
                                    <TableHead>Document Type</TableHead>
                                    <TableHead>File Name</TableHead>
                                    <TableHead>Uploaded By</TableHead>
                                    <TableHead>Upload Date</TableHead>
                                    <TableHead>Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredSubmissions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                                            {submissions.length === 0 ? 'No submissions found' : 'No submissions match your search'}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredSubmissions.map((submission) => (
                                        <TableRow key={submission.id}>
                                            <TableCell className="font-medium">{submission.groupName}</TableCell>
                                            <TableCell>
                                                <Badge variant="secondary">{submission.documentType}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                                    <span className="max-w-xs truncate">{submission.fileName}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>{submission.uploadedBy}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <Calendar className="h-3 w-3" />
                                                    {submission.uploadedAt.toLocaleString()}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDownload(submission.fileUrl, submission.fileName)}
                                                >
                                                    <Download className="h-4 w-4 mr-2" />
                                                    Download
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
