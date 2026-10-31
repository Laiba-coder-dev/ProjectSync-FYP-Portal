import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { UploadCloud, FileText, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { uploadProjectDocument } from '@/services/cloudinaryStorage';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface DocumentUploadCardProps {
    groupId: string;
    phase: string;
    onUploadSuccess?: (downloadUrl: string) => void;
}

export function DocumentUploadCard({ groupId, phase, onUploadSuccess }: DocumentUploadCardProps) {
    const { user } = useAuth();
    const [file, setFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    const validateFile = (selectedFile: File): boolean => {
        setError(null);
        
        // Size validation (5MB)
        const maxSize = 5 * 1024 * 1024;
        if (selectedFile.size > maxSize) {
            setError('File size exceeds the 5MB limit.');
            return false;
        }

        // Type validation
        const allowedTypes = [
            'application/pdf', 
            'application/msword', 
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        if (!allowedTypes.includes(selectedFile.type) && !selectedFile.name.match(/\.(pdf|doc|docx)$/i)) {
            setError('Invalid file type. Only PDF, DOC, and DOCX are allowed.');
            return false;
        }

        return true;
    };

    const handleFileSelect = (selectedFile: File) => {
        if (validateFile(selectedFile)) {
            setFile(selectedFile);
            setIsSuccess(false);
            setUploadProgress(0);
        }
    };

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const onDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    };

    const removeFile = () => {
        setFile(null);
        setError(null);
        setIsSuccess(false);
        setUploadProgress(0);
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const handleUpload = async () => {
        if (!file || !user) return;

        if (!CLOUD_NAME || !UPLOAD_PRESET) {
            toast.error("Cloudinary configuration is missing from environment variables.");
            return;
        }

        setIsUploading(true);
        setError(null);

        try {
            // Step 2 & 5: Upload to Cloudinary and get URL
            const secureUrl = await uploadProjectDocument(
                file,
                CLOUD_NAME,
                UPLOAD_PRESET,
                (progress) => setUploadProgress(progress)
            );

            // Step 4: Send the secure URL to the ASP.NET Core backend
            const token = await user.getIdToken();
            const response = await fetch('http://localhost:5000/api/submissions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    GroupId: groupId,
                    Phase: phase,
                    DocumentUrl: secureUrl,
                    SubmittedByUid: user.id
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => null);
                throw new Error(errData?.error || 'Failed to save submission to backend database.');
            }

            setIsSuccess(true);
            toast.success('Document uploaded successfully!');
            
            if (onUploadSuccess) {
                onUploadSuccess(secureUrl);
            }
        } catch (err: any) {
            console.error('Upload flow error:', err);
            setError(err.message || 'An error occurred during upload.');
            toast.error('Upload failed. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Upload Document</CardTitle>
                <CardDescription>
                    Upload your proposal or report document (Max 5MB. PDF or DOCX).
                </CardDescription>
            </CardHeader>
            <CardContent>
                {!file && !isSuccess && (
                    <div
                        className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
                            isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
                        }`}
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onDrop={onDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="font-medium text-lg mb-1">Click or drag file to this area to upload</h3>
                        <p className="text-sm text-muted-foreground">Support for a single PDF or DOCX file.</p>
                        <input
                            type="file"
                            className="hidden"
                            ref={fileInputRef}
                            accept=".pdf,.doc,.docx"
                            onChange={(e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                    handleFileSelect(e.target.files[0]);
                                }
                            }}
                        />
                    </div>
                )}

                {error && (
                    <div className="mt-4 flex items-start gap-2 text-destructive bg-destructive/10 p-3 rounded-md text-sm">
                        <AlertCircle className="h-5 w-5 shrink-0" />
                        <p>{error}</p>
                    </div>
                )}

                {file && (
                    <div className="mt-4 space-y-4 border rounded-lg p-4 bg-muted/30">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="bg-primary/10 p-2 rounded-md">
                                    <FileText className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <p className="font-medium text-sm line-clamp-1">{file.name}</p>
                                    <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                                </div>
                            </div>
                            {!isUploading && !isSuccess && (
                                <Button variant="ghost" size="icon" onClick={removeFile} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                        </div>

                        {isUploading && (
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Uploading to Cloudinary...</span>
                                    <span>{uploadProgress}%</span>
                                </div>
                                <Progress value={Math.min(Math.max(uploadProgress, 0), 100)} className="h-2" />
                            </div>
                        )}

                        {isSuccess && (
                            <div className="flex items-center gap-2 text-green-600 dark:text-green-500 text-sm font-medium">
                                <CheckCircle2 className="h-5 w-5" />
                                <span>Upload successful and saved!</span>
                            </div>
                        )}

                        {!isUploading && !isSuccess && (
                            <div className="flex justify-end pt-2">
                                <Button onClick={handleUpload}>
                                    Upload File
                                </Button>
                            </div>
                        )}
                        
                        {isUploading && (
                             <div className="flex justify-end pt-2">
                                <Button disabled>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Processing...
                                </Button>
                             </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
