import { useState, useEffect } from 'react';
import { Submission } from '@/types';
import { auth } from '@/lib/firebase';

export function useSupervisorSubmissions() {
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const fetchSubmissions = async () => {
            try {
                setLoading(true);
                const idToken = await auth.currentUser?.getIdToken();
                const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

                const response = await fetch(`${backendUrl}/api/submissions/supervisor`, {
                    headers: {
                        'Authorization': `Bearer ${idToken}`
                    }
                });

                if (!response.ok) {
                    throw new Error("Failed to fetch supervisor submissions.");
                }

                const data = await response.json();
                
                // Format dates
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
                setError(null);
            } catch (err: any) {
                console.error('[SUPERVISOR_SUBMISSIONS] Error:', err);
                setError(err);
            } finally {
                setLoading(false);
            }
        };

        if (auth.currentUser) {
            fetchSubmissions();
        }
    }, []);

    const pendingReviews = submissions.filter(s => s.status === 'uploaded').length;

    return {
        submissions,
        pendingReviews,
        loading,
        error,
    };
}
