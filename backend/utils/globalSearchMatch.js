const STOP = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'are', 'you', 'our',
  'your', 'will', 'have', 'been', 'into', 'over', 'open', 'full', 'time',
  'part', 'contract', 'years', 'year', 'the',
]);

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tokenize(value) {
  return String(value || '')
    .toLowerCase()
    .split(/[^a-z0-9+#]+/i)
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !STOP.has(w));
}

function haystack(parts = []) {
  return parts
    .flatMap((p) => (Array.isArray(p) ? p : [p]))
    .map((p) => String(p || ''))
    .join(' ');
}

function scoreOverlap(sourceText, targetText) {
  const source = new Set(tokenize(sourceText));
  if (!source.size) return 0;
  const target = tokenize(targetText);
  if (!target.length) return 0;
  let hits = 0;
  for (const token of target) {
    if (source.has(token)) hits += 1;
  }
  return hits;
}

function jobFitText(job = {}) {
  return haystack([
    job.title,
    job.role,
    job.jobCode,
    job.location,
    job.department,
    job.clientName,
    job.industry,
    job.summary,
    job.preferredProfile,
    job.skills,
    job.requirements,
    job.description,
    job.experience,
  ]);
}

function candidateFitText(candidate = {}) {
  return haystack([
    candidate.position,
    candidate.skills,
    candidate.product,
    candidate.location,
    candidate.companyName,
    candidate.client,
  ]);
}

module.exports = {
  escapeRegex,
  tokenize,
  scoreOverlap,
  jobFitText,
  candidateFitText,
};
