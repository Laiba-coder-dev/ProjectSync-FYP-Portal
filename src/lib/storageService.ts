import { storage } from './firebase';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject, UploadTask } from 'firebase/storage';

/**
 * Upload a file to Firebase Storage
 * @param file - The file to upload
 * @param path - Storage path (e.g., 'submissions/groupId/proposal/filename.pdf')
 * @param onProgress - Optional callback for upload progress (0-100)
 * @returns Promise with download URL
 */
export async function uploadFile(
    file: File,
    path: string,
    onProgress?: (progress: number) => void
): Promise<string> {
    return new Promise((resolve, reject) => {
        console.log('[STORAGE] Starting upload:', { path, fileName: file.name, fileSize: file.size, fileType: file.type });

        try {
            const storageRef = ref(storage, path);
            console.log('[STORAGE] Storage ref created:', storageRef.fullPath);

            const uploadTask: UploadTask = uploadBytesResumable(storageRef, file);
            console.log('[STORAGE] Upload task created');

            uploadTask.on(
                'state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    console.log(`[STORAGE] Upload progress: ${progress.toFixed(2)}% (${snapshot.bytesTransferred}/${snapshot.totalBytes} bytes)`);
                    console.log(`[STORAGE] Upload state: ${snapshot.state}`);
                    if (onProgress) {
                        onProgress(Math.round(progress));
                    }
                },
                (error) => {
                    console.error('[STORAGE] Upload failed with error:', error);
                    console.error('[STORAGE] Error code:', error.code);
                    console.error('[STORAGE] Error message:', error.message);
                    console.error('[STORAGE] Error details:', JSON.stringify(error, null, 2));
                    reject(error);
                },
                async () => {
                    try {
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        console.log('[STORAGE] Upload completed successfully!');
                        console.log('[STORAGE] File available at:', downloadURL);
                        resolve(downloadURL);
                    } catch (error) {
                        console.error('[STORAGE] Failed to get download URL:', error);
                        reject(error);
                    }
                }
            );
        } catch (error) {
            console.error('[STORAGE] Failed to initialize upload:', error);
            reject(error);
        }
    });
}

/**
 * Delete a file from Firebase Storage
 * @param path - Storage path of the file to delete
 */
export async function deleteFile(path: string): Promise<void> {
    try {
        const storageRef = ref(storage, path);
        await deleteObject(storageRef);
        console.log('[STORAGE] File deleted:', path);
    } catch (error) {
        console.error('[STORAGE] Delete failed:', error);
        throw error;
    }
}

/**
 * Get download URL for a file
 * @param path - Storage path of the file
 * @returns Promise with download URL
 */
export async function getFileDownloadURL(path: string): Promise<string> {
    try {
        const storageRef = ref(storage, path);
        const url = await getDownloadURL(storageRef);
        return url;
    } catch (error) {
        console.error('[STORAGE] Failed to get download URL:', error);
        throw error;
    }
}

/**
 * Validate file before upload
 * @param file - File to validate
 * @param maxSizeMB - Maximum file size in MB (default: 10)
 * @param allowedTypes - Allowed MIME types
 * @returns Error message if invalid, null if valid
 */
export function validateFile(
    file: File,
    maxSizeMB: number = 10,
    allowedTypes: string[] = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
): string | null {
    console.log('[STORAGE] Validating file:', { name: file.name, size: file.size, type: file.type });

    // Check file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
        const errorMsg = `File size exceeds ${maxSizeMB}MB limit`;
        console.error('[STORAGE] Validation failed:', errorMsg);
        return errorMsg;
    }

    // Check file type
    if (!allowedTypes.includes(file.type)) {
        const errorMsg = 'Invalid file type. Only PDF, DOC, and DOCX files are allowed';
        console.error('[STORAGE] Validation failed:', errorMsg, 'Got type:', file.type);
        return errorMsg;
    }

    console.log('[STORAGE] File validation passed');
    return null;
}

/**
 * Generate storage path for a submission
 * @param groupId - Group ID
 * @param milestoneType - Milestone type
 * @param fileName - Original file name
 * @returns Storage path
 */
export function generateSubmissionPath(
    groupId: string,
    milestoneType: string,
    fileName: string
): string {
    // Clean filename to remove special characters
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const timestamp = Date.now();
    const path = `submissions/${groupId}/${milestoneType}/${timestamp}_${cleanFileName}`;
    console.log('[STORAGE] Generated path:', path);
    return path;
}
