import axios from 'axios';

/**
 * Uploads an academic document (PDF, DOCX) to Cloudinary using an Unsigned Upload Preset.
 * 
 * @param file The document file to upload
 * @param cloudName The Cloudinary cloud name
 * @param uploadPreset The Cloudinary unsigned upload preset name
 * @param onProgress Callback function to track upload percentage (0-100)
 * @returns A promise resolving to the secure URL of the uploaded document
 */
export const uploadProjectDocument = async (
    file: File,
    cloudName: string,
    uploadPreset: string,
    onProgress?: (progress: number) => void
): Promise<string> => {
    // 1. Strict Validation
    const maxSize = 5 * 1024 * 1024; // 5MB limit
    if (file.size > maxSize) {
        throw new Error("File size exceeds the 5MB limit.");
    }

    const allowedTypes = [
        'application/pdf', 
        'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(pdf|doc|docx)$/i)) {
        throw new Error("Invalid file type. Only PDF, DOC, and DOCX are allowed.");
    }

    // 2. Prepare Form Data
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);
    // Explicitly set resource type for Cloudinary
    formData.append('resource_type', 'raw');

    // Use the raw/upload endpoint specifically for documents
    const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`;

    try {
        const response = await axios.post(cloudinaryUrl, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            onUploadProgress: (progressEvent) => {
                if (progressEvent.total && onProgress) {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    onProgress(percentCompleted);
                }
            },
        });

        // 3. Return the securely hosted URL
        return response.data.secure_url;
    } catch (error: any) {
        console.error('Cloudinary upload failed:', error);
        throw new Error(error?.response?.data?.error?.message || 'Failed to upload document to Cloudinary.');
    }
};
