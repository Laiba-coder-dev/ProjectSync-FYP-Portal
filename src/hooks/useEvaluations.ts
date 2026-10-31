import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Evaluation } from '@/types';

export function useEvaluations(groupId?: string, projectId?: string) {
    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchEvaluations() {
            if (!groupId && !projectId) {
                setLoading(false);
                return;
            }

            try {
                console.log('[USE_EVALUATIONS] Fetching evaluations');
                setLoading(true);
                setError(null);

                let q;
                if (projectId) {
                    q = query(collection(db, 'evaluations'), where('projectId', '==', projectId));
                } else if (groupId) {
                    q = query(collection(db, 'evaluations'), where('groupId', '==', groupId));
                }

                if (q) {
                    const snapshot = await getDocs(q);
                    const evaluationsData = snapshot.docs.map(doc => {
                        const data = doc.data();
                        return {
                            id: doc.id,
                            ...data,
                            submittedAt: data.submittedAt?.toDate?.() || undefined,
                            lockedAt: data.lockedAt?.toDate?.() || undefined,
                        } as Evaluation;
                    });

                    setEvaluations(evaluationsData);
                    console.log('[USE_EVALUATIONS] Fetched', evaluationsData.length, 'evaluations');
                }
            } catch (err: any) {
                console.error('[USE_EVALUATIONS] Error fetching evaluations:', err);
                setError(err.message);
                setEvaluations([]);
            } finally {
                setLoading(false);
            }
        }

        fetchEvaluations();
    }, [groupId, projectId]);

    return { evaluations, loading, error };
}
