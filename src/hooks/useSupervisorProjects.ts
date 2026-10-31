import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { Project } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

interface SupervisorProject extends Project {
    groupName?: string;
}

export function useSupervisorProjects() {
    const { user } = useAuth();
    const [projects, setProjects] = useState<SupervisorProject[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [refetchCounter, setRefetchCounter] = useState(0);

    const refetch = () => setRefetchCounter(c => c + 1);

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        const fetchProjects = async () => {
            try {
                setLoading(true);
                console.log('[SUPERVISOR_PROJECTS] Fetching projects for supervisor:', user.id);

                // First, get all groups supervised by this user
                const groupsQuery = query(
                    collection(db, 'groups'),
                    where('supervisorId', '==', user.id)
                );
                const groupsSnapshot = await getDocs(groupsQuery);
                const supervisedGroupIds = groupsSnapshot.docs.map(doc => doc.id);
                const groupsMap = new Map(
                    groupsSnapshot.docs.map(doc => [doc.id, doc.data().name])
                );

                console.log('[SUPERVISOR_PROJECTS] Supervised groups:', supervisedGroupIds);

                if (supervisedGroupIds.length === 0) {
                    console.log('[SUPERVISOR_PROJECTS] No supervised groups found');
                    setProjects([]);
                    setLoading(false);
                    return;
                }

                // Then, get all projects from those groups
                const projectsQuery = query(
                    collection(db, 'projects'),
                    where('groupId', 'in', supervisedGroupIds)
                );
                const projectsSnapshot = await getDocs(projectsQuery);

                const projectsList: SupervisorProject[] = projectsSnapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        ...data,
                        groupName: groupsMap.get(data.groupId),
                        submittedAt: data.submittedAt?.toDate?.() || new Date(data.submittedAt),
                        approvedAt: data.approvedAt?.toDate?.() || (data.approvedAt ? new Date(data.approvedAt) : undefined),
                        createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
                        updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt),
                    } as SupervisorProject;
                });

                console.log('[SUPERVISOR_PROJECTS] Fetched projects:', projectsList.length);
                setProjects(projectsList);
                setError(null);
            } catch (err) {
                console.error('[SUPERVISOR_PROJECTS] Error fetching projects:', err);
                setError(err as Error);
            } finally {
                setLoading(false);
            }
        };

        fetchProjects();
    }, [user?.id, refetchCounter]);

    const pendingProjects = projects.filter(p => p.status === 'submitted');
    const reviewedProjects = projects.filter(p => p.status === 'approved' || p.status === 'rejected');

    return {
        projects,
        pendingProjects,
        reviewedProjects,
        loading,
        error,
        refetch,
    };
}
