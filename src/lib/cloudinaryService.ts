/**
 * Cloudinary Storage Service
 * Handles file uploads to Cloudinary as an alternative to Firebase Storage
 */

interface CloudinaryUploadResponse {
    secure_url: string;
    public_id: string;
    resource_type: string;
    format: string;
    bytes: number;
}

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
// Use /auto/upload so Cloudinary correctly handles PDF, DOC, DOCX without needing
// the upload preset to be manually configured for 'raw' resource type
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;

/**
 * Upload a file to Cloudinary
 * @param file - The file to upload
 * @param folder - Optional folder path in Cloudinary
 * @param onProgress - Optional callback for upload progress (0-100)
 * @returns Promise with Cloudinary URL and metadata
 */
export async function uploadToCloudinary(
    file: File,
    folder?: string,
    onProgress?: (progress: number) => void
): Promise<{ url: string; publicId: string; size: number }> {
    return new Promise((resolve, reject) => {
        console.log('[CLOUDINARY] Starting upload:', {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            folder,
        });

        // Validate environment variables
        if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
            const error = 'Cloudinary credentials not configured. Check .env file.';
            console.error('[CLOUDINARY]', error);
            reject(new Error(error));
            return;
        }

        // Create form data
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        // Note: resource_type is handled by the upload preset configuration

        if (folder) {
            formData.append('folder', folder);
        }

        console.log('[CLOUDINARY] Form data prepared:', {
            preset: CLOUDINARY_UPLOAD_PRESET,
            folder: folder || 'none',
        });

        // Create XMLHttpRequest for progress tracking
        const xhr = new XMLHttpRequest();

        // Track upload progress
        xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable && onProgress) {
                const progress = Math.round((event.loaded / event.total) * 100);
                console.log(`[CLOUDINARY] Upload progress: ${progress}%`);
                onProgress(progress);
            }
        });

        // Handle successful upload
        xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
                try {
                    const response: CloudinaryUploadResponse = JSON.parse(xhr.responseText);
                    console.log('[CLOUDINARY] Upload successful:', {
                        url: response.secure_url,
                        publicId: response.public_id,
                        size: response.bytes,
                    });

                    resolve({
                        url: response.secure_url,
                        publicId: response.public_id,
                        size: response.bytes,
                    });
                } catch (error) {
                    console.error('[CLOUDINARY] Failed to parse response:', error);
                    reject(new Error('Failed to parse upload response'));
                }
            } else {
                // Extract the actual error message from Cloudinary's response
                let cloudinaryError = `HTTP ${xhr.status}`;
                try {
                    const errBody = JSON.parse(xhr.responseText);
                    cloudinaryError = errBody?.error?.message || cloudinaryError;
                } catch { /* response wasn't JSON */ }
                console.error('[CLOUDINARY] Upload failed:', cloudinaryError);
                console.error('[CLOUDINARY] Full response:', xhr.responseText);
                reject(new Error(`Cloudinary error: ${cloudinaryError}`));
            }
        });

        // Handle errors
        xhr.addEventListener('error', () => {
            console.error('[CLOUDINARY] Network error during upload');
            reject(new Error('Network error during upload'));
        });

        xhr.addEventListener('abort', () => {
            console.error('[CLOUDINARY] Upload aborted');
            reject(new Error('Upload aborted'));
        });

        // Send request
        console.log('[CLOUDINARY] Sending request to:', CLOUDINARY_UPLOAD_URL);
        xhr.open('POST', CLOUDINARY_UPLOAD_URL);
        xhr.send(formData);
    });
}

/**
 * Delete a file from Cloudinary
 * Note: This requires server-side implementation with API secret
 * For now, files can be managed through Cloudinary dashboard
 * @param publicId - The public ID of the file to delete
 */
export async function deleteFromCloudinary(publicId: string): Promise<void> {
    console.warn('[CLOUDINARY] Delete operation requires server-side implementation');
    console.log('[CLOUDINARY] File to delete:', publicId);
    // TODO: Implement server-side deletion endpoint
    throw new Error('Delete operation not yet implemented. Manage files through Cloudinary dashboard.');
}

/**
 * Validate file before upload
 * @param file - File to validate
 * @param maxSizeMB - Maximum file size in MB (default: 10)
 * @param allowedTypes - Allowed MIME types
 * @returns Error message if invalid, null if valid
 */
export function validateFileForCloudinary(
    file: File,
    maxSizeMB: number = 10,
    allowedTypes: string[] = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]
): string | null {
    console.log('[CLOUDINARY] Validating file:', {
        name: file.name,
        size: file.size,
        type: file.type,
    });

    // Check file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
        const errorMsg = `File size exceeds ${maxSizeMB}MB limit`;
        console.error('[CLOUDINARY] Validation failed:', errorMsg);
        return errorMsg;
    }

    // Check file type
    if (!allowedTypes.includes(file.type)) {
        const errorMsg = 'Invalid file type. Only PDF, DOC, and DOCX files are allowed';
        console.error('[CLOUDINARY] Validation failed:', errorMsg, 'Got type:', file.type);
        return errorMsg;
    }

    console.log('[CLOUDINARY] File validation passed');
    return null;
}

/**
 * Generate folder path for Cloudinary uploads
 * @param groupId - Group ID
 * @param milestoneType - Milestone type
 * @returns Folder path
 */
export function generateCloudinaryFolder(
    groupId: string,
    milestoneType: string
): string {
    const folder = `fyp-portal/submissions/${groupId}/${milestoneType}`;
    console.log('[CLOUDINARY] Generated folder:', folder);
    return folder;
}
