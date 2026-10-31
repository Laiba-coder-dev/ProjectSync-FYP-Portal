import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { Project } from '@/types';

export function useProject(groupId: string | undefined) {
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchProject() {
            if (!groupId) {
                setLoading(false);
                return;
            }

            try {
                console.log('[USE_PROJECT] Fetching project for group:', groupId);
                setLoading(true);
                setError(null);

                const q = query(collection(db, 'projects'), where('groupId', '==', groupId));
                const snapshot = await getDocs(q);

                if (!snapshot.empty) {
                    const projectData = snapshot.docs[0].data();
                    setProject({
                        id: snapshot.docs[0].id,
                        ...projectData,
                        createdAt: projectData.createdAt?.toDate?.() || new Date(),
                        updatedAt: projectData.updatedAt?.toDate?.() || new Date(),
                    } as Project);
                    console.log('[USE_PROJECT] Project found');
                } else {
                    setProject(null);
                    console.log('[USE_PROJECT] No project found for this group');
                }
            } catch (err: any) {
                console.error('[USE_PROJECT] Error fetching project:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        fetchProject();
    }, [groupId]);

    const createProject = async (projectData: Partial<Project>) => {
        try {
            console.log('[USE_PROJECT] Creating new project');
            const docRef = await addDoc(collection(db, 'projects'), {
                ...projectData,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            console.log('[USE_PROJECT] Project created with ID:', docRef.id);

            // Update local state immediately
            setProject({
                id: docRef.id,
                ...projectData,
                createdAt: new Date(),
                updatedAt: new Date(),
            } as Project);

            return docRef.id;
        } catch (err: any) {
            console.error('[USE_PROJECT] Error creating project:', err);
            throw err;
        }
    };

    const updateProject = async (projectId: string, updates: Partial<Project>) => {
        try {
            console.log('[USE_PROJECT] Updating project:', projectId);
            await updateDoc(doc(db, 'projects', projectId), {
                ...updates,
                updatedAt: serverTimestamp(),
            });
            console.log('[USE_PROJECT] Project updated successfully');

            // Update local state immediately
            setProject(prev => prev ? {
                ...prev,
                ...updates,
                updatedAt: new Date()
            } : null);

        } catch (err: any) {
            console.error('[USE_PROJECT] Error updating project:', err);
            throw err;
        }
    };

    return { project, loading, error, createProject, updateProject };
}
