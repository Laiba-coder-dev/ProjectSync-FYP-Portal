import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Megaphone, Calendar, Loader2, Trash2, Users, Search, X } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, deleteDoc, doc, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { sendAnnouncementNotifications } from '@/lib/services';
import { format } from 'date-fns';
import type { UserRole, User } from '@/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
    { value: 'student', label: 'Students' },
    { value: 'supervisor', label: 'Supervisors' },
    { value: 'pmo', label: 'PMO' },
    { value: 'external_panel', label: 'External Panel' },
    { value: 'exam_cell', label: 'Exam Cell' },
];

const priorityColors: Record<string, string> = {
    high: 'bg-destructive/10 text-destructive border-destructive/20',
    medium: 'bg-orange-100 text-orange-700 border-orange-200',
    low: 'bg-muted text-muted-foreground',
};

export default function PMOAnnouncements() {
    const { user } = useAuth();
    // Real-time: onSnapshot in useAnnouncements picks up new docs instantly
    const { announcements, loading } = useAnnouncements(undefined, 100);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
    const [targetMode, setTargetMode] = useState<'roles' | 'specific'>('roles');
    const [selectedRoles, setSelectedRoles] = useState<UserRole[]>(['student', 'supervisor']);
    const [searchEmail, setSearchEmail] = useState('');
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const toggleRole = (role: UserRole) => {
        setSelectedRoles(prev =>
            prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
        );
    };

    const resetForm = () => {
        setTitle('');
        setContent('');
        setPriority('medium');
        setTargetMode('roles');
        setSelectedRoles(['student', 'supervisor']);
        setSearchEmail('');
        setSearchResults([]);
        setSelectedUsers([]);
    };

    const handleSearch = async (val: string) => {
        setSearchEmail(val);
        if (val.length < 3) {
            setSearchResults([]);
            return;
        }
        setIsSearching(true);
        try {
            const q = query(
                collection(db, 'users'),
                where('email', '>=', val.toLowerCase()),
                where('email', '<=', val.toLowerCase() + '\uf8ff'),
                limit(5)
            );
            const snap = await getDocs(q);
            setSearchResults(snap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
        } catch (error) {
            console.error('Error searching users:', error);
        } finally {
            setIsSearching(false);
        }
    };

    const toggleUser = (u: User) => {
        if (selectedUsers.find(x => x.id === u.id)) {
            setSelectedUsers(prev => prev.filter(x => x.id !== u.id));
        } else {
            setSelectedUsers(prev => [...prev, u]);
        }
        setSearchEmail('');
        setSearchResults([]);
    };

    const handleSubmit = async () => {
        if (!title.trim() || !content.trim()) {
            toast.error('Please fill in the title and content');
            return;
        }
        if (targetMode === 'roles' && selectedRoles.length === 0) {
            toast.error('Please select at least one target audience role');
            return;
        }
        if (targetMode === 'specific' && selectedUsers.length === 0) {
            toast.error('Please add at least one specific user');
            return;
        }
        if (!user) return;

        // In specific mode, we must still supply the roles of the selected users 
        // to `targetRoles` so the Firestore query `where('targetRoles', 'array-contains')`
        // brings it into their feed, before the client-side `targetUsers` filter guarantees isolation.
        const finalTargetRoles = targetMode === 'roles' 
            ? selectedRoles 
            : Array.from(new Set(selectedUsers.map(u => u.role)));
            
        const finalTargetUsers = targetMode === 'specific' ? selectedUsers.map(u => u.id) : [];

        setIsSubmitting(true);
        try {
            // 1. Save the announcement
            const docRef = await addDoc(collection(db, 'announcements'), {
                title: title.trim(),
                content: content.trim(),
                priority,
                targetRoles: finalTargetRoles,
                targetUsers: finalTargetUsers,
                authorId: user.id,
                authorName: user.name,
                authorRole: user.role,
                createdBy: user.id,
                createdByName: user.name,
                publishedAt: serverTimestamp(),
            });

            // 2. Fan out notifications to all targeted users (non-blocking)
            // NotificationService now natively accepts a targetUsers array to override role fanout
            sendAnnouncementNotifications(
                docRef.id,
                title.trim(),
                content.trim(),
                finalTargetRoles,
                undefined,
                targetMode === 'specific' ? finalTargetUsers : undefined
            ).catch(err => console.error('Notification fanout error:', err));

            toast.success(`Announcement published to ${targetMode === 'roles' ? finalTargetRoles.length + ' role(s)' : finalTargetUsers.length + ' user(s)'}`);
            setIsDialogOpen(false);
            resetForm();
            // No page reload needed — useAnnouncements is real-time via onSnapshot
        } catch (error: any) {
            console.error('[PMO_ANNOUNCEMENTS] Error creating:', error);
            toast.error('Failed to publish announcement');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this announcement?')) return;
        try {
            await deleteDoc(doc(db, 'announcements', id));
            toast.success('Announcement deleted');
            // Real-time listener will update the list automatically
        } catch (error) {
            toast.error('Failed to delete announcement');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <PageHeader
                    title="Announcements"
                    description="Publish announcements to students, supervisors, and staff"
                />
                <Button onClick={() => setIsDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Announcement
                </Button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : announcements.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
                    <Megaphone className="h-12 w-12 text-muted-foreground/50" />
                    <p className="text-muted-foreground">No announcements yet. Create your first one.</p>
                    <Button onClick={() => setIsDialogOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        New Announcement
                    </Button>
                </div>
            ) : (
                <div className="grid gap-4">
                    {/* Sorted newest-first by useAnnouncements */}
                    {announcements.map((announcement) => (
                        <Card key={announcement.id} className="transition-shadow hover:shadow-md">
                            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                                <div className="space-y-1 flex-1 min-w-0">
                                    <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
                                        {announcement.title}
                                        <Badge
                                            className={`text-xs ${priorityColors[announcement.priority] || priorityColors.medium}`}
                                            variant="outline"
                                        >
                                            {announcement.priority}
                                        </Badge>
                                    </CardTitle>
                                    <CardDescription className="flex items-center gap-3 flex-wrap">
                                        <span className="flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {announcement.publishedAt
                                                ? format(
                                                    announcement.publishedAt instanceof Date
                                                        ? announcement.publishedAt
                                                        : new Date((announcement.publishedAt as any).seconds * 1000),
                                                    'MMM d, yyyy · h:mm a'
                                                )
                                                : 'Just now'}
                                        </span>
                                        <span>•</span>
                                        <span>{(announcement as any).createdByName || announcement.authorName}</span>
                                    </CardDescription>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-muted-foreground hover:text-destructive shrink-0"
                                    onClick={() => handleDelete(announcement.id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {announcement.content}
                                </p>
                                {announcement.targetRoles?.length > 0 && (
                                    <div className="flex items-center gap-2 mt-4 flex-wrap">
                                        <Users className="h-3 w-3 text-muted-foreground" />
                                        {announcement.targetRoles.map(role => (
                                            <Badge key={role} variant="outline" className="text-xs capitalize">
                                                {role.replace('_', ' ')}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Create Announcement Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>New Announcement</DialogTitle>
                        <DialogDescription>
                            Publish an announcement to selected roles. All targeted users will receive a notification immediately.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="ann-title">Title *</Label>
                            <Input
                                id="ann-title"
                                placeholder="Announcement title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="ann-content">Message *</Label>
                            <Textarea
                                id="ann-content"
                                placeholder="Announcement content..."
                                rows={4}
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Priority</Label>
                            <Select value={priority} onValueChange={(v: 'low' | 'medium' | 'high') => setPriority(v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="low">Low</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-4">
                            <Label>Target Audience *</Label>
                            <Tabs value={targetMode} onValueChange={(v) => setTargetMode(v as any)} className="w-full">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="roles">Role-Based</TabsTrigger>
                                    <TabsTrigger value="specific">Specific Users</TabsTrigger>
                                </TabsList>
                                <TabsContent value="roles" className="mt-4">
                                    <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
                                        {ROLE_OPTIONS.map(({ value, label }) => (
                                            <div key={value} className="flex items-center gap-2">
                                                <Checkbox
                                                    id={`role-${value}`}
                                                    checked={selectedRoles.includes(value)}
                                                    onCheckedChange={() => toggleRole(value)}
                                                />
                                                <label
                                                    htmlFor={`role-${value}`}
                                                    className="text-sm cursor-pointer select-none"
                                                >
                                                    {label}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                    {selectedRoles.length > 0 && (
                                        <p className="text-xs text-muted-foreground mt-2">
                                            Will notify all active: {selectedRoles.map(r => r.replace('_', ' ')).join(', ')}
                                        </p>
                                    )}
                                </TabsContent>
                                <TabsContent value="specific" className="mt-4">
                                    <div className="space-y-3">
                                        <div className="relative">
                                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Search by email..."
                                                className="pl-9"
                                                value={searchEmail}
                                                onChange={(e) => handleSearch(e.target.value)}
                                            />
                                            {isSearching && (
                                                <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                                            )}
                                        </div>
                                        
                                        {/* Search Results Dropdown-like UI */}
                                        {searchResults.length > 0 && (
                                            <div className="border rounded-md shadow-sm divide-y">
                                                {searchResults.map(u => (
                                                    <div key={u.id} className="p-2 flex items-center justify-between hover:bg-muted/50">
                                                        <div>
                                                            <p className="text-sm font-medium">{u.name}</p>
                                                            <p className="text-xs text-muted-foreground">{u.email} ({u.role})</p>
                                                        </div>
                                                        <Button variant="ghost" size="sm" onClick={() => toggleUser(u)}>
                                                            {selectedUsers.find(x => x.id === u.id) ? 'Added' : 'Add'}
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Selected Users Chips */}
                                        {selectedUsers.length > 0 && (
                                            <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-md border text-sm">
                                                {selectedUsers.map(su => (
                                                    <Badge key={su.id} variant="secondary" className="pl-2 pr-1 py-1 gap-1">
                                                        <span>{su.email}</span>
                                                        <Button variant="ghost" size="icon" className="h-4 w-4 rounded-full hover:bg-muted" onClick={() => toggleUser(su)}>
                                                            <X className="h-3 w-3" />
                                                        </Button>
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                        {selectedUsers.length === 0 && (
                                            <p className="text-xs text-muted-foreground text-center py-2">No users selected.</p>
                                        )}
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button onClick={handleSubmit} disabled={isSubmitting || !title.trim() || !content.trim() || (targetMode === 'roles' ? selectedRoles.length === 0 : selectedUsers.length === 0)}>
                            {isSubmitting ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Publishing...</>
                            ) : (
                                <>
                                    <Megaphone className="mr-2 h-4 w-4" />
                                    Publish
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
