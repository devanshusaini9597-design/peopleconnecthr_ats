import {
  Settings, Users, Briefcase, Shield, Eye, UserCog, ListChecks, Calendar, Globe, Handshake, UserPlus,
} from 'lucide-react';
import { DATE_FORMAT_OPTIONS, TIMEZONE_OPTIONS } from '../../data/locales';

export const ORG_TOUR_KEY = 'skillnix_tour_organization_v1';
export const ORG_TOUR_STEPS = [
  {
    title: 'Organization Settings',
    body: 'Configure company identity, hiring pipeline stages, team access, and careers page — then save with the sticky bar.',
  },
  {
    target: '[data-tour="org-tip"]',
    title: 'Tips',
    body: 'Use the tabs to switch between General, Pipeline, Team, and Careers. Changes apply org-wide when you save.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="org-tabs"]',
    title: 'Sections',
    body: 'General covers identity and locale. Pipeline defines stages. Team invites colleagues. Careers controls your public page.',
    placement: 'bottom',
  },
];

export const INVITE_ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin', description: 'Full org access', icon: Shield },
  { value: 'hr_recruiter', label: 'HR Recruiter', description: 'Hiring workflows', icon: Briefcase },
  { value: 'hr_manager', label: 'HR Manager', description: 'Team & settings', icon: UserCog },
  { value: 'sales', label: 'Sales', description: 'Candidates & pipeline', icon: Handshake },
  { value: 'freelancer', label: 'Freelance Recruiter', description: 'Own desk & open mandates (personal email OK)', icon: UserPlus },
  { value: 'other', label: 'Other', description: 'Limited view access', icon: Eye },
];

export const MEMBER_ROLE_OPTIONS = INVITE_ROLE_OPTIONS;

export const BrandToggle = ({ checked, onChange }) => (
  <label className="relative inline-flex items-center cursor-pointer shrink-0">
    <input
      type="checkbox"
      className="sr-only peer"
      checked={checked}
      onChange={onChange}
    />
    <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300/40 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600" />
  </label>
);

export const TABS = [
  { id: 'general', icon: Settings, label: 'General' },
  { id: 'pipeline', icon: ListChecks, label: 'Pipeline' },
  { id: 'team', icon: Users, label: 'Team' },
  { id: 'careers', icon: Briefcase, label: 'Careers' },
];

export const ROLE_BADGE = {
  admin: 'badge-danger',
  hr_recruiter: 'badge-warning',
  hr_manager: 'badge-info',
  sales: 'badge-brand',
  freelancer: 'badge-info',
  other: 'badge-neutral',
  recruiter: 'badge-warning',
  interviewer: 'badge-info',
  readonly: 'badge-neutral',
  owner: 'badge-brand',
};

export const ROLE_LABELS = {
  owner: 'Owner',
  admin: 'Admin',
  hr_recruiter: 'HR Recruiter',
  hr_manager: 'HR Manager',
  sales: 'Sales',
  freelancer: 'Freelance Recruiter',
  other: 'Other',
  recruiter: 'Recruiter',
  interviewer: 'Interviewer',
  readonly: 'Read Only',
};

const ROLE_ACRONYMS = new Set(['hr', 'sso', 'api', 'spoc', 'ats', 'ceo', 'cto', 'cfo', 'coo']);

/** Display label for system/custom role keys (e.g. hr_manager → HR Manager). */
export function formatRoleLabel(role) {
  if (role == null || role === '') return 'Team member';
  const key = String(role).trim();
  const mapped = ROLE_LABELS[key.toLowerCase()];
  if (mapped) return mapped;

  return key
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      if (ROLE_ACRONYMS.has(lower)) return lower.toUpperCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

export const dateFormatSelectOptions = DATE_FORMAT_OPTIONS.map((d) => ({ ...d, icon: Calendar }));

export function buildTimezoneOptions(extraTz) {
  const base = TIMEZONE_OPTIONS.map((t) => ({ ...t, icon: Globe }));
  if (extraTz && !base.some((t) => t.value === extraTz)) {
    base.unshift({
      value: extraTz,
      label: extraTz,
      description: 'Detected on this device',
      icon: Globe,
    });
  }
  return base;
}
