// ============================================================
// services.ts — Consolidated Utility & Service Layer
//
// This file merges the following former modules:
//   • lib/utils.ts            — cn() class-name helper
//   • lib/emailValidation.ts  — email domain/role validation
//   • lib/storageService.ts   — Firebase Storage helpers
//   • lib/profileService.ts   — student profile & avatar upload
//   • lib/cloudinaryService.ts — Cloudinary upload alternative
//   • lib/NotificationService.ts — Firestore notification helpers
// ============================================================

// ── External dependencies ──────────────────────────────────
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject, uploadBytes, UploadTask } from 'firebase/storage';
import { doc, updateDoc, Timestamp, collection, addDoc, query, where, getDocs, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, storage } from './firebase';
import type { UserRole, Student, NotificationType } from '@/types';

// ============================================================
// SECTION 1 — Class Name Helper (formerly utils.ts)
// ============================================================

/**
 * Merges Tailwind CSS class names, resolving conflicts intelligently.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================================
// SECTION 2 — Email Validation (formerly emailValidation.ts)
// ============================================================

/**
 * Email Validation and Role Assignment Utilities
 *
 * Enforces strict email-based authentication rules:
 * - Only @uskt.edu.pk domain allowed
 * - Automatic role assignment based on email pattern
 */

// Allowed email domain
const ALLOWED_DOMAIN = '@uskt.edu.pk';

// Email pattern regexes
const STUDENT_PATTERN = /^[0-9]+.*@uskt\.edu\.pk$/i;
const TEACHER_PATTERN = /^[A-Za-z].*@uskt\.edu\.pk$/i;
const DOMAIN_PATTERN = /@uskt\.edu\.pk$/i;

/**
 * Validates if email ends with the allowed domain.
 */
export function isValidDomain(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  return DOMAIN_PATTERN.test(email.trim().toLowerCase());
}

/**
 * Extracts the local-part from an email address.
 */
function getLocalPart(email: string): string {
  return email.split('@')[0] || '';
}

/**
 * Determines user role based on email pattern.
 * - Student: local-part starts with digit(s)
 * - Supervisor (Teacher/Staff): local-part starts with letter(s)
 */
export function getEmailRole(email: string): 'student' | 'supervisor' | null {
  if (!email || typeof email !== 'string') return null;
  const normalizedEmail = email.trim().toLowerCase();
  if (STUDENT_PATTERN.test(normalizedEmail)) return 'student';
  if (TEACHER_PATTERN.test(normalizedEmail)) return 'supervisor';
  return null;
}

/**
 * Comprehensive email validation with role determination.
 * Primary validation function used during authentication.
 */
export function validateEmailAndGetRole(email: string): {
  isValid: boolean;
  role: 'student' | 'supervisor' | null;
  error?: string;
} {
  if (!email || typeof email !== 'string' || email.trim() === '') {
    return { isValid: false, role: null, error: 'Email address is required' };
  }

  const normalizedEmail = email.trim();

  if (!isValidDomain(normalizedEmail)) {
    return { isValid: false, role: null, error: 'Only @uskt.edu.pk email addresses are allowed' };
  }

  const role = getEmailRole(normalizedEmail);
  if (!role) {
    return {
      isValid: false,
      role: null,
      error: 'Invalid email format. Email must start with letters (for staff) or numbers (for students)',
    };
  }

  return { isValid: true, role };
}

/**
 * Client-side helper to get role display name from email.
 */
export function getRoleDisplayName(email: string): string | null {
  const role = getEmailRole(email);
  if (!role) return null;
  return role === 'student' ? 'Student' : 'Teacher/Staff';
}

/**
 * Validates email for display purposes (non-blocking).
 * Returns user-friendly messages for UI feedback.
 */
export function getEmailValidationMessage(email: string): {
  type: 'success' | 'error' | 'warning' | null;
  message: string | null;
  role: string | null;
} {
  if (!email || email.trim() === '') return { type: null, message: null, role: null };

  const validation = validateEmailAndGetRole(email);

  if (!validation.isValid) {
    return { type: 'error', message: validation.error || 'Invalid email', role: null };
  }

  return {
    type: 'success',
    message: `Valid ${validation.role === 'student' ? 'student' : 'teacher/staff'} email`,
    role: validation.role === 'student' ? 'Student' : 'Teacher/Staff',
  };
}

// ============================================================
// SECTION 3 — Firebase Storage Helpers (formerly storageService.ts)
// ============================================================

/**
 * Uploads a file to Firebase Storage.
 * @param file - The file to upload
 * @param path - Storage path (e.g. 'submissions/groupId/proposal/filename.pdf')
 * @param onProgress - Optional callback for upload progress (0–100)
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
          if (onProgress) onProgress(Math.round(progress));
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
 * Deletes a file from Firebase Storage.
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
 * Gets the download URL for a file in Firebase Storage.
 */
export async function getFileDownloadURL(path: string): Promise<string> {
  try {
    const storageRef = ref(storage, path);
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error('[STORAGE] Failed to get download URL:', error);
    throw error;
  }
}

/**
 * Validates a file before upload (Firebase Storage).
 * @returns Error message if invalid, null if valid.
 */
export function validateFile(
  file: File,
  maxSizeMB: number = 10,
  allowedTypes: string[] = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]
): string | null {
  console.log('[STORAGE] Validating file:', { name: file.name, size: file.size, type: file.type });

  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    const errorMsg = `File size exceeds ${maxSizeMB}MB limit`;
    console.error('[STORAGE] Validation failed:', errorMsg);
    return errorMsg;
  }

  if (!allowedTypes.includes(file.type)) {
    const errorMsg = 'Invalid file type. Only PDF, DOC, and DOCX files are allowed';
    console.error('[STORAGE] Validation failed:', errorMsg, 'Got type:', file.type);
    return errorMsg;
  }

  console.log('[STORAGE] File validation passed');
  return null;
}

/**
 * Generates a storage path for a document submission.
 */
export function generateSubmissionPath(
  groupId: string,
  milestoneType: string,
  fileName: string
): string {
  const cleanFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const timestamp = Date.now();
  const path = `submissions/${groupId}/${milestoneType}/${timestamp}_${cleanFileName}`;
  console.log('[STORAGE] Generated path:', path);
  return path;
}

// ============================================================
// SECTION 4 — Student Profile Service (formerly profileService.ts)
// ============================================================

/**
 * Updates student profile information in Firestore.
 */
export async function updateStudentProfile(
  userId: string,
  data: Partial<Student>
): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
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
 * Uploads a profile picture to Firebase Storage and updates the user doc.
 * @returns The download URL of the uploaded image.
 */
export async function uploadProfilePicture(
  userId: string,
  file: File
): Promise<string> {
  try {
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      throw new Error('Invalid file type. Please upload a JPEG, PNG, or WebP image.');
    }

    const maxSize = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSize) {
      throw new Error('File size too large. Maximum size is 5MB.');
    }

    const timestamp = Date.now();
    const extension = file.name.split('.').pop();
    const filename = `avatars/${userId}_${timestamp}.${extension}`;

    const storageRef = ref(storage, filename);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);

    await updateDoc(doc(db, 'users', userId), { avatar: downloadURL });

    return downloadURL;
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    if (error instanceof Error) throw error;
    throw new Error('Failed to upload profile picture. Please try again.');
  }
}

// ============================================================
// SECTION 5 — Cloudinary Storage Service (formerly cloudinaryService.ts)
// ============================================================

/**
 * Cloudinary Storage Service
 * Handles file uploads to Cloudinary as an alternative to Firebase Storage.
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
const CLOUDINARY_UPLOAD_BASE_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}`;

/**
 * Uploads a file to Cloudinary.
 * @param file - The file to upload
 * @param folder - Optional folder path in Cloudinary
 * @param onProgress - Optional callback for upload progress (0–100)
 */
export async function uploadToCloudinary(
  file: File,
  folder?: string,
  onProgress?: (progress: number) => void
): Promise<{ url: string; publicId: string; size: number }> {
  return new Promise((resolve, reject) => {
    const isImage = file.type.startsWith('image/');
    const resourceType = isImage ? 'image' : 'raw';
    const uploadUrl = `${CLOUDINARY_UPLOAD_BASE_URL}/${resourceType}/upload`;

    console.log('[CLOUDINARY] Starting upload:', { fileName: file.name, fileSize: file.size, fileType: file.type, resourceType, folder });

    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
      const error = 'Cloudinary credentials not configured. Check .env file.';
      console.error('[CLOUDINARY]', error);
      reject(new Error(error));
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    if (folder) formData.append('folder', folder);

    console.log('[CLOUDINARY] Form data prepared:', { preset: CLOUDINARY_UPLOAD_PRESET, folder: folder || 'none' });

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100);
        console.log(`[CLOUDINARY] Upload progress: ${progress}%`);
        onProgress(progress);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        try {
          const response: CloudinaryUploadResponse = JSON.parse(xhr.responseText);
          console.log('[CLOUDINARY] Upload successful:', { url: response.secure_url, publicId: response.public_id, size: response.bytes });
          resolve({ url: response.secure_url, publicId: response.public_id, size: response.bytes });
        } catch (error) {
          console.error('[CLOUDINARY] Failed to parse response:', error);
          reject(new Error('Failed to parse upload response'));
        }
      } else {
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

    xhr.addEventListener('error', () => {
      console.error('[CLOUDINARY] Network error during upload');
      reject(new Error('Network error during upload'));
    });

    xhr.addEventListener('abort', () => {
      console.error('[CLOUDINARY] Upload aborted');
      reject(new Error('Upload aborted'));
    });

    console.log('[CLOUDINARY] Sending request to:', uploadUrl);
    xhr.open('POST', uploadUrl);
    xhr.send(formData);
  });
}

/**
 * Delete a file from Cloudinary.
 * Note: Requires server-side implementation with API secret.
 */
export async function deleteFromCloudinary(publicId: string): Promise<void> {
  console.warn('[CLOUDINARY] Delete operation requires server-side implementation');
  console.log('[CLOUDINARY] File to delete:', publicId);
  // TODO: Implement server-side deletion endpoint
  throw new Error('Delete operation not yet implemented. Manage files through Cloudinary dashboard.');
}

/**
 * Validates a file before uploading to Cloudinary.
 * @returns Error message if invalid, null if valid.
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
  console.log('[CLOUDINARY] Validating file:', { name: file.name, size: file.size, type: file.type });

  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    const errorMsg = `File size exceeds ${maxSizeMB}MB limit`;
    console.error('[CLOUDINARY] Validation failed:', errorMsg);
    return errorMsg;
  }

  if (!allowedTypes.includes(file.type)) {
    const errorMsg = 'Invalid file type. Only PDF, DOC, and DOCX files are allowed';
    console.error('[CLOUDINARY] Validation failed:', errorMsg, 'Got type:', file.type);
    return errorMsg;
  }

  console.log('[CLOUDINARY] File validation passed');
  return null;
}

/**
 * Generates a Cloudinary folder path for FYP submissions.
 */
export function generateCloudinaryFolder(groupId: string, milestoneType: string): string {
  const folder = `fyp-portal/submissions/${groupId}/${milestoneType}`;
  console.log('[CLOUDINARY] Generated folder:', folder);
  return folder;
}

// ============================================================
// SECTION 6 — Notification Service (formerly NotificationService.ts)
// ============================================================

/**
 * Notification Service
 * Handles creation, reading, and management of user notifications.
 * Uses Firestore as the real-time transport layer — no WebSockets needed.
 * The NotificationDropdown uses onSnapshot, so notifications arrive instantly.
 */

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

/**
 * Creates a new notification for a user.
 */
export async function createNotification({
  userId,
  type,
  title,
  message,
  link,
}: CreateNotificationParams): Promise<string> {
  try {
    const notificationData = {
      userId,
      type,
      title,
      message,
      link: link || null,
      isRead: false,
      createdAt: serverTimestamp(),
    };
    const docRef = await addDoc(collection(db, 'notifications'), notificationData);
    return docRef.id;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}

/**
 * Marks a single notification as read.
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), { isRead: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
}

/**
 * Marks all notifications as read for a given user.
 */
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('isRead', '==', false)
    );
    const snapshot = await getDocs(q);
    await Promise.all(snapshot.docs.map(d => updateDoc(d.ref, { isRead: true })));
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
}

/**
 * Deletes a single notification.
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'notifications', notificationId));
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
}

/**
 * Deletes all notifications for a user.
 */
export async function deleteAllNotifications(userId: string): Promise<void> {
  try {
    const q = query(collection(db, 'notifications'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    await Promise.all(snapshot.docs.map(d => deleteDoc(d.ref)));
  } catch (error) {
    console.error('Error deleting all notifications:', error);
    throw error;
  }
}

/**
 * Sends notifications to ALL users of the specified target roles when an
 * announcement is published.
 *
 * How real-time works:
 *   - This function writes to the 'notifications' collection.
 *   - Each user's NotificationDropdown already subscribes via onSnapshot.
 *   - As soon as this write completes, Firestore pushes the change to
 *     every matching listener — no polling, no WebSockets needed.
 *
 * @param announcementId - Firestore ID of the announcement
 * @param title          - Announcement title (used as notification title)
 * @param content        - Announcement body (used as notification message)
 * @param targetRoles    - Roles who should receive the notification
 * @param targetGroup    - Optional specific group ID to filter by
 * @param targetUsers    - Optional array of specific user IDs for direct targeting
 */
export async function sendAnnouncementNotifications(
  announcementId: string,
  title: string,
  content: string,
  targetRoles: UserRole[],
  targetGroup?: string,
  targetUsers?: string[]
): Promise<void> {
  if ((!targetRoles || targetRoles.length === 0) && (!targetUsers || targetUsers.length === 0)) return;

  try {
    let notificationPromises: Promise<any>[] = [];

    if (targetUsers && targetUsers.length > 0) {
      // Direct targeting mode: create notifications for specific user IDs
      notificationPromises = targetUsers.map(userId =>
        addDoc(collection(db, 'notifications'), {
          userId,
          type: 'announcement' as NotificationType,
          title: `📢 ${title}`,
          message: content.length > 120 ? content.substring(0, 120) + '...' : content,
          link: `/`,
          isRead: false,
          createdAt: serverTimestamp(),
          announcementId,
        })
      );
    } else {
      // Role-based fanout mode
      const usersQuery = query(collection(db, 'users'), where('role', 'in', targetRoles));
      const usersSnapshot = await getDocs(usersQuery);

      if (usersSnapshot.empty) return;

      let targetDocs = usersSnapshot.docs;
      if (targetGroup && targetGroup !== 'all') {
        targetDocs = targetDocs.filter(userDoc => userDoc.data().groupId === targetGroup);
      }

      if (targetDocs.length === 0) return;

      notificationPromises = targetDocs.map(userDoc =>
        addDoc(collection(db, 'notifications'), {
          userId: userDoc.id,
          type: 'announcement' as NotificationType,
          title: `📢 ${title}`,
          message: content.length > 120 ? content.substring(0, 120) + '...' : content,
          link: `/${userDoc.data().role === 'student' ? 'student' : userDoc.data().role}/announcements`,
          isRead: false,
          createdAt: serverTimestamp(),
          announcementId,
        })
      );
    }

    await Promise.all(notificationPromises);
    console.log(`[NotificationService] Sent notifications to ${notificationPromises.length} user(s) for announcement: ${title}`);
  } catch (error) {
    console.error('[NotificationService] Error sending announcement notifications:', error);
  }
}
