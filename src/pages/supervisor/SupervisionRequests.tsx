import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Users, Calendar, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { SupervisionRequest } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';

export default function SupervisionRequests() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [requests, setRequests] = useState<SupervisionRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<SupervisionRequest | null>(null);
  const [actionType, setActionType] = useState<'accept' | 'reject' | null>(null);
  const [responseMessage, setResponseMessage] = useState('');
  const [loading, setLoading] = useState(true);

  // Fetch supervision requests for current supervisor
  useEffect(() => {
    const fetchRequests = async () => {
      if (!user?.id) return;

      setLoading(true);
      try {
        const requestsQuery = query(
          collection(db, 'supervisionRequests'),
          where('supervisorId', '==', user.id)
        );
        const requestsSnapshot = await getDocs(requestsQuery);
        const requestsData = requestsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          requestedAt: doc.data().requestedAt?.toDate() || new Date(),
        })) as SupervisionRequest[];

        setRequests(requestsData);
      } catch (error) {
        console.error('Error fetching supervision requests:', error);
        toast({ title: 'Error', description: 'Failed to load supervision requests' });
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, [user]);

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const acceptedRequests = requests.filter(r => r.status === 'accepted');
  const rejectedRequests = requests.filter(r => r.status === 'rejected');

  const handleAction = (request: SupervisionRequest, action: 'accept' | 'reject') => {
    setSelectedRequest(request);
    setActionType(action);
    setResponseMessage('');
  };

  const confirmAction = async () => {
    if (!selectedRequest || !actionType || !user) return;

    try {
      const newStatus = actionType === 'accept' ? 'accepted' : 'rejected';

      // Update supervision request status
      await updateDoc(doc(db, 'supervisionRequests', selectedRequest.id), {
        status: newStatus,
        responseMessage: responseMessage || null,
      });

      // If accepting, update the group document with supervisorId
      if (actionType === 'accept') {
        console.log('[SUPERVISION_REQUESTS] Updating group with supervisorId:', user.id);
        await updateDoc(doc(db, 'groups', selectedRequest.groupId), {
          supervisorId: user.id,
        });
      }

      // Create notifications for group members
      try {
        const { getDoc } = await import('firebase/firestore');
        const groupDoc = await getDoc(doc(db, 'groups', selectedRequest.groupId));
        if (groupDoc.exists()) {
          const groupData = groupDoc.data();
          // members is [{userId, name, email, role}] — extract userId from each
          const members: any[] = groupData.members || [];

          const title = newStatus === 'accepted'
            ? '✅ Supervision Request Accepted'
            : '❌ Supervision Request Declined';
          const message = newStatus === 'accepted'
            ? `${user.name} has accepted your supervision request.${responseMessage ? ' Note: "' + responseMessage + '"' : ''}`
            : `${user.name} has declined your supervision request.${responseMessage ? ' Reason: "' + responseMessage + '"' : ''}`;

          const { createNotification } = await import('@/lib/services');
          await Promise.all(
            members.map(m =>
              createNotification({
                userId: m.userId,   // ← was incorrectly passing the whole object before
                type: 'supervision_response',
                title,
                message,
                link: '/student/supervisor',
              })
            )
          );
        }
      } catch (notifError) {
        console.error('Error creating supervision notifications:', notifError);
      }

      // Update local state
      setRequests(prev => prev.map(r =>
        r.id === selectedRequest.id
          ? { ...r, status: newStatus, responseMessage }
          : r
      ));

      toast({ title: actionType === 'accept' ? 'Request Accepted' : 'Request Declined' });
      setSelectedRequest(null);
      setActionType(null);
      // State already updated above \u2014 no page reload needed
    } catch (error) {
      console.error('Error updating request:', error);
      toast({ title: 'Error', description: 'Failed to update request' });
    }
  };

  const renderRequestCard = (request: SupervisionRequest) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10"><Users className="h-5 w-5 text-primary" /></div>
              <div>
                <h4 className="font-semibold">{request.group?.name || 'Student Group'}</h4>
                <p className="text-sm text-muted-foreground">Group ID: {request.groupId}</p>
              </div>
            </div>
            <StatusBadge status={request.status} />
          </div>
          {request.message && <div className="p-3 rounded-lg bg-muted/50"><p className="text-sm italic">"{request.message}"</p></div>}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1"><Calendar className="h-4 w-4" /><span>{new Date(request.requestedAt).toLocaleDateString()}</span></div>
          </div>
          {request.status === 'pending' && (
            <div className="flex gap-2 pt-2">
              <Button className="flex-1" onClick={() => handleAction(request, 'accept')}><CheckCircle className="mr-2 h-4 w-4" />Accept</Button>
              <Button variant="outline" className="flex-1" onClick={() => handleAction(request, 'reject')}><XCircle className="mr-2 h-4 w-4" />Decline</Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Supervision Requests" description="Review and respond to student group supervision requests" />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="flex gap-4 flex-wrap">
            <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> {pendingRequests.length} Pending</Badge>
            <Badge variant="outline" className="gap-1 text-status-approved"><CheckCircle className="h-3 w-3" /> {acceptedRequests.length} Accepted</Badge>
            <Badge variant="outline" className="gap-1 text-status-rejected"><XCircle className="h-3 w-3" /> {rejectedRequests.length} Declined</Badge>
          </div>
          <Tabs defaultValue="pending" className="space-y-4">
            <TabsList>
              <TabsTrigger value="pending">Pending ({pendingRequests.length})</TabsTrigger>
              <TabsTrigger value="accepted">Accepted ({acceptedRequests.length})</TabsTrigger>
              <TabsTrigger value="rejected">Declined ({rejectedRequests.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="pending">
              {pendingRequests.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">{pendingRequests.map(r => <div key={r.id}>{renderRequestCard(r)}</div>)}</div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No pending requests</p>
              )}
            </TabsContent>
            <TabsContent value="accepted">
              {acceptedRequests.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">{acceptedRequests.map(r => <div key={r.id}>{renderRequestCard(r)}</div>)}</div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No accepted requests</p>
              )}
            </TabsContent>
            <TabsContent value="rejected">
              {rejectedRequests.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">{rejectedRequests.map(r => <div key={r.id}>{renderRequestCard(r)}</div>)}</div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No declined requests</p>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
      <Dialog open={!!selectedRequest && !!actionType} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionType === 'accept' ? 'Accept' : 'Decline'} Request</DialogTitle>
            <DialogDescription>Confirm your action for this supervision request.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="response">Message (Optional)</Label>
              <Textarea id="response" value={responseMessage} onChange={(e) => setResponseMessage(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRequest(null)}>Cancel</Button>
            <Button variant={actionType === 'accept' ? 'default' : 'destructive'} onClick={confirmAction}>{actionType === 'accept' ? 'Accept' : 'Decline'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
