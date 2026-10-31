import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from '@/components/ui/table';
import {
  Users, Calendar, MapPin, Plus, Loader2, CheckCircle,
  Clock, BarChart3,
  Search, RefreshCw, ChevronDown, ChevronUp, Video,
  Upload, Sparkles, FileSpreadsheet, AlertCircle,
  BookOpen, Tag, User2, CheckCircle2, AlertTriangle,
  XCircle, Brain, Download, Printer
} from 'lucide-react';
import { toast } from 'sonner';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { EvaluationPanel, ProjectGroup } from '@/types';

type SupervisorMember = { id: string; name: string; department?: string; designation?: string; };

// ─── AI Scheduler types ──────────────────────────────────────────────────────

interface ScheduledProject {
  Project: string;
  Day: string;
  Time: string;
  Teachers: string[];
  Excluded_busy: string[];
  Overbooked: boolean;
}

interface PanelResult {
  panel_name: string;
  domains: string;
  members: string[];
  projects: ScheduledProject[];
}

const DAYS_OPTIONS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const PANEL_GRADIENT = [
  'from-violet-600 to-indigo-600',
  'from-cyan-600 to-blue-600',
  'from-emerald-600 to-teal-600',
  'from-orange-600 to-rose-600',
  'from-pink-600 to-purple-600',
  'from-amber-600 to-orange-600',
];

// ─── File upload card component ───────────────────────────────────────────────

function FileUploadCard({
  label, hint, icon: Icon, file, onFile, accept = '.xlsx,.xls'
}: {
  label: string;
  hint: string;
  icon: React.ElementType;
  file: File | null;
  onFile: (f: File | null) => void;
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))) {
      onFile(f);
    } else {
      toast.error('Only .xlsx / .xls files are accepted');
    }
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !file && inputRef.current?.click()}
      className={`
        relative flex items-center gap-3 rounded-xl border p-3 transition-all cursor-pointer select-none min-h-[72px]
        ${dragging
          ? 'border-primary bg-primary/5 scale-[1.01] border-dashed'
          : file
            ? 'border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-900/10 cursor-default'
            : 'border-dashed border-border hover:border-primary/50 hover:bg-muted/30'
        }
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0] ?? null;
          onFile(f);
          e.target.value = '';
        }}
      />

      {file ? (
        <>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 truncate">{file.name}</p>
            <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onFile(null); }}
            className="shrink-0 rounded-full p-1.5 text-emerald-600/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </>
      ) : (
        <>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
            <Icon className="h-4 w-4 text-slate-500" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-semibold truncate">{label}</p>
            <p className="text-xs text-primary mt-0.5 font-medium">Click to browse</p>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Project status badge ─────────────────────────────────────────────────────

function ProjectStatusBadge({ proj, allMembers }: { proj: ScheduledProject; allMembers: string[] }) {
  if (proj.Overbooked) {
    return (
      <Badge className="bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-400 dark:ring-rose-800 shadow-none gap-1 border-0 font-medium">
        <XCircle className="h-3 w-3" />
        Overbooked
      </Badge>
    );
  }
  if (proj.Excluded_busy.length > 0) {
    return (
      <Badge className="bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:ring-amber-800 shadow-none gap-1 border-0 font-medium">
        <AlertTriangle className="h-3 w-3" />
        Busy: {proj.Excluded_busy.join(', ')}
      </Badge>
    );
  }
  return (
    <Badge className="bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:ring-emerald-800 shadow-none gap-1 border-0 font-medium">
      <CheckCircle2 className="h-3 w-3" />
      Available
    </Badge>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PanelScheduling() {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

  // Panel Creator State
  const [panelName, setPanelName] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [scheduledDate, setScheduledDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [venueOrLink, setVenueOrLink] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Data
  const [supervisors, setSupervisors] = useState<SupervisorMember[]>([]);
  const [groups, setGroups] = useState<(ProjectGroup & { projectTitle?: string })[]>([]);
  const [panels, setPanels] = useState<EvaluationPanel[]>([]);
  const [loading, setLoading] = useState(true);
  const [oversightLoading, setOversightLoading] = useState(false);

  // Group Assignment State
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [targetPanelId, setTargetPanelId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [groupSearch, setGroupSearch] = useState('');

  // Oversight
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(new Set());

  // ── AI Scheduler State ──────────────────────────────────────────────────────
  const [timetableFile, setTimetableFile] = useState<File | null>(null);
  const [expertiseFile, setExpertiseFile] = useState<File | null>(null);
  const [projectsFile, setProjectsFile] = useState<File | null>(null);

  const [numPanels, setNumPanels] = useState(4);
  const [teachersPerPanel, setTeachersPerPanel] = useState(5);
  const [duration, setDuration] = useState(30);
  const [selectedDays, setSelectedDays] = useState<string[]>(['Wednesday', 'Thursday']);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('12:00');

  const [isGenerating, setIsGenerating] = useState(false);
  const [scheduleResult, setScheduleResult] = useState<PanelResult[] | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [expandedResultPanels, setExpandedResultPanels] = useState<Set<number>>(new Set([0]));

  // ── Data loading ────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [supSnap, groupSnap] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('role', '==', 'supervisor'))),
        getDocs(collection(db, 'groups'))
      ]);

      setSupervisors(supSnap.docs.map(d => ({
        id: d.id,
        name: d.data().name || 'Unknown',
        department: d.data().department,
        designation: d.data().designation
      })));

      setGroups(groupSnap.docs.map(d => ({
        id: d.id,
        name: d.data().name || 'Unnamed Group',
        members: d.data().members || [],
        supervisorId: d.data().supervisorId,
        projectId: d.data().projectId,
        assignedPanelId: d.data().assignedPanelId,
        evaluationStatus: d.data().evaluationStatus || 'Pending',
        createdAt: d.data().createdAt?.toDate() || new Date(),
        maxMembers: d.data().maxMembers || 4,
      } as ProjectGroup & { projectTitle?: string })));

      await fetchOversight();
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchOversight = async () => {
    setOversightLoading(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch(`${backendUrl}/api/pmo/panels/oversight`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPanels(data);
      }
    } catch (err) {
      // Panel oversight is optional — don't block the page
    } finally {
      setOversightLoading(false);
    }
  };

  // ── Panel CRUD ──────────────────────────────────────────────────────────────

  const handleCreatePanel = async () => {
    if (!panelName.trim()) { toast.error('Panel name is required'); return; }
    if (selectedMemberIds.length === 0) { toast.error('Select at least one panel member'); return; }
    if (!scheduledDate) { toast.error('Scheduled date is required'); return; }
    if (!timeSlot.trim()) { toast.error('Time slot is required'); return; }

    setIsCreating(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch(`${backendUrl}/api/pmo/panels/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({
          panelName: panelName.trim(),
          memberIds: selectedMemberIds,
          scheduledDate,
          timeSlot: timeSlot.trim(),
          venueOrLink: venueOrLink.trim()
        })
      });

      if (!res.ok) throw new Error('Failed to create panel');
      toast.success(`Panel "${panelName}" created successfully!`);

      setPanelName('');
      setSelectedMemberIds([]);
      setScheduledDate('');
      setTimeSlot('');
      setVenueOrLink('');
      await fetchOversight();
    } catch (err) {
      toast.error('Failed to create panel. Make sure the backend is running.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleAssignGroups = async () => {
    if (!targetPanelId) { toast.error('Select a target panel'); return; }
    if (selectedGroupIds.length === 0) { toast.error('Select at least one group'); return; }

    setIsAssigning(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch(`${backendUrl}/api/pmo/panels/assign-groups`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ panelId: targetPanelId, groupIds: selectedGroupIds })
      });

      if (!res.ok) throw new Error('Assignment failed');
      toast.success(`${selectedGroupIds.length} group(s) assigned to panel!`);
      setSelectedGroupIds([]);
      await Promise.all([fetchAllData(), fetchOversight()]);
    } catch (err) {
      toast.error('Failed to assign groups.');
    } finally {
      setIsAssigning(false);
    }
  };

  // ── AI Schedule generation ──────────────────────────────────────────────────

  const handleGenerateSchedule = async () => {
    if (!timetableFile) { toast.error('Please upload the Timetable file'); return; }
    if (!expertiseFile) { toast.error('Please upload the Teacher Expertise file'); return; }
    if (!projectsFile) { toast.error('Please upload the Projects file'); return; }
    if (selectedDays.length === 0) { toast.error('Select at least one evaluation day'); return; }

    setIsGenerating(true);
    setScheduleResult(null);
    setScheduleError(null);

    try {
      const fd = new FormData();
      fd.append('timetable', timetableFile);
      fd.append('expertise', expertiseFile);
      fd.append('projects', projectsFile);
      fd.append('panels', String(numPanels));
      fd.append('teachers_per_panel', String(teachersPerPanel));
      fd.append('duration', String(duration));
      fd.append('days', selectedDays.join(', '));
      fd.append('start_time', startTime);
      fd.append('end_time', endTime);

      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch(`${backendUrl}/api/pmo/schedule-panels`, {
        method: 'POST',
        headers: { ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {}) },
        body: fd,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (!data.success) throw new Error('Scheduler returned failure');

      setScheduleResult(data.schedule);
      setExpandedResultPanels(new Set([0]));
      toast.success(`Generated schedule for ${data.schedule.length} panel(s)!`);
    } catch (err: any) {
      const msg = err.message || 'Scheduling failed. Check your files and try again.';
      setScheduleError(msg);
      toast.error(msg, { duration: 6000 });
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleDay = (day: string) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const toggleResultPanel = (idx: number) => {
    setExpandedResultPanels(prev => {
      const s = new Set(prev);
      s.has(idx) ? s.delete(idx) : s.add(idx);
      return s;
    });
  };

  const handleExportExcel = () => {
    if (!scheduleResult || scheduleResult.length === 0) {
      toast.error("No schedule data available to export.");
      return;
    }

    // 1. Column Headers
    const headers = [
      "Panel",
      "Panel Domains",
      "All Panel Members",
      "Project Name",
      "Evaluation Day",
      "Time Slot",
      "Available Evaluators",
      "Busy / Excluded Evaluators",
      "Status"
    ];

    // 2. Flatten schedule rows
    const rows: string[][] = [];

    scheduleResult.forEach((panel: any) => {
      const panelName = panel.panel_name || "Panel";
      const panelDomains = panel.domains || "";
      const panelMembers = Array.isArray(panel.members) ? panel.members.join("; ") : "";

      if (panel.projects && panel.projects.length > 0) {
        panel.projects.forEach((proj: any) => {
          rows.push([
            panelName,
            panelDomains,
            panelMembers,
            proj.Project || "",
            proj.Day || "",
            proj.Time || "",
            Array.isArray(proj.Teachers) ? proj.Teachers.join("; ") : "",
            Array.isArray(proj.Excluded_busy) && proj.Excluded_busy.length > 0
              ? proj.Excluded_busy.join("; ")
              : "None",
            proj.Overbooked
              ? "Overbooked"
              : (proj.Excluded_busy && proj.Excluded_busy.length > 0 ? "Partial (Busy)" : "Available")
          ]);
        });
      } else {
        rows.push([
          panelName,
          panelDomains,
          panelMembers,
          "No projects scheduled",
          "-",
          "-",
          "-",
          "-",
          "-"
        ]);
      }
    });

    // 3. Format CSV with quotes and UTF-8 Byte Order Mark (BOM) so Excel opens it with proper columns
    const csvRows = [
      headers.map(h => `"${h.replace(/"/g, '""')}"`).join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ];
    
    const csvContent = "\uFEFF" + csvRows.join("\r\n");

    // 4. Download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    const dateStr = new Date().toISOString().split("T")[0];

    downloadLink.href = url;
    downloadLink.setAttribute("download", `FYP_Panel_Schedule_${dateStr}.csv`);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
  };

  // ── Legacy helpers ──────────────────────────────────────────────────────────

  const toggleMember = (id: string) => {
    setSelectedMemberIds(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  };

  const toggleGroup = (id: string) => {
    setSelectedGroupIds(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);
  };

  const togglePanelExpand = (id: string) => {
    setExpandedPanels(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(groupSearch.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    if (status === 'Completed') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    if (status === 'In-Progress') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Panel Scheduling" description="Create and manage evaluation panels for student groups" />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Panel Scheduling" description="Create evaluation panels, assign student groups, and AI-generate conflict-free schedules">
        <Button variant="outline" size="sm" onClick={fetchAllData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </PageHeader>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <BarChart3 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{panels.length}</p>
              <p className="text-xs text-muted-foreground">Total Panels</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{panels.reduce((acc, p) => acc + (p.completedGroups || 0), 0)}</p>
              <p className="text-xs text-muted-foreground">Evaluated</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{groups.filter(g => !g.assignedPanelId).length}</p>
              <p className="text-xs text-muted-foreground">Unassigned Groups</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{supervisors.length}</p>
              <p className="text-xs text-muted-foreground">Faculty Available</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="ai-scheduler" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="ai-scheduler" className="gap-1.5">
            <Brain className="h-4 w-4" />
            <span className="hidden sm:inline">AI Scheduler</span>
            <span className="sm:hidden">AI</span>
          </TabsTrigger>
          <TabsTrigger value="creator">
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Panel Creator</span>
            <span className="sm:hidden">Create</span>
          </TabsTrigger>
          <TabsTrigger value="assignment">
            <Users className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Group Assignment</span>
            <span className="sm:hidden">Assign</span>
          </TabsTrigger>
          <TabsTrigger value="oversight">
            <BarChart3 className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Oversight Board</span>
            <span className="sm:hidden">Oversight</span>
          </TabsTrigger>
        </TabsList>

        {/* ============================
            TAB 1: AI SCHEDULER
        ============================ */}
        <TabsContent value="ai-scheduler" className="space-y-6">

          {/* ── Upload Section ─────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-violet-100 dark:bg-violet-900/30">
                  <Upload className="h-4 w-4 text-violet-600" />
                </div>
                <div>
                  <CardTitle className="text-base">Step 1 — Upload Data Files</CardTitle>
                  <CardDescription>All three Excel workbooks are required (.xlsx / .xls)</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-3">
                <FileUploadCard
                  label="Timetable Workbook"
                  hint="Multi-sheet file — one sheet per day, rooms × time slots"
                  icon={Calendar}
                  file={timetableFile}
                  onFile={setTimetableFile}
                />
                <FileUploadCard
                  label="Teacher Expertise"
                  hint="Teacher names + domain/expertise (comma-separated)"
                  icon={User2}
                  file={expertiseFile}
                  onFile={setExpertiseFile}
                />
                <FileUploadCard
                  label="Project List"
                  hint="Project/group names + domain column"
                  icon={FileSpreadsheet}
                  file={projectsFile}
                  onFile={setProjectsFile}
                />
              </div>
            </CardContent>
          </Card>

          {/* ── Parameters Section ─────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
                  <Sparkles className="h-4 w-4 text-cyan-600" />
                </div>
                <div>
                  <CardTitle className="text-base">Step 2 — Scheduling Parameters</CardTitle>
                  <CardDescription>Configure the panel structure and time window</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Row 1: numeric params */}
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="numPanels">
                    <span className="flex items-center gap-1.5"><BarChart3 className="h-3.5 w-3.5 text-muted-foreground" /> Total Panels</span>
                  </Label>
                  <Input
                    id="numPanels"
                    type="number"
                    min={1} max={20}
                    value={numPanels}
                    onChange={e => setNumPanels(Math.max(1, Math.min(20, +e.target.value)))}
                    className="focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-xs text-muted-foreground">Parallel evaluation panels (1–20)</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="teachersPerPanel">
                    <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-muted-foreground" /> Teachers / Panel</span>
                  </Label>
                  <Input
                    id="teachersPerPanel"
                    type="number"
                    min={1} max={20}
                    value={teachersPerPanel}
                    onChange={e => setTeachersPerPanel(Math.max(1, Math.min(20, +e.target.value)))}
                    className="focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-xs text-muted-foreground">Advisory target evaluators</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration">
                    <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-muted-foreground" /> Slot Duration (min)</span>
                  </Label>
                  <Input
                    id="duration"
                    type="number"
                    min={5} max={180} step={5}
                    value={duration}
                    onChange={e => setDuration(Math.max(5, Math.min(180, +e.target.value)))}
                    className="focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-xs text-muted-foreground">Minutes per presentation slot</p>
                </div>
              </div>

              {/* Row 2: days */}
              <div className="space-y-2">
                <Label>
                  <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-muted-foreground" /> Evaluation Days</span>
                </Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OPTIONS.map(day => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`
                        px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                        ${selectedDays.includes(day)
                          ? 'bg-indigo-600 text-white shadow-sm border border-indigo-600'
                          : 'bg-slate-100 text-slate-600 border border-transparent hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                        }
                      `}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 3: time range */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startTime">
                    <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-muted-foreground" /> Daily Start Time</span>
                  </Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    className="focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">
                    <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-muted-foreground" /> Daily End Time</span>
                  </Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                    className="focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Generate button */}
              <div className="pt-2">
                <Button
                  onClick={handleGenerateSchedule}
                  disabled={isGenerating}
                  size="lg"
                  className="w-full gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-0 shadow-md shadow-violet-200 dark:shadow-violet-900/30 transition-all"
                >
                  {isGenerating ? (
                    <><Loader2 className="h-5 w-5 animate-spin" />Processing Schedule...</>
                  ) : (
                    <><Brain className="h-5 w-5" />Generate AI Panel Schedule</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ── Error Banner ───────────────────────────────────── */}
          {scheduleError && !isGenerating && (
            <div className="flex items-start gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive">
              <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">Scheduling Failed</p>
                <p className="text-sm mt-0.5 break-words">{scheduleError}</p>
              </div>
            </div>
          )}

          {/* ── Results Section ────────────────────────────────── */}
          {scheduleResult && !isGenerating && (
            <div className="space-y-4">
              {/* Results header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">
                    Generated Schedule
                    <Badge className="ml-2 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200">
                      {scheduleResult.length} Panels
                    </Badge>
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {scheduleResult.reduce((acc, p) => acc + p.projects.length, 0)} projects scheduled
                    • {selectedDays.join(', ')} • {startTime}–{endTime} • {duration} min slots
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleExportExcel}
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 hover:text-emerald-700 hover:border-emerald-300 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600"/>
                    <span>Export Excel</span>
                  </button>
                </div>
              </div>

              {/* Summary stat row (Compact 4-card metric strip) */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-xl border bg-card p-3 flex items-center gap-3">
                  <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    <BookOpen className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-slate-800 dark:text-slate-200 leading-none">
                      {scheduleResult.reduce((acc, p) => acc + p.projects.length, 0)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 font-medium">Projects</p>
                  </div>
                </div>
                <div className="rounded-xl border bg-card p-3 flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
                    <Users className="h-4 w-4 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-indigo-600 leading-none">
                      {scheduleResult.reduce((acc, p) => acc + p.members.length, 0)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 font-medium">Teachers</p>
                  </div>
                </div>
                <div className="rounded-xl border bg-card p-3 flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-emerald-600 leading-none">
                      {scheduleResult.reduce((acc, p) => acc + p.projects.filter(pr => !pr.Overbooked && pr.Excluded_busy.length === 0).length, 0)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 font-medium">Conflict-Free</p>
                  </div>
                </div>
                <div className="rounded-xl border bg-card p-3 flex items-center gap-3">
                  <div className="p-2 bg-rose-50 dark:bg-rose-900/30 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-rose-600" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-rose-600 leading-none">
                      {scheduleResult.reduce((acc, p) => acc + p.projects.filter(pr => pr.Overbooked).length, 0)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 font-medium">Overbooked</p>
                  </div>
                </div>
              </div>

              {/* Modern Panel Tabs */}
              <Tabs defaultValue="panel-0" className="w-full mt-4">
                <div className="border-b border-border">
                  <TabsList className="w-full justify-start overflow-x-auto h-auto p-0 bg-transparent gap-6">
                    {scheduleResult.map((panel, idx) => (
                      <TabsTrigger
                        key={idx}
                        value={`panel-${idx}`}
                        className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 rounded-none px-1 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-none"
                      >
                        {panel.panel_name} ({panel.projects.length})
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>

                {scheduleResult.map((panel, panelIdx) => (
                  <TabsContent key={panelIdx} value={`panel-${panelIdx}`} className="pt-6">
                    <Card className="overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800">
                      {/* Panel header inside Tab */}
                      <div className="bg-white dark:bg-slate-950 p-5 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex-1">
                            <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{panel.panel_name}</h4>
                            
                            {/* Domain tags - Subtle neutral pills */}
                            <div className="flex flex-wrap gap-2 mt-2">
                              {panel.domains.split(',').map((d, i) => (
                                <span key={i} className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-xs px-2.5 py-1 rounded-full font-medium">
                                  {d.trim()}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Project table */}
                      <div className="overflow-x-auto">
                        {panel.projects.length === 0 ? (
                          <div className="py-8 text-center text-sm text-muted-foreground">
                            No projects assigned to this panel
                          </div>
                        ) : (
                          <Table className="min-w-[800px]">
                            <TableHeader>
                              <TableRow className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                                <TableHead className="w-12 text-center text-slate-500 text-xs uppercase font-semibold">#</TableHead>
                                <TableHead className="text-slate-500 text-xs uppercase font-semibold">Project</TableHead>
                                <TableHead className="text-slate-500 text-xs uppercase font-semibold">Day</TableHead>
                                <TableHead className="text-slate-500 text-xs uppercase font-semibold">Time Slot</TableHead>
                                <TableHead className="text-slate-500 text-xs uppercase font-semibold">Evaluators</TableHead>
                                <TableHead className="text-slate-500 text-xs uppercase font-semibold">Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                              {panel.projects.map((proj, projIdx) => (
                                <TableRow
                                  key={projIdx}
                                  className="hover:bg-slate-50/80 dark:hover:bg-slate-900/50 transition-colors"
                                >
                                  <TableCell className="text-center text-xs text-muted-foreground font-mono py-3.5 px-4">
                                    {projIdx + 1}
                                  </TableCell>
                                  <TableCell className="py-3.5 px-4">
                                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{proj.Project}</p>
                                  </TableCell>
                                  <TableCell className="py-3.5 px-4">
                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{proj.Day}</span>
                                  </TableCell>
                                  <TableCell className="py-3.5 px-4">
                                    <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-1 rounded-md">
                                      {proj.Time}
                                    </span>
                                  </TableCell>
                                  <TableCell className="py-3.5 px-4">
                                    <div className="flex flex-wrap gap-1.5">
                                      {proj.Teachers.map((t, i) => (
                                        <span key={i} className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 text-xs font-medium px-2 py-1 rounded-md">
                                          {t}
                                        </span>
                                      ))}
                                      {proj.Teachers.length === 0 && (
                                        <span className="text-xs text-muted-foreground italic">None free</span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-3.5 px-4">
                                    <ProjectStatusBadge proj={proj} allMembers={panel.members} />
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    </Card>
                  </TabsContent>
                ))}
              </Tabs>

              {/* Legend */}
              <div className="flex flex-wrap gap-4 pt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" />
                  Available — all members free
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500 inline-block" />
                  Partial — some members have class conflicts
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500 inline-block" />
                  Overbooked — no ideal slot found, best slot assigned
                </span>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ============================
            TAB 2: PANEL CREATOR
        ============================ */}
        <TabsContent value="creator" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Left: Panel Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Panel Configuration</CardTitle>
                <CardDescription>Set panel name, schedule, and venue details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="panelName">Panel Name *</Label>
                  <Input
                    id="panelName"
                    placeholder="e.g., Final Evaluation Panel A"
                    value={panelName}
                    onChange={e => setPanelName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scheduledDate">Scheduled Date *</Label>
                  <Input
                    id="scheduledDate"
                    type="date"
                    value={scheduledDate}
                    onChange={e => setScheduledDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timeSlot">Time Slot *</Label>
                  <Input
                    id="timeSlot"
                    placeholder="e.g., 10:00 AM - 12:00 PM"
                    value={timeSlot}
                    onChange={e => setTimeSlot(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="venueOrLink">
                    <span className="flex items-center gap-1">
                      Venue / Meeting Link
                      <Video className="h-3 w-3 text-muted-foreground" />
                    </span>
                  </Label>
                  <Input
                    id="venueOrLink"
                    placeholder="Room 301 — or — https://meet.google.com/..."
                    value={venueOrLink}
                    onChange={e => setVenueOrLink(e.target.value)}
                  />
                </div>

                <div className="pt-2">
                  <Button
                    onClick={handleCreatePanel}
                    disabled={isCreating}
                    className="w-full"
                  >
                    {isCreating ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating Panel...</>
                    ) : (
                      <><Plus className="mr-2 h-4 w-4" />Create Panel</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Right: Faculty Member Pool */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Faculty Member Pool</CardTitle>
                <CardDescription>Select supervisors to add to this panel ({selectedMemberIds.length} selected)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {supervisors.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No supervisors found</p>
                    </div>
                  ) : (
                    supervisors.map(sup => (
                      <div
                        key={sup.id}
                        onClick={() => toggleMember(sup.id)}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          selectedMemberIds.includes(sup.id)
                            ? 'bg-primary/5 border-primary/40 shadow-sm'
                            : 'bg-background border-border hover:border-primary/30 hover:bg-muted/30'
                        }`}
                      >
                        <Checkbox
                          checked={selectedMemberIds.includes(sup.id)}
                          onCheckedChange={() => toggleMember(sup.id)}
                          onClick={e => e.stopPropagation()}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{sup.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {sup.designation || 'Supervisor'} {sup.department ? `• ${sup.department}` : ''}
                          </p>
                        </div>
                        {selectedMemberIds.includes(sup.id) && (
                          <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                        )}
                      </div>
                    ))
                  )}
                </div>

                {selectedMemberIds.length > 0 && (
                  <div className="mt-3 p-2 rounded-md bg-primary/5 border border-primary/20">
                    <p className="text-xs font-medium text-primary">
                      {selectedMemberIds.length} member(s) selected:
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedMemberIds
                        .map(id => supervisors.find(s => s.id === id)?.name)
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============================
            TAB 3: GROUP ASSIGNMENT
        ============================ */}
        <TabsContent value="assignment" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assign Groups to Panel</CardTitle>
              <CardDescription>
                Select groups and assign them to an evaluation panel.{' '}
                {selectedGroupIds.length > 0 && (
                  <span className="font-medium text-primary">{selectedGroupIds.length} group(s) selected</span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Assignment Controls */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search groups..."
                    value={groupSearch}
                    onChange={e => setGroupSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={targetPanelId} onValueChange={setTargetPanelId}>
                  <SelectTrigger className="w-full sm:w-56">
                    <SelectValue placeholder="Select target panel..." />
                  </SelectTrigger>
                  <SelectContent>
                    {panels.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.panelName}</SelectItem>
                    ))}
                    {panels.length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No panels created yet</div>
                    )}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleAssignGroups}
                  disabled={isAssigning || selectedGroupIds.length === 0 || !targetPanelId}
                >
                  {isAssigning ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Assigning...</>
                  ) : (
                    <><CheckCircle className="mr-2 h-4 w-4" />Assign ({selectedGroupIds.length})</>
                  )}
                </Button>
              </div>

              {/* Groups Table */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selectedGroupIds.length === filteredGroups.length && filteredGroups.length > 0}
                          onCheckedChange={checked => {
                            setSelectedGroupIds(checked ? filteredGroups.map(g => g.id) : []);
                          }}
                        />
                      </TableHead>
                      <TableHead>Group Name</TableHead>
                      <TableHead>Members</TableHead>
                      <TableHead>Assigned Panel</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGroups.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          {groupSearch ? 'No groups match your search' : 'No groups found'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredGroups.map(group => {
                        const assignedPanel = panels.find(p => p.id === group.assignedPanelId);
                        return (
                          <TableRow
                            key={group.id}
                            className={`cursor-pointer transition-colors ${
                              selectedGroupIds.includes(group.id) ? 'bg-primary/5' : ''
                            }`}
                            onClick={() => toggleGroup(group.id)}
                          >
                            <TableCell>
                              <Checkbox
                                checked={selectedGroupIds.includes(group.id)}
                                onCheckedChange={() => toggleGroup(group.id)}
                                onClick={e => e.stopPropagation()}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{group.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="gap-1">
                                <Users className="h-3 w-3" />
                                {group.members?.length || 0}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {assignedPanel ? (
                                <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-0">
                                  {assignedPanel.panelName}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">Unassigned</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(group.evaluationStatus || 'Pending')}`}>
                                {group.evaluationStatus || 'Pending'}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================
            TAB 4: OVERSIGHT BOARD
        ============================ */}
        <TabsContent value="oversight" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">
              {panels.length} panel(s) tracked
            </h3>
            <Button variant="outline" size="sm" onClick={fetchOversight} disabled={oversightLoading}>
              {oversightLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2">Refresh</span>
            </Button>
          </div>

          {panels.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-muted-foreground">No Panels Created Yet</p>
                <p className="text-sm text-muted-foreground mt-2">Create an evaluation panel from the Panel Creator tab</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {panels.map(panel => {
                const progress = panel.totalGroups
                  ? Math.round(((panel.completedGroups || 0) / panel.totalGroups) * 100)
                  : 0;
                const isExpanded = expandedPanels.has(panel.id);
                const memberNames = panel.memberIds
                  .map(id => supervisors.find(s => s.id === id)?.name)
                  .filter(Boolean);

                return (
                  <Card key={panel.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      {/* Panel Header */}
                      <div
                        className="flex items-start justify-between p-4 cursor-pointer hover:bg-muted/20 transition-colors"
                        onClick={() => togglePanelExpand(panel.id)}
                      >
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/10">
                              <BarChart3 className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <h4 className="font-semibold">{panel.panelName}</h4>
                              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                                {panel.scheduledDate && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />{panel.scheduledDate}
                                  </span>
                                )}
                                {panel.timeSlot && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />{panel.timeSlot}
                                  </span>
                                )}
                                {panel.venueOrLink && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {panel.venueOrLink.startsWith('http') ? (
                                      <a
                                        href={panel.venueOrLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline"
                                        onClick={e => e.stopPropagation()}
                                      >
                                        Join Meeting
                                      </a>
                                    ) : panel.venueOrLink}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="px-2">
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                              <span>Evaluation Progress</span>
                              <span className="font-medium">{panel.completedGroups || 0} / {panel.totalGroups || 0} Groups</span>
                            </div>
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                  width: `${progress}%`,
                                  background: progress === 100 ? '#16a34a' : progress > 50 ? '#2563eb' : '#ca8a04'
                                }}
                              />
                            </div>
                          </div>

                          {/* Faculty Members */}
                          {memberNames.length > 0 && (
                            <div className="flex flex-wrap gap-1 px-2">
                              {memberNames.map((name, i) => (
                                <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded-full">{name}</span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-2 ml-4">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            progress === 100
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : progress > 0
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          }`}>
                            {progress === 100 ? 'Complete' : progress > 0 ? 'In Progress' : 'Pending'}
                          </span>
                          <span className="text-lg font-bold text-primary">{progress}%</span>
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </div>

                      {/* Expanded: Group List */}
                      {isExpanded && panel.groups && panel.groups.length > 0 && (
                        <div className="border-t bg-muted/20 px-4 py-3">
                          <p className="text-xs font-semibold text-muted-foreground mb-2">Assigned Groups</p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {panel.groups.map(g => (
                              <div key={g.id} className="flex items-center justify-between p-2 rounded-md bg-background border">
                                <span className="text-sm font-medium">{g.name}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(g.evaluationStatus)}`}>
                                  {g.evaluationStatus}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {isExpanded && (!panel.groups || panel.groups.length === 0) && (
                        <div className="border-t bg-muted/20 px-4 py-4 text-center text-sm text-muted-foreground">
                          No groups assigned to this panel yet
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
