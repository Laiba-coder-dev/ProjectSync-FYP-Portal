// ============================================
// ProjectSync Mock Data
// ============================================

import {
  User,
  Student,
  Supervisor,
  ProjectGroup,
  Project,
  SupervisionRequest,
  Submission,
  Milestone,
  Evaluation,
  Announcement,
  Notification,
  AcademicSession,
  DocumentTemplate,
  AuditLog,
} from '@/types';

// ============================================
// Users
// ============================================

export const mockStudents: Student[] = [
  {
    id: 'student-1',
    email: '22104001@uskt.edu.pk',
    name: 'Ali Khan',
    role: 'student',
    enrollmentNumber: '22104001',
    semester: 8,
    groupId: 'group-1',
    supervisorId: 'supervisor-1',
    department: 'Computer Science',
    createdAt: new Date('2021-08-01'),
    lastLogin: new Date('2024-01-15'),
  },
  {
    id: 'student-2',
    email: '22104002@uskt.edu.pk',
    name: 'Zara Ahmed',
    role: 'student',
    enrollmentNumber: '22104002',
    semester: 8,
    groupId: 'group-1',
    supervisorId: 'supervisor-1',
    department: 'Computer Science',
    createdAt: new Date('2021-08-01'),
    lastLogin: new Date('2024-01-15'),
  },
  {
    id: 'student-3',
    email: '22104003@uskt.edu.pk',
    name: 'Bilal Hassan',
    role: 'student',
    enrollmentNumber: '22104003',
    semester: 8,
    groupId: 'group-1',
    supervisorId: 'supervisor-1',
    department: 'Computer Science',
    createdAt: new Date('2021-08-01'),
    lastLogin: new Date('2024-01-14'),
  },
  {
    id: 'student-4',
    email: '22104004@uskt.edu.pk',
    name: 'Fatima Noor',
    role: 'student',
    enrollmentNumber: '22104004',
    semester: 8,
    department: 'Computer Science',
    createdAt: new Date('2021-08-01'),
    lastLogin: new Date('2024-01-13'),
  },
];

export const mockSupervisors: Supervisor[] = [
  {
    id: 'supervisor-1',
    email: 'tanveer.hussain@uskt.edu.pk',
    name: 'Dr. Tanveer Hussain',
    role: 'supervisor',
    expertise: ['Machine Learning', 'Data Science', 'AI'],
    maxGroups: 5,
    currentGroups: 3,
    designation: 'Associate Professor',
    department: 'Computer Science',
    createdAt: new Date('2015-06-01'),
    lastLogin: new Date('2024-01-15'),
  },
  {
    id: 'supervisor-2',
    email: 'saira.bano@uskt.edu.pk',
    name: 'Dr. Saira Bano',
    role: 'supervisor',
    expertise: ['Web Development', 'Cloud Computing', 'DevOps'],
    maxGroups: 4,
    currentGroups: 4,
    designation: 'Professor',
    department: 'Computer Science',
    createdAt: new Date('2010-08-01'),
    lastLogin: new Date('2024-01-15'),
  },
  {
    id: 'supervisor-3',
    email: 'farhan.qureshi@uskt.edu.pk',
    name: 'Dr. Farhan Qureshi',
    role: 'supervisor',
    expertise: ['Cybersecurity', 'Blockchain', 'Cryptography'],
    maxGroups: 5,
    currentGroups: 2,
    designation: 'Assistant Professor',
    department: 'Computer Science',
    createdAt: new Date('2018-01-01'),
    lastLogin: new Date('2024-01-14'),
  },
  {
    id: 'supervisor-4',
    email: 'imran.khan@uskt.edu.pk',
    name: 'Dr. Imran Khan',
    role: 'supervisor',
    expertise: ['Mobile Development', 'IoT', 'Embedded Systems'],
    maxGroups: 4,
    currentGroups: 1,
    designation: 'Associate Professor',
    department: 'Computer Science',
    createdAt: new Date('2016-03-01'),
    lastLogin: new Date('2024-01-12'),
  },
];

export const mockPMOUsers: User[] = [
  {
    id: 'pmo-1',
    email: 'ayesha.siddiqui@uskt.edu.pk',
    name: 'Dr. Ayesha Siddiqui',
    role: 'pmo',
    department: 'Computer Science',
    createdAt: new Date('2019-06-01'),
    lastLogin: new Date('2024-01-15'),
  },
  {
    id: 'pmo-2',
    email: 'azkamir@uskt.edu.pk',
    name: 'Mr. Azkamir',
    role: 'pmo',
    department: 'Computer Science',
    createdAt: new Date('2019-06-01'),
    lastLogin: new Date('2024-01-15'),
  },
];

export const mockExternalPanel: User[] = [
  {
    id: 'external-1',
    email: 'kamran.ahmed@uskt.edu.pk',
    name: 'Mr. Kamran Ahmed',
    role: 'external_panel',
    createdAt: new Date('2023-11-01'),
    lastLogin: new Date('2024-01-10'),
  },
];

export const mockExamCell: User[] = [
  {
    id: 'examcell-1',
    email: 'hina.rabbani@uskt.edu.pk',
    name: 'Ms. Hina Rabbani',
    role: 'exam_cell',
    department: 'Examination Cell',
    createdAt: new Date('2017-04-01'),
    lastLogin: new Date('2024-01-15'),
  },
];

export const mockAdmins: User[] = [
  {
    id: 'admin-1',
    email: 'javed.sheikh@uskt.edu.pk',
    name: 'Prof. Javed Sheikh',
    role: 'admin',
    department: 'Computer Science',
    createdAt: new Date('2012-01-01'),
    lastLogin: new Date('2024-01-15'),
  },
];

// ============================================
// Groups
// ============================================

export const mockGroups: ProjectGroup[] = [
  {
    id: 'group-1',
    name: 'Team Alpha',
    members: [
      {
        userId: 'student-1',
        name: 'Ali Khan',
        email: '22104001@uskt.edu.pk',
        enrollmentNumber: '22104001',
        role: 'leader',
        joinedAt: new Date('2024-01-01'),
      },
      {
        userId: 'student-2',
        name: 'Zara Ahmed',
        email: '22104002@uskt.edu.pk',
        enrollmentNumber: '22104002',
        role: 'member',
        joinedAt: new Date('2024-01-02'),
      },
      {
        userId: 'student-3',
        name: 'Bilal Hassan',
        email: '22104003@uskt.edu.pk',
        enrollmentNumber: '22104003',
        role: 'member',
        joinedAt: new Date('2024-01-02'),
      },
    ],
    supervisorId: 'supervisor-1',
    projectId: 'project-1',
    createdAt: new Date('2024-01-01'),
    maxMembers: 4,
  },
  {
    id: 'group-2',
    name: 'Innovators',
    members: [
      {
        userId: 'student-4',
        name: 'Fatima Noor',
        email: '22104004@uskt.edu.pk',
        enrollmentNumber: '22104004',
        role: 'leader',
        joinedAt: new Date('2024-01-03'),
      },
    ],
    createdAt: new Date('2024-01-03'),
    maxMembers: 4,
  },
];

// ============================================
// Projects
// ============================================

export const mockProjects: Project[] = [
  {
    id: 'project-1',
    title: 'AI-Powered Student Performance Prediction System',
    abstract: 'This project aims to develop a machine learning-based system that predicts student academic performance using historical data, attendance patterns, and engagement metrics. The system will help identify at-risk students early and enable timely interventions.',
    domain: 'Machine Learning',
    status: 'approved',
    groupId: 'group-1',
    supervisorId: 'supervisor-1',
    submittedAt: new Date('2024-01-05'),
    approvedAt: new Date('2024-01-08'),
    createdAt: new Date('2024-01-04'),
    updatedAt: new Date('2024-01-08'),
  },
  {
    id: 'project-2',
    title: 'Blockchain-Based Certificate Verification System',
    abstract: 'A decentralized system for issuing and verifying academic certificates using blockchain technology to prevent fraud and enable instant verification.',
    domain: 'Blockchain',
    status: 'submitted',
    groupId: 'group-2',
    submittedAt: new Date('2024-01-10'),
    createdAt: new Date('2024-01-09'),
    updatedAt: new Date('2024-01-10'),
  },
];

// ============================================
// Supervision Requests
// ============================================

export const mockSupervisionRequests: SupervisionRequest[] = [
  {
    id: 'request-1',
    groupId: 'group-1',
    supervisorId: 'supervisor-1',
    status: 'accepted',
    message: 'We are interested in working on an AI/ML project and your expertise aligns with our interests.',
    responseMessage: 'Happy to supervise your group. Let\'s schedule a meeting to discuss your project idea.',
    requestedAt: new Date('2024-01-01'),
    respondedAt: new Date('2024-01-02'),
  },
  {
    id: 'request-2',
    groupId: 'group-2',
    supervisorId: 'supervisor-3',
    status: 'pending',
    message: 'We want to work on a blockchain-based project.',
    requestedAt: new Date('2024-01-08'),
  },
];

// ============================================
// Submissions
// ============================================

export const mockSubmissions: Submission[] = [
  {
    id: 'submission-1',
    projectId: 'project-1',
    groupId: 'group-1',
    milestoneType: 'proposal',
    title: 'Project Proposal - AI Performance Prediction',
    description: 'Initial project proposal document with objectives and methodology.',
    fileUrl: '/documents/proposal-v2.pdf',
    fileName: 'proposal-v2.pdf',
    fileSize: 2456789,
    version: 2,
    status: 'approved',
    submittedAt: new Date('2024-01-06'),
    submittedBy: 'student-1',
    reviewedBy: 'supervisor-1',
    reviewedAt: new Date('2024-01-08'),
    feedback: 'Good proposal. Please include more details about the dataset in the next milestone.',
    similarityScore: 12,
  },
  {
    id: 'submission-2',
    projectId: 'project-1',
    groupId: 'group-1',
    milestoneType: 'mid_term',
    title: 'Mid-Term Progress Report',
    description: 'Progress report with implementation details and preliminary results.',
    fileUrl: '/documents/midterm-report.pdf',
    fileName: 'midterm-report.pdf',
    fileSize: 3567890,
    version: 1,
    status: 'uploaded',
    submittedAt: new Date('2024-01-12'),
    submittedBy: 'student-1',
    similarityScore: 8,
  },
];

// ============================================
// Milestones
// ============================================

export const mockMilestones: Milestone[] = [
  {
    id: 'milestone-1',
    projectId: 'project-1',
    title: 'Project Proposal Submission',
    description: 'Submit the initial project proposal with objectives, scope, and methodology.',
    type: 'proposal',
    dueDate: new Date('2024-01-15'),
    completedAt: new Date('2024-01-06'),
    status: 'completed',
  },
  {
    id: 'milestone-2',
    projectId: 'project-1',
    title: 'Mid-Term Progress Report',
    description: 'Submit progress report with implementation details and preliminary results.',
    type: 'mid_term',
    dueDate: new Date('2024-02-15'),
    status: 'in_progress',
  },
  {
    id: 'milestone-3',
    projectId: 'project-1',
    title: 'Final Project Submission',
    description: 'Complete project with final report, source code, and documentation.',
    type: 'final',
    dueDate: new Date('2024-04-15'),
    status: 'upcoming',
  },
];

// ============================================
// Evaluations
// ============================================

export const mockEvaluations: Evaluation[] = [
  {
    id: 'eval-1',
    projectId: 'project-1',
    groupId: 'group-1',
    evaluatorId: 'supervisor-1',
    evaluatorName: 'Dr. Tanveer Hussain',
    evaluatorRole: 'supervisor',
    marks: {
      documentation: 18,
      presentation: 17,
      implementation: 19,
      innovation: 16,
      teamwork: 18,
    },
    totalMarks: 88,
    maxMarks: 100,
    feedback: 'Excellent work on the implementation. Documentation could be improved with more diagrams.',
    status: 'submitted',
    submittedAt: new Date('2024-01-14'),
  },
];

// ============================================
// Announcements
// ============================================

export const mockAnnouncements: Announcement[] = [
  {
    id: 'announce-1',
    title: 'Mid-Term Submission Deadline Extended',
    content: 'Due to the upcoming holidays, the mid-term submission deadline has been extended by one week. The new deadline is February 22, 2024. Please ensure all documents are submitted before 11:59 PM.',
    authorId: 'pmo-1',
    authorName: 'Dr. Ayesha Siddiqui',
    authorRole: 'pmo',
    targetRoles: ['student', 'supervisor'],
    priority: 'high',
    publishedAt: new Date('2024-01-14'),
    isRead: false,
  },
  {
    id: 'announce-2',
    title: 'Workshop on Technical Writing',
    content: 'A workshop on technical writing for FYP documentation will be held on January 20, 2024. All students are encouraged to attend.',
    authorId: 'pmo-1',
    authorName: 'Dr. Ayesha Siddiqui',
    authorRole: 'pmo',
    targetRoles: ['student'],
    priority: 'medium',
    publishedAt: new Date('2024-01-12'),
    isRead: true,
  },
  {
    id: 'announce-3',
    title: 'Updated Project Proposal Template',
    content: 'A new project proposal template has been uploaded. Please use this updated template for all future submissions.',
    authorId: 'pmo-1',
    authorName: 'Dr. Ayesha Siddiqui',
    authorRole: 'pmo',
    targetRoles: ['student', 'supervisor'],
    priority: 'low',
    publishedAt: new Date('2024-01-10'),
    isRead: true,
  },
];

// ============================================
// Notifications
// ============================================

export const mockNotifications: Notification[] = [
  {
    id: 'notif-1',
    userId: 'student-1',
    type: 'document_feedback',
    title: 'Feedback Received',
    message: 'Dr. Anderson has provided feedback on your proposal submission.',
    link: '/student/submissions',
    isRead: false,
    createdAt: new Date('2024-01-08'),
  },
  {
    id: 'notif-2',
    userId: 'student-1',
    type: 'project_approved',
    title: 'Project Approved',
    message: 'Your project "AI-Powered Student Performance Prediction System" has been approved.',
    link: '/student/project',
    isRead: true,
    createdAt: new Date('2024-01-08'),
  },
  {
    id: 'notif-3',
    userId: 'student-1',
    type: 'announcement',
    title: 'New Announcement',
    message: 'Mid-Term Submission Deadline Extended - Check announcements for details.',
    link: '/student/announcements',
    isRead: false,
    createdAt: new Date('2024-01-14'),
  },
  {
    id: 'notif-4',
    userId: 'supervisor-1',
    type: 'supervision_request',
    title: 'New Supervision Request',
    message: 'Team Innovators has requested your supervision.',
    link: '/supervisor/requests',
    isRead: false,
    createdAt: new Date('2024-01-08'),
  },
];

// ============================================
// Academic Sessions
// ============================================

export const mockAcademicSessions: AcademicSession[] = [
  {
    id: 'session-1',
    name: 'Spring 2024',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-05-31'),
    isActive: true,
    deadlines: [
      {
        id: 'deadline-1',
        sessionId: 'session-1',
        name: 'Group Formation',
        type: 'group_formation',
        dueDate: new Date('2024-01-10'),
      },
      {
        id: 'deadline-2',
        sessionId: 'session-1',
        name: 'Supervisor Selection',
        type: 'supervisor_selection',
        dueDate: new Date('2024-01-15'),
      },
      {
        id: 'deadline-3',
        sessionId: 'session-1',
        name: 'Proposal Submission',
        type: 'proposal',
        dueDate: new Date('2024-01-31'),
      },
      {
        id: 'deadline-4',
        sessionId: 'session-1',
        name: 'Mid-Term Report',
        type: 'mid_term',
        dueDate: new Date('2024-02-28'),
      },
      {
        id: 'deadline-5',
        sessionId: 'session-1',
        name: 'Final Submission',
        type: 'final',
        dueDate: new Date('2024-04-30'),
      },
    ],
  },
];

// ============================================
// Document Templates
// ============================================

export const mockTemplates: DocumentTemplate[] = [
  {
    id: 'template-1',
    name: 'Project Proposal Template',
    description: 'Standard template for project proposal submission',
    category: 'proposal',
    fileUrl: '/templates/proposal-template.docx',
    uploadedAt: new Date('2024-01-01'),
    uploadedBy: 'pmo-1',
  },
  {
    id: 'template-2',
    name: 'Mid-Term Report Template',
    description: 'Template for mid-term progress report',
    category: 'mid_term',
    fileUrl: '/templates/midterm-template.docx',
    uploadedAt: new Date('2024-01-01'),
    uploadedBy: 'pmo-1',
  },
  {
    id: 'template-3',
    name: 'Final Report Template',
    description: 'Comprehensive template for final project report',
    category: 'final',
    fileUrl: '/templates/final-template.docx',
    uploadedAt: new Date('2024-01-01'),
    uploadedBy: 'pmo-1',
  },
];

// ============================================
// Audit Logs
// ============================================

export const mockAuditLogs: AuditLog[] = [
  {
    id: 'log-1',
    userId: 'student-1',
    userName: 'Ali Khan',
    userRole: 'student',
    action: 'SUBMIT_DOCUMENT',
    details: 'Submitted mid-term progress report for project "AI Performance Prediction"',
    timestamp: new Date('2024-01-12T10:30:00'),
  },
  {
    id: 'log-2',
    userId: 'supervisor-1',
    userName: 'Dr. Tanveer Hussain',
    userRole: 'supervisor',
    action: 'APPROVE_PROJECT',
    details: 'Approved project proposal for Team Alpha',
    timestamp: new Date('2024-01-08T14:15:00'),
  },
  {
    id: 'log-3',
    userId: 'pmo-1',
    userName: 'Dr. Ayesha Siddiqui',
    userRole: 'pmo',
    action: 'PUBLISH_ANNOUNCEMENT',
    details: 'Published announcement: Mid-Term Submission Deadline Extended',
    timestamp: new Date('2024-01-14T09:00:00'),
  },
];

// ============================================
// Current User (for demo purposes)
// ============================================

export const getCurrentUser = (role: string): User | null => {
  switch (role) {
    case 'student':
      return mockStudents[0];
    case 'supervisor':
      return mockSupervisors[0];
    case 'pmo':
      return mockPMOUsers[0];
    case 'external_panel':
      return mockExternalPanel[0];
    case 'exam_cell':
      return mockExamCell[0];
    case 'admin':
      return mockAdmins[0];
    default:
      return null;
  }
};
