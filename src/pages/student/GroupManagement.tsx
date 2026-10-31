import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { useStudentData } from '@/hooks/useStudentData';
import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  query,
  where,
  getDocs,
  getDoc,
  limit,
  runTransaction
} from 'firebase/firestore';
import { Users, UserPlus, Crown, Mail, Copy, Trash2, Plus, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export default function GroupManagement() {
  const { user } = useAuth();
  const { group, loading } = useStudentData(); // Real data hook

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [supervisorName, setSupervisorName] = useState<string | null>(null);

  const isLeader = group?.members.find(m => m.userId === user?.id)?.role === 'leader';

  // Fetch supervisor name if group has accepted supervision
  useEffect(() => {
    if (!group?.id) return;

    const fetchSupervisor = async () => {
      try {
        // Find accepted supervision request for this group
        const requestsQuery = query(
          collection(db, 'supervisionRequests'),
          where('groupId', '==', group.id),
          where('status', '==', 'accepted'),
          limit(1)
        );
        const requestsSnapshot = await getDocs(requestsQuery);

        if (!requestsSnapshot.empty) {
          const request = requestsSnapshot.docs[0].data();
          // Use getDoc directly by ID — no need for a collection query
          const supervisorDocRef = doc(db, 'users', request.supervisorId);
          const supervisorDoc = await getDoc(supervisorDocRef);
          if (supervisorDoc.exists()) {
            setSupervisorName(supervisorDoc.data().name);
          }
        }
      } catch (error) {
        console.error('Error fetching supervisor:', error);
      }
    };

    fetchSupervisor();
  }, [group?.id]);

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast.error('Please enter a group name');
      return;
    }
    if (!user) return;

    setIsSubmitting(true);
    try {
      // 1. Create Group Document
      const newGroupData = {
        name: groupName,
        members: [{
          userId: user.id,
          name: user.name,
          email: user.email,
          enrollmentNumber: (user as any).enrollmentNumber || 'N/A',
          role: 'leader',
          joinedAt: new Date(),
        }],
        maxMembers: 4,
        createdAt: serverTimestamp(),
      };

      const groupRef = await addDoc(collection(db, 'groups'), newGroupData);

      // 2. Update User Profile with groupId
      await updateDoc(doc(db, 'users', user.id), {
        groupId: groupRef.id
      });

      toast.success(`Group "${groupName}" created successfully!`);
      setCreateDialogOpen(false);
      setGroupName('');
      // Triggers re-fetch via useStudentData's user dependency
    } catch (error: any) {
      console.error(error);
      toast.error('Failed to create group: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }
    if (!user || !group) return;

    // Check if group is full
    if (group.members.length >= group.maxMembers) {
      toast.error("Group is already full");
      return;
    }

    // Check if duplicate
    if (group.members.find(m => m.email === inviteEmail)) {
      toast.error("User is already in the group");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Check if user exists
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', inviteEmail), limit(1));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        toast.error("User not found with this email");
        return;
      }

      const targetUser = snapshot.docs[0].data();

      // 2. Check if user is already in a group
      if (targetUser.groupId) {
        toast.error("User is already in another group");
        return;
      }

      // 3. Check if invite already sent
      const inviteQ = query(
        collection(db, 'invitations'),
        where('toEmail', '==', inviteEmail),
        where('fromGroupId', '==', group.id),
        where('status', '==', 'pending')
      );
      const inviteSnapshot = await getDocs(inviteQ);
      if (!inviteSnapshot.empty) {
        toast.error("Invitation already sent to this user");
        return;
      }

      // 4. Create Invitation
      const inviteRef = await addDoc(collection(db, 'invitations'), {
        toEmail: inviteEmail,
        toName: targetUser.name,
        toUserId: snapshot.docs[0].id,   // store userId so we can notify directly
        fromGroupId: group.id,
        fromGroupName: group.name,
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      // 5. Send notification to the invited student immediately
      const { createNotification } = await import('@/lib/services');
      await createNotification({
        userId: snapshot.docs[0].id,
        type: 'general',
        title: '👥 Group Invitation',
        message: `You've been invited to join "${group.name}". Check the My Group page to accept or reject.`,
        link: '/student/group',
      }).catch(err => console.error('Invite notification failed:', err));

      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteDialogOpen(false);
      setInviteEmail('');
    } catch (error: any) {
      console.error(error);
      toast.error("Failed to send invite: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyInviteLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/invite/${group?.id}`);
    toast.success('Invite link copied to clipboard!');
  };

  const handleRemoveMember = async (userId: string, memberName: string) => {
    if (!group) return;

    try {
      await runTransaction(db, async (transaction) => {
        const groupRef = doc(db, 'groups', group.id);
        const groupDoc = await transaction.get(groupRef);
        if (!groupDoc.exists()) throw new Error('Group does not exist');

        const currentMembers = groupDoc.data().members || [];
        const newMembers = currentMembers.filter((m: any) => m.userId !== userId);

        transaction.update(groupRef, { members: newMembers });

        const userRef = doc(db, 'users', userId);
        transaction.update(userRef, { groupId: null });
      });

      toast.success(`${memberName} removed from group`);
    } catch (error: any) {
      console.error(error);
      toast.error('Failed to remove member: ' + error.message);
    }
  };

  const handleLeaveGroup = async () => {
    if (!group || !user) return;

    if (isLeader && group.members.length > 1) {
      toast.error('Leader cannot leave while other members exist. Promote someone else first.');
      setLeaveDialogOpen(false);
      return;
    }

    try {
      await runTransaction(db, async (transaction) => {
        const groupRef = doc(db, 'groups', group.id);
        const groupDoc = await transaction.get(groupRef);
        if (!groupDoc.exists()) throw new Error('Group not found');

        const currentMembers = groupDoc.data().members || [];
        const newMembers = currentMembers.filter((m: any) => m.userId !== user.id);

        if (newMembers.length === 0) {
          transaction.delete(groupRef);
        } else {
          transaction.update(groupRef, { members: newMembers });
        }

        const userRef = doc(db, 'users', user.id);
        transaction.update(userRef, { groupId: null });
      });

      toast.success('You have left the group');
      setLeaveDialogOpen(false);
    } catch (error: any) {
      console.error(error);
      toast.error('Failed to leave group: ' + error.message);
    }
  };




  const [invitations, setInvitations] = useState<any[]>([]);

  // Fetch invitations if no group
  useEffect(() => {
    if (group || !user) return;

    const fetchInvites = async () => {
      const q = query(collection(db, 'invitations'), where('toEmail', '==', user.email), where('status', '==', 'pending'));
      const snapshot = await getDocs(q);
      setInvitations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchInvites();
  }, [user, group]);

  const handleAcceptInvite = async (invite: any) => {
    if (!user) return;
    try {
      await runTransaction(db, async (transaction) => {
        // 1. Get Group
        const groupRef = doc(db, 'groups', invite.fromGroupId);
        const groupDoc = await transaction.get(groupRef);
        if (!groupDoc.exists()) throw new Error('Group not found');

        const groupData = groupDoc.data();
        if (groupData.members.length >= groupData.maxMembers) {
          throw new Error('Group is full');
        }

        // 2. Add Member
        const newMember = {
          userId: user.id,
          name: user.name,
          email: user.email,
          enrollmentNumber: (user as any).enrollmentNumber || 'N/A',
          role: 'member',
          joinedAt: new Date()
        };
        const newMembers = [...groupData.members, newMember];

        transaction.update(groupRef, { members: newMembers });

        // 3. Update User
        const userRef = doc(db, 'users', user.id);
        transaction.update(userRef, { groupId: invite.fromGroupId });

        // 4. Update Invitation
        const inviteRef = doc(db, 'invitations', invite.id);
        transaction.update(inviteRef, { status: 'accepted' });
      });

      toast.success('Joined group successfully!');
      setInvitations([]);
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to join: ' + e.message);
    }
  };

  const handleRejectInvite = async (inviteId: string) => {
    try {
      await updateDoc(doc(db, 'invitations', inviteId), { status: 'rejected' });
      setInvitations(prev => prev.filter(i => i.id !== inviteId));
      toast.success('Invitation rejected');
    } catch (e) {
      toast.error('Failed to reject invitation');
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
  }

  if (!group) {
    return (
      <div className="space-y-6 pb-16 lg:pb-0">
        <PageHeader
          title="My Group"
          description="Create or join a project group"
        />

        {/* Invitations Section */}
        {invitations.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Pending Invitations</h3>
            {invitations.map(invite => (
              <Card key={invite.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">Invitation to join <strong>{invite.fromGroupName}</strong></p>
                    <p className="text-sm text-muted-foreground">From: {invite.fromGroupName}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => handleRejectInvite(invite.id)}>Reject</Button>
                    <Button onClick={() => handleAcceptInvite(invite)}>Accept</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <EmptyState
          icon={Users}
          title="You're not in a group"
          description="Create a new group or wait for an invitation from another student"
          action={{
            label: 'Create Group',
            onClick: () => setCreateDialogOpen(true),
          }}
        />

        {/* Create Group Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Group</DialogTitle>
              <DialogDescription>
                Create a project group. You will become the leader.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="groupName">Group Name</Label>
                <Input
                  id="groupName"
                  placeholder="e.g., Team Alpha"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateGroup} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Group
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16 lg:pb-0">
      <PageHeader
        title="My Group"
        description="Manage your project group"
      >
        {isLeader && group.members.length < group.maxMembers && (
          <Button onClick={() => setInviteDialogOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Invite Member
          </Button>
        )}
      </PageHeader>

      {/* Group Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {group.name}
              </CardTitle>
              <CardDescription>
                {group.members.length}/{group.maxMembers} members
                {supervisorName && (
                  <span className="ml-2 text-primary">• Supervisor: {supervisorName}</span>
                )}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleCopyInviteLink}>
              <Copy className="mr-2 h-4 w-4" />
              Copy Invite Link
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Members List */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Members</h4>
              {group.members.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {member?.name?.split(' ').map(n => n[0]).join('') || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{member.name}</p>
                        {member.role === 'leader' && (
                          <Badge variant="default" className="gap-1">
                            <Crown className="h-3 w-3" />
                            Leader
                          </Badge>
                        )}
                        {member.userId === user?.id && (
                          <Badge variant="outline">You</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        {member.email}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {member.enrollmentNumber}
                      </p>
                    </div>
                  </div>
                  {isLeader && member.userId !== user?.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleRemoveMember(member.userId, member.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Add Member Placeholder */}
            {group.members.length < group.maxMembers && (
              <Button
                variant="outline"
                className="w-full border-dashed"
                onClick={() => setInviteDialogOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Member ({group.maxMembers - group.members.length} slots available)
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Leave Group */}
      {!isLeader && (
        <Card className="border-destructive/20">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium">Leave Group</p>
              <p className="text-sm text-muted-foreground">
                You will need to join another group or create a new one
              </p>
            </div>
            <Button variant="destructive" onClick={() => setLeaveDialogOpen(true)}>
              Leave Group
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Invite Member Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
            <DialogDescription>
              Send an invitation to a student to join your group
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="inviteEmail">Student Email</Label>
              <Input
                id="inviteEmail"
                type="email"
                placeholder="student@university.edu"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInviteMember}>
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave Group Dialog */}
      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Group?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave {group.name}? You will need to join another group or create a new one.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleLeaveGroup}
            >
              Leave Group
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
