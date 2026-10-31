import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { useStudentData } from '@/hooks/useStudentData';
import { useProject } from '@/hooks/useProject';
import { useSubmissions } from '@/hooks/useSubmissions';
import { uploadToCloudinary, generateCloudinaryFolder } from '@/lib/services';
import { createNotification } from '@/lib/services';
import { addDoc, collection, serverTimestamp, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Badge } from '@/components/ui/badge';
import { DocumentUploadCard } from '@/components/shared/DocumentUploadCard';

import { FolderKanban, Upload, AlertTriangle, FileText, Edit2, Save, Loader2, Download, Sparkles, Search, Info, CheckCircle2, Lightbulb, BrainCircuit } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

const domains = [
  'Machine Learning',
  'Web Development',
  'Mobile Development',
  'Blockchain',
  'Cybersecurity',
  'IoT',
  'Cloud Computing',
  'Data Science',
  'Other',
];

export default function ProjectIdea() {
  const { user } = useAuth();
  const { group, loading: groupLoading } = useStudentData();
  const { project, loading: projectLoading, createProject, updateProject } = useProject(group?.id);
  const { submissions, loading: submissionsLoading } = useSubmissions(group?.id, project?.id);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [domain, setDomain] = useState('');
  const [abstract, setAbstract] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isTagging, setIsTagging] = useState(false);
  const [similarityResult, setSimilarityResult] = useState<{ score: number, similarProjects: any[] } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestedIdeas, setSuggestedIdeas] = useState<{title: string, abstract: string}[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);

  // Recommendations State
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [isRecommending, setIsRecommending] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);

  // Get the latest proposal submission
  const proposalSubmission = submissions
    .filter(s => s.milestoneType === 'proposal')
    .sort((a, b) => b.version - a.version)[0] || null;

  // Helper function to format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Helper function to handle file download
  const handleDownload = (fileUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Initialize form with existing project data
  useEffect(() => {
    if (project && !isEditing && !title && !domain && !abstract) {
      setTitle(project.title || '');
      setDomain(project.domain || '');
      setAbstract(project.abstract || '');
      setTags(project.tags || []);
    }
  }, [project, isEditing, title, domain, abstract]);

  const isLocked = project?.status === 'approved' || project?.status === 'locked';
  const isLoading = groupLoading || projectLoading || submissionsLoading;

  const handleSubmit = async () => {
    if (!title.trim() || !domain || !abstract.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!group) {
      toast.error('You must be part of a group to submit a project');
      return;
    }

    try {
      setIsSaving(true);

      const projectData = {
        title: title.trim(),
        domain,
        abstract: abstract.trim(),
        tags,
        groupId: group.id,
        supervisorId: group.supervisorId || null,
        status: 'submitted' as const,
      };

      let currentProjectId = project?.id;

      if (project) {
        // Update existing project
        await updateProject(project.id, projectData);
        toast.success('Project updated successfully!');
      } else {
        // Create new project
        currentProjectId = await createProject(projectData);
        toast.success('Project submitted successfully!');
      }

      // Notify supervisor about the idea submission
      if (group.supervisorId) {
        createNotification({
          userId: group.supervisorId,
          type: 'general',
          title: 'Project Idea Submitted',
          message: `Group ${group.name} has submitted a project idea for review.`,
          link: '/supervisor/ideas'
        }).catch(err => console.error('Failed to notify supervisor:', err));
      }

      setIsEditing(false);
    } catch (error: any) {
      console.error('Error saving project:', error);
      toast.error('Failed to save project. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSuggestIdeas = async () => {
    if (!domain) {
      toast.error('Please select a domain first');
      return;
    }

    setIsSuggesting(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
      const response = await fetch(`${backendUrl}/api/ai/suggest-ideas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ domain })
      });

      if (!response.ok) throw new Error('Failed to generate ideas');

      const data = await response.json();
      setSuggestedIdeas(data.ideas || []);
      toast.success('Ideas generated successfully!');
    } catch (error: any) {
      console.error('Suggest ideas error:', error);
      toast.error('Failed to generate AI ideas');
    } finally {
      setIsSuggesting(false);
    }
  };



  const handleAutoTag = async () => {
    if (!abstract.trim()) {
      toast.error('Please enter an abstract first');
      return;
    }

    setIsTagging(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
      const response = await fetch(`${backendUrl}/api/ai/extract-tags`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ abstract })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Backend error details:', errorText);
        throw new Error(`Server returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      setTags(data.tags);
      toast.success('Tags generated successfully!');
    } catch (error: any) {
      console.error('Auto-tagging error:', error);
      toast.error(`AI Tagging Failed: ${error.message || 'Check if backend is running'}`);
    } finally {
      setIsTagging(false);
    }
  };

  const handleSimilarityCheck = async () => {
    if (!abstract.trim()) {
      toast.error('Please enter an abstract first');
      return;
    }

    setIsAnalyzing(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
      const response = await fetch(`${backendUrl}/api/ai/analyze-similarity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ 
          projectId: project?.id || 'new',
          abstract 
        })
      });

      if (!response.ok) throw new Error('Similarity analysis failed');

      const data = await response.json();
      setSimilarityResult({
        score: data.similarityScore,
        similarProjects: data.similarProjects
      });
      
      if (data.similarityScore > 40) {
        toast.warning(`High similarity detected (${data.similarityScore}%). Please review your content.`);
      } else {
        toast.success('Similarity check passed!');
      }
    } catch (error: any) {
      console.error('Similarity check error:', error);
      toast.error('Failed to run similarity analysis');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGetRecommendations = async () => {
    if (!title.trim() && !abstract.trim()) {
      toast.error('Please provide project details.');
      return;
    }

    setIsRecommending(true);
    setShowRecommendations(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
      
      const formData = new FormData();
      if (title.trim()) formData.append('projectTitle', title.trim());
      if (abstract.trim()) formData.append('abstractText', abstract.trim());
      if (domain) formData.append('domain', domain);

      const response = await fetch(`${backendUrl}/api/recommendations/supervisors`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`
        },
        body: formData
      });

      if (!response.ok) throw new Error('Recommendation failed');

      const data = await response.json();
      setRecommendations(data.recommendations || []);
    } catch (error: any) {
      console.error('Recommendation error:', error);
      toast.error('Failed to get supervisor recommendations');
      setShowRecommendations(false);
    } finally {
      setIsRecommending(false);
    }
  };

  const handleRequestSupervision = async (supervisorId: string, supervisorName: string) => {
    if (!group) return;
    try {
      // Direct update of the group's supervisor as per requirements
      const groupRef = doc(db, 'groups', group.id);
      await updateDoc(groupRef, {
        supervisorId: supervisorId,
        supervisorName: supervisorName
      });
      toast.success(`Successfully selected ${supervisorName} as supervisor!`);
      // Hide recommendations after selection
      setShowRecommendations(false);
    } catch (error: any) {
      console.error('Error selecting supervisor:', error);
      toast.error('Failed to select supervisor');
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="space-y-6 pb-16 lg:pb-0">
        <PageHeader
          title="Project Idea"
          description="Submit your project proposal"
        />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // Check if user has a group
  if (!group) {
    return (
      <div className="space-y-6 pb-16 lg:pb-0">
        <PageHeader
          title="Project Idea"
          description="Submit your project proposal"
        />
        <EmptyState
          icon={FolderKanban}
          title="Join a group first"
          description="You need to be part of a group before submitting a project idea"
          action={{
            label: 'Go to Group Management',
            onClick: () => window.location.href = '/student/group',
          }}
        />
      </div>
    );
  }

  // Show existing project
  if (project && !isEditing) {
    return (
      <div className="space-y-6 pb-16 lg:pb-0">
        <PageHeader
          title="Project Idea"
          description="Your submitted project proposal"
        >
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => window.location.href = '/student/analyzer'}>
              <BrainCircuit className="mr-2 h-4 w-4" />
              AI Quality Check
            </Button>
            {!isLocked && (
              <Button onClick={() => setIsEditing(true)}>
                <Edit2 className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
          </div>
        </PageHeader>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle>{project.title}</CardTitle>
                <CardDescription>{project.domain}</CardDescription>
              </div>
              <StatusBadge status={project.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Abstract</h4>
              <p className="text-sm leading-relaxed">{project.abstract}</p>
            </div>
            
            {project.tags && project.tags.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {project.tags.map((tag: string, index: number) => (
                    <Badge key={index} variant="secondary">{tag}</Badge>
                  ))}
                </div>
              </div>
            )}

            {project.status === 'rejected' && project.rejectionReason && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Rejection Reason:</strong> {project.rejectionReason}
                </AlertDescription>
              </Alert>
            )}

            {proposalSubmission ? (
              <div className="flex items-center gap-4 rounded-lg border p-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-medium">Proposal Document</p>
                  <p className="text-sm text-muted-foreground">
                    {proposalSubmission.fileName} • {formatFileSize(proposalSubmission.fileSize)}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(proposalSubmission.fileUrl, proposalSubmission.fileName)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-4 rounded-lg border border-dashed p-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-medium text-muted-foreground">No Proposal Document</p>
                  <p className="text-sm text-muted-foreground">
                    Upload your proposal document in the Documents section
                  </p>
                </div>
              </div>
            )}

            {isLocked && (
              <Alert>
                <AlertDescription>
                  This project has been approved and cannot be edited.
                </AlertDescription>
              </Alert>
            )}

            {!group.supervisorId && project.status === 'submitted' && (
              <div className="pt-6 border-t mt-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-lg font-semibold tracking-tight">Need a Supervisor?</h4>
                      <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 flex items-center gap-1.5 animate-in fade-in slide-in-from-bottom-1">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                        </span>
                        AI-Powered Faculty Matching
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Get intelligent faculty recommendations tailored precisely to your project domain and abstract.</p>
                  </div>
                  <Button 
                    onClick={handleGetRecommendations} 
                    disabled={isRecommending}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all"
                  >
                    {isRecommending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    {isRecommending ? 'Analyzing...' : 'Get Recommendations'}
                  </Button>
                </div>

                {showRecommendations && (
                  <div className="mt-8 space-y-4">
                    {isRecommending ? (
                      <div className="flex flex-col items-center justify-center p-12 text-indigo-600 space-y-4">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <p className="text-sm font-medium animate-pulse">Scanning faculty profiles and capacity...</p>
                      </div>
                    ) : recommendations.length > 0 ? (
                      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
                        {recommendations.map((rec, i) => {
                          const slotsLeft = (rec.maxGroups || 4) - (rec.activeGroupsCount || 0);
                          const isAvailable = slotsLeft > 0;
                          
                          // Match Percentage Badge Styling
                          let badgeStyle = "bg-amber-50 text-amber-700 border-amber-200";
                          if (rec.matchPercentage >= 70) {
                            badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200";
                          } else if (rec.matchPercentage >= 50) {
                            badgeStyle = "bg-indigo-50 text-indigo-700 border-indigo-200";
                          }

                          return (
                          <Card 
                            key={i} 
                            className="bg-white border-slate-200/80 hover:border-indigo-300 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 overflow-hidden"
                          >
                            <CardContent className="p-5 flex flex-col h-full">
                              <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-inner shrink-0">
                                    {rec.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                                  </div>
                                  <div>
                                    <h6 className="font-semibold text-slate-900 leading-none mb-1.5">{rec.name}</h6>
                                    <p className="text-xs text-slate-500 font-medium">{rec.department} Department</p>
                                  </div>
                                </div>
                                <div className={`px-2.5 py-1 rounded-full border text-xs font-bold ${badgeStyle}`}>
                                  {rec.matchPercentage}% Match
                                </div>
                              </div>
                              
                              <div className="mb-5 flex flex-wrap gap-1.5">
                                {rec.matchedSkills?.map((skill: string, idx: number) => (
                                  <span key={idx} className="bg-slate-100/80 text-slate-700 text-xs px-2.5 py-1 rounded-md font-medium">
                                    {skill}
                                  </span>
                                ))}
                                {(!rec.matchedSkills || rec.matchedSkills.length === 0) && (
                                  <span className="bg-slate-100/80 text-slate-700 text-xs px-2.5 py-1 rounded-md font-medium">General Supervision</span>
                                )}
                              </div>
                              
                              <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="relative flex h-2.5 w-2.5">
                                    <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${isAvailable ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isAvailable ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                                  </span>
                                  <span className={`text-xs font-semibold ${isAvailable ? 'text-emerald-700' : 'text-red-600'}`}>
                                    {isAvailable ? `${slotsLeft} slots available` : 'At Capacity'}
                                  </span>
                                </div>
                                {rec.id && isAvailable && (
                                  <Button 
                                    size="sm" 
                                    className="bg-slate-900 hover:bg-slate-800 text-white shadow-sm"
                                    onClick={() => handleRequestSupervision(rec.id, rec.name)}
                                  >
                                    Select Supervisor
                                  </Button>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        )})}
                      </div>
                    ) : (
                      <div className="p-8 text-center border border-dashed rounded-lg bg-slate-50">
                        <p className="text-sm text-slate-500">No suitable supervisors found with available capacity for this domain.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show form for new project or editing
  return (
    <div className="space-y-6 pb-16 lg:pb-0">
      <PageHeader
        title="Project Idea"
        description={project ? 'Edit your project proposal' : 'Submit a new project proposal'}
      />

      <Card>
        <CardHeader>
          <CardTitle>Project Proposal</CardTitle>
          <CardDescription>
            Fill in the details of your project idea
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Project Title *</Label>
            <Input
              id="title"
              placeholder="Enter your project title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="domain">Domain / Category *</Label>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={handleSuggestIdeas}
                disabled={isSuggesting || !domain}
              >
                {isSuggesting ? (
                  <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                ) : (
                  <Lightbulb className="h-3 w-3 mr-2 text-primary" />
                )}
                AI Suggest Ideas
              </Button>
            </div>
            <Select value={domain} onValueChange={setDomain}>
              <SelectTrigger>
                <SelectValue placeholder="Select a domain" />
              </SelectTrigger>
              <SelectContent>
                {domains.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {suggestedIdeas.length > 0 && (
              <div className="mt-4 space-y-3 p-4 border rounded-lg bg-primary/5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-semibold">AI Suggested Ideas for {domain}</h4>
                </div>
                <div className="grid gap-3">
                  {suggestedIdeas.map((idea, i) => (
                    <Card key={i} className="bg-background/60 shadow-sm border-primary/20">
                      <CardContent className="p-3">
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                          <div className="flex-1">
                            <h5 className="font-medium text-sm text-primary">{idea.title}</h5>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{idea.abstract}</p>
                          </div>
                          <Button 
                            variant="secondary" 
                            size="sm"
                            className="shrink-0 w-full sm:w-auto"
                            onClick={() => {
                              setTitle(idea.title);
                              setAbstract(idea.abstract);
                              setSuggestedIdeas([]);
                              toast.success('Idea applied successfully!');
                            }}
                          >
                            Use this
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="abstract">Abstract *</Label>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={handleAutoTag}
                disabled={isTagging || !abstract.trim()}
              >
                {isTagging ? (
                  <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3 mr-2 text-primary" />
                )}
                AI Auto-Tag
              </Button>
            </div>
            <Textarea
              id="abstract"
              placeholder="Describe your project idea, objectives, and methodology..."
              value={abstract}
              onChange={(e) => setAbstract(e.target.value)}
              rows={6}
            />
            <p className="text-xs text-muted-foreground flex justify-between">
              <span>Minimum 100 words recommended</span>
            </p>
            {tags.length > 0 && (
              <div className="mt-4 p-4 border rounded-md bg-muted/20">
                <p className="text-sm text-muted-foreground mb-2">Generated Tags:</p>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag, i) => (
                    <Badge key={i} variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 cursor-default">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {project && !isEditing && (
              <div className="space-y-2">
                <DocumentUploadCard 
                  groupId={group.id} 
                  phase="proposal" 
                  onUploadSuccess={() => {
                    // Trigger a reload or state update if necessary
                  }}
                />
              </div>
          )}
          {(!project || isEditing) && (
              <p className="text-sm text-muted-foreground mt-4">
                  Please save the project details first before uploading the proposal document.
              </p>
          )}

          {/* Similarity Check Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Similarity Check</Label>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={handleSimilarityCheck}
                disabled={isAnalyzing || !abstract.trim()}
              >
                {isAnalyzing ? (
                  <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                ) : (
                  <Search className="h-3 w-3 mr-2 text-primary" />
                )}
                Check Similarity
              </Button>
            </div>

            {similarityResult ? (
              <Alert className={similarityResult.score < 20 ? 'bg-green-50 dark:bg-green-900/20 border-green-500/50' : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500/50'}>
                {similarityResult.score < 20 ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4 text-yellow-600" />}
                <AlertDescription>
                  <div className="flex flex-col gap-2">
                    <span className="font-semibold">Similarity Score: {similarityResult.score}%</span>
                    {similarityResult.similarProjects.length > 0 && (
                      <ul className="text-xs list-disc pl-4 space-y-1">
                        {similarityResult.similarProjects.map((p, i) => (
                          <li key={i}><strong>{p.title}</strong>: {p.reason}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-blue-500/50 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200">
                <Info className="h-4 w-4 stroke-blue-600 dark:stroke-blue-400" />
                <AlertDescription>
                  Run the similarity check to ensure your project idea is unique and avoid automatic rejection.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="flex justify-end gap-3">
            {isEditing && (
              <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving}>
                Cancel
              </Button>
            )}
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {project ? 'Update Proposal' : 'Submit Proposal'}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
