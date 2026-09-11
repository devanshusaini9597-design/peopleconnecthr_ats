/** Freelancer desk stats — company-identical KPI stage cards from desk candidates. */

/** Submission board stages (My Pipeline), separate from ATS status cards. */
export const SUB_STAGES = [
  { key: 'submitted', label: 'Submitted', stage: 'Submitted', color: 'bg-sky-500' },
  { key: 'reviewing', label: 'Reviewing', stage: 'Reviewing', color: 'bg-amber-500' },
  { key: 'shortlisted', label: 'Shortlisting', stage: 'Shortlisting', color: 'bg-emerald-500' },
  { key: 'selection', label: 'Selection', stage: 'Selection', color: 'bg-violet-500' },
  { key: 'joined', label: 'Joined', stage: 'Joined', color: 'bg-teal-500' },
  { key: 'rejected', label: 'Rejected', stage: 'Rejected', color: 'bg-red-400' },
];

/** Same default order company dashboard uses when org stages are not loaded. */
export const COMPANY_STAGE_ORDER = [
  'Applied',
  'Screening / Pending',
  'Turn Up',
  'Shortlisted',
  'Offer',
  'Hired',
  'Joined',
  'Dropped',
  'Screen Reject',
  'Interview Reject',
  'Rejected',
];

const PIPELINE_BAR_COLORS = {
  Applied: 'bg-sky-500',
  'Screening / Pending': 'bg-indigo-500',
  Screening: 'bg-amber-500',
  'Turn Up': 'bg-orange-500',
  Interview: 'bg-brand-500',
  Shortlisted: 'bg-violet-500',
  Offer: 'bg-fuchsia-500',
  Hired: 'bg-emerald-500',
  Joined: 'bg-teal-500',
  Dropped: 'bg-stone-400',
  'Screen Reject': 'bg-sky-600',
  'Interview Reject': 'bg-orange-500',
  Rejected: 'bg-red-400',
};

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function last7Days() {
  const days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = startOfDay(new Date());
    d.setDate(d.getDate() - i);
    days.push({
      date: d.toISOString().slice(0, 10),
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      added: 0,
      submitted: 0,
    });
  }
  return days;
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function titleCaseStatus(value) {
  const raw = String(value || '').trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  if (!raw) return '';
  return raw.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Fold candidate.status into company dashboard stage labels. */
export function canonDeskStatus(raw) {
  const key = String(raw || '').trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').toUpperCase();
  if (!key) return 'Applied';
  const map = {
    APPLIED: 'Applied',
    SCREENING: 'Screening / Pending',
    'SCREENING / PENDING': 'Screening / Pending',
    'PENDING REVIEW': 'Screening / Pending',
    PENDING: 'Screening / Pending',
    'TURN UP': 'Turn Up',
    TURNUP: 'Turn Up',
    INTERVIEW: 'Interview',
    SHORTLISTED: 'Shortlisted',
    SHORTLISTING: 'Shortlisted',
    SELECTION: 'Shortlisted',
    OFFER: 'Offer',
    HIRED: 'Hired',
    JOINED: 'Joined',
    DROPPED: 'Dropped',
    'SCREEN REJECT': 'Screen Reject',
    'INTERVIEW REJECT': 'Interview Reject',
    REJECTED: 'Rejected',
    SUBMITTED: 'Applied',
    REVIEWING: 'Screening / Pending',
  };
  if (map[key]) return map[key];
  return titleCaseStatus(key) || 'Applied';
}

function countBySubmissionStatus(submissions = []) {
  const byStatus = {
    submitted: 0,
    reviewing: 0,
    shortlisted: 0,
    selection: 0,
    joined: 0,
    rejected: 0,
  };
  for (const row of submissions) {
    const key = String(row?.status || '').toLowerCase().trim();
    if (byStatus[key] !== undefined) byStatus[key] += 1;
  }
  return byStatus;
}

function foldCandidateStages(candidates = []) {
  const pipeline = {};
  for (const c of candidates) {
    const stage = canonDeskStatus(c?.status);
    pipeline[stage] = (pipeline[stage] || 0) + 1;
  }
  return pipeline;
}

function buildCompanyStyleStatusCards(pipeline = {}, preferredOrder = COMPANY_STAGE_ORDER) {
  const seen = new Set();
  const list = [];
  const order = Array.isArray(preferredOrder) && preferredOrder.length ? preferredOrder : COMPANY_STAGE_ORDER;
  for (const stage of order) {
    if (seen.has(stage)) continue;
    seen.add(stage);
    list.push({ stage, count: pipeline[stage] || 0 });
  }
  // Include any extra live stages with counts
  Object.keys(pipeline)
    .sort()
    .forEach((stage) => {
      if (seen.has(stage) || !(pipeline[stage] > 0)) return;
      seen.add(stage);
      list.push({ stage, count: pipeline[stage] });
    });
  return list;
}

/**
 * Build freelancer dashboard metrics with company-identical KPI cards.
 * Stage cards come from desk candidate statuses (same look as company dashboard).
 * Submission pipeline remains available for the lower "Hiring Pipeline" board section.
 */
export function buildFreelancerStats({ desk = {}, candidates = [], submissions = [] }) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const thisMonthFromList = candidates.filter((c) => c.createdAt && new Date(c.createdAt) >= startOfMonth).length;
  const lastMonthFromList = candidates.filter((c) => {
    if (!c.createdAt) return false;
    const t = new Date(c.createdAt);
    return t >= startOfLastMonth && t <= endOfLastMonth;
  }).length;

  const totalCandidates = Math.max(num(desk.totalCandidates), candidates.length);
  const thisMonth = desk.thisMonth != null ? num(desk.thisMonth) : thisMonthFromList;
  const lastMonth = desk.lastMonth != null ? num(desk.lastMonth) : lastMonthFromList;
  const candidateTrend = desk.candidateTrend != null
    ? num(desk.candidateTrend)
    : (lastMonth > 0
      ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100)
      : (thisMonth > 0 ? 100 : 0));

  const byStatus = countBySubmissionStatus(submissions);
  const mandateCounts = new Map();
  let slaBreachesFromRows = 0;
  for (const row of submissions) {
    if (row?.slaBreached) slaBreachesFromRows += 1;
    const job = row.jobId && typeof row.jobId === 'object' ? row.jobId : {};
    const title = job.title || job.role || job.jobCode;
    if (title) mandateCounts.set(title, (mandateCounts.get(title) || 0) + 1);
  }

  const submittedTotal = submissions.length || num(desk.submittedTotal);
  const shortlistedCount = (byStatus.shortlisted || 0) + (byStatus.selection || 0) + (byStatus.joined || 0);
  const shortlisted = desk.shortlisted != null && submissions.length === 0
    ? num(desk.shortlisted)
    : shortlistedCount;
  const rejected = byStatus.rejected || num(desk.rejected);
  const awaitingReview = (byStatus.submitted || 0) + (byStatus.reviewing || 0);
  const conversionRate = submittedTotal > 0
    ? Math.round((shortlisted / submittedTotal) * 100)
    : num(desk.conversionRate);
  const rejectionRate = submittedTotal > 0
    ? Math.round((rejected / submittedTotal) * 100)
    : num(desk.rejectionRate);
  const slaBreaches = desk.slaBreaches != null ? num(desk.slaBreaches) : slaBreachesFromRows;

  const positionCounts = new Map();
  for (const c of candidates) {
    const pos = String(c.position || '').trim();
    if (pos) positionCounts.set(pos, (positionCounts.get(pos) || 0) + 1);
  }

  const days = last7Days();
  const addedByDay = new Map();
  for (const c of candidates) {
    if (!c.createdAt) continue;
    const key = new Date(c.createdAt).toISOString().slice(0, 10);
    addedByDay.set(key, (addedByDay.get(key) || 0) + 1);
  }
  const submittedByDay = new Map();
  for (const row of submissions) {
    if (!row.createdAt) continue;
    const key = new Date(row.createdAt).toISOString().slice(0, 10);
    submittedByDay.set(key, (submittedByDay.get(key) || 0) + 1);
  }
  const daily = days.map((d) => ({
    ...d,
    added: addedByDay.get(d.date) || 0,
    submitted: submittedByDay.get(d.date) || 0,
  }));

  // Prefer server desk statusCards (org pipeline stages, same as company KPIs)
  const listPipeline = foldCandidateStages(candidates);
  const preferredOrder = Array.isArray(desk.pipelineStages) && desk.pipelineStages.length
    ? desk.pipelineStages
    : COMPANY_STAGE_ORDER;
  const statusCards = Array.isArray(desk.statusCards) && desk.statusCards.length
    ? desk.statusCards.map((row) => ({ stage: row.stage, count: num(row.count) }))
    : buildCompanyStyleStatusCards(listPipeline, preferredOrder);

  // Hiring Pipeline bars still use submission board stages
  const submissionPipeline = SUB_STAGES.map((stage) => ({
    key: stage.key,
    label: stage.label,
    stage: stage.stage,
    color: stage.color,
    count: byStatus[stage.key] || 0,
  }));

  return {
    totalCandidates,
    totalCandidatesAllTime: totalCandidates,
    thisMonth,
    lastMonth,
    candidateTrend,
    openMandates: (desk.mandates || []).length || num(desk.openMandates),
    awaitingReview: awaitingReview || num(desk.awaitingReview),
    shortlisted,
    rejected,
    submittedTotal,
    conversionRate,
    rejectionRate,
    slaBreaches,
    byStatus,
    // Company KPI cards use statusCards; lower bars use submission pipeline
    pipeline: submissionPipeline,
    statusCards,
    candidatePipeline: desk.candidatePipeline || listPipeline,
    daily,
    topPositions: [...positionCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([position, count]) => ({ position, count })),
    topMandates: [...mandateCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([mandate, count]) => ({ mandate, count })),
    mandates: desk.mandates || [],
    recentSubmissions: (submissions.length ? submissions : (desk.recentSubmissions || [])).slice(0, 8),
    recentCandidates: (candidates.length ? candidates : (desk.recentCandidates || [])).slice(0, 6),
    // Fields DashboardKpis expects
    scope: 'employee',
    atsView: 'mine',
    periodLabel: 'This Month',
  };
}

export { PIPELINE_BAR_COLORS };
