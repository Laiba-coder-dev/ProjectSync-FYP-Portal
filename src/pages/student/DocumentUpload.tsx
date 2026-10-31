import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useStudentData } from '@/hooks/useStudentData';
import { useSubmissions } from '@/hooks/useSubmissions';
import { DocumentViewerList } from '@/components/shared/DocumentViewerList';
import { Upload, FileText, Download, MessageSquare, Clock, CheckCircle2, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { uploadToCloudinary, validateFileForCloudinary, generateCloudinaryFolder } from '@/lib/services';
import { createNotification } from '@/lib/services';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import type { MilestoneType } from '@/types';

const milestones = [
  { id: 'proposal' as MilestoneType, label: 'Proposal', description: 'Initial project proposal' },
  { id: 'mid_term' as MilestoneType, label: 'Mid-Term', description: 'Progress report' },
  { id: 'final' as MilestoneType, label: 'Final', description: 'Complete project submission' },
];

export default function DocumentUpload() {
  const { user } = useAuth();
  const { group, project, loading: dataLoading } = useStudentData();
  const { submissions, loading: submissionsLoading } = useSubmissions(group?.id, project?.id);

  const [selectedMilestone, setSelectedMilestone] = useState<MilestoneType>('proposal');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const isLoading = dataLoading || submissionsLoading;

  // Get submissions for each milestone
  const getSubmissionsForMilestone = (milestoneId: MilestoneType) => {
    return submissions.filter(s => s.milestoneType === milestoneId);
  };

  // Get latest submission for milestone
  const getLatestSubmission = (milestoneId: MilestoneType) => {
    const milestoneSubmissions = getSubmissionsForMilestone(milestoneId);
    return milestoneSubmissions.sort((a, b) => b.version - a.version)[0] || null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validationError = validateFileForCloudinary(file);

      if (validationError) {
        toast.error(validationError);
        return;
      }

      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file to upload');
      return;
    }

    if (!group || !project) {
      toast.error('You must be part of a group with a project to upload documents');
      return;
    }

    if (!user) {
      toast.error('You must be logged in to upload documents');
      return;
    }

    try {
      console.log('[UPLOAD] Starting upload process...');
      console.log('[UPLOAD] User:', user.id, user.email);
      console.log('[UPLOAD] Group:', group.id);
      console.log('[UPLOAD] Project:', project.id);
      console.log('[UPLOAD] File:', selectedFile.name, selectedFile.size, selectedFile.type);

      setUploading(true);
      setUploadProgress(0);

      // Generate Cloudinary folder path
      const cloudinaryFolder = generateCloudinaryFolder(group.id, selectedMilestone);
      console.log('[UPLOAD] Cloudinary folder:', cloudinaryFolder);

      // Upload file to Cloudinary
      console.log('[UPLOAD] Calling uploadToCloudinary...');
      const uploadResult = await uploadToCloudinary(selectedFile, cloudinaryFolder, (progress) => {
        console.log('[UPLOAD] Progress callback:', progress);
        setUploadProgress(progress);
      });
      console.log('[UPLOAD] Upload complete, file URL:', uploadResult.url);

      // Get current version number
      const existingSubmissions = getSubmissionsForMilestone(selectedMilestone);
      const newVersion = existingSubmissions.length > 0
        ? Math.max(...existingSubmissions.map(s => s.version)) + 1
        : 1;
      console.log('[UPLOAD] New version:', newVersion);

      // Create submission document in Firestore
      console.log('[UPLOAD] Creating Firestore document...');
      await addDoc(collection(db, 'submissions'), {
        projectId: project.id,
        groupId: group.id,
        milestoneType: selectedMilestone,
        title: `${milestones.find(m => m.id === selectedMilestone)?.label} Submission`,
        description: description.trim() || null,
        fileUrl: uploadResult.url,
        fileName: selectedFile.name,
        fileSize: uploadResult.size,
        version: newVersion,
        status: 'uploaded',
        submittedAt: serverTimestamp(),
        submittedBy: user.id,
      });
      console.log('[UPLOAD] Firestore document created successfully');

      // Notify supervisor about the document upload
      if (group.supervisorId) {
        const milestoneLabel = milestones.find(m => m.id === selectedMilestone)?.label || 'Document';
        createNotification({
          userId: group.supervisorId,
          type: 'general',
          title: `New Document Upload: ${milestoneLabel}`,
          message: `Group ${group.name} has uploaded a new version of their ${milestoneLabel} document.`,
          link: '/supervisor/documents'
        }).catch(err => console.error('Failed to notify supervisor:', err));
      }

      toast.success(`Document uploaded successfully! (Version ${newVersion})`);
      setSelectedFile(null);
      setDescription('');
      setUploadProgress(0);
      // Clear the file input element visually
      const fileInput = document.getElementById('file') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error: any) {
      console.error('[UPLOAD] Upload error:', error);
      console.error('[UPLOAD] Error code:', error.code);
      console.error('[UPLOAD] Error message:', error.message);
      console.error('[UPLOAD] Full error:', JSON.stringify(error, null, 2));

      let errorMessage = 'Failed to upload. ';

      if (error.message?.includes('Cloudinary credentials') || error.message?.includes('not configured')) {
        errorMessage += 'Upload service not configured. Contact administrator.';
      } else if (error.message?.includes('Network error')) {
        errorMessage += 'Network error. Check your connection.';
      } else if (error.message?.includes('Cloudinary error:')) {
        // Show the actual Cloudinary reason (e.g. "Upload preset not found")
        errorMessage = error.message;
      } else if (error.message) {
        errorMessage += error.message;
      }

      toast.error(errorMessage, { duration: 6000 });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = (fileUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Calculate progress
  const completedMilestones = milestones.filter(m => getLatestSubmission(m.id)).length;
  const progressPercentage = (completedMilestones / milestones.length) * 100;

  if (isLoading) {
    return (
      <div className="space-y-6 pb-16 lg:pb-0">
        <PageHeader
          title="Document Upload"
          description="Upload and manage your project documents"
        />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!group || !project) {
    return (
      <div className="space-y-6 pb-16 lg:pb-0">
        <PageHeader
          title="Document Upload"
          description="Upload and manage your project documents"
        />
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              You need to be part of a group with an approved project to upload documents.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16 lg:pb-0">
      <PageHeader
        title="Document Upload"
        description="Upload and manage your project documents"
      />

      {/* Progress Overview */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Submission Progress</span>
            <span className="text-sm text-muted-foreground">
              {completedMilestones}/{milestones.length} completed
            </span>
          </div>
          <Progress value={Math.min(Math.max(progressPercentage, 0), 100)} className="h-2" />
        </CardContent>
      </Card>

      {/* Milestone Tabs */}
      <Tabs value={selectedMilestone} onValueChange={(v) => setSelectedMilestone(v as MilestoneType)}>
        <TabsList className="grid w-full grid-cols-3">
          {milestones.map((milestone) => {
            const submission = getLatestSubmission(milestone.id);
            return (
              <TabsTrigger key={milestone.id} value={milestone.id} className="relative">
                {milestone.label}
                {submission && (
                  <CheckCircle2 className="absolute -top-1 -right-1 h-4 w-4 text-success" />
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {milestones.map((milestone) => {
          const latestSubmission = getLatestSubmission(milestone.id);
          const allVersions = getSubmissionsForMilestone(milestone.id).sort((a, b) => b.version - a.version);

          return (
            <TabsContent key={milestone.id} value={milestone.id} className="space-y-6 mt-6">
              {/* Existing Submission */}
              {latestSubmission && (
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">Current Submission</CardTitle>
                        <CardDescription>Version {latestSubmission.version}</CardDescription>
                      </div>
                      <StatusBadge status={latestSubmission.status} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* File Info */}
                    <div className="flex items-center gap-4 rounded-lg border p-4">
                      <FileText className="h-10 w-10 text-primary" />
                      <div className="flex-1">
                        <p className="font-medium">{latestSubmission.fileName}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatFileSize(latestSubmission.fileSize)} • Uploaded {format(latestSubmission.submittedAt, 'MMM d, yyyy')}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(latestSubmission.fileUrl, latestSubmission.fileName)}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </Button>
                    </div>

                    {/* Similarity Score */}
                    {latestSubmission.similarityScore !== undefined && (
                      <div className="flex items-center gap-2 rounded-lg border p-3">
                        <Badge variant={latestSubmission.similarityScore < 20 ? 'default' : 'destructive'}>
                          {latestSubmission.similarityScore}% Similarity
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {latestSubmission.similarityScore < 20 ? 'Within acceptable range' : 'Please review for plagiarism'}
                        </span>
                      </div>
                    )}

                    {/* Feedback */}
                    {latestSubmission.feedback && (
                      <div className="rounded-lg border p-4 bg-muted/30">
                        <div className="flex items-center gap-2 mb-2">
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Supervisor Feedback</span>
                        </div>
                        <p className="text-sm">{latestSubmission.feedback}</p>
                        {latestSubmission.reviewedAt && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Reviewed on {format(latestSubmission.reviewedAt, 'MMM d, yyyy')}
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Upload New Version */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {latestSubmission ? 'Upload New Version' : 'Upload Document'}
                  </CardTitle>
                  <CardDescription>
                    {milestone.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="file">Select File</Label>
                    <div className="flex items-center gap-4">
                      <Input
                        id="file"
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={handleFileChange}
                        className="flex-1"
                        disabled={uploading}
                      />
                    </div>
                    {selectedFile && (
                      <p className="text-sm text-muted-foreground">
                        Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Accepted formats: PDF, DOC, DOCX. Max size: 10MB
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Textarea
                      id="description"
                      placeholder="Add notes about this submission..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      disabled={uploading}
                    />
                  </div>

                  {uploading && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Uploading...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <Progress value={Math.min(Math.max(uploadProgress, 0), 100)} className="h-2" />
                    </div>
                  )}

                  <Button onClick={handleUpload} className="w-full sm:w-auto" disabled={uploading || !selectedFile}>
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Document
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Version History */}
              {allVersions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Version History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {allVersions.map((version) => (
                        <div
                          key={version.id}
                          className="flex items-center justify-between rounded-lg border p-3"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">Version {version.version}</p>
                              <p className="text-xs text-muted-foreground">
                                Uploaded {format(version.submittedAt, 'MMM d, yyyy')}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(version.fileUrl, version.fileName)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Universal Document Viewer */}
      <div className="mt-8">
        <h3 className="text-lg font-medium mb-4">All Uploaded Documents</h3>
        <DocumentViewerList groupId={group.id} />
      </div>
    </div>
  );
}
