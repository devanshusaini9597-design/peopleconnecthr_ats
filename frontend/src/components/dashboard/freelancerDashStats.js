const SUB_STAGES = [
  { key: 'submitted', label: 'Submitted', color: 'bg-sky-500' },
  { key: 'reviewing', label: 'Reviewing', color: 'bg-amber-500' },
  { key: 'shortlisted', label: 'Shortlisting', color: 'bg-emerald-500' },
  { key: 'selection', label: 'Selection', color: 'bg-violet-500' },
  { key: 'joined', label: 'Joined', color: 'bg-teal-500' },
  { key: 'rejected', label: 'Rejected', color: 'bg-red-400' },
];

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

export function buildFreelancerStats({ desk = {}, candidates = [], submissions = [] }) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const thisMonth = candidates.filter((c) => c.createdAt && new Date(c.createdAt) >= startOfMonth).length;
  const lastMonth = candidates.filter((c) => {
    if (!c.createdAt) return false;
    const t = new Date(c.createdAt);
    return t >= startOfLastMonth && t <= endOfLastMonth;
  }).length;
  const candidateTrend = lastMonth > 0
    ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100)
    : (thisMonth > 0 ? 100 : 0);

  const byStatus = { submitted: 0, reviewing: 0, shortlisted: 0, selection: 0, joined: 0, rejected: 0 };
  const mandateCounts = new Map();
  for (const row of submissions) {
    if (byStatus[row.status] !== undefined) byStatus[row.status] += 1;
    const job = row.jobId || {};
    const title = job.title || job.role || job.jobCode;
    if (title) mandateCounts.set(title, (mandateCounts.get(title) || 0) + 1);
  }

  const submittedTotal = submissions.length;
  const shortlisted = byStatus.shortlisted || 0;
  const rejected = byStatus.rejected || 0;
  const awaitingReview = (byStatus.submitted || 0) + (byStatus.reviewing || 0);
  const conversionRate = submittedTotal > 0 ? Math.round((shortlisted / submittedTotal) * 100) : 0;
  const rejectionRate = submittedTotal > 0 ? Math.round((rejected / submittedTotal) * 100) : 0;

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

  const pipeline = SUB_STAGES.map((stage) => ({
    ...stage,
    count: byStatus[stage.key] || 0,
  }));

  return {
    totalCandidates: candidates.length || desk.totalCandidates || 0,
    thisMonth,
    lastMonth,
    candidateTrend,
    openMandates: (desk.mandates || []).length || desk.openMandates || 0,
    awaitingReview,
    shortlisted,
    rejected,
    submittedTotal,
    conversionRate,
    rejectionRate,
    pipeline,
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
    recentSubmissions: submissions.slice(0, 8),
    recentCandidates: candidates.slice(0, 6),
  };
}
