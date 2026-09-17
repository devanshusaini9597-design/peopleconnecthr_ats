/**
 * Short public job tokens for careers URLs.
 * Avoids exposing Mongo ObjectIds; hard to enumerate (non-sequential).
 */
const crypto = require('crypto');
const mongoose = require('mongoose');
const Job = require('../models/Job');

/** URL-safe, no ambiguous 0/O/1/l/I */
const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';
const PUBLIC_ID_LEN = 8;
const PUBLIC_ID_RE = /^[23456789abcdefghjkmnpqrstuvwxyz]{8}$/;

function generatePublicId() {
  const bytes = crypto.randomBytes(PUBLIC_ID_LEN);
  let out = '';
  for (let i = 0; i < PUBLIC_ID_LEN; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

function normalizePublicId(raw) {
  return String(raw || '').trim().toLowerCase();
}

function isPublicIdToken(raw) {
  return PUBLIC_ID_RE.test(normalizePublicId(raw));
}

function isMongoObjectIdString(raw) {
  const s = String(raw || '').trim();
  return mongoose.Types.ObjectId.isValid(s) && String(new mongoose.Types.ObjectId(s)) === s;
}

async function allocatePublicId() {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const publicId = generatePublicId();
    const exists = await Job.exists({ publicId });
    if (!exists) return publicId;
  }
  throw new Error('Could not allocate a unique public job id');
}

/**
 * Ensure a job has publicId. Always uses updateOne (safe for partial selects).
 */
async function ensurePublicId(job) {
  if (!job?._id) return null;
  const existing = normalizePublicId(job.publicId);
  if (existing && isPublicIdToken(existing)) {
    job.publicId = existing;
    return existing;
  }
  const publicId = await allocatePublicId();
  await Job.updateOne({ _id: job._id }, { $set: { publicId } });
  job.publicId = publicId;
  return publicId;
}

/**
 * Resolve an open published job by publicId, jobCode, or legacy ObjectId.
 * Lazily backfills publicId when found via legacy id.
 */
async function findPublicOpenJob(organizationId, token, select = null) {
  const key = String(token || '').trim();
  if (!key || !organizationId) return null;

  const base = {
    organizationId,
    status: 'Open',
    isPublished: { $ne: false },
  };

  const query = (filter) => {
    const q = Job.findOne({ ...base, ...filter });
    return select ? q.select(select) : q;
  };

  const publicId = normalizePublicId(key);
  if (isPublicIdToken(publicId)) {
    const byPublic = await query({ publicId });
    if (byPublic) return byPublic;
  }

  const jobCode = key.toUpperCase();
  if (/^[A-Z0-9][A-Z0-9-]{2,39}$/.test(jobCode)) {
    const byCode = await query({ jobCode });
    if (byCode) {
      await ensurePublicId(byCode);
      return byCode;
    }
  }

  if (isMongoObjectIdString(key)) {
    const byId = await query({ _id: key });
    if (byId) {
      await ensurePublicId(byId);
      return byId;
    }
  }

  return null;
}

/** Prefer short publicId for share/apply links. */
function careersJobPathSegment(job) {
  const pid = normalizePublicId(job?.publicId);
  if (pid && isPublicIdToken(pid)) return pid;
  const code = String(job?.jobCode || '').trim();
  if (code) return encodeURIComponent(code);
  return String(job?._id || '');
}

module.exports = {
  PUBLIC_ID_LEN,
  allocatePublicId,
  ensurePublicId,
  findPublicOpenJob,
  careersJobPathSegment,
  normalizePublicId,
  isPublicIdToken,
  generatePublicId,
};
