import {
  Mail, Briefcase, Phone, XCircle, UserCheck, FileCheck, Sparkles, Megaphone
} from 'lucide-react';
import API_URL from '../../config';

export const BASE = API_URL;

export const TPL_TOUR_KEY = 'skillnix_tour_email_templates_v1';
export const TPL_TOUR_STEPS = [
  {
    title: 'Email Templates',
    body: 'Reusable emails for hiring, interviews, offers, and more. Click personalization tags — no coding.',
  },
  {
    target: '[data-tour="tpl-filters"]',
    title: 'Find templates',
    body: 'Search by name or filter by category (Interview, Rejection, Onboarding…).',
    placement: 'bottom',
  },
  {
    target: '[data-tour="tpl-catalog"]',
    title: 'Your templates',
    body: 'Preview with sample data, edit, duplicate, or delete. Defaults stay protected.',
    placement: 'top',
  },
  {
    target: '[data-tour="tpl-create"]',
    title: 'Create template',
    body: 'Write subject and body, then click tags like Candidate name to personalize.',
    placement: 'bottom',
  },
];

export const CATEGORY_META = {
  hiring:     { label: 'Hiring Drive', icon: Briefcase, bg: 'bg-brand-50',  text: 'text-brand-700',  badge: 'bg-brand-100 text-brand-700 border-brand-200' },
  interview:  { label: 'Interview',    icon: Phone,     bg: 'bg-cyan-50',    text: 'text-cyan-700',   badge: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  rejection:  { label: 'Rejection',    icon: XCircle,   bg: 'bg-red-50',     text: 'text-red-700',    badge: 'bg-red-100 text-red-700 border-red-200' },
  onboarding: { label: 'Onboarding',   icon: UserCheck, bg: 'bg-emerald-50', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  document:   { label: 'Document',     icon: FileCheck, bg: 'bg-amber-50',   text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  marketing:  { label: 'Marketing',    icon: Megaphone, bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', badge: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200' },
  custom:     { label: 'Custom',       icon: Sparkles,  bg: 'bg-violet-50',  text: 'text-violet-700', badge: 'bg-violet-100 text-violet-700 border-violet-200' },
};

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_META).map(([value, meta]) => ({
  value,
  label: meta.label,
  icon: meta.icon,
}));

export const FILTER_OPTIONS = [
  { value: 'all', label: 'All categories', icon: Mail },
  ...CATEGORY_OPTIONS,
];

export const VARIABLE_OPTIONS = [
  { key: 'candidateName', label: 'Candidate name', example: 'Priya Sharma' },
  { key: 'position', label: 'Position', example: 'Full Stack Developer' },
  { key: 'company', label: 'Company', example: 'Skillnix Recruitment Services' },
  { key: 'ctc', label: 'CTC / Salary', example: 'Up to 4 LPA' },
  { key: 'experience', label: 'Experience', example: 'Minimum 1 year' },
  { key: 'location', label: 'Location', example: 'Delhi, Gurgaon' },
  { key: 'date', label: 'Date', example: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) },
  { key: 'time', label: 'Time', example: '10:00 AM', isTime: true },
  { key: 'venue', label: 'Venue', example: 'Shyampur, Rishikesh' },
  { key: 'spoc', label: 'SPOC name', example: 'Mr. XYZ' },
  { key: 'subscribeLink', label: 'Subscribe URL', example: 'https://yoursite.com/subscribe' },
  { key: 'unsubscribeLink', label: 'Unsubscribe link', example: '#unsubscribe' },
];

export const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? '00' : '30';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return { value: `${String(h).padStart(2, '0')}:${m}`, label: `${h12}:${m} ${ampm}` };
});
