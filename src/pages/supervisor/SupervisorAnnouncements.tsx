import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/PageHeader';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Megaphone, Plus, Calendar, Users, Trash2, Loader2 } from 'lucide-react';
import { useSupervisorGroups } from '@/hooks/useSupervisorGroups';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { sendAnnouncementNotifications } from '@/lib/services';
import type { UserRole } from '@/types';

interface AnnouncementData {
  id: string;
  title: string;
  content: string;
  priority: 'low' | 'medium' | 'high';
  targetGroup: string;
  targetGroupName?: string;
  createdBy: string;
  createdByName: string;
  publishedAt: Date;
  targetRoles: string[];
}

export default function SupervisorAnnouncements() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { groups } = useSupervisorGroups();
  const [announcements, setAnnouncements] = useState<AnnouncementData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetGroup, setTargetGroup] = useState<string>('all');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch announcements created by this supervisor with client-side sort guarantee
  useEffect(() => {
    const fetchAnnouncements = async () => {
      if (!user) return;

      try {
        setLoading(true);
        const q = query(
          collection(db, 'announcements'),
          where('createdBy', '==', user.id),
          orderBy('publishedAt', 'desc')
        );

        const snapshot = await getDocs(q);
        const announcementsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          publishedAt: doc.data().publishedAt?.toDate() || new Date(),
        })) as AnnouncementData[];

        // Client-side sort guarantee: newest first
        announcementsData.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
        setAnnouncements(announcementsData);
      } catch (error) {
        console.error('[SUPERVISOR_ANNOUNCEMENTS] Error fetching:', error);
        // Fallback without orderBy
        try {
          const fallbackQuery = query(
            collection(db, 'announcements'),
            where('createdBy', '==', user.id)
          );
          const snapshot = await getDocs(fallbackQuery);
          const announcementsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            publishedAt: doc.data().publishedAt?.toDate() || new Date(),
          })) as AnnouncementData[];
          // Sort newest first even on fallback
          announcementsData.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
          setAnnouncements(announcementsData);
        } catch (fallbackError) {
          console.error('[SUPERVISOR_ANNOUNCEMENTS] Fallback error:', fallbackError);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchAnnouncements();
  }, [user?.id]);

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim() || !user) {
      toast({ title: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const targetGroupName = targetGroup === 'all'
        ? 'All Groups'
        : groups.find(g => g.id === targetGroup)?.name || 'Unknown Group';

      const newAnnouncement = {
        title: title.trim(),
        content: content.trim(),
        priority,
        targetGroup,
        targetGroupName,
        createdBy: user.id,
        createdByName: user.name,
        authorId: user.id,
        authorName: user.name,
        authorRole: user.role,
        publishedAt: serverTimestamp(),
        targetRoles: ['student'] as UserRole[], // Supervisor announcements target students
      };

      const docRef = await addDoc(collection(db, 'announcements'), newAnnouncement);

      // Fan out notifications to all students in the targeted scope immediately
      sendAnnouncementNotifications(
        docRef.id,
        title.trim(),
        content.trim(),
        ['student'],
        targetGroup
      ).catch(err => console.error('Notification fanout error:', err));

      toast({ title: 'Announcement Published', description: 'Students will receive a notification' });
      setIsDialogOpen(false);
      setTitle('');
      setContent('');
      setTargetGroup('all');
      setPriority('medium');

      // Add to local list optimistically (real-time would also work)
      const optimistic: AnnouncementData = {
        id: docRef.id,
        title: title.trim(),
        content: content.trim(),
        priority,
        targetGroup,
        targetGroupName,
        createdBy: user.id,
        createdByName: user.name,
        publishedAt: new Date(),
        targetRoles: ['student'],
      };
      setAnnouncements(prev => [optimistic, ...prev]);
    } catch (error: any) {
      console.error('[SUPERVISOR_ANNOUNCEMENTS] Error creating:', error);
      toast({ title: 'Error', description: 'Failed to publish announcement', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;

    try {
      await deleteDoc(doc(db, 'announcements', id));
      setAnnouncements(prev => prev.filter(a => a.id !== id));
      toast({ title: 'Announcement Deleted' });
    } catch (error) {
      console.error('[SUPERVISOR_ANNOUNCEMENTS] Error deleting:', error);
      toast({ title: 'Error', description: 'Failed to delete announcement', variant: 'destructive' });
    }
  };

  const getPriorityColor = (p: string) => {
    switch (p) { case 'high': return 'bg-destructive/10 text-destructive'; case 'low': return 'bg-muted text-muted-foreground'; default: return 'bg-primary/10 text-primary'; }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Announcements" description="Create announcements for your supervised groups" />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Announcements" description="Create announcements for your supervised groups">
        <Button onClick={() => setIsDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />New Announcement</Button>
      </PageHeader>
      <div className="space-y-4">
        {announcements.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center justify-center py-12"><Megaphone className="h-12 w-12 text-muted-foreground/50 mb-4" /><p className="text-muted-foreground mb-4">No announcements yet</p><Button onClick={() => setIsDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Create Announcement</Button></CardContent></Card>
        ) : (
          announcements.map(ann => (
            <Card key={ann.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div><CardTitle className="text-lg flex items-center gap-2">{ann.title}<Badge className={getPriorityColor(ann.priority)}>{ann.priority}</Badge></CardTitle><CardDescription className="flex items-center gap-4"><span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(ann.publishedAt).toLocaleDateString()}</span><span className="flex items-center gap-1"><Users className="h-3 w-3" />{ann.targetGroupName || (ann.targetGroup === 'all' ? 'All groups' : ann.targetGroup)}</span></CardDescription></div>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(ann.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">{ann.content}</p></CardContent>
            </Card>
          ))
        )}
      </div>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Announcement</DialogTitle><DialogDescription>Create a new announcement for your groups.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Announcement title" /></div>
            <div><Label>Content *</Label><Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} placeholder="Announcement content" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Target</Label><Select value={targetGroup} onValueChange={setTargetGroup}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Groups</SelectItem>{groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Priority</Label><Select value={priority} onValueChange={(v: 'low' | 'medium' | 'high') => setPriority(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent></Select></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Publishing...</> : 'Publish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
