import { publicSiteOrigin } from './publicSiteOrigin';
import { veiledEmployer, jobEmailSummary, cleanApplyUrl, looksLikeJdDump } from './employerVeil';

export function careersApplyUrl(job, orgSlug) {
  const slug = String(orgSlug || '').trim();
  if (!slug || !job) return '';
  const raw = job.publicId || job.jobCode || job._id;
  if (!raw) return '';
  const key = encodeURIComponent(raw);
  const base = `${publicSiteOrigin()}/careers/${slug}/jobs/${key}`;
  const via = String(job.shareVia || '').trim();
  return cleanApplyUrl(via ? `${base}?via=${encodeURIComponent(via)}` : base);
}

export function splitPeopleForCampaign(people = []) {
  const candidateIds = [];
  const misIds = [];
  for (const row of people) {
    if (!row) continue;
    const kinds = Array.isArray(row._kinds) ? row._kinds : [];
    const candId = row.candidateId
      || (kinds.includes('candidates') ? row._id : '');
    const misId = row.misId
      || (kinds.includes('mis') ? row._id : '');
    if (candId) candidateIds.push(String(candId));
    if (misId) misIds.push(String(misId));
    if (candId || misId) continue;
    if (row.deskScope || row.uploadBatchId != null || Object.prototype.hasOwnProperty.call(row, 'recordDate')) {
      if (row._id) misIds.push(String(row._id));
      continue;
    }
    if (row._id) candidateIds.push(String(row._id));
  }
  return {
    candidateIds: [...new Set(candidateIds.filter(Boolean))],
    misIds: [...new Set(misIds.filter(Boolean))],
  };
}

export function candidateIdsFromPeople(people = []) {
  return splitPeopleForCampaign(people).candidateIds;
}

export function withJobApplyFooter(text, meta = {}) {
  const url = cleanApplyUrl(meta.applyUrl || meta.applyLink || '');
  const title = String(meta.jobTitle || '').trim();
  const code = String(meta.jobCode || '').trim();
  const location = String(meta.jobLocation || '').trim();
  const department = String(meta.jobDepartment || '').trim();
  const industry = String(meta.jobIndustry || meta.industry || '').trim();
  const clientRaw = String(meta.jobClient || '').trim();
  const employer = /^a leading\b/i.test(clientRaw)
    ? clientRaw
    : veiledEmployer(industry, clientRaw);
  const experience = String(meta.jobExperience || '').trim();
  const summary = jobEmailSummary(meta.jobSummary || '', clientRaw);
  if (!url && !title && !code) return String(text || '');
  const body = String(text || '');
  const bodyHasApply = url && (body.includes(url) || /\/careers\/[^/\s]+\/jobs\//i.test(body));
  if (bodyHasApply) return body;
  const lines = ['---', 'Job details'];
  if (title) lines.push(`Role: ${title}`);
  if (code) lines.push(`Job ID: ${code}`);
  if (department) lines.push(`Department: ${department}`);
  if (location) lines.push(`Location: ${location}`);
  if (employer) lines.push(`Employer: ${employer}`);
  if (experience) lines.push(`Experience: ${experience}`);
  const ctc = String(meta.jobCtc || meta.ctc || '').trim();
  if (ctc) lines.push(`CTC: ${ctc}`);
  if (summary && !looksLikeJdDump(summary)) lines.push(summary);
  if (url) {
    lines.push(`Apply using the link below:`);
    lines.push(url);
  }
  const block = lines.join('\n');
  return body.trim() ? `${body.trim()}\n\n${block}` : block;
}
