import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  redirectUrl: string;
  isRead: boolean;
  createdAt: string;
  eventType: string;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fallback/Initial load from Firestore
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', user.id),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs: AppNotification[] = [];
      let unread = 0;
      snapshot.forEach((doc) => {
        const data = doc.data();
        let createdAtStr = new Date().toISOString();
        if (data.createdAt) {
          if (typeof data.createdAt === 'string') {
            createdAtStr = data.createdAt;
          } else if (data.createdAt.seconds) {
            createdAtStr = new Date(data.createdAt.seconds * 1000).toISOString();
          }
        }
        
        const notifData = { ...data, createdAt: createdAtStr, id: doc.id } as AppNotification;
        notifs.push(notifData);
        if (!notifData.isRead) unread++;
      });
      setNotifications(notifs);
      setUnreadCount(unread);
    });

    return () => unsubscribe();
  }, [user]);

  // Real-time SSE Stream Listener
  useEffect(() => {
    if (!user) return;
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    const eventSource = new EventSource(`${backendUrl}/api/notifications/stream?userId=${user.id}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as AppNotification;
        toast({
          title: data.title,
          description: data.message,
          duration: 5000,
        });
      } catch (err) {
        console.error('Failed to parse SSE notification', err);
      }
    };

    return () => eventSource.close();
  }, [user, toast]);

  const markAsRead = async (id: string) => {
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
      await fetch(`${backendUrl}/api/notifications/${id}/read`, { method: 'PUT' });
    } catch (err) {
      console.error('Failed to mark notification as read', err);
    }
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
