/**
 * Candidate.status is stored in BLOCK LETTERS (APPLIED) but older rows
 * and the dashboard UI use title case (Applied). Fold both into one label.
 */
const CANON = {
  APPLIED: 'Applied',
  SCREENING: 'Screening',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  HIRED: 'Hired',
  JOINED: 'Joined',
  REJECTED: 'Rejected',
  DROPPED: 'Dropped',
  INTERESTED: 'Interested',
  'INTERESTED AND SCHEDULED': 'Interested and scheduled',
  'PENDING REVIEW': 'Applied',
};

const STAGE_ORDER = [
  'Applied',
  'Screening',
  'Interview',
  'Offer',
  'Hired',
  'Joined',
  'Rejected',
  'Dropped',
];

function titleCaseStatus(value) {
  const raw = String(value || '').trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  if (!raw) return '';
  return raw
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function canonCandidateStatus(raw) {
  const key = String(raw || '').trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').toUpperCase();
  if (!key) return 'Unspecified';
  if (CANON[key]) return CANON[key];
  return titleCaseStatus(key);
}

function foldStatusCounts(rows) {
  const pipeline = {};
  for (const row of rows || []) {
    const stage = canonCandidateStatus(row?._id);
    pipeline[stage] = (pipeline[stage] || 0) + Number(row?.count || 0);
  }
  return pipeline;
}

function pipelineList(pipeline, preferredOrder, options = {}) {
  const includeZero = options.includeZero !== false;
  const ensureStages = (Array.isArray(options.ensureStages) ? options.ensureStages : [])
    .map((s) => canonCandidateStatus(s))
    .filter(Boolean);
  const fromOrg = (Array.isArray(preferredOrder) ? preferredOrder : [])
    .map((s) => canonCandidateStatus(s))
    .filter(Boolean);
  const order = fromOrg.length ? fromOrg : STAGE_ORDER;
  const seen = new Set();
  const list = [];
  for (const stage of order) {
    if (seen.has(stage)) continue;
    seen.add(stage);
    const count = pipeline[stage] || 0;
    if (!includeZero && !(count > 0)) continue;
    list.push({ stage, count });
  }
  for (const stage of ensureStages) {
    if (seen.has(stage)) continue;
    seen.add(stage);
    list.push({ stage, count: pipeline[stage] || 0 });
  }
  Object.keys(pipeline || {})
    .sort()
    .forEach((stage) => {
      if (seen.has(stage) || !(pipeline[stage] > 0)) return;
      seen.add(stage);
      list.push({ stage, count: pipeline[stage] });
    });
  return list;
}

function statusMatchValues(labels) {
  const out = [];
  for (const label of labels) {
    const s = String(label || '').trim();
    if (!s) continue;
    out.push(s, s.toUpperCase(), s.toLowerCase(), titleCaseStatus(s));
  }
  return [...new Set(out)];
}

module.exports = {
  CANON,
  STAGE_ORDER,
  canonCandidateStatus,
  foldStatusCounts,
  pipelineList,
  statusMatchValues,
  titleCaseStatus,
};
