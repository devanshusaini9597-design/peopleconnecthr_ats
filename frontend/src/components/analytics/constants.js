import { BarChart3, ArrowUpRight, Briefcase, Building2, GitBranch } from 'lucide-react';

export const ANALYTICS_TOUR_KEY = 'skillnix_tour_analytics_v1';
export const ANALYTICS_TOUR_STEPS = [
  {
    title: 'Reports & Analytics',
    body: 'Track hiring KPIs, pipeline health, and sources — then export or share branded PDF reports.',
  },
  {
    target: '[data-tour="analytics-tip"]',
    title: 'Quick tip',
    body: 'Use Analytics for live dashboards and Export Data for PDF reports. Press ? anytime to reopen this tour.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="analytics-tabs"]',
    title: 'Views',
    body: 'Switch between the live Analytics dashboard and Export Data for report generation.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="analytics-kpis"]',
    title: 'Headline metrics',
    body: 'Click a KPI card to jump into Candidates, Applications, or Pending Review.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="analytics-charts"]',
    title: 'Trends & pipeline',
    body: 'Daily submissions and stage breakdown show where your funnel is moving.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="analytics-activity"]',
    title: 'Recent activity',
    body: 'Latest candidates at a glance. Use the view action or drag across table cells to scroll columns.',
    placement: 'top',
  },
];

export const REPORT_TYPE_OPTIONS = [
  { value: 'recruitment-summary', label: 'Recruitment Summary', description: 'Pipeline, conversion, and key hiring metrics', icon: BarChart3 },
  { value: 'source-performance', label: 'Source Performance', description: 'Channel ROI and conversion by source', icon: ArrowUpRight },
  { value: 'position-report', label: 'Position-wise Report', description: 'Applications, offers, and fill rate by role', icon: Briefcase },
  { value: 'client-report', label: 'Client Report', description: 'Client-wise pipeline and success rates', icon: Building2 },
  { value: 'pipeline-status', label: 'Pipeline Status', description: 'All candidates sorted by current stage', icon: GitBranch },
];

export const DATE_RANGE_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'Last 7 Days' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
];

export const REPORT_LABELS = {
  'recruitment-summary': 'Recruitment Summary',
  'source-performance': 'Source Performance',
  'position-report': 'Position Report',
  'client-report': 'Client Report',
  'pipeline-status': 'Pipeline Status',
};

export const DATE_RANGE_LABELS = {
  all: 'All Time', today: 'Today', yesterday: 'Yesterday', week: 'Last 7 Days',
  month: 'This Month', quarter: 'This Quarter', year: 'This Year', custom: 'Custom',
};

export const PIPELINE_COLORS = {
  Applied: '#3b82f6', Screening: '#f59e0b', Interview: '#8b5cf6',
  Offer: '#06b6d4', Hired: '#10b981', Joined: '#059669',
  Rejected: '#ef4444', Dropped: '#6b7280'
};
export const PIE_COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6b7280'];
