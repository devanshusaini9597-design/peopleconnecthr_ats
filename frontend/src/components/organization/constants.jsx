import {
  Building2, Settings, Users, Briefcase, Shield, Eye, UserCog, ListChecks, Calendar, Globe,
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
  { value: 'recruiter', label: 'Recruiter', description: 'Hiring workflows', icon: Briefcase },
  { value: 'interviewer', label: 'Interviewer', description: 'Interview schedule', icon: UserCog },
  { value: 'readonly', label: 'Read Only', description: 'View-only access', icon: Eye },
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
  recruiter: 'badge-warning',
  interviewer: 'badge-info',
  readonly: 'badge-neutral',
  owner: 'badge-brand',
};

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
