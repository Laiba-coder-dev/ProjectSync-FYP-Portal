import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/lib/firebase';
import { BrainCircuit, FileText, LayoutTemplate, Settings2, UploadCloud, ChevronLeft, Loader2, Sparkles, CheckCircle2, AlertTriangle, Lightbulb, Type } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { checkRateLimit, saveAnalysisReport } from '@/lib/services/aiAnalyzerService';
import { useTask } from '@/contexts/TaskContext';

interface ProjectAnalyzerProps {
  initialData?: {
    title: string;
    description: string;
    domain: string;
  };
}

type AnalysisMode = 'idea' | 'document' | 'full' | 'custom' | null;

const CUSTOM_CHECKS = [
  { id: 'idea_quality', label: 'Idea Quality Check' },
  { id: 'title_quality', label: 'Title Quality Check' },
  { id: 'similarity', label: 'Similarity Check' },
  { id: 'domain_match', label: 'Domain Relevance Check' },
  { id: 'doc_structure', label: 'Document Structure Analysis' },
  { id: 'content_quality', label: 'Content Quality Check' },
  { id: 'grammar', label: 'Grammar Check' },
  { id: 'deadline', label: 'Deadline Check' },
  { id: 'progress', label: 'Progress Prediction' },
];

const DOMAINS = ['AI/ML', 'Web Development', 'Mobile Development', 'Cybersecurity', 'Data Science'];

export default function ProjectAnalyzer({ initialData }: ProjectAnalyzerProps) {
  const { toast } = useToast();
  const task = useTask();
  const [mode, setMode] = useState<AnalysisMode>(null);
  
  // Form State
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [domain, setDomain] = useState(initialData?.domain || '');
  const [file, setFile] = useState<File | null>(null);
  const [customChecks, setCustomChecks] = useState<string[]>([]);
  
  const analyzing = task.status === 'processing';
  const results = task.results;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
      if (!validTypes.includes(selectedFile.type)) {
        toast({ title: 'Invalid File', description: 'Please upload PDF, DOCX, or TXT only.', variant: 'destructive' });
        return;
      }
      if (selectedFile.size > 5 * 1024 * 1024) {
        toast({ title: 'File Too Large', description: 'Max file size is 5MB.', variant: 'destructive' });
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleCustomCheckToggle = (checkId: string) => {
    setCustomChecks(prev => 
      prev.includes(checkId) ? prev.filter(c => c !== checkId) : [...prev, checkId]
    );
  };

  const validateForm = () => {
    if ((mode === 'idea' || mode === 'full' || (mode === 'custom' && customChecks.some(c => ['idea_quality', 'title_quality', 'similarity', 'domain_match'].includes(c))))) {
      if (title.trim().length < 3) {
        toast({ title: 'Validation Error', description: 'Title must be at least 3 characters.', variant: 'destructive' });
        return false;
      }
      if (description.trim().length < 30) {
        toast({ title: 'Validation Error', description: 'Description must be at least 30 characters.', variant: 'destructive' });
        return false;
      }
      if (!domain) {
        toast({ title: 'Validation Error', description: 'Please select a domain.', variant: 'destructive' });
        return false;
      }
    }

    if ((mode === 'document' || mode === 'full' || (mode === 'custom' && customChecks.some(c => ['doc_structure', 'content_quality', 'grammar'].includes(c))))) {
      if (!file) {
        toast({ title: 'Validation Error', description: 'Please upload a document for analysis.', variant: 'destructive' });
        return false;
      }
    }

    if (mode === 'custom' && customChecks.length === 0) {
      toast({ title: 'Validation Error', description: 'Please select at least one check.', variant: 'destructive' });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const user = auth.currentUser;
      const idToken = await user?.getIdToken();
      const userId = user?.uid;
      
      if (userId) {
        const { allowed, remaining } = await checkRateLimit(userId);
        if (!allowed) {
          toast({ title: 'Rate Limit Exceeded', description: 'You have reached your daily limit of 5 analysis runs.', variant: 'destructive' });
          return;
        }
      }

      // Explicitly hit the Python backend for AI service
      const backendUrl = import.meta.env.VITE_AI_URL || 'http://localhost:8000';
      
      const formData = new FormData();
      formData.append('mode', mode || '');
      formData.append('title', title);
      formData.append('description', description);
      formData.append('domain', domain);
      formData.append('custom_checks', JSON.stringify(customChecks));
      if (file) {
        formData.append('file', file);
      }

      const response = await fetch(`${backendUrl}/ai/analyzer/start`, {
        method: 'POST',
        headers: {
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
        },
        body: formData
      });

      if (!response.ok) throw new Error('Analysis failed');

      const data = await response.json();
      task.setTaskData({ taskId: data.task_id, status: 'processing', progress: 0, currentStep: 'Starting background analysis...' });
      
      toast({ title: 'Analysis Started', description: 'Your project analysis is running in the background.' });
    } catch (error) {
      console.error(error);
      toast({ title: 'Analysis Error', description: 'An error occurred during analysis. Make sure the Python AI microservice is running.', variant: 'destructive' });
    }
  };

  const resetState = () => {
    setMode(null);
    setTitle('');
    setDescription('');
    setDomain('');
    setFile(null);
    setCustomChecks([]);
    task.clearTask();
  };

  // If a task is active or completed, skip the setup screen
  if (task.status === 'processing' || task.results) {
    // We already have mode if we initiated it, but if not we can assume a default so it doesn't block rendering
  } else if (!mode) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <PageHeader 
          title="Project Quality Analyzer" 
          description="AI-powered module to evaluate ideas, proposals, and documents comprehensively." 
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="hover:border-primary cursor-pointer transition-all hover:shadow-md group" onClick={() => setMode('idea')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Lightbulb className="h-6 w-6" />
                </div>
                Idea Analysis Only
              </CardTitle>
              <CardDescription>Evaluate idea quality, check similarity with past projects, and assess domain relevance.</CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:border-primary cursor-pointer transition-all hover:shadow-md group" onClick={() => setMode('document')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <FileText className="h-6 w-6" />
                </div>
                Document Analysis Only
              </CardTitle>
              <CardDescription>Check document structure, grammar, readability, and content quality automatically.</CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:border-primary cursor-pointer transition-all hover:shadow-md group" onClick={() => setMode('full')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 text-purple-600 rounded-lg group-hover:bg-purple-600 group-hover:text-white transition-colors">
                  <Sparkles className="h-6 w-6" />
                </div>
                Full Analysis
              </CardTitle>
              <CardDescription>Comprehensive check combining both Idea and Document analysis along with deadline adherence.</CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:border-primary cursor-pointer transition-all hover:shadow-md group" onClick={() => setMode('custom')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="p-3 bg-orange-100 text-orange-600 rounded-lg group-hover:bg-orange-600 group-hover:text-white transition-colors">
                  <Settings2 className="h-6 w-6" />
                </div>
                Custom Selection
              </CardTitle>
              <CardDescription>Pick and choose specific AI checks you want to run.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  // Determine which fields to show based on mode and custom selection
  const showTextInputs = mode === 'idea' || mode === 'full' || (mode === 'custom' && customChecks.some(c => ['idea_quality', 'title_quality', 'similarity', 'domain_match'].includes(c)));
  const showFileInput = mode === 'document' || mode === 'full' || (mode === 'custom' && customChecks.some(c => ['doc_structure', 'content_quality', 'grammar'].includes(c)));

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={resetState}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight capitalize">{mode} Analysis</h1>
          <p className="text-muted-foreground">Fill in the required information to begin the analysis.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {mode === 'custom' && (
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-sm">Select Checks</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {CUSTOM_CHECKS.map(check => (
                    <div key={check.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={check.id} 
                        checked={customChecks.includes(check.id)} 
                        onCheckedChange={() => handleCustomCheckToggle(check.id)}
                      />
                      <Label htmlFor={check.id} className="text-sm cursor-pointer">{check.label}</Label>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {showTextInputs && (
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-sm">Project Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Project Title</Label>
                    <Input 
                      id="title" 
                      placeholder="e.g. AI Based Disease Detection" 
                      value={title} 
                      onChange={e => setTitle(e.target.value)} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description / Abstract</Label>
                    <Textarea 
                      id="description" 
                      placeholder="Enter minimum 30 characters..." 
                      rows={4}
                      value={description} 
                      onChange={e => setDescription(e.target.value)} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Domain</Label>
                    <Select value={domain} onValueChange={setDomain}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Domain" />
                      </SelectTrigger>
                      <SelectContent>
                        {DOMAINS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            )}

            {showFileInput && (
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-sm">Document Upload</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center">
                    <UploadCloud className="h-8 w-8 text-muted-foreground mb-3" />
                    <p className="text-sm font-medium mb-1">Click to upload document</p>
                    <p className="text-xs text-muted-foreground mb-4">PDF, DOCX up to 5MB</p>
                    <Input id="file" type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.docx,.txt" />
                    <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('file')?.click()}>
                      {file ? file.name : 'Select File'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Button type="submit" className="w-full" disabled={analyzing}>
              {analyzing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing...</> : <><BrainCircuit className="mr-2 h-4 w-4" /> Run Analysis</>}
            </Button>
          </form>
        </div>

        <div className="lg:col-span-2">
          {!results && !analyzing && (
            <div className="h-full min-h-[400px] border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
              <BrainCircuit className="h-16 w-16 mb-4 opacity-20" />
              <h3 className="text-lg font-medium text-foreground">Awaiting Analysis</h3>
              <p>Configure the required inputs and click Run Analysis to see the comprehensive quality report here.</p>
            </div>
          )}

          {analyzing && (
             <div className="h-full min-h-[400px] border rounded-lg flex flex-col items-center justify-center p-8">
               <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
               <p className="font-medium animate-pulse">{task.currentStep || 'Running AI Evaluation Pipeline...'}</p>
             </div>
          )}

          {results && !analyzing && (
            <div className="space-y-6">
              
              {results.status === 'FAILED_VALIDATION' && (
                <Card className="border-destructive bg-destructive/10">
                  <CardContent className="p-6 flex flex-col gap-4">
                    <div className="flex items-center gap-4 text-destructive">
                      <AlertTriangle className="h-8 w-8" />
                      <div>
                        <h4 className="font-bold text-lg">Validation Failed</h4>
                        <p>{results.error_message}</p>
                      </div>
                    </div>
                    {results.recommendations && (
                      <div className="mt-2 text-sm text-destructive/80">
                        <ul className="list-disc pl-5">
                          {results.recommendations.map((rec: string, i: number) => (
                            <li key={i}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
              
              {results.overall_score !== undefined && results.status !== 'FAILED_VALIDATION' && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-6 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-1">Overall Quality Score</p>
                      <h2 className="text-4xl font-black">{results.overall_score}<span className="text-xl text-muted-foreground">/10</span></h2>
                    </div>
                    <Progress value={Math.min(Math.max(results.overall_score * 10, 0), 100)} className="w-1/2 h-4" />
                  </CardContent>
                </Card>
              )}

              {results.decision && (
                <Card className={results.decision.status === 'READY FOR REVIEW' ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-amber-500 bg-amber-50 dark:bg-amber-950/20'}>
                  <CardContent className="p-4 flex items-center gap-4">
                    {results.decision.status === 'READY FOR REVIEW' ? <CheckCircle2 className="h-8 w-8 text-green-600" /> : <AlertTriangle className="h-8 w-8 text-amber-600" />}
                    <div>
                      <h4 className="font-bold">{results.decision.status}</h4>
                      <p className="text-sm">{results.decision.action}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {results.idea_quality && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex justify-between">Idea Quality <span>{results.idea_quality.score}/10</span></CardTitle></CardHeader>
                    <CardContent className="text-sm">
                      <ul className="space-y-1 text-muted-foreground list-disc pl-4">
                        {results.idea_quality.feedback.map((f: string, i: number) => <li key={i}>{f}</li>)}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {results.title_quality && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex justify-between">Title Quality <span>{results.title_quality.score}/10</span></CardTitle></CardHeader>
                    <CardContent className="text-sm">
                      <ul className="space-y-1 text-muted-foreground list-disc pl-4">
                        {results.title_quality.feedback.map((f: string, i: number) => <li key={i}>{f}</li>)}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {results.doc_structure && (
                   <Card>
                   <CardHeader className="pb-2"><CardTitle className="text-sm flex justify-between">Structure <span>{results.doc_structure.completeness}%</span></CardTitle></CardHeader>
                   <CardContent className="text-sm">
                     <ul className="space-y-1 text-muted-foreground list-disc pl-4">
                       {results.doc_structure.feedback.map((f: string, i: number) => <li key={i}>{f}</li>)}
                     </ul>
                   </CardContent>
                 </Card>
                )}

                {results.content_quality && (
                   <Card>
                   <CardHeader className="pb-2"><CardTitle className="text-sm flex justify-between">Content Quality <span>{results.content_quality.score}/10</span></CardTitle></CardHeader>
                   <CardContent className="text-sm">
                     <ul className="space-y-1 text-muted-foreground list-disc pl-4">
                       {results.content_quality.feedback.map((f: string, i: number) => <li key={i}>{f}</li>)}
                     </ul>
                   </CardContent>
                 </Card>
                )}
                
                {results.similarity && (
                   <Card className="md:col-span-2">
                   <CardHeader className="pb-2"><CardTitle className="text-sm flex justify-between">Similarity Check <span className={results.similarity.has_duplicate ? "text-red-500" : "text-green-500"}>{results.similarity.status}</span></CardTitle></CardHeader>
                   <CardContent className="text-sm">
                     <ul className="space-y-1 text-muted-foreground list-disc pl-4">
                       {results.similarity.feedback.map((f: string, i: number) => <li key={i} className={f.includes('WARNING') ? 'text-red-500 font-bold' : ''}>{f}</li>)}
                     </ul>
                   </CardContent>
                 </Card>
                )}

                {results.domain_match && (
                  <Card className="md:col-span-2">
                   <CardHeader className="pb-2"><CardTitle className="text-sm flex justify-between">Domain Relevance <span className={results.domain_match.is_match ? "text-green-500" : "text-red-500"}>{results.domain_match.status}</span></CardTitle></CardHeader>
                   <CardContent className="text-sm">
                     <ul className="space-y-1 text-muted-foreground list-disc pl-4">
                       {results.domain_match.feedback.map((f: string, i: number) => <li key={i}>{f}</li>)}
                     </ul>
                   </CardContent>
                 </Card>
                )}

                {results.grammar && (
                   <Card className="md:col-span-2">
                   <CardHeader className="pb-2"><CardTitle className="text-sm flex justify-between">Grammar & Syntax <span className={results.grammar.issue_count > 0 ? "text-amber-500" : "text-green-500"}>{results.grammar.status}</span></CardTitle></CardHeader>
                   <CardContent className="text-sm">
                     <ul className="space-y-1 text-muted-foreground list-disc pl-4">
                       {results.grammar.issues.length > 0 ? results.grammar.issues.map((f: string, i: number) => <li key={i}>{f}</li>) : <li>No major issues found.</li>}
                     </ul>
                   </CardContent>
                 </Card>
                )}

                {results.suggestions && results.suggestions.length > 0 && (
                  <Card className="md:col-span-2 border-primary/20 bg-primary/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-primary" /> Key Recommendations
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm">
                      <ul className="space-y-2 font-medium list-decimal pl-4">
                        {results.suggestions.map((f: string, i: number) => <li key={i}>{f}</li>)}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
