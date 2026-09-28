/**
 * Live per-requisition application counts for Jobs / Applications.
 * Prefer these over the denormalized Job.applicationCount field.
 */
const { organizationIdMatch } = require('./dataScope');

function emptyPipelineStats() {
  return {
    applicationCount: 0,
    uniqueCandidateCount: 0,
    activeCount: 0,
    rejectedCount: 0,
    careersCount: 0,
    addedCount: 0,
    duplicateCount: 0,
    pipeline: {},
  };
}

function toPlainJob(job) {
  if (!job) return job;
  return typeof job.toObject === 'function' ? job.toObject() : { ...job };
}

function isCareersSource(source) {
  return /career/i.test(String(source || ''));
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

/** Fold $group rows into a Map keyed by jobId string. */
function foldPipelineAggregates(rows = []) {
  const byJob = new Map();
  for (const row of rows) {
    const key = String(row?._id?.jobId || '');
    if (!key) continue;
    const stats = byJob.get(key) || emptyPipelineStats();
    const n = Number(row.count) || 0;
    stats.applicationCount += n;
    if (row._id.rejected) stats.rejectedCount += n;
    else {
      stats.activeCount += n;
      const stage = String(row._id.stage || 'Applied').trim() || 'Applied';
      stats.pipeline[stage] = (stats.pipeline[stage] || 0) + n;
    }
    if (isCareersSource(row._id.source)) stats.careersCount += n;
    else stats.addedCount += n;
    byJob.set(key, stats);
  }
  return byJob;
}

function lastPhoneDigits(value) {
  const digits = normalizePhone(value);
  return digits.length >= 8 ? digits.slice(-10) : '';
}

function collectDuplicateApplicantIds(candidates = []) {
  const byEmail = new Map();
  const byPhone = new Map();
  const byPerson = new Map();
  const flagged = new Set();

  const push = (map, key, id) => {
    if (!key) return;
    const list = map.get(key) || [];
    list.push(id);
    map.set(key, list);
  };

  for (const c of candidates) {
    const id = String(c?._id || '');
    if (!id) continue;
    push(byEmail, normalizeEmail(c.email), id);
    const phone = lastPhoneDigits(c.contact || c.phone);
    if (phone) push(byPhone, phone, id);
    if (c.personId) push(byPerson, String(c.personId), id);
  }

  for (const groups of [byEmail, byPhone, byPerson]) {
    for (const ids of groups.values()) {
      if (ids.length > 1) ids.forEach((id) => flagged.add(String(id)));
    }
  }
  return flagged;
}

function countDuplicateApplicants(candidates = []) {
  return collectDuplicateApplicantIds(candidates).size;
}

/** Applicants that share identity with another org profile (not merged). */
function collectUnmergedDuplicateIds(applicants = [], siblings = []) {
  const flagged = collectDuplicateApplicantIds(applicants);
  const byEmail = new Map();
  const byPhone = new Map();
  const byPerson = new Map();
  const push = (map, key, id) => {
    if (!key) return;
    const list = map.get(key) || [];
    list.push(String(id));
    map.set(key, list);
  };
  for (const s of siblings) {
    const id = String(s?._id || '');
    if (!id) continue;
    push(byEmail, normalizeEmail(s.email), id);
    push(byPhone, lastPhoneDigits(s.contact || s.phone), id);
    if (s.personId) push(byPerson, String(s.personId), id);
  }
  for (const a of applicants) {
    const id = String(a?._id || '');
    if (!id) continue;
    const pools = [
      byEmail.get(normalizeEmail(a.email)) || [],
      byPhone.get(lastPhoneDigits(a.contact || a.phone)) || [],
      a.personId ? (byPerson.get(String(a.personId)) || []) : [],
    ];
    if (pools.some((ids) => ids.some((other) => other !== id))) flagged.add(id);
  }
  return flagged;
}

async function attachJobPipelineStats(organizationId, jobs = []) {
  const list = jobs.map(toPlainJob).filter(Boolean);
  if (!list.length) return list;
  if (!organizationId) {
    return list.map((job) => {
      const { applicationCount: _ignored, ...rest } = job;
      return { ...rest, ...emptyPipelineStats() };
    });
  }

  const ids = list.map((job) => job._id).filter(Boolean);
  const orgMatch = organizationIdMatch(organizationId);
  const Application = require('../models/Application');
  const Candidate = require('../models/Candidate');
  let rows = [];
  let idRows = [];
  try {
    const liveOnly = [
      { $match: { ...(orgMatch || {}), jobId: { $in: ids } } },
      {
        $lookup: {
          from: Candidate.collection.name,
          localField: 'candidateId',
          foreignField: '_id',
          as: '_liveCandidate',
        },
      },
      { $match: { '_liveCandidate.0': { $exists: true } } },
    ];
    [rows, idRows] = await Promise.all([
      Application.aggregate([
        ...liveOnly,
        {
          $group: {
            _id: {
              jobId: '$jobId',
              source: { $toLower: { $ifNull: ['$source', ''] } },
              stage: { $ifNull: ['$stage', 'Applied'] },
              rejected: { $eq: [{ $ifNull: ['$isRejected', false] }, true] },
            },
            count: { $sum: 1 },
          },
        },
      ]),
      Application.aggregate([
        ...liveOnly,
        {
          $group: {
            _id: '$jobId',
            candidateIds: { $addToSet: '$candidateId' },
          },
        },
      ]),
    ]);
  } catch {
    rows = [];
    idRows = [];
  }

  const byJob = foldPipelineAggregates(rows);
  const idsByJob = new Map(
    (idRows || []).map((row) => [String(row._id), (row.candidateIds || []).map(String)])
  );

  const allCandidateIds = [...new Set([...idsByJob.values()].flat())].filter(Boolean);
  let candidateById = new Map();
  if (allCandidateIds.length) {
    try {
      const Candidate = require('../models/Candidate');
      const mongoose = require('mongoose');
      const objectIds = allCandidateIds
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));
      const cands = await Candidate.find({
        ...(orgMatch || {}),
        _id: { $in: objectIds },
      }).select('email contact phone personId').lean();
      candidateById = new Map(cands.map((c) => [String(c._id), c]));
    } catch {
      candidateById = new Map();
    }
  }

  let siblings = [];
  const allPeople = [...candidateById.values()];
  const emails = [...new Set(allPeople.map((c) => normalizeEmail(c.email)).filter(Boolean))];
  const personIds = [...new Set(allPeople.map((c) => c.personId).filter(Boolean))];
  if ((emails.length || personIds.length) && organizationId) {
    try {
      const Candidate = require('../models/Candidate');
      const or = [];
      if (emails.length) {
        or.push({ email: { $in: emails } });
        or.push({ email: { $in: emails.map((e) => e.toUpperCase()) } });
      }
      if (personIds.length) or.push({ personId: { $in: personIds } });
      siblings = await Candidate.find({
        ...(orgMatch || {}),
        $or: or,
      }).select('_id email contact phone personId').lean();
    } catch {
      siblings = [];
    }
  }

  return list.map((job) => {
    const { applicationCount: _stale, careersCount: _c, addedCount: _a, ...rest } = job;
    const stats = byJob.get(String(job._id)) || emptyPipelineStats();
    const candIds = idsByJob.get(String(job._id)) || [];
    stats.uniqueCandidateCount = candIds.filter((id) => candidateById.has(String(id))).length;
    if (!stats.applicationCount) stats.applicationCount = stats.uniqueCandidateCount;
    stats.addedCount = Math.max(0, Number(stats.applicationCount || 0) - Number(stats.careersCount || 0));
    const people = candIds.map((id) => candidateById.get(id)).filter(Boolean);
    stats.duplicateCount = collectUnmergedDuplicateIds(people, siblings).size;
    return { ...rest, ...stats };
  });
}

module.exports = {
  emptyPipelineStats,
  foldPipelineAggregates,
  attachJobPipelineStats,
  isCareersSource,
  countDuplicateApplicants,
  collectUnmergedDuplicateIds,
  collectDuplicateApplicantIds,
};
