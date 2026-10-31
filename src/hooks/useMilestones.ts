import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Milestone } from '@/types';

export function useMilestones(projectId?: string) {
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchMilestones() {
            if (!projectId) {
                setLoading(false);
                return;
            }

            try {
                console.log('[USE_MILESTONES] Fetching milestones for project:', projectId);
                setLoading(true);
                setError(null);

                const q = query(collection(db, 'milestones'), where('projectId', '==', projectId));
                const snapshot = await getDocs(q);
                const milestonesData = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        ...data,
                        dueDate: data.dueDate?.toDate?.() || new Date(),
                        completedAt: data.completedAt?.toDate?.() || undefined,
                    } as Milestone;
                });

                setMilestones(milestonesData);
                console.log('[USE_MILESTONES] Fetched', milestonesData.length, 'milestones');
            } catch (err: any) {
                console.error('[USE_MILESTONES] Error fetching milestones:', err);
                setError(err.message);
                setMilestones([]);
            } finally {
                setLoading(false);
            }
        }

        fetchMilestones();
    }, [projectId]);

    return { milestones, loading, error };
}
