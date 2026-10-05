const Candidate = require('../models/Candidate');
const Application = require('../models/Application');
const Organization = require('../models/Organization');
const { orgJobCodePrefix } = require('./jobCodeService');

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function seqKey(kind) {
  return kind === 'CAND' ? 'codeSeq.candidate' : 'codeSeq.application';
}

function seqValue(org, kind) {
  return Number(kind === 'CAND' ? org?.codeSeq?.candidate : org?.codeSeq?.application) || 0;
}

async function existingMaxSeq(Model, organizationId, field, prefix) {
  const rows = await Model.find({
    organizationId,
    [field]: { $regex: `^${escapeRegex(prefix)}` },
  }).select(field).lean();
  let max = 0;
  for (const row of rows) {
    const n = parseInt(String(row[field] || '').slice(prefix.length), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

/**
 * Enterprise IDs: monotonic per org. Deleting a candidate/application never
 * decrements the counter, so SKILLNIX-CAND-000007 is never issued twice.
 */
async function nextOrgCode(Model, organizationId, field, kind) {
  const org = organizationId
    ? await Organization.findById(organizationId).select('slug name codeSeq').lean()
    : null;
  const prefix = `${orgJobCodePrefix(org)}-${kind}-`;
  if (!organizationId) {
    return `${kind}-${Date.now().toString(36).toUpperCase()}`;
  }

  const key = seqKey(kind);
  if (seqValue(org, kind) < 1) {
    const max = await existingMaxSeq(Model, organizationId, field, prefix);
    if (max > 0) {
      await Organization.updateOne({ _id: organizationId }, { $max: { [key]: max } });
    }
  }

  for (let i = 0; i < 20; i += 1) {
    const updated = await Organization.findByIdAndUpdate(
      organizationId,
      { $inc: { [key]: 1 } },
      { new: true, projection: { codeSeq: 1 } }
    );
    const n = seqValue(updated, kind);
    if (n < 1) continue;
    const code = `${prefix}${String(n).padStart(6, '0')}`;
    const exists = await Model.findOne({ organizationId, [field]: code }).select('_id').lean();
    if (!exists) return code;
  }
  return `${prefix}${Date.now().toString(36).toUpperCase()}`;
}

async function allocateCandidateCode(organizationId) {
  if (!organizationId) return `CAND-${Date.now().toString(36).toUpperCase()}`;
  return nextOrgCode(Candidate, organizationId, 'candidateCode', 'CAND');
}

async function allocateApplicationCode(organizationId) {
  if (!organizationId) return `APP-${Date.now().toString(36).toUpperCase()}`;
  return nextOrgCode(Application, organizationId, 'applicationCode', 'APP');
}

async function ensureCodeOnDoc(doc, field, allocate) {
  if (!doc) return '';
  const existing = String(doc[field] || '').trim().toUpperCase();
  if (existing) {
    doc[field] = existing;
    return existing;
  }
  const code = await allocate(doc.organizationId);
  doc[field] = code;
  if (typeof doc.save === 'function') {
    await doc.save();
  } else if (doc._id) {
    const Model = field === 'candidateCode' ? Candidate : Application;
    await Model.updateOne({ _id: doc._id }, { $set: { [field]: code } });
  }
  return code;
}

async function ensureCandidateCode(candidate) {
  return ensureCodeOnDoc(candidate, 'candidateCode', allocateCandidateCode);
}

async function ensureApplicationCode(application) {
  return ensureCodeOnDoc(application, 'applicationCode', allocateApplicationCode);
}

module.exports = {
  allocateCandidateCode,
  allocateApplicationCode,
  ensureCandidateCode,
  ensureApplicationCode,
};
