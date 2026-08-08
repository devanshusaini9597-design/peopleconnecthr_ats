import { Briefcase, FileSignature } from 'lucide-react';

export const APPR_TOUR_KEY = 'skillnix_tour_approvals_v1';

export const APPR_TOUR_STEPS = [
  {
    title: 'Approval workflows',
    body: 'Define who must sign off on job requisitions and offers — then act on pending requests here.',
  },
  {
    target: '[data-tour="appr-workflows"]',
    title: 'Workflows',
    body: 'Create multi-step approval chains for job reqs or offers.',
    placement: 'top',
  },
  {
    target: '[data-tour="appr-pending"]',
    title: 'Pending approvals',
    body: 'Approve or reject items waiting on you.',
    placement: 'top',
  },
  {
    target: '[data-tour="appr-create"]',
    title: 'New workflow',
    body: 'Start a new approval workflow from here.',
    placement: 'bottom',
  },
];

export const ENTITY_TYPE_OPTIONS = [
  { value: 'job_req', label: 'Job requisition', description: 'Multi-step approval for new reqs', icon: Briefcase },
  { value: 'offer', label: 'Offer', description: 'Approval before sending offers', icon: FileSignature },
];

export const OFFER_MERGE_TAGS = [
  { token: '{{candidate.name}}', label: 'Candidate name' },
  { token: '{{job.title}}', label: 'Job title' },
  { token: '{{offer.salary}}', label: 'Salary' },
];

export const EMPTY_WORKFLOW_FORM = {
  name: '',
  entityType: 'job_req',
  steps: [{ order: 0, name: 'Manager approval', approverRole: 'admin' }],
};

export function insertAtCursor(el, value, token) {
  if (!el) return `${value || ''}${token}`;
  const start = el.selectionStart ?? String(value || '').length;
  const end = el.selectionEnd ?? start;
  const next = `${String(value || '').slice(0, start)}${token}${String(value || '').slice(end)}`;
  requestAnimationFrame(() => {
    try {
      const pos = start + token.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    } catch { /* ignore */ }
  });
  return next;
}
