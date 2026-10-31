import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, orderBy, limit } from 'firebase/firestore';
import { ProjectGroup, Project, Supervisor, Milestone, Announcement } from '@/types';

export function useStudentData() {
    const { user } = useAuth();
    const [group, setGroup] = useState<ProjectGroup | null>(null);
    const [project, setProject] = useState<Project | null>(null);
    const [supervisor, setSupervisor] = useState<Supervisor | null>(null);
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            if (!user) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);

                // 1. Fetch Group via user profile's groupId (efficient — no collection scan)
                let foundGroup: ProjectGroup | null = null;
                const studentDoc = await getDoc(doc(db, 'users', user.id));
                const studentData = studentDoc.data();

                if (studentData?.groupId) {
                    const groupDoc = await getDoc(doc(db, 'groups', studentData.groupId));
                    if (groupDoc.exists()) {
                        foundGroup = { id: groupDoc.id, ...convertDates(groupDoc.data()) } as ProjectGroup;
                    }
                }

                setGroup(foundGroup);

                // 2. Fetch Project
                if (foundGroup?.projectId) {
                    const projectDoc = await getDoc(doc(db, 'projects', foundGroup.projectId));
                    if (projectDoc.exists()) {
                        setProject({ id: projectDoc.id, ...convertDates(projectDoc.data()) } as Project);
                    }
                } else if (foundGroup) {
                    // Fallback: search by groupId
                    const q = query(collection(db, 'projects'), where('groupId', '==', foundGroup.id));
                    const snapshot = await getDocs(q);
                    if (!snapshot.empty) {
                        setProject({ id: snapshot.docs[0].id, ...convertDates(snapshot.docs[0].data()) } as Project);
                    }
                }

                // 3. Fetch Supervisor
                if (foundGroup?.supervisorId) {
                    const supDoc = await getDoc(doc(db, 'users', foundGroup.supervisorId));
                    if (supDoc.exists()) {
                        setSupervisor({ id: supDoc.id, ...convertDates(supDoc.data()) } as Supervisor);
                    }
                }

                // 4. Fetch Announcements (top 3, newest first)
                const annQuery = query(
                    collection(db, 'announcements'),
                    where('targetRoles', 'array-contains', 'student'),
                    orderBy('publishedAt', 'desc'),
                    limit(10) // fetch more to account for filtering drop-offs
                );
                try {
                    const annSnapshot = await getDocs(annQuery);
                    let anns = annSnapshot.docs.map(d => ({ id: d.id, ...convertDates(d.data()) } as Announcement));
                    
                    // Apply Context-Aware Filtering
                    const studentGroupId = studentData?.groupId;
                    anns = anns.filter(a => {
                        // Temporal rule
                        if (a.publishedAt < user.createdAt) return false;
                        // Scope rule
                        if ((a as any).targetGroup && (a as any).targetGroup !== 'all') {
                            if ((a as any).targetGroup !== studentGroupId) return false;
                        }
                        return true;
                    });

                    // Sort newest first client-side as a safety guarantee
                    anns.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
                    setAnnouncements(anns.slice(0, 3));
                } catch {
                    // Fallback if Firestore index is missing
                    try {
                        const q2 = query(collection(db, 'announcements'), where('targetRoles', 'array-contains', 'student'), limit(20));
                        const s2 = await getDocs(q2);
                        let anns = s2.docs.map(d => ({ id: d.id, ...convertDates(d.data()) } as Announcement));
                        
                        // Apply Context-Aware Filtering
                        const studentGroupId = studentData?.groupId;
                        anns = anns.filter(a => {
                            if (a.publishedAt < user.createdAt) return false;
                            if ((a as any).targetGroup && (a as any).targetGroup !== 'all') {
                                if ((a as any).targetGroup !== studentGroupId) return false;
                            }
                            return true;
                        });

                        // Sort and slice to top 3 newest
                        anns.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
                        setAnnouncements(anns.slice(0, 3));
                    } catch {
                        setAnnouncements([]);
                    }
                }
            } catch (error) {
                console.error('[STUDENT_DATA] Failed to fetch student data:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    // Use user.id (stable string) rather than user object to prevent unnecessary re-fetches
    }, [user?.id]);

    return { group, project, supervisor, milestones, announcements, loading };
}

// Helper to safely convert Firestore data to properly typed objects
const convertDates = (data: any): any => {
    if (!data) return data;
    const result = { ...data };
    Object.keys(result).forEach(key => {
        if (result[key] && typeof result[key] === 'object' && 'seconds' in result[key]) {
            result[key] = new Date(result[key].seconds * 1000);
        }
    });
    return result;
};
