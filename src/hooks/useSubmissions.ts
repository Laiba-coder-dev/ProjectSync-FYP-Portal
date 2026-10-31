import { useState, useEffect } from 'react';
import { Submission } from '@/types';
import { auth } from '@/lib/firebase';

export function useSubmissions(groupId?: string, projectId?: string) {
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchSubmissions = async () => {
            // We strictly require groupId for the secure backend query
            if (!groupId) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);
                
                const idToken = await auth.currentUser?.getIdToken();
                const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
                
                // Call the hardened backend endpoint
                const response = await fetch(`${backendUrl}/api/submissions/group/${groupId}`, {
                    headers: {
                        'Authorization': `Bearer ${idToken}`
                    }
                });

                if (!response.ok) {
                    if (response.status === 403) {
                        throw new Error("Unauthorized access to these documents.");
                    }
                    throw new Error("Failed to fetch submissions from server.");
                }

                const data = await response.json();
                
                // Format dates correctly from the backend response
                const formattedData = data.map((s: any) => ({
                    ...s,
                    submittedAt: s.submittedAt?._seconds 
                        ? new Date(s.submittedAt._seconds * 1000) 
                        : new Date(s.submittedAt),
                    reviewedAt: s.reviewedAt?._seconds 
                        ? new Date(s.reviewedAt._seconds * 1000) 
                        : (s.reviewedAt ? new Date(s.reviewedAt) : undefined),
                })) as Submission[];

                setSubmissions(formattedData);
            } catch (err: any) {
                console.error('[USE_SUBMISSIONS] Error:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchSubmissions();
    }, [groupId]);

    return { submissions, loading, error };
}
