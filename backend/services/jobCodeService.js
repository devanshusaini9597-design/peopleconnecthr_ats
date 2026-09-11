const Job = require('../models/Job');
const Organization = require('../models/Organization');

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{2,39}$/;
const NOISE_WORDS = /\b(recruitment|recruiting|services|service|solutions|consulting|consultancy|private|limited|pvt|ltd|inc|llc|company|corp|group|holdings|enterprises|global|india)\b/gi;

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Uppercase alphanumeric + hyphens — unique within one organization. */
function normalizeJobCode(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function validateJobCodeFormat(code) {
  if (!code) return 'Job ID is required';
  if (code.length < 3) return 'Job ID must be at least 3 characters';
  if (code.length > 40) return 'Job ID must be 40 characters or fewer';
  if (!CODE_PATTERN.test(code)) {
    return 'Job ID may only use letters, numbers, and hyphens (e.g. SKILLNIX-2026-0001)';
  }
  return null;
}

/**
 * Short brand prefix from org slug/name — e.g. skillnixrecruitment → SKILLNIX.
 */
function orgJobCodePrefix(org) {
  const slug = String(org?.slug || '').toLowerCase().trim();
  let base = slug || String(org?.name || 'ORG').toLowerCase();
  base = base.replace(NOISE_WORDS, ' ').replace(/[^a-z0-9\s-]/g, ' ');
  base = base.replace(/[\s-]+/g, '').trim();

  if (base.startsWith('skillnix')) return 'SKILLNIX';
  if (!base) return 'ORG';
  if (base.length <= 10) return base.toUpperCase();
  return base.slice(0, 10).toUpperCase();
}

async function loadOrg(organizationId) {
  if (!organizationId) return null;
  return Organization.findById(organizationId).select('slug name').lean();
}

function yearPrefix(org, year = new Date().getFullYear()) {
  return `${orgJobCodePrefix(org)}-${year}-`;
}

async function jobCodeExists(organizationId, code, excludeJobId = null) {
  const filter = {
    organizationId,
    isTemplate: { $ne: true },
    jobCode: normalizeJobCode(code),
  };
  if (excludeJobId) filter._id = { $ne: excludeJobId };
  const row = await Job.findOne(filter).select('_id').lean();
  return Boolean(row);
}

/** Highest sequence for PREFIX-YEAR-NNNN in this org (any prefix variant with same year). */
async function maxSequenceForYear(organizationId, year = new Date().getFullYear()) {
  const yearTag = `-${year}-`;
  const jobs = await Job.find({
    organizationId,
    isTemplate: { $ne: true },
    jobCode: { $exists: true, $ne: '' },
  }).select('jobCode').lean();

  let max = 0;
  for (const row of jobs) {
    const code = normalizeJobCode(row.jobCode);
    const idx = code.indexOf(yearTag);
    if (idx === -1) continue;
    const n = parseInt(code.slice(idx + yearTag.length), 10);
    if (Number.isFinite(n)) max = Math.max(max, n);
  }
  return max;
}

/**
 * Next sequential code for this organization (e.g. SKILLNIX-2026-0004).
 * Skips any collision with manual/custom IDs.
 */
async function allocateJobCode(organizationId) {
  if (!organizationId) {
    const year = new Date().getFullYear();
    return `ORG-${year}-0001`;
  }
  const org = await loadOrg(organizationId);
  const prefix = yearPrefix(org);
  let seq = (await maxSequenceForYear(organizationId)) + 1;

  for (let attempt = 0; attempt < 200; attempt += 1) {
    const code = `${prefix}${String(seq).padStart(4, '0')}`;
    if (!(await jobCodeExists(organizationId, code))) return code;
    seq += 1;
  }
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

async function previewNextJobCode(organizationId) {
  return allocateJobCode(organizationId);
}

async function assertJobCodeUnique(organizationId, jobCode, excludeJobId = null) {
  if (!organizationId) return jobCode;
  const code = normalizeJobCode(jobCode);
  const formatErr = validateJobCodeFormat(code);
  if (formatErr) {
    const err = new Error(formatErr);
    err.statusCode = 400;
    throw err;
  }
  if (await jobCodeExists(organizationId, code, excludeJobId)) {
    const err = new Error(`Job ID “${code}” is already used in your organization`);
    err.statusCode = 409;
    throw err;
  }
  return code;
}

/**
 * Create: always auto unless caller passes explicit customJobCode + rawCode.
 */
async function resolveJobCodeForCreate(organizationId, rawCode, { forceAuto = false } = {}) {
  if (!organizationId) return normalizeJobCode(rawCode) || null;
  const trimmed = normalizeJobCode(rawCode);
  if (!forceAuto && trimmed) return assertJobCodeUnique(organizationId, trimmed);
  return allocateJobCode(organizationId);
}

async function healOrganizationJobCodes(organizationId) {
  if (!organizationId) return { fixed: 0, assigned: 0, skipped: 0 };

  const jobs = await Job.find({
    organizationId,
    $or: [{ isTemplate: false }, { isTemplate: { $exists: false } }],
  }).sort({ createdAt: 1 }).select('_id jobCode createdAt').lean();

  const seen = new Set();
  let fixed = 0;
  let assigned = 0;

  for (const job of jobs) {
    let code = normalizeJobCode(job.jobCode);
    const needsNew = !code || seen.has(code);
    if (needsNew) {
      code = await allocateJobCode(organizationId);
      await Job.updateOne({ _id: job._id }, { $set: { jobCode: code } });
      if (job.jobCode) fixed += 1;
      else assigned += 1;
    }
    seen.add(code);
  }

  return { fixed, assigned, skipped: jobs.length - fixed - assigned, total: jobs.length };
}

module.exports = {
  normalizeJobCode,
  validateJobCodeFormat,
  orgJobCodePrefix,
  allocateJobCode,
  previewNextJobCode,
  assertJobCodeUnique,
  resolveJobCodeForCreate,
  healOrganizationJobCodes,
};
