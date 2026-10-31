import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from '@/components/shared/PageHeader';
import ProjectAnalyzer from '@/pages/shared/ProjectAnalyzer';
import { useAuth } from '@/contexts/AuthContext';
import { useStudentData } from '@/hooks/useStudentData';
import { useProject } from '@/hooks/useProject';
import { getStudentHistory } from '@/lib/services/aiAnalyzerService';
import { format } from 'date-fns';
import { BrainCircuit, History, AlertTriangle, CheckCircle2, Loader2, Play } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function AnalyzerDashboard() {
  const { user } = useAuth();
  const { group, loading: groupLoading } = useStudentData();
  const { project, loading: projectLoading } = useProject(group?.id);
  
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('new');

  useEffect(() => {
    if (user?.uid) {
      loadHistory();
    }
  }, [user]);

  const loadHistory = async () => {
    if (!user?.uid) return;
    setHistoryLoading(true);
    try {
      const data = await getStudentHistory(user.uid);
      setHistory(data);
    } catch (error) {
      console.error(error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const renderHistoryScore = (results: any) => {
    if (results?.overall_score) {
      return (
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold">{results.overall_score}/10</span>
        </div>
      );
    }
    return <span className="text-muted-foreground">N/A</span>;
  };

  const getStatusColor = (status: string) => {
    if (!status) return 'default';
    if (status.includes('READY')) return 'success';
    if (status.includes('REJECTION') || status.includes('WARNING')) return 'destructive';
    return 'default';
  };

  if (groupLoading || projectLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <PageHeader 
          title="AI Quality Analyzer" 
          description="Evaluate your project ideas and drafts before official submission." 
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full md:w-auto grid-cols-2 h-auto p-1">
          <TabsTrigger value="new" className="py-3 flex items-center gap-2">
            <Play className="h-4 w-4" /> New Analysis
          </TabsTrigger>
          <TabsTrigger value="history" className="py-3 flex items-center gap-2" onClick={loadHistory}>
            <History className="h-4 w-4" /> My History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="m-0">
          <div className="bg-card rounded-lg border shadow-sm p-6">
            <ProjectAnalyzer 
              initialData={{
                title: project?.title || '',
                description: project?.abstract || '',
                domain: project?.domain || ''
              }} 
            />
          </div>
        </TabsContent>

        <TabsContent value="history" className="m-0 space-y-4">
          {historyLoading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                <BrainCircuit className="h-12 w-12 mb-4 opacity-20" />
                <h3 className="text-lg font-medium text-foreground">No Analysis History</h3>
                <p className="mt-1">You haven't run any AI quality checks yet.</p>
                <Button variant="outline" className="mt-4" onClick={() => setActiveTab('new')}>
                  Run First Analysis
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {history.map((report) => (
                <Card key={report.id} className="overflow-hidden">
                  <CardHeader className="bg-muted/30 pb-4">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="uppercase tracking-wider text-[10px]">
                            {report.mode} Check
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {report.createdAt ? format(report.createdAt.toDate(), 'MMM d, yyyy • h:mm a') : 'Recent'}
                          </span>
                        </div>
                        <CardTitle className="text-lg">{report.title || 'Untitled Document'}</CardTitle>
                        {report.domain && <CardDescription>{report.domain}</CardDescription>}
                      </div>
                      
                      {report.results?.decision && (
                        <Badge variant={getStatusColor(report.results.decision.status)} className="flex items-center gap-1 w-fit">
                          {report.results.decision.status.includes('READY') ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <AlertTriangle className="h-3 w-3" />
                          )}
                          {report.results.decision.status}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                      {report.results?.overall_score !== undefined && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">Overall Score</p>
                          {renderHistoryScore(report.results)}
                        </div>
                      )}
                      
                      {report.results?.idea_quality && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">Idea Quality</p>
                          <span className="text-xl font-semibold">{report.results.idea_quality.score}/10</span>
                        </div>
                      )}
                      
                      {report.results?.doc_structure && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">Document Completeness</p>
                          <span className="text-xl font-semibold">{report.results.doc_structure.completeness}%</span>
                        </div>
                      )}
                      
                      {report.results?.similarity && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">Similarity Check</p>
                          <span className={`text-sm font-semibold ${report.results.similarity.has_duplicate ? 'text-red-500' : 'text-green-500'}`}>
                            {report.results.similarity.status}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
