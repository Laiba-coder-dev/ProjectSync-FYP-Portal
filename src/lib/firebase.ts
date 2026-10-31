// ... existing imports
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';
import { getStorage } from 'firebase/storage';

export const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Store session in localStorage so users stay logged in across
// page refreshes, tab closures, and browser restarts.
// Without this, some browsers default to sessionStorage (clears on tab close).
setPersistence(auth, browserLocalPersistence).catch(err =>
    console.warn('[Firebase] Could not set persistence:', err)
);

export const db = getFirestore(app);

// Initialize analytics only in production or when explicitly enabled
// This prevents blocking issues in localhost/development environments
let analyticsInstance;
try {
    if (typeof window !== 'undefined' && import.meta.env.PROD) {
        analyticsInstance = getAnalytics(app);
    }
} catch (error) {
    console.warn('Analytics initialization skipped:', error);
}
export const analytics = analyticsInstance;

export const storage = getStorage(app);

export const getSecondaryAuth = () => {
    let secondaryApp;
    try {
        secondaryApp = getApp('Secondary');
    } catch (e) {
        secondaryApp = initializeApp(firebaseConfig, 'Secondary');
    }
    return getAuth(secondaryApp);
};
