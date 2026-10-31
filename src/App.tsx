import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import React, { Suspense } from "react";
import Login from "./pages/Login";

import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import { lazyWithRetry } from "./lib/lazyWithRetry";
import { ErrorBoundary } from "./components/common/ErrorBoundary";

// Dev Pages
const SeedDatabase = lazyWithRetry(() => import("./pages/dev/SeedDatabase"));

// Shared Pages
const ProjectAnalyzer = lazyWithRetry(() => import("./pages/shared/ProjectAnalyzer"));

// Student Pages
const StudentDashboard = lazyWithRetry(() => import("./pages/student/StudentDashboard"));
const SupervisorSelection = lazyWithRetry(() => import("./pages/student/SupervisorSelection"));
const GroupManagement = lazyWithRetry(() => import("./pages/student/GroupManagement"));
const ProjectIdea = lazyWithRetry(() => import("./pages/student/ProjectIdea"));
const DocumentUpload = lazyWithRetry(() => import("./pages/student/DocumentUpload"));
const StudentTemplates = lazyWithRetry(() => import("./pages/student/Templates"));
const ProgressTracking = lazyWithRetry(() => import("./pages/student/ProgressTracking"));
const AnalyzerDashboard = lazyWithRetry(() => import("./pages/student/AnalyzerDashboard"));
const Announcements = lazyWithRetry(() => import("./pages/student/Announcements"));
const Evaluation = lazyWithRetry(() => import("./pages/student/Evaluation"));
const StudentProfile = lazyWithRetry(() => import("./pages/student/StudentProfile"));

// Supervisor Pages
const SupervisorDashboard = lazyWithRetry(() => import("./pages/supervisor/SupervisorDashboard"));
const SupervisionRequests = lazyWithRetry(() => import("./pages/supervisor/SupervisionRequests"));
const AssignedGroups = lazyWithRetry(() => import("./pages/supervisor/AssignedGroups"));
const IdeaReview = lazyWithRetry(() => import("./pages/supervisor/IdeaReview"));
const DocumentReview = lazyWithRetry(() => import("./pages/supervisor/DocumentReview"));
const SupervisorEvaluation = lazyWithRetry(() => import("./pages/supervisor/SupervisorEvaluation"));
const SupervisorAnnouncements = lazyWithRetry(() => import("./pages/supervisor/SupervisorAnnouncements"));

// PMO Pages
const PMODashboard = lazyWithRetry(() => import("./pages/pmo/PMODashboard"));
const ProjectApproval = lazyWithRetry(() => import("./pages/pmo/ProjectApproval"));
const UserManagement = lazyWithRetry(() => import("./pages/pmo/UserManagement"));
const PMOAnnouncements = lazyWithRetry(() => import("./pages/pmo/PMOAnnouncements"));
const SupervisorAssignment = lazyWithRetry(() => import("./pages/pmo/SupervisorAssignment"));
const ProgressMonitor = lazyWithRetry(() => import("./pages/pmo/ProgressMonitor"));
const Templates = lazyWithRetry(() => import("./pages/pmo/Templates"));
const Reports = lazyWithRetry(() => import("./pages/pmo/Reports"));
const GroupOverview = lazyWithRetry(() => import("./pages/pmo/GroupOverview"));
const DocumentRepository = lazyWithRetry(() => import("./pages/pmo/DocumentRepository"));
const ExternalAssignment = lazyWithRetry(() => import("./pages/pmo/ExternalAssignment"));
const PanelScheduling = lazyWithRetry(() => import("./pages/pmo/PanelScheduling"));

// External Panel Pages
const ExternalDashboard = lazyWithRetry(() => import("./pages/external/ExternalDashboard"));
const EvaluateGroups = lazyWithRetry(() => import("./pages/external/EvaluateGroups"));
const GroupView = lazyWithRetry(() => import("./pages/external/GroupView"));
const ExternalDocumentReview = lazyWithRetry(() => import("./pages/external/DocumentReview"));

// Exam Cell Pages
const ExamCellDashboard = lazyWithRetry(() => import("./pages/exam-cell/ExamCellDashboard"));
const CompileResults = lazyWithRetry(() => import("./pages/exam-cell/CompileResults"));

// Admin Pages
const AdminDashboard = lazyWithRetry(() => import("./pages/admin/AdminDashboard"));
const RoleManagement = lazyWithRetry(() => import("./pages/admin/RoleManagement"));
const AcademicConfig = lazyWithRetry(() => import("./pages/admin/AcademicConfig"));
const AuditLogs = lazyWithRetry(() => import("./pages/admin/AuditLogs"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000, // 30 seconds
      refetchOnWindowFocus: false,
    },
  },
});

const Unauthorized = () => (
  <div className="flex flex-col items-center justify-center min-h-screen">
    <h1 className="text-4xl font-bold text-destructive">403 Unauthorized</h1>
    <p className="text-muted-foreground mt-4">You do not have permission to access this page.</p>
    <a href="/login" className="mt-4 text-primary hover:underline">Return to Login</a>
  </div>
);

const LoadingFallback = () => (
  <div className="flex h-screen w-full bg-background">
    {/* Sidebar skeleton */}
    <div className="hidden lg:flex flex-col w-64 border-r bg-card p-4 gap-3 shrink-0">
      <div className="h-8 w-32 rounded bg-muted animate-pulse mb-4" />
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-9 rounded bg-muted animate-pulse" style={{ opacity: 1 - i * 0.1 }} />
      ))}
    </div>
    {/* Content skeleton */}
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="h-14 border-b bg-card px-6 flex items-center gap-4">
        <div className="h-6 w-48 rounded bg-muted animate-pulse" />
        <div className="ml-auto h-8 w-8 rounded-full bg-muted animate-pulse" />
      </div>
      <div className="flex-1 p-6 space-y-4">
        <div className="h-8 w-64 rounded bg-muted animate-pulse" />
        <div className="h-4 w-96 rounded bg-muted animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-lg bg-muted animate-pulse mt-2" />
      </div>
    </div>
  </div>
);

import { NotificationProvider } from '@/context/NotificationContext';
import { TaskProvider } from '@/contexts/TaskContext';

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TaskProvider>
        <NotificationProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="/login" element={<Login />} />

                <Route path="/unauthorized" element={<Unauthorized />} />

                {/* Dev Tools */}
                <Route path="/dev/seed" element={<SeedDatabase />} />

                {/* Student Routes */}
                <Route element={<ProtectedRoute allowedRoles={['student']} />}>
                  <Route path="/student" element={<Navigate to="/student/dashboard" replace />} />
                  <Route path="/student/dashboard" element={<AppLayout><ErrorBoundary pageName="Student Dashboard"><StudentDashboard /></ErrorBoundary></AppLayout>} />
                  <Route path="/student/supervisor" element={<AppLayout><ErrorBoundary pageName="Supervisor Selection"><SupervisorSelection /></ErrorBoundary></AppLayout>} />
                  <Route path="/student/group" element={<AppLayout><ErrorBoundary pageName="My Group"><GroupManagement /></ErrorBoundary></AppLayout>} />
                  <Route path="/student/project" element={<AppLayout><ErrorBoundary pageName="Project Idea"><ProjectIdea /></ErrorBoundary></AppLayout>} />
                  <Route path="/student/analyzer" element={<AppLayout><ErrorBoundary pageName="AI Analyzer"><AnalyzerDashboard /></ErrorBoundary></AppLayout>} />
                  <Route path="/student/documents" element={<AppLayout><ErrorBoundary pageName="Documents"><DocumentUpload /></ErrorBoundary></AppLayout>} />
                  <Route path="/student/templates" element={<AppLayout><ErrorBoundary pageName="Template Documents"><StudentTemplates /></ErrorBoundary></AppLayout>} />
                  <Route path="/student/progress" element={<AppLayout><ErrorBoundary pageName="Progress Tracking"><ProgressTracking /></ErrorBoundary></AppLayout>} />
                  <Route path="/student/announcements" element={<AppLayout><ErrorBoundary pageName="Announcements"><Announcements /></ErrorBoundary></AppLayout>} />
                  <Route path="/student/evaluation" element={<AppLayout><ErrorBoundary pageName="Evaluation"><Evaluation /></ErrorBoundary></AppLayout>} />
                  <Route path="/student/profile" element={<AppLayout><ErrorBoundary pageName="Profile"><StudentProfile /></ErrorBoundary></AppLayout>} />
                </Route>

                {/* Supervisor Routes */}
                <Route element={<ProtectedRoute allowedRoles={['supervisor']} />}>
                  <Route path="/supervisor" element={<Navigate to="/supervisor/dashboard" replace />} />
                  <Route path="/supervisor/dashboard" element={<AppLayout><ErrorBoundary pageName="Supervisor Dashboard"><SupervisorDashboard /></ErrorBoundary></AppLayout>} />
                  <Route path="/supervisor/requests" element={<AppLayout><ErrorBoundary pageName="Supervision Requests"><SupervisionRequests /></ErrorBoundary></AppLayout>} />
                  <Route path="/supervisor/groups" element={<AppLayout><ErrorBoundary pageName="Assigned Groups"><AssignedGroups /></ErrorBoundary></AppLayout>} />
                  <Route path="/supervisor/ideas" element={<AppLayout><ErrorBoundary pageName="Idea Review"><IdeaReview /></ErrorBoundary></AppLayout>} />
                  <Route path="/supervisor/documents" element={<AppLayout><ErrorBoundary pageName="Document Review"><DocumentReview /></ErrorBoundary></AppLayout>} />
                  <Route path="/supervisor/analyzer" element={<AppLayout><ErrorBoundary pageName="AI Analyzer"><ProjectAnalyzer /></ErrorBoundary></AppLayout>} />
                  <Route path="/supervisor/evaluation" element={<AppLayout><ErrorBoundary pageName="Evaluation"><SupervisorEvaluation /></ErrorBoundary></AppLayout>} />
                  <Route path="/supervisor/announcements" element={<AppLayout><ErrorBoundary pageName="Announcements"><SupervisorAnnouncements /></ErrorBoundary></AppLayout>} />
                </Route>

                {/* PMO Routes */}
                <Route element={<ProtectedRoute allowedRoles={['pmo']} />}>
                  <Route path="/pmo" element={<Navigate to="/pmo/dashboard" replace />} />
                  <Route path="/pmo/dashboard" element={<AppLayout><ErrorBoundary pageName="PMO Dashboard"><PMODashboard /></ErrorBoundary></AppLayout>} />
                  <Route path="/pmo/approvals" element={<AppLayout><ErrorBoundary pageName="Project Approval"><ProjectApproval /></ErrorBoundary></AppLayout>} />
                  <Route path="/pmo/users" element={<AppLayout><ErrorBoundary pageName="User Management"><UserManagement /></ErrorBoundary></AppLayout>} />
                  <Route path="/pmo/announcements" element={<AppLayout><ErrorBoundary pageName="Announcements"><PMOAnnouncements /></ErrorBoundary></AppLayout>} />
                  <Route path="/pmo/assignments" element={<AppLayout><ErrorBoundary pageName="Supervisor Assignment"><SupervisorAssignment /></ErrorBoundary></AppLayout>} />
                  <Route path="/pmo/progress" element={<AppLayout><ErrorBoundary pageName="Progress Monitor"><ProgressMonitor /></ErrorBoundary></AppLayout>} />
                  <Route path="/pmo/templates" element={<AppLayout><ErrorBoundary pageName="Templates"><Templates /></ErrorBoundary></AppLayout>} />
                  <Route path="/pmo/reports" element={<AppLayout><ErrorBoundary pageName="Reports"><Reports /></ErrorBoundary></AppLayout>} />
                  <Route path="/pmo/groups" element={<AppLayout><ErrorBoundary pageName="Group Overview"><GroupOverview /></ErrorBoundary></AppLayout>} />
                  <Route path="/pmo/documents" element={<AppLayout><ErrorBoundary pageName="Document Repository"><DocumentRepository /></ErrorBoundary></AppLayout>} />
                  <Route path="/pmo/analyzer" element={<AppLayout><ErrorBoundary pageName="AI Analyzer"><ProjectAnalyzer /></ErrorBoundary></AppLayout>} />
                  <Route path="/pmo/external-assignment" element={<AppLayout><ErrorBoundary pageName="External Assignment"><ExternalAssignment /></ErrorBoundary></AppLayout>} />
                  <Route path="/pmo/panels" element={<AppLayout><ErrorBoundary pageName="Panel Scheduling"><PanelScheduling /></ErrorBoundary></AppLayout>} />
                  <Route path="/pmo/evaluation" element={<AppLayout><ErrorBoundary pageName="Evaluation"><SupervisorEvaluation /></ErrorBoundary></AppLayout>} />
                </Route>

                {/* External Panel Routes */}
                <Route element={<ProtectedRoute allowedRoles={['external_panel']} />}>
                  <Route path="/external" element={<Navigate to="/external/dashboard" replace />} />
                  <Route path="/external/dashboard" element={<AppLayout><ErrorBoundary pageName="External Dashboard"><ExternalDashboard /></ErrorBoundary></AppLayout>} />
                  <Route path="/external/groups" element={<AppLayout><ErrorBoundary pageName="Group View"><GroupView /></ErrorBoundary></AppLayout>} />
                  <Route path="/external/documents" element={<AppLayout><ErrorBoundary pageName="Document Review"><ExternalDocumentReview /></ErrorBoundary></AppLayout>} />
                  <Route path="/external/evaluate" element={<AppLayout><ErrorBoundary pageName="Evaluate Groups"><EvaluateGroups /></ErrorBoundary></AppLayout>} />
                </Route>

                {/* Exam Cell Routes */}
                <Route element={<ProtectedRoute allowedRoles={['exam_cell']} />}>
                  <Route path="/exam-cell" element={<Navigate to="/exam-cell/dashboard" replace />} />
                  <Route path="/exam-cell/dashboard" element={<AppLayout><ErrorBoundary pageName="Exam Cell Dashboard"><ExamCellDashboard /></ErrorBoundary></AppLayout>} />
                  <Route path="/exam-cell/compile" element={<AppLayout><ErrorBoundary pageName="Compile Results"><CompileResults /></ErrorBoundary></AppLayout>} />
                </Route>

                {/* Admin Routes */}
                <Route element={<ProtectedRoute allowedRoles={['admin', 'hod']} />}>
                  <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
                  <Route path="/admin/dashboard" element={<AppLayout><ErrorBoundary pageName="Admin Dashboard"><AdminDashboard /></ErrorBoundary></AppLayout>} />
                  <Route path="/admin/roles" element={<AppLayout><ErrorBoundary pageName="Role Management"><RoleManagement /></ErrorBoundary></AppLayout>} />
                  <Route path="/admin/config" element={<AppLayout><ErrorBoundary pageName="Academic Config"><AcademicConfig /></ErrorBoundary></AppLayout>} />
                  <Route path="/admin/logs" element={<AppLayout><ErrorBoundary pageName="Audit Logs"><AuditLogs /></ErrorBoundary></AppLayout>} />
                </Route>

                {/* Catch-all */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
        </NotificationProvider>
      </TaskProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

