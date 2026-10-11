import { Inbox, Mail, Star, CheckCircle2, Layers } from 'lucide-react';

export const TYPES = {
  query: 'Guidance',
  issue: 'Issue',
  feedback: 'Feedback',
  feature: 'Feature',
};

export const STATUS = {
  open: { label: 'Open', className: 'badge-warning' },
  in_progress: { label: 'In progress', className: 'badge-info' },
  resolved: { label: 'Resolved', className: 'badge-success' },
};

export const FOLDERS = [
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'unread', label: 'Unread', icon: Mail },
  { id: 'starred', label: 'Starred', icon: Star },
  { id: 'resolved', label: 'Resolved', icon: CheckCircle2 },
  { id: 'all', label: 'All', icon: Layers },
];

export const COMPANY_ROLES = ['owner', 'admin', 'hr_manager', 'hr_recruiter', 'recruiter', 'sales'];

export function relativeTime(value) {
  if (!value) return '';
  const mins = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '•';
}
