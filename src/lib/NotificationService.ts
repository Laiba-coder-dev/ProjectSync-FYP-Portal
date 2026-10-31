import { db } from './firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import type { NotificationType, UserRole } from '@/types';

/**
 * Notification Service
 * Handles creation, reading, and management of user notifications.
 * Uses Firestore as the real-time transport layer — no WebSockets needed.
 * The NotificationDropdown uses onSnapshot, so notifications arrive instantly.
 */

/**
 * Notification Service
 * Handles creation, reading, and management of user notifications
 */

export interface CreateNotificationParams {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
}

/**
 * Creates a new notification for a user
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
 * Marks a notification as read
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
    try {
        await updateDoc(doc(db, 'notifications', notificationId), {
            isRead: true,
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        throw error;
    }
}

/**
 * Marks all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
    try {
        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', userId),
            where('isRead', '==', false)
        );

        const snapshot = await getDocs(q);
        const updatePromises = snapshot.docs.map(doc =>
            updateDoc(doc.ref, { isRead: true })
        );

        await Promise.all(updatePromises);
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        throw error;
    }
}

/**
 * Deletes a notification
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
 * Deletes all notifications for a user
 */
export async function deleteAllNotifications(userId: string): Promise<void> {
    try {
        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', userId)
        );

        const snapshot = await getDocs(q);
        const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));

        await Promise.all(deletePromises);
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
 */
export async function sendAnnouncementNotifications(
    announcementId: string,
    title: string,
    content: string,
    targetRoles: UserRole[],
    targetGroup?: string,
    targetUsers?: string[] // array of specific user IDs
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
                    link: `/`, // generic link since role is dynamic, could enhance by passing role map
                    isRead: false,
                    createdAt: serverTimestamp(),
                    announcementId,
                })
            );
        } else {
            // Role-based fanout mode
            const usersQuery = query(
                collection(db, 'users'),
                where('role', 'in', targetRoles)
            );

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
