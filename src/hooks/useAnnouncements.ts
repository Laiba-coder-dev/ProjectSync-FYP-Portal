import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Announcement } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Real-time announcements hook.
 * Uses onSnapshot so new announcements appear instantly without page refresh.
 * Always returns results sorted newest-first.
 * 
 * Includes Context-Aware Filtering:
 * - Users cannot see announcements created before their account existed.
 * - Group-specific announcements are only visible to members of that group.
 */
export function useAnnouncements(targetRole?: string, limitCount: number = 50, userGroupId?: string | null) {
    const { user } = useAuth();
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        setError(null);

        // Primary query: with orderBy (requires Firestore composite index)
        let q = targetRole
            ? query(
                collection(db, 'announcements'),
                where('targetRoles', 'array-contains', targetRole),
                orderBy('publishedAt', 'desc'),
                limit(limitCount)
            )
            : query(
                collection(db, 'announcements'),
                orderBy('publishedAt', 'desc'),
                limit(limitCount)
            );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                let data = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    publishedAt: doc.data().publishedAt?.toDate?.() || new Date(),
                    expiresAt: doc.data().expiresAt?.toDate?.() || undefined,
                } as Announcement));

                // Context-Aware Filtering constraints
                if (user) {
                    const studentGroupId = (user as any).groupId;
                    data = data.filter(a => {
                        // 1. Temporal rule: User must not see announcements created before they existed
                        if (a.publishedAt < user.createdAt) return false;

                        // 2. Scope rule: If the user is a student, evaluate targetGroup scopes
                        if (user.role === 'student' && (a as any).targetGroup && (a as any).targetGroup !== 'all') {
                            if ((a as any).targetGroup !== studentGroupId) return false;
                        }

                        // 3. Direct Target rule: If the announcement is for specific users only
                        if ((a as any).targetUsers && Array.isArray((a as any).targetUsers) && (a as any).targetUsers.length > 0) {
                            if (!(a as any).targetUsers.includes(user.id)) return false;
                        }

                        return true;
                    });
                }

                // Client-side sort guarantee: newest first
                data.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

                setAnnouncements(data);
                setLoading(false);
            },
            (err) => {
                console.warn('[useAnnouncements] Primary query failed (likely missing index), falling back:', err.message);

                // Fallback: no orderBy — will still sort client-side
                const fallbackQ = targetRole
                    ? query(
                        collection(db, 'announcements'),
                        where('targetRoles', 'array-contains', targetRole),
                        limit(limitCount)
                    )
                    : query(collection(db, 'announcements'), limit(limitCount));

                const fallbackUnsub = onSnapshot(
                    fallbackQ,
                    (snapshot) => {
                        let data = snapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data(),
                            publishedAt: doc.data().publishedAt?.toDate?.() || new Date(),
                            expiresAt: doc.data().expiresAt?.toDate?.() || undefined,
                        } as Announcement));

                        // Context-Aware Filtering constraints
                        if (user) {
                            const studentGroupId = (user as any).groupId;
                            data = data.filter(a => {
                                // 1. Temporal rule: User must not see announcements created before they existed
                                if (a.publishedAt < user.createdAt) return false;

                                // 2. Scope rule: If the user is a student, evaluate targetGroup scopes
                                if (user.role === 'student' && (a as any).targetGroup && (a as any).targetGroup !== 'all') {
                                    if ((a as any).targetGroup !== studentGroupId) return false;
                                }

                                // 3. Direct Target rule
                                if ((a as any).targetUsers && Array.isArray((a as any).targetUsers) && (a as any).targetUsers.length > 0) {
                                    if (!(a as any).targetUsers.includes(user.id)) return false;
                                }

                                return true;
                            });
                        }

                        // Always sort newest first client-side
                        data.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

                        setAnnouncements(data);
                        setLoading(false);
                    },
                    (fallbackErr) => {
                        console.error('[useAnnouncements] Fallback also failed:', fallbackErr);
                        setError(fallbackErr.message);
                        setLoading(false);
                    }
                );

                // Return the fallback unsubscribe — the outer unsubscribe is already done
                return () => fallbackUnsub();
            }
        );

        return () => unsubscribe();
    }, [targetRole, limitCount, user?.createdAt, user?.role, userGroupId]);

    return { announcements, loading, error };
}
