import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, writeBatch } from 'firebase/firestore';
import { ProjectGroup, Project } from '@/types';
import { Share, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface GroupData {
  group: ProjectGroup;
  project: Project | null;
  evaluations: any[];
  status: 'draft' | 'shared' | 'finalized';
  sharedWith: string;
}

export default function ExternalMarksSharing() {
  const { user } = useAuth();
  const [data, setData] = useState<GroupData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharingId, setSharingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const qG = query(collection(db, 'groups'), where('externalPanelId', '==', user.id));
        const snapG = await getDocs(qG);
        const groups = snapG.docs.map(d => ({ id: d.id, ...d.data() } as ProjectGroup));

        if (groups.length === 0) {
          setData([]); setLoading(false); return;
        }

        const qP = query(collection(db, 'projects'), where('groupId', 'in', groups.map(g => g.id)));
        const snapP = await getDocs(qP);
        const projectsMap: Record<string, Project> = {};
        snapP.docs.forEach(d => {
          const p = { id: d.id, ...d.data() } as Project;
          projectsMap[p.groupId] = p;
        });

        const qE = query(collection(db, 'evaluations'), where('evaluatorId', '==', user.id));
        const snapE = await getDocs(qE);
        const evalsMap: Record<string, any[]> = {};
        snapE.docs.forEach(d => {
            const ev = { id: d.id, ...d.data() };
            if (!evalsMap[ev.groupId]) evalsMap[ev.groupId] = [];
            evalsMap[ev.groupId].push(ev);
        });

        const compiled: GroupData[] = groups.map(g => {
            const groupEvals = evalsMap[g.id] || [];
            const groupEval = groupEvals.find(e => e.studentId === null);
            return {
                group: g,
                project: projectsMap[g.id] || null,
                evaluations: groupEvals,
                status: groupEval?.status || 'draft',
                sharedWith: groupEval?.sharedWith || 'none'
            };
        });

        setData(compiled.filter(c => c.evaluations.length > 0));
      } catch (err) {
        toast.error('Failed to load marks sharing data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const handleShare = async (groupId: string) => {
      setSharingId(groupId);
      try {
          const groupData = data.find(d => d.group.id === groupId);
          if (!groupData) return;

          const batch = writeBatch(db);
          groupData.evaluations.forEach(ev => {
              const ref = doc(db, 'evaluations', ev.id);
              batch.update(ref, { status: 'shared', sharedWith: 'exam_cell' });
          });
          await batch.commit();

          setData(prev => prev.map(d => d.group.id === groupId ? { ...d, status: 'shared', sharedWith: 'exam_cell' } : d));
          toast.success('Marks shared with Exam Cell successfully!');
      } catch (err) {
          toast.error('Failed to share marks');
      } finally {
          setSharingId(null);
      }
  };

  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Marks Sharing" description="Review and share your evaluation marks with the Exam Cell" />
      
      {data.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No evaluated groups available to share.</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
            {data.map(item => (
                <Card key={item.group.id}>
                    <CardContent className="p-4 flex flex-col justify-between min-h-[160px]">
                       <div>
                         <div className="flex justify-between items-start mb-2">
                            <div>
                               <h4 className="font-semibold">{item.group.name}</h4>
                               <p className="text-sm text-muted-foreground">{item.project?.title || 'No Project Assigned'}</p>
                            </div>
                            <Badge variant={item.status === 'shared' ? 'default' : item.status === 'finalized' ? 'secondary' : 'outline'}>
                                {item.status === 'finalized' ? 'Finalized' : item.status === 'shared' ? 'Shared with Exam Cell' : 'Draft'}
                            </Badge>
                         </div>
                         <p className="text-xs text-muted-foreground">
                             Evaluations completed for {item.evaluations.filter(e => e.studentId).length} students.
                         </p>
                       </div>
                       
                       <div className="mt-4 flex justify-end">
                          <Button 
                             onClick={() => handleShare(item.group.id)}
                             disabled={item.status !== 'draft' || sharingId === item.group.id}
                          >
                             {sharingId === item.group.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : (item.status !== 'draft' ? <CheckCircle className="w-4 h-4 mr-2" /> : <Share className="w-4 h-4 mr-2" />)}
                             {item.status !== 'draft' ? 'Shared' : 'Share with Exam Cell'}
                          </Button>
                       </div>
                    </CardContent>
                </Card>
            ))}
        </div>
      )}
    </div>
  );
}
