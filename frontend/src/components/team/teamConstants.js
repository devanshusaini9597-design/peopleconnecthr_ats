import {
  Users,
  UsersRound,
  Briefcase,
  UserCog,
  BarChart3,
  Target,
  Shield,
  Handshake,
  Building2,
} from 'lucide-react';

export const TEAM_TOUR_KEY = 'skillnix_tour_team_v2';

export const TEAM_TOUR_STEPS = [
  {
    title: 'Team Directory',
    body: 'Everyone with a Skillnix seat appears here automatically. Add stakeholders for CC/BCC without giving them a login.',
  },
  {
    target: '[data-tour="team-tip"]',
    title: 'Two kinds of people',
    body: 'Workspace members can sign in. Stakeholders are hiring managers, clients, and SPOCs you copy on mail.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="team-filters"]',
    title: 'Find people',
    body: 'Filter by workspace seats or stakeholders, then search by name or email.',
    placement: 'bottom',
  },
];

export const ROLE_OPTIONS = [
  { value: 'Hiring Manager', label: 'Hiring Manager', description: 'Stakeholders', icon: Handshake },
  { value: 'SPOC', label: 'SPOC', description: 'Stakeholders', icon: Target },
  { value: 'Reporting Manager', label: 'Reporting Manager', description: 'Reporting / Senior', icon: BarChart3 },
  { value: 'HR Manager', label: 'HR Manager', description: 'Reporting / Senior', icon: UserCog },
  { value: 'Director', label: 'Director', description: 'Reporting / Senior', icon: Target },
  { value: 'VP / Head', label: 'VP / Head', description: 'Reporting / Senior', icon: Shield },
  { value: 'External', label: 'External', description: 'Stakeholders', icon: Users },
  { value: 'Team Member', label: 'Team Member', description: 'Directory', icon: Users },
  { value: 'Team Lead', label: 'Team Lead', description: 'Directory', icon: UsersRound },
  { value: 'Recruiter', label: 'Recruiter', description: 'Directory', icon: Briefcase },
  { value: 'HR Executive', label: 'HR Executive', description: 'Directory', icon: UserCog },
  { value: 'Admin', label: 'Admin', description: 'Directory', icon: Shield },
];

export const ROLE_COLORS = {
  'Team Lead': 'bg-teal-100 text-teal-700',
  Manager: 'bg-brand-100 text-brand-700',
  'Team Member': 'bg-stone-100 text-stone-700',
  HR: 'bg-green-100 text-green-700',
  'HR Executive': 'bg-green-100 text-green-700',
  'HR Manager': 'bg-emerald-100 text-emerald-700',
  Recruiter: 'bg-amber-100 text-amber-700',
  Admin: 'bg-red-100 text-red-700',
  'Reporting Manager': 'bg-sky-100 text-sky-700',
  Director: 'bg-brand-100 text-brand-700',
  'VP / Head': 'bg-teal-100 text-teal-800',
  'Hiring Manager': 'bg-teal-100 text-teal-700',
  SPOC: 'bg-orange-100 text-orange-700',
  External: 'bg-stone-100 text-stone-600',
  Owner: 'bg-brand-100 text-brand-800',
  'Freelance Recruiter': 'bg-indigo-100 text-indigo-800',
  'HR Recruiter': 'bg-amber-100 text-amber-800',
  Sales: 'bg-sky-100 text-sky-800',
};

export const FILTER_TABS = [
  { key: 'all', label: 'All', icon: UsersRound },
  { key: 'workspace', label: 'Workspace', icon: Building2 },
  { key: 'stakeholders', label: 'Stakeholders', icon: Handshake },
];

export function isWorkspaceMember(member) {
  return member?.kind === 'workspace' || Boolean(member?.systemRole);
}

export function memberMatchesTab(member, tab) {
  if (tab === 'all') return true;
  if (tab === 'workspace') return isWorkspaceMember(member);
  if (tab === 'stakeholders') return !isWorkspaceMember(member);
  return true;
}

export function getTabCount(members, tab) {
  if (tab === 'all') return members.length;
  return members.filter((m) => memberMatchesTab(m, tab)).length;
}

export function filterMembers(members, searchQuery, activeTab) {
  const q = searchQuery.toLowerCase();
  return members.filter((m) => {
    const hay = `${m.name || ''} ${m.email || ''} ${m.role || ''} ${m.systemRole || ''} ${m.department || ''} ${m.customRoleName || ''}`.toLowerCase();
    if (q && !hay.includes(q)) return false;
    return memberMatchesTab(m, activeTab);
  });
}

export const EMPTY_MEMBER_FORM = {
  name: '',
  email: '',
  role: 'Hiring Manager',
  phone: '',
  department: '',
  message: '',
};
