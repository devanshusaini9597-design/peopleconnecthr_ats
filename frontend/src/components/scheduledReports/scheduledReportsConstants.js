import {
  FileSpreadsheet, FileText,
} from 'lucide-react';

export const SCHED_TOUR_KEY = 'skillnix_tour_scheduled_reports_v1';
export const SCHED_TOUR_STEPS = [
  {
    title: 'Scheduled Reports',
    body: 'Automate recurring emailed reports — pick the type, cadence, and who should receive them.',
  },
  {
    target: '[data-tour="sched-tip"]',
    title: 'Tips',
    body: 'Create a schedule, pause or resume with the power control, and delete when you no longer need it.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="sched-filters"]',
    title: 'Find schedules',
    body: 'Search by name or report type, and filter by Active or Paused.',
    placement: 'bottom',
  },
];

export const REPORT_TYPES = [
  { id: 'recruitment-summary', label: 'Recruitment Summary', description: 'Overall hiring snapshot' },
  { id: 'source-performance', label: 'Source Performance', description: 'Channel ROI' },
  { id: 'position-report', label: 'Position-wise Report', description: 'By role' },
  { id: 'client-report', label: 'Client Report', description: 'By client' },
  { id: 'pipeline-status', label: 'Pipeline Status', description: 'Stage breakdown' },
];

export const FORMAT_OPTIONS = [
  { value: 'xlsx', label: 'Excel (.xlsx)', description: 'Spreadsheet download', icon: FileSpreadsheet },
  { value: 'pdf', label: 'PDF', description: 'Document download', icon: FileText },
];

export const RANGE_OPTIONS = [
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'This month' },
  { value: 'quarter', label: 'This quarter' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
];

export const FREQ_OPTIONS = [
  { value: 'daily', label: 'Daily', description: 'Every day' },
  { value: 'weekly', label: 'Weekly', description: 'Every 7 days' },
  { value: 'monthly', label: 'Monthly', description: 'Every month' },
];

export const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
];

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const emptyForm = {
  name: '',
  reportType: 'recruitment-summary',
  format: 'xlsx',
  dateRange: 'month',
  frequency: 'weekly',
  recipients: [],
};

export function reportLabel(type) {
  return REPORT_TYPES.find((r) => r.id === type)?.label || type;
}
