import { UserRole } from '@prisma/client';

export const ROLES = {
  ADMIN: 'ADMIN',
  RECRUITER: 'RECRUITER',
  HIRING_MANAGER: 'HIRING_MANAGER',
  INTERVIEWER: 'INTERVIEWER',
  VIEWER: 'VIEWER',
} as const;

export type Role = keyof typeof ROLES;

// Permission definitions
export const PERMISSIONS = {
  // Candidates
  VIEW_CANDIDATES: 'VIEW_CANDIDATES',
  CREATE_CANDIDATE: 'CREATE_CANDIDATE',
  EDIT_CANDIDATE: 'EDIT_CANDIDATE',
  DELETE_CANDIDATE: 'DELETE_CANDIDATE',
  
  // Jobs
  VIEW_JOBS: 'VIEW_JOBS',
  CREATE_JOB: 'CREATE_JOB',
  EDIT_JOB: 'EDIT_JOB',
  DELETE_JOB: 'DELETE_JOB',
  
  // Applications
  VIEW_APPLICATIONS: 'VIEW_APPLICATIONS',
  MOVE_APPLICATION: 'MOVE_APPLICATION',
  
  // Interviews
  VIEW_INTERVIEWS: 'VIEW_INTERVIEWS',
  SCHEDULE_INTERVIEW: 'SCHEDULE_INTERVIEW',
  SCORE_INTERVIEW: 'SCORE_INTERVIEW',
  
  // Analytics
  VIEW_ANALYTICS: 'VIEW_ANALYTICS',
  
  // Settings
  MANAGE_SETTINGS: 'MANAGE_SETTINGS',
  MANAGE_USERS: 'MANAGE_USERS',
  
  // Premium Features
  USE_EMAIL_TEMPLATES: 'USE_EMAIL_TEMPLATES',
  USE_RESUME_PARSER: 'USE_RESUME_PARSER',
  USE_SMART_SEARCH: 'USE_SMART_SEARCH',
  GENERATE_OFFER_LETTER: 'GENERATE_OFFER_LETTER',
  USE_TEAM_COMMENTS: 'USE_TEAM_COMMENTS',
  MANAGE_EMAIL_SEQUENCES: 'MANAGE_EMAIL_SEQUENCES',

  // Assessments & Evaluations
  VIEW_ASSESSMENTS: 'VIEW_ASSESSMENTS',
  MANAGE_ASSESSMENTS: 'MANAGE_ASSESSMENTS',

  // Referrals
  VIEW_REFERRALS: 'VIEW_REFERRALS',
  MANAGE_REFERRALS: 'MANAGE_REFERRALS',

  // E-Signature
  USE_ESIGNATURE: 'USE_ESIGNATURE',
  APPROVE_OFFERS: 'APPROVE_OFFERS',

  // Background Checks
  RUN_BACKGROUND_CHECKS: 'RUN_BACKGROUND_CHECKS',
  VIEW_BACKGROUND_CHECKS: 'VIEW_BACKGROUND_CHECKS',

  // Integrations & API
  MANAGE_INTEGRATIONS: 'MANAGE_INTEGRATIONS',
  MANAGE_WEBHOOKS: 'MANAGE_WEBHOOKS',
  MANAGE_API_KEYS: 'MANAGE_API_KEYS',

  // Data & Reports
  EXPORT_DATA: 'EXPORT_DATA',
  VIEW_REPORTS: 'VIEW_REPORTS',
  VIEW_SALARY_DATA: 'VIEW_SALARY_DATA',

  // Company
  MANAGE_COMPANY: 'MANAGE_COMPANY',

  // Audit
  VIEW_AUDIT_LOGS: 'VIEW_AUDIT_LOGS',
} as const;

export type Permission = keyof typeof PERMISSIONS;

// Role-based permission mapping
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: Object.values(PERMISSIONS) as Permission[],
  
  RECRUITER: [
    'VIEW_CANDIDATES', 'CREATE_CANDIDATE', 'EDIT_CANDIDATE', 'DELETE_CANDIDATE',
    'VIEW_JOBS', 'CREATE_JOB', 'EDIT_JOB', 'DELETE_JOB',
    'VIEW_APPLICATIONS', 'MOVE_APPLICATION',
    'VIEW_INTERVIEWS', 'SCHEDULE_INTERVIEW', 'SCORE_INTERVIEW',
    'VIEW_ANALYTICS', 'VIEW_REPORTS', 'EXPORT_DATA',
    'USE_EMAIL_TEMPLATES', 'MANAGE_EMAIL_SEQUENCES',
    'USE_RESUME_PARSER', 'USE_SMART_SEARCH',
    'GENERATE_OFFER_LETTER', 'USE_ESIGNATURE', 'APPROVE_OFFERS',
    'USE_TEAM_COMMENTS',
    'VIEW_ASSESSMENTS', 'MANAGE_ASSESSMENTS',
    'VIEW_REFERRALS', 'MANAGE_REFERRALS',
    'VIEW_BACKGROUND_CHECKS', 'RUN_BACKGROUND_CHECKS',
    'VIEW_SALARY_DATA',
  ],

  HIRING_MANAGER: [
    'VIEW_CANDIDATES', 'CREATE_CANDIDATE', 'EDIT_CANDIDATE',
    'VIEW_JOBS', 'CREATE_JOB', 'EDIT_JOB',
    'VIEW_APPLICATIONS', 'MOVE_APPLICATION',
    'VIEW_INTERVIEWS', 'SCHEDULE_INTERVIEW', 'SCORE_INTERVIEW',
    'VIEW_ANALYTICS', 'VIEW_REPORTS', 'EXPORT_DATA',
    'USE_EMAIL_TEMPLATES',
    'USE_RESUME_PARSER', 'USE_SMART_SEARCH',
    'GENERATE_OFFER_LETTER', 'USE_ESIGNATURE', 'APPROVE_OFFERS',
    'USE_TEAM_COMMENTS',
    'VIEW_ASSESSMENTS', 'MANAGE_ASSESSMENTS',
    'VIEW_REFERRALS',
    'VIEW_BACKGROUND_CHECKS',
    'VIEW_SALARY_DATA',
  ],

  INTERVIEWER: [
    'VIEW_CANDIDATES',
    'VIEW_APPLICATIONS',
    'VIEW_INTERVIEWS', 'SCHEDULE_INTERVIEW', 'SCORE_INTERVIEW',
    'USE_TEAM_COMMENTS',
    'VIEW_ASSESSMENTS',
  ],

  VIEWER: [
    'VIEW_CANDIDATES',
    'VIEW_JOBS',
    'VIEW_APPLICATIONS',
    'VIEW_INTERVIEWS',
    'VIEW_ANALYTICS',
    'VIEW_REPORTS',
    'VIEW_ASSESSMENTS',
    'VIEW_REFERRALS',
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

export function hasAllPermissions(role: Role, permissions: Permission[]): boolean {
  return permissions.every((permission) => hasPermission(role, permission));
}

// Role display names
export const ROLE_DISPLAY_NAMES: Record<Role, string> = {
  ADMIN: 'Administrator',
  RECRUITER: 'Recruiter',
  HIRING_MANAGER: 'Hiring Manager',
  INTERVIEWER: 'Interviewer',
  VIEWER: 'Viewer',
};

// Role descriptions
export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: 'Full system access. Can manage users, settings, and all data.',
  RECRUITER: 'Full recruitment access. Can manage candidates, jobs, and use all premium features.',
  HIRING_MANAGER: 'Can view and manage candidates for their department, schedule interviews, and generate offers.',
  INTERVIEWER: 'Can view assigned candidates, schedule and score interviews, and leave comments.',
  VIEWER: 'Read-only access to view candidates, jobs, and analytics.',
};
