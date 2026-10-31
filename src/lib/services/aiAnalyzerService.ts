import { collection, addDoc, query, where, getDocs, orderBy, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

// Helper function to check if a timestamp is from today
const isToday = (timestamp: Timestamp) => {
  const date = timestamp.toDate();
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
};

export const checkRateLimit = async (userId: string): Promise<{ allowed: boolean, remaining: number }> => {
  try {
    const reportsRef = collection(db, 'analysis_reports');
    // Fetch all reports for the user, order by createdAt descending
    const q = query(
      reportsRef,
      where('userId', '==', userId)
    );
    
    const querySnapshot = await getDocs(q);
    const todayReports = querySnapshot.docs.filter(doc => {
      const data = doc.data();
      if (!data.createdAt) return false;
      return isToday(data.createdAt as Timestamp);
    });

    const limit = 5;
    const count = todayReports.length;
    
    return {
      allowed: count < limit,
      remaining: Math.max(0, limit - count)
    };
  } catch (error) {
    console.error('Rate limit check failed', error);
    // Fail open if firestore index is missing or error
    return { allowed: true, remaining: 5 };
  }
};

export const saveAnalysisReport = async (userId: string, formData: any, results: any) => {
  try {
    const reportsRef = collection(db, 'analysis_reports');
    await addDoc(reportsRef, {
      userId,
      mode: formData.get('mode'),
      title: formData.get('title'),
      domain: formData.get('domain'),
      results,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Failed to save analysis report', error);
  }
};

export const getStudentHistory = async (userId: string) => {
  try {
    const reportsRef = collection(db, 'analysis_reports');
    const q = query(
      reportsRef,
      where('userId', '==', userId)
    );
    
    const querySnapshot = await getDocs(q);
    const history = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as any[];
    
    // Sort manually if index is missing
    history.sort((a, b) => {
      const timeA = a.createdAt?.toMillis() || 0;
      const timeB = b.createdAt?.toMillis() || 0;
      return timeB - timeA;
    });

    return history;
  } catch (error) {
    console.error('Failed to get student history', error);
    return [];
  }
};
