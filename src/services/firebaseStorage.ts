import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';

/**
 * Uploads a document to Firebase Cloud Storage and tracks its progress.
 * @param file The file to upload.
 * @param groupId The ID of the group uploading the document.
 * @param phase The project phase (e.g., 'proposal', 'mid-evaluation', 'final').
 * @param onProgress Callback function to track upload percentage (0-100).
 * @returns A promise resolving to the final download URL of the uploaded file.
 */
export const uploadProjectDocument = (
    file: File,
    groupId: string,
    phase: string,
    onProgress?: (progress: number) => void
): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (!file || !groupId || !phase) {
            reject(new Error("Missing required parameters for upload."));
            return;
        }

        // 1. Validate file constraints before attempting upload
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            reject(new Error("File size exceeds the 5MB limit."));
            return;
        }

        const allowedTypes = [
            'application/pdf', 
            'application/msword', 
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        if (!allowedTypes.includes(file.type)) {
            reject(new Error("Invalid file type. Only PDF, DOC, and DOCX are allowed."));
            return;
        }

        // 2. Define the exact path in Firebase Storage
        const storageRef = ref(storage, `projects/${groupId}/${phase}/${file.name}`);
        
        // 3. Initiate the upload
        const uploadTask = uploadBytesResumable(storageRef, file);

        // 4. Listen for state changes, errors, and completion
        uploadTask.on(
            'state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                if (onProgress) {
                    onProgress(progress);
                }
            },
            (error) => {
                console.error("Firebase Storage Upload failed:", error);
                reject(error);
            },
            async () => {
                try {
                    // Upload completed successfully, get the download URL
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    resolve(downloadURL);
                } catch (error) {
                    console.error("Failed to retrieve download URL:", error);
                    reject(error);
                }
            }
        );
    });
};
