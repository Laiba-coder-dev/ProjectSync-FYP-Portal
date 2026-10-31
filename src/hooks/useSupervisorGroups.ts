import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { ProjectGroup } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

export function useSupervisorGroups() {
    const { user } = useAuth();
    const [groups, setGroups] = useState<ProjectGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        const fetchGroups = async () => {
            try {
                setLoading(true);
                console.log('[SUPERVISOR_GROUPS] Fetching groups for supervisor:', user.id);

                const groupsQuery = query(
                    collection(db, 'groups'),
                    where('supervisorId', '==', user.id)
                );
                const groupsSnapshot = await getDocs(groupsQuery);

                const groupsList: ProjectGroup[] = groupsSnapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        ...data,
                        createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
                        members: data.members?.map((m: any) => ({
                            ...m,
                            joinedAt: m.joinedAt?.toDate?.() || new Date(m.joinedAt),
                        })) || [],
                    } as ProjectGroup;
                });

                console.log('[SUPERVISOR_GROUPS] Fetched groups:', groupsList.length);
                setGroups(groupsList);
                setError(null);
            } catch (err) {
                console.error('[SUPERVISOR_GROUPS] Error fetching groups:', err);
                setError(err as Error);
            } finally {
                setLoading(false);
            }
        };

        fetchGroups();
    }, [user]);

    return {
        groups,
        loading,
        error,
    };
}
