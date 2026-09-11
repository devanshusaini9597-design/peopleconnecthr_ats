/**
 * Shared company ATS stage helpers — freelancer pipeline + company freelance review
 * must use the same stage vocabulary from /api/statuses.
 */
import {
  Briefcase, Calendar, CheckCircle2, Inbox, Layers, Search, UserCheck, BadgeCheck, XCircle,
} from 'lucide-react';

export const STAGE_STYLE = [
  { bar: 'bg-sky-500', soft: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-800', chip: 'bg-sky-50 text-sky-800 border-sky-200' },
  { bar: 'bg-indigo-500', soft: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-800', chip: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
  { bar: 'bg-amber-500', soft: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900', chip: 'bg-amber-50 text-amber-900 border-amber-200' },
  { bar: 'bg-orange-500', soft: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-900', chip: 'bg-orange-50 text-orange-900 border-orange-200' },
  { bar: 'bg-violet-500', soft: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-800', chip: 'bg-violet-50 text-violet-800 border-violet-200' },
  { bar: 'bg-fuchsia-500', soft: 'bg-fuchsia-50', border: 'border-fuchsia-200', text: 'text-fuchsia-800', chip: 'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200' },
  { bar: 'bg-emerald-500', soft: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', chip: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  { bar: 'bg-teal-500', soft: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-800', chip: 'bg-teal-50 text-teal-800 border-teal-200' },
  { bar: 'bg-stone-400', soft: 'bg-stone-50', border: 'border-stone-200', text: 'text-stone-700', chip: 'bg-stone-50 text-stone-700 border-stone-200' },
  { bar: 'bg-red-500', soft: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', chip: 'bg-red-50 text-red-800 border-red-200' },
];

export const DEFAULT_COMPANY_STAGES = [
  'Applied',
  'Screening',
  'Interview',
  'Offer',
  'Hired',
  'Joined',
  'Rejected',
  'Dropped',
];

/** Submission handoff enum → company ATS label fallback */
export const SUB_TO_COMPANY = {
  submitted: 'Applied',
  reviewing: 'Screening',
  shortlisted: 'Shortlisted',
  selection: 'Offer',
  joined: 'Joined',
  rejected: 'Rejected',
};

export function titleCaseStatus(value) {
  const raw = String(value || '').trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  if (!raw) return '';
  return raw.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function canonLabel(value) {
  const key = String(value || '').trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').toUpperCase();
  if (!key) return '';
  const map = {
    APPLIED: 'Applied',
    SCREENING: 'Screening',
    'SCREENING / PENDING': 'Screening / Pending',
    'PENDING REVIEW': 'Screening / Pending',
    PENDING: 'Screening / Pending',
    INTERVIEW: 'Interview',
    SHORTLISTED: 'Shortlisted',
    SHORTLISTING: 'Shortlisted',
    SELECTION: 'Offer',
    SELECTED: 'Offer',
    OFFER: 'Offer',
    HIRED: 'Hired',
    JOINED: 'Joined',
    REJECTED: 'Rejected',
    DROPPED: 'Dropped',
    'TURN UP': 'Turn Up',
    'SCREEN REJECT': 'Screen Reject',
    'INTERVIEW REJECT': 'Interview Reject',
    SUBMITTED: 'Applied',
    REVIEWING: 'Screening',
  };
  if (map[key]) return map[key];
  return titleCaseStatus(key);
}

export function stageIcon(label) {
  const k = String(label || '').toUpperCase();
  if (k.includes('REJECT') || k.includes('DROP')) return XCircle;
  if (k.includes('JOIN')) return BadgeCheck;
  if (k.includes('HIRE')) return UserCheck;
  if (k.includes('OFFER') || k.includes('SELECT')) return Briefcase;
  if (k.includes('INTERVIEW')) return Calendar;
  if (k.includes('SHORT')) return CheckCircle2;
  if (k.includes('SCREEN') || k.includes('PENDING') || k.includes('TURN')) return Search;
  if (k.includes('APPLIED') || k.includes('SOURCED')) return Inbox;
  return Layers;
}

export function buildStageDefs(labels) {
  const list = (Array.isArray(labels) && labels.length ? labels : DEFAULT_COMPANY_STAGES)
    .map((s) => canonLabel(s) || String(s).trim())
    .filter(Boolean);
  const seen = new Set();
  const unique = [];
  for (const s of list) {
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(s);
  }
  for (const must of ['Rejected', 'Dropped']) {
    if (!seen.has(must.toLowerCase())) {
      unique.push(must);
      seen.add(must.toLowerCase());
    }
  }
  return unique.map((label, i) => {
    const style = STAGE_STYLE[i % STAGE_STYLE.length];
    const isReject = /reject|drop/i.test(label);
    return {
      id: label,
      label,
      hint: 'Company ATS stage',
      icon: stageIcon(label),
      bar: isReject ? 'bg-red-500' : style.bar,
      soft: isReject ? 'bg-red-50' : style.soft,
      border: isReject ? 'border-red-200' : style.border,
      text: isReject ? 'text-red-800' : style.text,
      chip: isReject ? 'bg-red-50 text-red-800 border-red-200' : style.chip,
      terminal: isReject,
    };
  });
}

/** Resolve row to a company stage id present in stages. */
export function resolveCompanyStage(row, stages) {
  const ids = (stages || []).map((s) => s.id);
  const match = (label) => {
    const want = canonLabel(label);
    if (!want) return null;
    const exact = ids.find((id) => id.toLowerCase() === want.toLowerCase());
    if (exact) return exact;
    const soft = ids.find((id) => {
      const a = id.toLowerCase();
      const b = want.toLowerCase();
      return a.includes(b) || b.includes(a.split(' / ')[0]);
    });
    return soft || null;
  };

  const cand = row?.candidateId && typeof row.candidateId === 'object' ? row.candidateId : {};
  const fromCand = match(cand.status);
  if (fromCand) return fromCand;

  const sub = String(row?.status || '').toLowerCase();
  const mapped = SUB_TO_COMPANY[sub] || 'Applied';
  return match(mapped) || ids[0] || 'Applied';
}

/** Map a company ATS stage label → FreelancerSubmission.status enum */
export function companyStageToSubmissionStatus(label) {
  const k = String(label || '').trim().toUpperCase().replace(/[_-]+/g, ' ');
  if (!k) return 'submitted';
  if (/REJECT|DROP|DECLIN/.test(k)) return 'rejected';
  if (/JOIN/.test(k)) return 'joined';
  if (/HIRE/.test(k)) return 'joined';
  if (/OFFER|SELECT/.test(k)) return 'selection';
  if (/SHORT/.test(k)) return 'shortlisted';
  if (/INTERVIEW|SCREEN|PENDING|TURN|REVIEW/.test(k)) return 'reviewing';
  if (/APPLIED|SOURCED|SUBMIT/.test(k)) return 'submitted';
  return 'reviewing';
}
