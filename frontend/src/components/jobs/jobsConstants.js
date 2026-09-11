import { INDIAN_CITIES } from '../../data/indianCities';

export const JOBS_TOUR_KEY = 'skillnix_tour_jobs_v1';
export const JOBS_TOUR_STEPS = [
  {
    title: 'Job openings',
    body: 'Create roles, filter by status, and reuse JD templates — without leaving this page.',
  },
  {
    target: '[data-tour="jobs-tip"]',
    title: 'Quick tip',
    body: 'Use JD Library for templates, then Post New Job. Press ? anytime to reopen this tour.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="jobs-actions"]',
    title: 'Create & templates',
    body: 'Open the JD Library or post a new requisition from here.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="jobs-filters"]',
    title: 'Search & filters',
    body: 'Search by role, location, or skills, and filter by Open, On Hold, or Closed.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="jobs-list"]',
    title: 'Job cards',
    body: 'Use the compact edit, share, and delete actions on each card. Status lives in the overflow menu.',
    placement: 'top',
  },
];

export const STATUS_OPTIONS = [
  { value: 'Open', label: 'OPEN' },
  { value: 'On Hold', label: 'ON HOLD' },
  { value: 'Closed', label: 'CLOSED' },
  { value: 'Draft', label: 'DRAFT' },
];

export const FILTER_OPTIONS = [
  { value: 'All', label: 'All statuses' },
  { value: 'Draft', label: 'Draft' },
  { value: 'Open', label: 'Open' },
  { value: 'On Hold', label: 'On Hold' },
  { value: 'Closed', label: 'Closed' },
];

export const JOB_BOARD_OPTIONS = [
  { value: 'indeed_feed', label: 'Indeed feed', description: 'XML / feed sync' },
  { value: 'webhook', label: 'Webhook', description: 'POST to configured endpoint' },
];

export const STATUS_STYLES = {
  Open: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'On Hold': 'bg-amber-50 text-amber-700 border-amber-200',
  Closed: 'bg-stone-100 text-stone-600 border-stone-200',
  Draft: 'bg-sky-50 text-sky-700 border-sky-200',
  Cancelled: 'bg-red-50 text-red-700 border-red-200',
};
export const DOT_STYLES = {
  Open: 'bg-emerald-500',
  'On Hold': 'bg-amber-500',
  Closed: 'bg-stone-400',
  Draft: 'bg-sky-500',
  Cancelled: 'bg-red-500',
};

export const EMPLOYMENT_OPTIONS = [
  { value: 'full_time', label: 'FULL-TIME' },
  { value: 'part_time', label: 'PART-TIME' },
  { value: 'contract', label: 'CONTRACT' },
  { value: 'internship', label: 'INTERNSHIP' },
  { value: 'freelance', label: 'FREELANCE' },
];

export const EMPLOYMENT_LABELS = Object.fromEntries(EMPLOYMENT_OPTIONS.map((o) => [o.value, o.label]));

export const GRADE_STARTERS = [
  'EXECUTIVE', 'SENIOR EXECUTIVE', 'ASSISTANT MANAGER', 'MANAGER', 'SENIOR - MANAGER',
  'ASSISTANT BRANCH HEAD', 'BRANCH HEAD', 'AVP', 'VP',
];

export const INDUSTRY_STARTERS = [
  'LIFE INSURANCE', 'GENERAL INSURANCE', 'HEALTH INSURANCE', 'BFSI', 'IT / SOFTWARE',
  'ITES / BPO', 'MANUFACTURING', 'PHARMA / HEALTHCARE', 'FMCG', 'RETAIL',
  'REAL ESTATE', 'EDUCATION', 'TELECOM',
];

export const LOCATION_STARTERS = INDIAN_CITIES;

export const EXPERIENCE_STARTERS = [
  'FRESHER', '0-1 YEARS', '1-2 YEARS', '2-3 YEARS', '3-5 YEARS', '5-8 YEARS',
  '8-12 YEARS', '12+ YEARS', 'MINIMUM 2 YEARS OF RELEVANT EXPERIENCE',
];

export const GRADE_OPTIONS = GRADE_STARTERS.map((name) => ({ value: name, label: name }));
export const INDUSTRY_OPTIONS = INDUSTRY_STARTERS;

export function employmentLabel(type) {
  return EMPLOYMENT_LABELS[type] || String(type || '').replace(/_/g, ' ') || '';
}

export const initialForm = {
  role: '',
  jobCode: '',
  customJobCode: false,
  grade: '',
  clientName: '',
  industry: '',
  location: '',
  locations: [],
  ctc: '',
  experience: '',
  employmentType: 'full_time',
  openings: 1,
  priority: 'medium',
  skills: [],
  summary: '',
  responsibilitiesText: '',
  requirementsText: '',
  preferredProfile: '',
  description: '',
  hiringManagers: [],
  status: 'Open',
  spocName: '',
  spocContact: '',
  spocEmail: '',
  internalNotes: '',
  notifyEmail: true,
};

export function linesToList(raw) {
  return String(raw || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s*•\-–]+/, '').trim())
    .filter(Boolean);
}

export function listToLines(arr) {
  if (Array.isArray(arr)) return arr.filter(Boolean).join('\n');
  return String(arr || '');
}

export function looksLikeHtml(str = '') {
  return /<[a-z][\s\S]*>/i.test(String(str));
}

export function stripHtml(html = '') {
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

export function htmlToList(raw) {
  const html = String(raw || '');
  const lis = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((m) => stripHtml(m[1]))
    .filter(Boolean);
  if (lis.length) return lis;
  return linesToList(looksLikeHtml(html) ? stripHtml(html) : html);
}

export function splitLocations(...sources) {
  const out = [];
  const seen = new Set();
  for (const src of sources) {
    const parts = Array.isArray(src) ? src : String(src || '').split(/[,;\n]+/);
    for (const part of parts) {
      const value = String(part || '').trim().toUpperCase();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      out.push(value);
    }
  }
  return out;
}

function injectRich(value) {
  if (!value) return '';
  if (looksLikeHtml(value)) return String(value);
  return `<p>${esc(value).replace(/\n/g, '<br/>')}</p>`;
}

function locationLine(form) {
  const locs = splitLocations(form.locations, form.location);
  return locs.length ? locs.join(', ') : String(form.location || '').trim();
}

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function bulletsHtml(items) {
  if (!items.length) return '';
  return `<ul>${items.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`;
}

/** Canonical HTML JD for careers page + stored description. */
export function composeJobDescriptionHtml(form) {
  const title = String(form.role || '').trim();
  const meta = [
    title ? `<p><strong>Job Title:</strong> ${esc(title)}${form.grade ? ` , Grade ${esc(form.grade)}` : ''}</p>` : '',
    form.clientName ? `<p><strong>Client Name:</strong> ${esc(form.clientName)}</p>` : '',
    form.industry ? `<p><strong>Industry:</strong> ${esc(form.industry)}</p>` : '',
    form.ctc ? `<p><strong>CTC:</strong> ${esc(form.ctc)}</p>` : '',
    form.experience ? `<p><strong>Experience:</strong> ${esc(form.experience)}</p>` : '',
    form.employmentType ? `<p><strong>Employment Type:</strong> ${esc(EMPLOYMENT_LABELS[form.employmentType] || form.employmentType)}</p>` : '',
    locationLine(form) ? `<p><strong>Locations:</strong> ${esc(locationLine(form))}</p>` : '',
  ].filter(Boolean).join('');

  const responsibilitiesHtml = looksLikeHtml(form.responsibilitiesText)
    ? form.responsibilitiesText
    : bulletsHtml(htmlToList(form.responsibilitiesText || form.responsibilities));
  const requirementsHtml = looksLikeHtml(form.requirementsText)
    ? form.requirementsText
    : bulletsHtml(htmlToList(form.requirementsText || form.requirements));
  const sections = [
    meta,
    form.summary ? `<h3>Job Summary</h3>${injectRich(form.summary)}` : '',
    htmlToList(form.responsibilitiesText || form.responsibilities).length || looksLikeHtml(form.responsibilitiesText)
      ? `<h3>Key Responsibilities</h3>${responsibilitiesHtml}` : '',
    htmlToList(form.requirementsText || form.requirements).length || looksLikeHtml(form.requirementsText)
      ? `<h3>Candidate Requirements</h3>${requirementsHtml}` : '',
    form.ctc ? `<h3>Compensation</h3><p><strong>CTC: ${esc(form.ctc)}</strong>, depending on experience, performance, and current compensation.</p>` : '',
    form.preferredProfile ? `<h3>Preferred Candidate Profile</h3>${injectRich(form.preferredProfile)}` : '',
  ].filter(Boolean);

  return sections.join('\n');
}

/** Plain-text JD matching the agency format used with clients. */
export function composeJobDescriptionText(form) {
  const title = String(form.role || '').trim() || 'Untitled role';
  const type = employmentLabel(form.employmentType);
  const lines = [title, ''];
  lines.push(`Job Title: ${title}${form.grade ? ` , Grade ${form.grade}` : ''}`);
  if (form.clientName) lines.push(`Client Name - ${form.clientName}`);
  if (form.industry) lines.push(`Industry: ${form.industry}`);
  if (form.ctc) lines.push(`CTC: ${form.ctc}`);
  if (form.experience) lines.push(`Experience: ${form.experience}`);
  if (type) lines.push(`Employment Type: ${type}`);
  const locs = locationLine(form);
  if (locs) lines.push(`Locations: ${locs}`);

  const pushSection = (heading, body) => {
    if (!body) return;
    lines.push('', `## ${heading}`, '', body);
  };

  pushSection('Job Summary', stripHtml(form.summary || '').trim());
  const responsibilities = htmlToList(form.responsibilitiesText || form.responsibilities);
  if (responsibilities.length) {
    lines.push('', '## Key Responsibilities', '', ...responsibilities.map((item) => `* ${item}`));
  }
  const requirements = htmlToList(form.requirementsText || form.requirements);
  if (requirements.length) {
    lines.push('', '## Candidate Requirements', '', ...requirements.map((item) => `* ${item}`));
  }
  if (form.ctc) {
    lines.push('', '## Compensation', '', `CTC: ${form.ctc}, depending on experience, performance, and current compensation.`);
  }
  pushSection('Preferred Candidate Profile', stripHtml(form.preferredProfile || '').trim());
  return lines.filter((line, i, arr) => !(line === '' && arr[i - 1] === '')).join('\n').trim();
}

export function jobFromRecord(job) {
  const hasStructured = Boolean(
    job.summary || job.grade || job.clientName || job.industry
    || (job.responsibilities || []).length || (job.requirements || []).length
    || job.preferredProfile
  );
  const locations = splitLocations(job.locations, job.location);
  return {
    ...initialForm,
    role: String(job.role || job.title || '').toUpperCase(),
    jobCode: job.jobCode || '',
    grade: String(job.grade || '').toUpperCase(),
    clientName: String(job.clientName || '').toUpperCase(),
    industry: String(job.industry || '').toUpperCase(),
    location: locations.join(', '),
    locations,
    ctc: String(job.ctc || '').toUpperCase(),
    experience: String(job.experience || '').toUpperCase(),
    employmentType: job.employmentType || 'full_time',
    openings: job.openings || 1,
    priority: String(job.priority || 'medium').toLowerCase() === 'urgent' ? 'urgent' : (job.priority || 'medium'),
    skills: (job.skills || []).map((s) => String(s).toUpperCase()),
    summary: job.summary || (!hasStructured ? String(job.description || '') : ''),
    responsibilitiesText: job.responsibilitiesHtml || listToLines(job.responsibilities),
    requirementsText: job.requirementsHtml || listToLines(job.requirements),
    preferredProfile: job.preferredProfile || '',
    description: hasStructured ? '' : (job.description || ''),
    hiringManagers: job.hiringManagers || [],
    status: job.status || 'Open',
    spocName: String(job.spocName || '').toUpperCase(),
    spocContact: String(job.spocContact || ''),
    spocEmail: String(job.spocEmail || ''),
    internalNotes: job.internalNotes || '',
  };
}
