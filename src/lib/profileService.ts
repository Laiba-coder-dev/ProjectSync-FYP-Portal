import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import { Student } from '@/types';

/**
 * Update student profile information in Firestore
 */
export async function updateStudentProfile(
    userId: string,
    data: Partial<Student>
): Promise<void> {
    try {
        const userRef = doc(db, 'users', userId);

        // Convert Date objects to Firestore Timestamps
        const updateData: any = { ...data };
        if (data.dateOfBirth instanceof Date) {
            updateData.dateOfBirth = Timestamp.fromDate(data.dateOfBirth);
        }

        await updateDoc(userRef, updateData);
    } catch (error) {
        console.error('Error updating student profile:', error);
        throw new Error('Failed to update profile. Please try again.');
    }
}

/**
 * Upload profile picture to Firebase Storage and return the download URL
 */
export async function uploadProfilePicture(
    userId: string,
    file: File
): Promise<string> {
    try {
        // Validate file type
        const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            throw new Error('Invalid file type. Please upload a JPEG, PNG, or WebP image.');
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            throw new Error('File size too large. Maximum size is 5MB.');
        }

        // Create a unique filename
        const timestamp = Date.now();
        const extension = file.name.split('.').pop();
        const filename = `avatars/${userId}_${timestamp}.${extension}`;

        // Upload to Firebase Storage
        const storageRef = ref(storage, filename);
        await uploadBytes(storageRef, file);

        // Get download URL
        const downloadURL = await getDownloadURL(storageRef);

        // Update user document with new avatar URL
        await updateDoc(doc(db, 'users', userId), {
            avatar: downloadURL,
        });

        return downloadURL;
    } catch (error) {
        console.error('Error uploading profile picture:', error);
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Failed to upload profile picture. Please try again.');
    }
}
