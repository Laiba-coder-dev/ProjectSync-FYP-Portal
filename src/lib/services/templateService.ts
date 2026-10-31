import { collection, addDoc, getDocs, doc, deleteDoc, updateDoc, serverTimestamp, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { uploadToCloudinary } from '../cloudinaryService';
import type { DocumentTemplate } from '@/types';

const COLLECTION_NAME = 'template_documents';

/**
 * Validates a template file before upload.
 */
export function validateTemplateFile(
  file: File,
  maxSizeMB: number = 25,
  allowedTypes: string[] = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ]
): string | null {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return `File size exceeds ${maxSizeMB}MB limit`;
  }
  if (!allowedTypes.includes(file.type)) {
    return 'Invalid file type. Only PDF, DOC, DOCX, PPT, and PPTX files are allowed';
  }
  return null;
}

/**
 * Uploads a new template document.
 */
export async function uploadTemplate(
  data: { title: string; description: string; category: string; userId: string },
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  try {
    const validationError = validateTemplateFile(file);
    if (validationError) throw new Error(validationError);

    const folder = `fyp-portal/templates/${data.category.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const uploadResult = await uploadToCloudinary(file, folder, onProgress);

    const docData = {
      title: data.title,
      description: data.description,
      category: data.category,
      fileUrl: uploadResult.url,
      fileName: file.name,
      fileSize: uploadResult.size,
      fileType: file.type,
      uploadedBy: data.userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), docData);
    return docRef.id;
  } catch (error) {
    console.error('Error uploading template:', error);
    throw error;
  }
}

/**
 * Updates an existing template document.
 */
export async function updateTemplate(
  id: string,
  data: { title?: string; description?: string; category?: string },
  newFile?: File,
  onProgress?: (progress: number) => void
): Promise<void> {
  try {
    const updateData: any = { ...data, updatedAt: serverTimestamp() };

    if (newFile) {
      const validationError = validateTemplateFile(newFile);
      if (validationError) throw new Error(validationError);

      const category = data.category || 'uncategorized';
      const folder = `fyp-portal/templates/${category.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const uploadResult = await uploadToCloudinary(newFile, folder, onProgress);
      
      updateData.fileUrl = uploadResult.url;
      updateData.fileName = newFile.name;
      updateData.fileSize = uploadResult.size;
      updateData.fileType = newFile.type;
    }

    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, updateData);
  } catch (error) {
    console.error('Error updating template:', error);
    throw error;
  }
}

/**
 * Deletes a template document.
 */
export async function deleteTemplate(id: string): Promise<void> {
  try {
    // Note: Cloudinary file deletion requires a server-side endpoint with API secrets.
    // For now, we only delete the Firestore reference.
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting template:', error);
    throw error;
  }
}

/**
 * Fetches all template documents, optionally filtered by category.
 */
export async function getTemplates(category?: string): Promise<DocumentTemplate[]> {
  try {
    const colRef = collection(db, COLLECTION_NAME);
    let q;

    if (category && category !== 'All') {
      q = query(colRef, where('category', '==', category), orderBy('createdAt', 'desc'));
    } else {
      q = query(colRef, orderBy('createdAt', 'desc'));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(),
      } as DocumentTemplate;
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    throw error;
  }
}
