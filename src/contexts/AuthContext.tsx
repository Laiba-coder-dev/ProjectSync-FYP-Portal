import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User as AppUser, UserRole } from '@/types';
import { auth, db } from '@/lib/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { isValidDomain, validateEmailAndGetRole } from '@/lib/emailValidation';

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (data: Partial<AppUser>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Failsafe: Ensure loading is set to false after 8 seconds max
    const timeoutId = setTimeout(() => {
      console.warn('[AUTH] Timeout reached, forcing loading to false');
      setLoading(false);
    }, 8000);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      clearTimeout(timeoutId);

      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));

          if (userDoc.exists()) {
            const userData = userDoc.data();

            // Only force-logout if an admin has explicitly disabled the account
            if (userData.isActive === false) {
              console.warn('[AUTH] Account deactivated, signing out');
              await signOut(auth);
              toast.error('Your account has been deactivated. Please contact the administrator.');
              setUser(null);
              setLoading(false);
              return;
            }

            setUser({
              id: firebaseUser.uid,
              email: firebaseUser.email!,
              name: userData.name,
              role: userData.role as UserRole,
              createdAt: userData.createdAt?.toDate() || new Date(),
              ...userData,
            } as AppUser);
          } else {
            // Firestore doc missing — likely a data issue, NOT an auth issue.
            // Keep the Firebase session alive; just build a minimal user object
            // so the app doesn't crash or redirect to login.
            console.warn('[AUTH] Firestore user doc missing for uid:', firebaseUser.uid);
            setUser({
              id: firebaseUser.uid,
              email: firebaseUser.email!,
              name: firebaseUser.displayName || firebaseUser.email!,
              role: 'student' as UserRole,
              createdAt: new Date(),
            } as AppUser);
          }
        } catch (error: any) {
          // Network failure, Firestore offline, etc.
          // DO NOT log out — the user is still Firebase-authenticated.
          // Keep whatever user state we already have (or set a shell if first load).
          console.warn('[AUTH] Firestore read failed (transient error):', error?.message);
          if (!user) {
            // First load and Firestore is offline — build a shell from the Firebase token.
            setUser({
              id: firebaseUser.uid,
              email: firebaseUser.email!,
              name: firebaseUser.displayName || firebaseUser.email!,
              role: 'student' as UserRole,
              createdAt: new Date(),
            } as AppUser);
          }
          // If user state already exists (navigating between pages), keep it as-is.
        }
      } else {
        // Firebase explicitly says no user — this is a real logout
        setUser(null);
      }

      setLoading(false);
    });

    return () => {
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = async (email: string, password: string) => {
    try {
      console.log('[AUTH] Starting login process for:', email);

      // Validate email domain before attempting login
      console.log('[AUTH] Validating email domain...');
      if (!isValidDomain(email)) {
        throw new Error('Only @uskt.edu.pk email addresses are allowed');
      }

      console.log('[AUTH] Email validation passed, attempting Firebase sign in...');
      await signInWithEmailAndPassword(auth, email, password);
      console.log('[AUTH] Firebase sign in successful');
      // State update happens in onAuthStateChanged
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (email: string, password: string, name: string) => {
    try {
      // Validate email domain and determine role
      const validation = validateEmailAndGetRole(email);

      if (!validation.isValid || !validation.role) {
        throw new Error(validation.error || 'Invalid email address');
      }

      // Create Firebase user
      const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);

      // Create user document with automatically determined role
      const userData = {
        email: newUser.email,
        name,
        role: validation.role, // Automatically assigned based on email pattern
        isActive: true,
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'users', newUser.uid), userData);

      toast.success('Account created successfully');
    } catch (error: any) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      // onAuthStateChanged will set user to null automatically
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const updateUserProfile = async (data: Partial<AppUser>) => {
    try {
      if (!user) {
        throw new Error('No user logged in');
      }

      // Update Firestore document
      const userRef = doc(db, 'users', user.id);
      const updateData: any = { ...data };

      // Convert Date objects to Firestore Timestamps properly
      if (updateData.dateOfBirth instanceof Date) {
        // Keep it as a JS Date; Firestore SDK will convert it automatically
        // Do NOT replace with serverTimestamp() which would set it to NOW
      }

      await setDoc(userRef, updateData, { merge: true });

      // Refresh user data
      const updatedDoc = await getDoc(userRef);
      if (updatedDoc.exists()) {
        const userData = updatedDoc.data();
        setUser({
          ...user,
          ...userData,
          createdAt: userData.createdAt?.toDate() || user.createdAt,
          lastLogin: userData.lastLogin?.toDate() || user.lastLogin,
          dateOfBirth: userData.dateOfBirth?.toDate(),
        } as AppUser);
      }

      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Update profile error:', error);
      toast.error('Failed to update profile');
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
