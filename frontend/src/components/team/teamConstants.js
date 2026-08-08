import {
  Users,
  UsersRound,
  Briefcase,
  UserCog,
  BarChart3,
  Target,
  Shield,
  Handshake,
} from 'lucide-react';

export const TEAM_TOUR_KEY = 'skillnix_tour_team_v1';

export const TEAM_TOUR_STEPS = [
  {
    title: 'Team Directory',
    body: 'Keep colleagues, managers, and stakeholders ready to CC/BCC when you send emails.',
  },
  {
    target: '[data-tour="team-tip"]',
    title: 'How it works',
    body: 'Add contacts here — they show up as suggestions in email flows, like a shared address book.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="team-filters"]',
    title: 'Find people',
    body: 'Search by name, email, role, or department, then filter by My Team, Reporting, or Stakeholders.',
    placement: 'bottom',
  },
];

export const ROLE_OPTIONS = [
  { value: 'Team Member', label: 'Team Member', description: 'My Team', icon: Users },
  { value: 'Team Lead', label: 'Team Lead', description: 'My Team', icon: UsersRound },
  { value: 'Recruiter', label: 'Recruiter', description: 'My Team', icon: Briefcase },
  { value: 'HR Executive', label: 'HR Executive', description: 'My Team', icon: UserCog },
  { value: 'Reporting Manager', label: 'Reporting Manager', description: 'Reporting / Senior', icon: BarChart3 },
  { value: 'HR Manager', label: 'HR Manager', description: 'Reporting / Senior', icon: UserCog },
  { value: 'Director', label: 'Director', description: 'Reporting / Senior', icon: Target },
  { value: 'VP / Head', label: 'VP / Head', description: 'Reporting / Senior', icon: Shield },
  { value: 'Hiring Manager', label: 'Hiring Manager', description: 'Stakeholders', icon: Handshake },
  { value: 'SPOC', label: 'SPOC', description: 'Stakeholders', icon: Target },
  { value: 'Admin', label: 'Admin', description: 'Stakeholders', icon: Shield },
  { value: 'External', label: 'External', description: 'Stakeholders', icon: Users },
];

export const TAB_CATEGORIES = {
  myTeam: ['Team Member', 'Team Lead', 'Recruiter', 'HR Executive', 'HR'],
  reporting: ['Reporting Manager', 'HR Manager', 'Director', 'VP / Head', 'Manager'],
  stakeholders: ['Hiring Manager', 'SPOC', 'Admin', 'External'],
};

export const ROLE_COLORS = {
  'Team Lead': 'bg-teal-100 text-teal-700',
  'Manager': 'bg-brand-100 text-brand-700',
  'Team Member': 'bg-stone-100 text-stone-700',
  'HR': 'bg-green-100 text-green-700',
  'HR Executive': 'bg-green-100 text-green-700',
  'HR Manager': 'bg-emerald-100 text-emerald-700',
  'Recruiter': 'bg-amber-100 text-amber-700',
  'Admin': 'bg-red-100 text-red-700',
  'Reporting Manager': 'bg-sky-100 text-sky-700',
  'Director': 'bg-brand-100 text-brand-700',
  'VP / Head': 'bg-teal-100 text-teal-800',
  'Hiring Manager': 'bg-teal-100 text-teal-700',
  'SPOC': 'bg-orange-100 text-orange-700',
  'External': 'bg-stone-100 text-stone-600',
};

export const FILTER_TABS = [
  { key: 'all', label: 'All', icon: UsersRound },
  { key: 'myTeam', label: 'My Team', icon: Handshake },
  { key: 'reporting', label: 'Reporting', icon: BarChart3 },
  { key: 'stakeholders', label: 'Stakeholders', icon: Target },
];

export function memberMatchesTab(member, tab) {
  if (tab === 'all') return true;
  return (TAB_CATEGORIES[tab] || []).includes(member.role || 'Team Member');
}

export function getTabCount(members, tab) {
  if (tab === 'all') return members.length;
  return members.filter((m) => memberMatchesTab(m, tab)).length;
}

export function filterMembers(members, searchQuery, activeTab) {
  return members.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.role || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.department || '').toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    return memberMatchesTab(m, activeTab);
  });
}

export const EMPTY_MEMBER_FORM = {
  name: '',
  email: '',
  role: 'Team Member',
  phone: '',
  department: '',
  message: '',
};
