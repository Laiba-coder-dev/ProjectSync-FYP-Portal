// ============================================
// ProjectSync Type Definitions
// ============================================

// User Roles
export type UserRole = 'student' | 'supervisor' | 'pmo' | 'external_panel' | 'exam_cell' | 'admin' | 'hod';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  department?: string;
  createdAt: Date;
  lastLogin?: Date;
  isActive?: boolean; // Account status - can be disabled by admin
}

// Extended role-specific user types
export interface Student extends User {
  role: 'student';
  enrollmentNumber: string;
  semester: number;
  groupId?: string;
  supervisorId?: string;
  phoneNumber?: string;
  dateOfBirth?: Date;
  cgpa?: number;
  batchYear?: string;
  program?: string;
  isActive?: boolean; // Inherited from User, but explicitly defined for clarity
}

export interface Supervisor extends User {
  role: 'supervisor';
  expertise: string[];
  maxGroups: number;
  currentGroups: number;
  designation: string;
}

export interface PMOUser extends User {
  role: 'pmo';
  department: string;
}

// Project Status Types
export type ProjectStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'locked';
export type DocumentStatus = 'not_uploaded' | 'uploaded' | 'reviewed' | 'approved' | 'rejected';
export type EvaluationStatus = 'pending' | 'submitted' | 'locked';
export type SupervisionRequestStatus = 'pending' | 'accepted' | 'rejected';
export type MilestoneType = 'proposal' | 'mid_term' | 'final';

// Project Group
export interface ProjectGroup {
  id: string;
  name: string;
  members: GroupMember[];
  supervisorId?: string;
  supervisor?: Supervisor;
  externalPanelId?: string;
  externalPanelName?: string;
  projectId?: string;
  createdAt: Date;
  maxMembers: number;
  isMarksShared?: boolean;
}

export interface GroupMember {
  userId: string;
  name: string;
  email: string;
  enrollmentNumber: string;
  role: 'leader' | 'member';
  joinedAt: Date;
}

// Project
export interface Project {
  id: string;
  title: string;
  abstract: string;
  domain: string;
  status: ProjectStatus;
  groupId: string;
  supervisorId?: string;
  submittedAt?: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Supervision Request
export interface SupervisionRequest {
  id: string;
  groupId: string;
  group?: ProjectGroup;
  supervisorId: string;
  supervisor?: Supervisor;
  status: SupervisionRequestStatus;
  message?: string;
  responseMessage?: string;
  requestedAt: Date;
  respondedAt?: Date;
}

// Document Submission
export interface Submission {
  id: string;
  projectId: string;
  groupId: string;
  milestoneType: MilestoneType;
  title: string;
  description?: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  version: number;
  status: DocumentStatus;
  submittedAt: Date;
  submittedBy: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  feedback?: string;
  similarityScore?: number;
}

// Milestone / Progress
export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  description: string;
  type: MilestoneType;
  dueDate: Date;
  completedAt?: Date;
  status: 'upcoming' | 'in_progress' | 'completed' | 'overdue';
}

// ============================================
// Evaluation System V2 — Multi-Stakeholder
// ============================================

export type SemesterType = 'SEM_7' | 'SEM_8';
export type EvaluatorRole = 'PMO' | 'SUPERVISOR' | 'PANEL' | 'EXTERNAL';

/** Criteria breakdown stored per score submission */
export type EvaluationCriteria = Record<string, number>;

/** Master evaluation record — one per group per semester */
export interface ProjectEvaluation {
  id: string;            // Firestore doc ID: `${groupId}_${semesterType}`
  groupId: string;
  projectId?: string;
  semesterType: SemesterType;
  isLocked: boolean;
  createdAt: Date;
}

/** Individual stakeholder score submission */
export interface EvaluationScore {
  id: string;            // Firestore doc ID: `${groupId}_${evaluatorId}_${evaluatorRole}`
  evaluationId: string;  // ref to project_evaluations doc
  groupId: string;       // denormalized for client queries
  evaluatorId: string;
  evaluatorName?: string;
  evaluatorRole: EvaluatorRole;
  semesterType: SemesterType;
  score: number;
  maxScore: number;
  criteria: EvaluationCriteria;
  feedback?: string;
  submittedAt: Date;
}

/** Role-specific max marks */
export const MAX_MARKS: Record<SemesterType, Record<EvaluatorRole, number>> = {
  SEM_7: { PMO: 5, SUPERVISOR: 30, PANEL: 65, EXTERNAL: 0 },
  SEM_8: { PMO: 5, SUPERVISOR: 10, PANEL: 35, EXTERNAL: 50 },
};

export interface ComputedStudent {
  studentId: string;
  studentName: string;
  studentRollNo: string;
  pmoScore: number;
  supervisorScore: number;
  panelAvg: number;
  externalScore: number;
  internalTotal: number;
  grandTotal: number;
  breakdown: {
    panelSubmissionsCount: number;
    panelTotalExpected: number;
  };
}

/** Response shape from /api/evaluations/v2/group/{id}/computed */
export interface ComputedScore {
  groupId: string;
  semesterType: SemesterType;
  isLocked: boolean;
  maxTotal: number;
  students: ComputedStudent[];
  allScores: EvaluationScore[];
}

// ---- LEGACY (read-only fallback for archived projects) ----
/** @deprecated Use EvaluationScore for all new submissions */
export interface LegacyEvaluationMarks {
  documentation?: number;
  presentation?: number;
  implementation?: number;
  innovation?: number;
  teamwork?: number;
  viva?: number;
}
/** @deprecated Use ProjectEvaluation for all new submissions */
export interface LegacyEvaluation {
  id: string;
  groupId: string;
  evaluatorId: string;
  evaluatorName?: string;
  evaluatorRole: string;
  marks: LegacyEvaluationMarks;
  totalMarks: number;
  feedback?: string;
  status?: string;
  isSharedWithPMO?: boolean;
  isSharedWithExamCell?: boolean;
  isFinalized?: boolean;
}

// Announcement
export interface Announcement {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  targetRoles: UserRole[];
  targetGroupIds?: string[];
  priority: 'low' | 'medium' | 'high';
  publishedAt: Date;
  expiresAt?: Date;
  isRead?: boolean;
}

// Notification
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: Date;
}

export type NotificationType =
  | 'supervision_request'
  | 'supervision_response'
  | 'project_approved'
  | 'project_rejected'
  | 'document_feedback'
  | 'evaluation_submitted'
  | 'announcement'
  | 'deadline_reminder'
  | 'general';

// Academic Session
export interface AcademicSession {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  deadlines: SessionDeadline[];
}

export interface SessionDeadline {
  id: string;
  sessionId: string;
  name: string;
  type: MilestoneType | 'supervisor_selection' | 'group_formation';
  dueDate: Date;
}

// Audit Log (for Admin)
export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  details: string;
  ipAddress?: string;
  timestamp: Date;
}

// Dashboard Statistics
export interface DashboardStats {
  totalProjects: number;
  pendingApprovals: number;
  activeGroups: number;
  completedProjects: number;
  averageProgress: number;
}

// Form/Template (template_documents)
export interface DocumentTemplate {
  id: string;
  title: string;
  description: string;
  category: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Module 1: Supervisor Recommendation Engine
// ============================================

export interface SupervisorRecommendation {
  name: string;
  expertise: string;
  department: string;
  matchScore: number;
  slotsLeft: number;
  totalSlots: number;
  isAvailable: boolean;
  supervisorId?: string; // Populated after Firestore lookup
}

// ============================================
// Module 2: Panel Scheduling & Oversight
// ============================================

export type PanelEvaluationStatus = 'Pending' | 'In-Progress' | 'Completed';

export interface EvaluationPanel {
  id: string;
  panelName: string;
  memberIds: string[];
  scheduledDate: string;
  timeSlot: string;
  venueOrLink: string;
  status: string;
  createdBy?: string;
  // Aggregated fields from oversight endpoint
  totalGroups?: number;
  completedGroups?: number;
  pendingGroups?: number;
  groups?: PanelGroupOverview[];
}

export interface PanelGroupOverview {
  id: string;
  name: string;
  evaluationStatus: PanelEvaluationStatus;
  isEvaluated: boolean;
}
