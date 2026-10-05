/**
 * Dedupe Service — fuzzy duplicate detection + merge (keep one).
 * Not LLM-based; deterministic normalization + grouping.
 */

const mongoose = require('mongoose');
const Candidate = require('../models/Candidate');

const normalizeEmail = (email) => {
  if (!email) return '';
  return String(email).trim().toLowerCase();
};

const normalizePhone = (phone) => {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length > 10) digits = digits.slice(-10);
  if (digits.length > 10) digits = digits.slice(-10);
  return digits;
};

const normalizeName = (name) => {
  if (!name) return '';
  return String(name)
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/** Levenshtein distance for short name comparison */
const levenshtein = (a, b) => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[b.length][a.length];
};

const namesLikelyMatch = (a, b) => {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen <= 3) return false;
  return levenshtein(na, nb) <= Math.floor(maxLen * 0.2);
};

const phonesLikelyMatch = (a, b) => {
  const pa = normalizePhone(a);
  const pb = normalizePhone(b);
  return pa.length >= 7 && pa === pb;
};

const buildCandidateKey = (c) => ({
  id: String(c._id),
  name: c.name,
  email: c.email,
  contact: c.contact || c.phone,
  normalizedEmail: normalizeEmail(c.email),
  normalizedPhone: normalizePhone(c.contact || c.phone),
  normalizedName: normalizeName(c.name),
});

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/**
 * Find an existing org candidate with the same normalized phone.
 * @returns {Promise<object|null>} lean candidate or null
 */
async function findOrgPhoneConflict(organizationId, phone, { excludeId } = {}) {
  const norm = normalizePhone(phone);
  if (!organizationId || !norm || norm.length < 7) return null;

  const filter = { organizationId };
  if (excludeId) filter._id = { $ne: excludeId };

  // Narrow candidates whose contact/phone ends with these digits, then exact-normalize.
  const escaped = norm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  filter.$or = [
    { contact: { $regex: `${escaped}$` } },
    { phone: { $regex: `${escaped}$` } },
  ];

  const rows = await Candidate.find(filter)
    .select('_id name email contact phone')
    .limit(50)
    .lean();

  return rows.find((r) => normalizePhone(r.contact || r.phone) === norm) || null;
}

/**
 * Find an existing org candidate with the same email (case-insensitive).
 * @returns {Promise<object|null>} lean candidate or null
 */
async function findOrgEmailConflict(organizationId, email, { excludeId } = {}) {
  const norm = normalizeEmail(email);
  if (!organizationId || !norm) return null;

  const filter = {
    organizationId,
    email: norm,
  };
  if (excludeId) filter._id = { $ne: excludeId };

  return Candidate.findOne(filter)
    .select('_id name email contact phone')
    .lean();
}

/**
 * Find duplicate groups within an organization.
 * Groups by exact normalized email / phone (O(n)), not O(n²) pairwise scan.
 * @param {string} organizationId
 * @param {{ candidateId?: string, limit?: number }} [options]
 */
const findDuplicates = async (organizationId, options = {}) => {
  const select = 'name email contact phone position location source date createdAt appliedAt status resume';
  const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 200);

  if (options.candidateId) {
    const targetDoc = await Candidate.findOne({ organizationId, _id: options.candidateId })
      .select(select)
      .lean();
    if (!targetDoc) {
      return { groups: [], totalGroups: 0 };
    }
    const target = buildCandidateKey(targetDoc);
    const or = [];
    if (target.normalizedEmail) {
      or.push({ email: target.normalizedEmail });
    }
    if (target.normalizedPhone && target.normalizedPhone.length >= 7) {
      const escaped = target.normalizedPhone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      or.push({ contact: { $regex: `${escaped}$` } });
      or.push({ phone: { $regex: `${escaped}$` } });
    }
    if (!or.length) {
      return { groups: [], totalGroups: 0 };
    }
    const peers = await Candidate.find({
      organizationId,
      _id: { $ne: targetDoc._id },
      $or: or,
    })
      .select(select)
      .limit(100)
      .lean();

    const matches = peers.filter((c) => {
      const other = buildCandidateKey(c);
      if (target.normalizedEmail && other.normalizedEmail && target.normalizedEmail === other.normalizedEmail) {
        return true;
      }
      return phonesLikelyMatch(target.contact, other.contact);
    });

    return {
      groups: matches.length
        ? [{ key: 'candidate_match', reason: 'email_or_phone', members: [targetDoc, ...matches] }]
        : [],
      totalGroups: matches.length ? 1 : 0,
    };
  }

  // Projection-only scan — avoid loading full candidate documents.
  const candidates = await Candidate.find({ organizationId })
    .select(select)
    .lean();

  const parent = {};
  const find = (i) => {
    if (parent[i] === undefined) parent[i] = i;
    if (parent[i] !== i) parent[i] = find(parent[i]);
    return parent[i];
  };
  const union = (i, j) => {
    const a = find(i);
    const b = find(j);
    if (a !== b) parent[a] = b;
  };

  const emailBuckets = new Map();
  const phoneBuckets = new Map();

  candidates.forEach((c, idx) => {
    parent[idx] = idx;
    const key = buildCandidateKey(c);
    if (key.normalizedEmail) {
      const list = emailBuckets.get(key.normalizedEmail) || [];
      list.push(idx);
      emailBuckets.set(key.normalizedEmail, list);
    }
    if (key.normalizedPhone && key.normalizedPhone.length >= 7) {
      const list = phoneBuckets.get(key.normalizedPhone) || [];
      list.push(idx);
      phoneBuckets.set(key.normalizedPhone, list);
    }
  });

  for (const idxs of emailBuckets.values()) {
    for (let i = 1; i < idxs.length; i += 1) union(idxs[0], idxs[i]);
  }
  for (const idxs of phoneBuckets.values()) {
    for (let i = 1; i < idxs.length; i += 1) union(idxs[0], idxs[i]);
  }

  const groupsMap = new Map();
  candidates.forEach((c, idx) => {
    const root = find(idx);
    if (!groupsMap.has(root)) groupsMap.set(root, []);
    groupsMap.get(root).push(c);
  });

  const groups = [...groupsMap.values()]
    .filter((members) => members.length > 1)
    .map((members) => ({
      key: normalizeEmail(members[0].email)
        || normalizePhone(members[0].contact || members[0].phone)
        || normalizeName(members[0].name)
        || String(members[0]._id),
      reason: 'email_or_phone',
      members,
    }))
    .sort((a, b) => b.members.length - a.members.length);

  return {
    groups: groups.slice(0, limit),
    totalGroups: groups.length,
  };
};

const MERGE_FILL_FIELDS = [
  'contact', 'phone', 'position', 'location', 'state', 'companyName', 'experience',
  'ctc', 'expectedCtc', 'noticePeriod', 'skills', 'product', 'pan', 'client', 'spoc',
  'source', 'remark', 'feedback', 'fls', 'resume', 'date', 'appliedAt',
];

function isBlank(val) {
  return val == null || (typeof val === 'string' && !String(val).trim());
}

/**
 * Keep one candidate; merge blank fields from drops; re-point related docs; delete drops.
 */
async function mergeCandidates(organizationId, keepId, dropIds = []) {
  if (!organizationId) throw httpError('Organization required', 400);
  if (!keepId) throw httpError('keepId is required', 400);

  const dropList = [...new Set((dropIds || []).map(String).filter((id) => id && id !== String(keepId)))];
  if (!dropList.length) throw httpError('Select at least one duplicate to merge into the kept record', 400);

  const keep = await Candidate.findOne({ _id: keepId, organizationId });
  if (!keep) throw httpError('Keep candidate not found', 404);

  const drops = await Candidate.find({
    _id: { $in: dropList },
    organizationId,
  });
  if (drops.length !== dropList.length) {
    throw httpError('One or more duplicates were not found in your organization', 404);
  }

  // Fill blank fields on keep from drops (first non-blank wins)
  let keepDirty = false;
  for (const field of MERGE_FILL_FIELDS) {
    if (!isBlank(keep[field])) continue;
    for (const drop of drops) {
      if (!isBlank(drop[field])) {
        keep[field] = drop[field];
        keepDirty = true;
        break;
      }
    }
  }
  if (keepDirty) await keep.save();

  const dropObjectIds = drops.map((d) => d._id);

  // Applications: move to keep, drop if same job already applied
  try {
    const Application = mongoose.model('Application');
    const dropApps = await Application.find({
      organizationId,
      candidateId: { $in: dropObjectIds },
    }).lean();
    for (const app of dropApps) {
      const exists = await Application.findOne({
        organizationId,
        jobId: app.jobId,
        candidateId: keep._id,
      }).select('_id').lean();
      if (exists) {
        await Application.deleteOne({ _id: app._id });
      } else {
        await Application.updateOne({ _id: app._id }, { $set: { candidateId: keep._id } });
      }
    }
  } catch (err) {
    if (err.name !== 'MissingSchemaError') throw err;
  }

  // Comments
  try {
    const CandidateComment = mongoose.model('CandidateComment');
    await CandidateComment.updateMany(
      { organizationId, candidateId: { $in: dropObjectIds } },
      { $set: { candidateId: keep._id } }
    );
  } catch (err) {
    if (err.name !== 'MissingSchemaError') throw err;
  }

  // Notifications pointing at dropped candidates
  try {
    const Notification = mongoose.model('Notification');
    await Notification.updateMany(
      { organizationId, candidateId: { $in: dropObjectIds } },
      { $set: { candidateId: keep._id } }
    );
  } catch (err) {
    if (err.name !== 'MissingSchemaError') throw err;
  }

  // Freelancer submissions — unique on job+candidate; drop conflicts
  try {
    const FreelancerSubmission = mongoose.model('FreelancerSubmission');
    const subs = await FreelancerSubmission.find({
      organizationId,
      candidateId: { $in: dropObjectIds },
    }).lean();
    for (const sub of subs) {
      const exists = await FreelancerSubmission.findOne({
        organizationId,
        jobId: sub.jobId,
        candidateId: keep._id,
      }).select('_id').lean();
      if (exists) {
        await FreelancerSubmission.deleteOne({ _id: sub._id });
      } else {
        await FreelancerSubmission.updateOne({ _id: sub._id }, { $set: { candidateId: keep._id } });
      }
    }
  } catch (err) {
    if (err.name !== 'MissingSchemaError') throw err;
  }

  await Candidate.deleteMany({ _id: { $in: dropObjectIds }, organizationId });

  return {
    keptId: String(keep._id),
    deletedIds: dropList,
    kept: {
      _id: keep._id,
      name: keep.name,
      email: keep.email,
      contact: keep.contact,
    },
  };
}

module.exports = {
  normalizeEmail,
  normalizePhone,
  normalizeName,
  findDuplicates,
  findOrgPhoneConflict,
  findOrgEmailConflict,
  mergeCandidates,
};
