import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Filter, UserCheck, Users, BookOpen, Send, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import type { User, SupervisionRequest } from '@/types';

export default function SupervisorSelection() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExpertise, setSelectedExpertise] = useState<string | null>(null);
  const [selectedSupervisor, setSelectedSupervisor] = useState<string | null>(null);
  const [requestMessage, setRequestMessage] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [supervisors, setSupervisors] = useState<User[]>([]);
  const [existingRequest, setExistingRequest] = useState<SupervisionRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [userGroupId, setUserGroupId] = useState<string | null>(null);

  // Fetch user's group ID
  useEffect(() => {
    const fetchUserGroup = async () => {
      if (!user?.id) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', user.id));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserGroupId(userData.groupId || null);
        }
      } catch (error) {
        console.error('Error fetching user group:', error);
      }
    };
    fetchUserGroup();
  }, [user]);

  // groupCountMap: supervisorId → actual number of groups assigned
  const [groupCountMap, setGroupCountMap] = useState<Record<string, number>>({});

  // Fetch supervisors and existing requests from Firebase
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch all supervisors
        const supervisorsQuery = query(
          collection(db, 'users'),
          where('role', '==', 'supervisor')
        );
        const supervisorsSnapshot = await getDocs(supervisorsQuery);
        const supervisorsData = supervisorsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as User[];
        setSupervisors(supervisorsData);

        // Fetch all groups that have a supervisorId assigned — one query, not N
        const groupsSnapshot = await getDocs(
          query(collection(db, 'groups'), where('supervisorId', '!=', null))
        );
        const countMap: Record<string, number> = {};
        groupsSnapshot.docs.forEach(d => {
          const sid = d.data().supervisorId;
          if (sid) countMap[sid] = (countMap[sid] || 0) + 1;
        });
        setGroupCountMap(countMap);

        // Fetch existing supervision request for user's group
        if (userGroupId) {
          const requestsQuery = query(
            collection(db, 'supervisionRequests'),
            where('groupId', '==', userGroupId)
          );
          const requestsSnapshot = await getDocs(requestsQuery);
          if (!requestsSnapshot.empty) {
            setExistingRequest({
              id: requestsSnapshot.docs[0].id,
              ...requestsSnapshot.docs[0].data()
            } as SupervisionRequest);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load supervisors');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userGroupId]);

  // Get all unique expertise areas
  const allExpertise = [...new Set(supervisors.flatMap(s => ((s as any).expertise || []) as string[]))];

  // Filter supervisors
  const filteredSupervisors = supervisors.filter(supervisor => {
    const expertise = ((supervisor as any).expertise || []) as string[];
    const matchesSearch = supervisor.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      expertise.some(e => e.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesExpertise = !selectedExpertise || expertise.includes(selectedExpertise);
    return matchesSearch && matchesExpertise;
  });

  const handleRequestClick = (supervisorId: string) => {
    setSelectedSupervisor(supervisorId);
    setDialogOpen(true);
  };

  const handleSubmitRequest = async () => {
    if (!selectedSupervisor || !userGroupId) {
      toast.error('You must be in a group to send a supervision request');
      return;
    }

    try {
      // Create supervision request in Firebase
      const { addDoc, collection: firestoreCollection, serverTimestamp } = await import('firebase/firestore');
      const { createNotification } = await import('@/lib/services');

      const requestData = {
        groupId: userGroupId,
        supervisorId: selectedSupervisor,
        message: requestMessage,
        status: 'pending',
        requestedAt: serverTimestamp(),
      };

      const docRef = await addDoc(firestoreCollection(db, 'supervisionRequests'), requestData);

      // Create notification for supervisor
      await createNotification({
        userId: selectedSupervisor,
        type: 'supervision_request',
        title: 'New Supervision Request',
        message: `Group ${userGroupId} has requested your supervision${requestMessage ? ': "' + requestMessage.substring(0, 50) + '..."' : ''}`,
        link: '/supervisor/requests',
      });

      // Update local state to show the new request
      setExistingRequest({
        id: docRef.id,
        ...requestData,
        requestedAt: new Date(),
      } as SupervisionRequest);

      toast.success('Supervision request sent successfully!');
      setDialogOpen(false);
      setRequestMessage('');
    } catch (error) {
      console.error('Error sending supervision request:', error);
      toast.error('Failed to send request. Please try again.');
    }
  };

  const selectedSupervisorData = supervisors.find(s => s.id === selectedSupervisor);

  return (
    <div className="space-y-6 pb-16 lg:pb-0">
      <PageHeader
        title="Supervisor Selection"
        description="Find and request a supervisor for your project"
      />

      {/* Current Request Status */}
      {existingRequest && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <UserCheck className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Request Status</p>
                <p className="text-sm text-muted-foreground">
                  You've requested {supervisors.find(s => s.id === existingRequest.supervisorId)?.name}
                </p>
              </div>
            </div>
            <StatusBadge status={existingRequest.status} />
          </CardContent>
        </Card>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or expertise..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedExpertise === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedExpertise(null)}
          >
            All
          </Button>
          {allExpertise.slice(0, 4).map((expertise) => (
            <Button
              key={expertise}
              variant={selectedExpertise === expertise ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedExpertise(expertise)}
            >
              {expertise}
            </Button>
          ))}
        </div>
      </div>

      {/* Supervisor Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredSupervisors.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSupervisors.map((supervisor) => {
            // Use live count from groups collection, not the stale user doc field
            const currentGroups = groupCountMap[supervisor.id] ?? 0;
            const maxGroups = (supervisor as any).maxGroups || 5;
            const isAvailable = currentGroups < maxGroups;
            const availableSlots = maxGroups - currentGroups;

            return (
              <Card key={supervisor.id} className="card-interactive">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{supervisor.name}</CardTitle>
                      <CardDescription>{(supervisor as any).designation || 'Supervisor'}</CardDescription>
                    </div>
                    <Badge variant={isAvailable ? 'default' : 'secondary'}>
                      {isAvailable ? `${availableSlots} slots` : 'Full'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Expertise</p>
                    <div className="flex flex-wrap gap-1">
                      {((supervisor as any).expertise || []).map((exp: string) => (
                        <Badge key={exp} variant="outline" className="text-xs">
                          {exp}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      {currentGroups}/{maxGroups} groups
                    </span>
                    <Button
                      size="sm"
                      disabled={!isAvailable || !!existingRequest}
                      onClick={() => handleRequestClick(supervisor.id)}
                    >
                      <Send className="mr-1 h-3 w-3" />
                      Request
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={UserCheck}
          title="No supervisors found"
          description={supervisors.length === 0 ? "No supervisors available yet" : "Try adjusting your search or filters"}
        />
      )}

      {/* Request Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Supervision</DialogTitle>
            <DialogDescription>
              Send a supervision request to {selectedSupervisorData?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="message">Message (Optional)</Label>
              <Textarea
                id="message"
                placeholder="Introduce yourself and explain why you'd like this supervisor..."
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitRequest}>
              Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
