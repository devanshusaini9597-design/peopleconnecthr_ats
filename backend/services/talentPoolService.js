/**
 * Talent pools domain logic — silver-medalist / passive-candidate databases.
 */
const mongoose = require('mongoose');
const TalentPool = require('../models/TalentPool');
const Candidate = require('../models/Candidate');
const { planHasFeature } = require('../config/planFeatures');
const Organization = require('../models/Organization');
const { escapeRegex } = require('../utils/textNormalize');
const {
  selectPoolsForReject,
  selectPoolsForJob,
  selectPoolsForTrigger,
  contextBlob,
} = require('../utils/talentPoolMatch');

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

async function listPools(organizationId) {
  const pools = await TalentPool.find({ organizationId }).sort({ createdAt: -1 }).lean();
  const counts = await Candidate.aggregate([
    { $match: { organizationId: new mongoose.Types.ObjectId(organizationId), talentPoolIds: { $exists: true, $ne: [] } } },
    { $unwind: '$talentPoolIds' },
    { $group: { _id: '$talentPoolIds', count: { $sum: 1 } } }
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
  return pools.map((p) => ({ ...p, memberCount: countMap.get(String(p._id)) || 0 }));
}

async function createPool(organizationId, userId, { name, description = '', color = '#6366f1', industry = '', product = '' }) {
  if (!name || !name.trim()) throw httpError('Pool name is required');
  try {
    return await TalentPool.create({
      organizationId,
      name: name.trim(),
      description,
      color,
      industry: String(industry || '').trim(),
      product: String(product || '').trim(),
      createdBy: userId
    });
  } catch (error) {
    if (error.code === 11000) throw httpError('A talent pool with this name already exists', 409);
    throw error;
  }
}

async function updatePool(organizationId, poolId, body) {
  const AUTO_KEYS = ['addOnReject', 'isDefaultRejectPool', 'addOnDropped', 'addOnInterview', 'addOnHired', 'addOnCreate'];
  const { name, description, color, industry, product, ...rest } = body;
  const update = {};
  if (name !== undefined) update.name = name.trim();
  if (description !== undefined) update.description = description;
  if (color !== undefined) update.color = color;
  if (industry !== undefined) update.industry = String(industry || '').trim();
  if (product !== undefined) update.product = String(product || '').trim();

  const autoTouched = AUTO_KEYS.some((k) => rest[k] !== undefined);
  if (autoTouched) {
    const org = await Organization.findById(organizationId).select('plan');
    if (!planHasFeature(org?.plan, 'candidates.talentPoolAutomation')) {
      throw httpError('Talent pool automation requires a Professional plan or higher.', 403, {
        code: 'UPGRADE_REQUIRED',
        feature: 'candidates.talentPoolAutomation'
      });
    }
    for (const key of AUTO_KEYS) {
      if (rest[key] !== undefined) update[key] = !!rest[key];
    }
    if (update.isDefaultRejectPool) {
      await TalentPool.updateMany(
        { organizationId, _id: { $ne: poolId } },
        { $set: { isDefaultRejectPool: false } }
      );
    }
  }

  const pool = await TalentPool.findOneAndUpdate(
    { _id: poolId, organizationId },
    { $set: update },
    { new: true }
  );
  if (!pool) throw httpError('Talent pool not found', 404);
  return pool;
}

async function suggestCandidates(organizationId, { skills = '', limit = 20 }) {
  const terms = String(skills)
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 15);

  if (!terms.length) throw httpError('Provide skills keywords to match');

  const regexes = terms.map((t) => new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  const candidates = await Candidate.find({
    organizationId,
    $or: [
      { skills: { $in: regexes } },
      { position: { $in: regexes } },
      { remark: { $in: regexes } }
    ]
  })
    .select('name email position skills experience location')
    .limit(Math.min(Number(limit) || 20, 50))
    .lean();

  return candidates.map((c) => {
    const hay = `${c.skills || ''} ${c.position || ''}`.toLowerCase();
    const hits = terms.filter((t) => hay.includes(t.toLowerCase())).length;
    return { ...c, matchScore: Math.round((hits / terms.length) * 100) };
  }).sort((a, b) => b.matchScore - a.matchScore);
}

async function runCampaign(organizationId, user, poolId, { subject = '', body = '', channel = 'email', sequenceId }) {
  const pool = await TalentPool.findOne({ _id: poolId, organizationId });
  if (!pool) throw httpError('Talent pool not found', 404);

  const members = await Candidate.find({
    organizationId,
    talentPoolIds: pool._id
  }).select('_id name email');

  if (!members.length) throw httpError('Pool has no members');

  if (sequenceId) {
    const org = await Organization.findById(organizationId).select('plan');
    if (!planHasFeature(org?.plan, 'messaging.sequences')) {
      throw httpError('Campaign via sequences requires messaging.sequences on your plan.', 403, {
        code: 'UPGRADE_REQUIRED',
        feature: 'messaging.sequences'
      });
    }
    const SequenceEnrollment = require('../models/SequenceEnrollment');
    const EmailSequence = require('../models/EmailSequence');
    const sequence = await EmailSequence.findOne({
      _id: sequenceId,
      organizationId,
      isActive: true
    });
    if (!sequence) throw httpError('Sequence not found', 404);

    let enrolled = 0;
    for (const m of members) {
      try {
        await SequenceEnrollment.create({
          organizationId,
          sequenceId: sequence._id,
          candidateId: m._id,
          status: 'active',
          currentStep: 0,
          nextSendAt: new Date(),
          enrolledBy: user.id || user._id
        });
        enrolled++;
      } catch { /* duplicate */ }
    }
    return { mode: 'sequence', enrolled, total: members.length };
  }

  if (!body.trim()) throw httpError('body is required when not using a sequence');

  const org = await Organization.findById(organizationId).select('plan');
  if (!planHasFeature(org?.plan, 'messaging.inbox')) {
    throw httpError('Direct pool campaigns require messaging.inbox on your plan.', 403, {
      code: 'UPGRADE_REQUIRED',
      feature: 'messaging.inbox'
    });
  }

  const MessageThread = require('../models/MessageThread');
  const Message = require('../models/Message');
  const { sendEmail } = require('./emailService');
  let sent = 0;
  let failed = 0;

  for (const m of members) {
    if (!m.email) { failed++; continue; }
    try {
      if (channel === 'email') {
        const { wrapBrandedEmailHtml, loadOrgEmailBrand } = require('./emailBrandLayout');
        const brand = await loadOrgEmailBrand(organizationId);
        const html = wrapBrandedEmailHtml({
          orgName: brand.name,
          logoUrl: brand.logoUrl,
          brandColor: brand.brandColor,
          wordmark: brand.wordmark,
          bodyHtml: `<div style="color:#3f3f46;white-space:pre-wrap;line-height:1.7;">${body
            .split('\n')
            .map((line) => line || '&nbsp;')
            .join('<br/>')}</div>`,
        });
        await sendEmail(
          m.email,
          subject || 'Opportunity from our talent team',
          html,
          body,
          { userId: user.id || user._id }
        );
      }
      let thread = await MessageThread.findOne({
        organizationId,
        candidateId: m._id,
        archived: false
      }).sort({ lastMessageAt: -1 });
      if (!thread) {
        thread = await MessageThread.create({
          organizationId,
          candidateId: m._id,
          subject: subject || `Talent pool: ${pool.name}`,
          channel: 'email',
          participants: { candidateName: m.name, candidateEmail: m.email },
          lastMessageAt: new Date(),
          lastMessagePreview: body.slice(0, 160),
          lastDirection: 'outbound',
          createdBy: user.id || user._id
        });
      }
      await Message.create({
        organizationId,
        threadId: thread._id,
        candidateId: m._id,
        channel: 'email',
        direction: 'outbound',
        fromName: user.name || 'Recruiter',
        toAddress: m.email,
        subject,
        body,
        status: 'sent',
        isRead: true,
        sentBy: user.id || user._id
      });
      sent++;
    } catch {
      failed++;
    }
  }

  return { mode: 'direct', sent, failed, total: members.length };
}

async function deletePool(organizationId, poolId) {
  const pool = await TalentPool.findOneAndDelete({ _id: poolId, organizationId });
  if (!pool) throw httpError('Talent pool not found', 404);

  await Candidate.updateMany(
    { organizationId, talentPoolIds: pool._id },
    { $pull: { talentPoolIds: pool._id } }
  );

  return { message: 'Talent pool deleted' };
}

async function listPoolCandidates(organizationId, poolId) {
  const pool = await TalentPool.findOne({ _id: poolId, organizationId });
  if (!pool) throw httpError('Talent pool not found', 404);

  const candidates = await Candidate.find({
    organizationId,
    talentPoolIds: pool._id
  })
    .select('name email contact phone position location experience skills status createdAt')
    .sort({ createdAt: -1 })
    .lean();

  return { pool, candidates };
}

async function addCandidates(organizationId, poolId, candidateIds) {
  if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
    throw httpError('candidateIds must be a non-empty array');
  }

  const pool = await TalentPool.findOne({ _id: poolId, organizationId });
  if (!pool) throw httpError('Talent pool not found', 404);

  const orgCandidates = await Candidate.find({
    _id: { $in: candidateIds },
    organizationId
  }).select('_id name talentPoolConsent');

  const optedOut = orgCandidates.filter((c) => c.talentPoolConsent && c.talentPoolConsent.optedIn === false);
  const allowedIds = orgCandidates
    .filter((c) => !(c.talentPoolConsent && c.talentPoolConsent.optedIn === false))
    .map((c) => c._id);

  if (allowedIds.length === 0) {
    throw httpError('No candidates added — all selected have opted out of talent-pool retention.', 400, {
      skipped: optedOut.map((c) => ({ id: c._id, name: c.name }))
    });
  }

  const result = await Candidate.updateMany(
    { _id: { $in: allowedIds }, organizationId },
    { $addToSet: { talentPoolIds: pool._id } }
  );

  // Enterprise: enroll consented candidates onto marketing list (best-effort)
  try {
    const { enrollCandidatesAfterTalentPool } = require('./marketingListService');
    await enrollCandidatesAfterTalentPool(organizationId, allowedIds);
  } catch (err) {
    console.warn('[talentPool] marketing enroll skipped:', err.message);
  }

  return {
    message: optedOut.length
      ? `${result.modifiedCount} added; ${optedOut.length} skipped (opted out of pool retention)`
      : `${result.modifiedCount} candidate(s) added to pool`,
    skipped: optedOut.map((c) => ({ id: c._id, name: c.name }))
  };
}

async function removeCandidate(organizationId, poolId, candidateId) {
  const pool = await TalentPool.findOne({ _id: poolId, organizationId });
  if (!pool) throw httpError('Talent pool not found', 404);

  await Candidate.findOneAndUpdate(
    { _id: candidateId, organizationId },
    { $pull: { talentPoolIds: pool._id } }
  );

  return { message: 'Candidate removed from pool' };
}

function candidateContext(candidate = {}, job = {}) {
  const skills = Array.isArray(candidate.skills)
    ? candidate.skills.join(' ')
    : candidate.skills;
  const jobSkills = Array.isArray(job.skills) ? job.skills.join(' ') : job.skills;
  return {
    industry: job.industry || '',
    title: job.title || job.role || '',
    role: job.role || '',
    position: candidate.position || '',
    skills: [skills, jobSkills].filter(Boolean).join(' '),
    product: candidate.product || '',
    client: candidate.client || job.clientName || '',
    clientName: job.clientName || '',
    remark: candidate.remark || '',
    description: job.description || job.summary || '',
  };
}

async function resolveRejectPools(organizationId, { job, candidate, talentPoolIds }) {
  const pools = await TalentPool.find({ organizationId }).lean();
  if (!pools.length) return [];

  if (Array.isArray(talentPoolIds)) {
    const allowed = new Set(talentPoolIds.map(String));
    return pools.filter((p) => allowed.has(String(p._id)));
  }

  return selectPoolsForTrigger(pools, candidateContext(candidate, job), 'reject');
}

async function enrollByTrigger(organizationId, candidateDoc, { trigger = 'reject', job, talentPoolIds } = {}) {
  if (!organizationId || !candidateDoc?._id) return { added: 0, poolIds: [] };
  const Organization = require('../models/Organization');
  const org = await Organization.findById(organizationId).select('plan');
  if (!planHasFeature(org?.plan, 'candidates.talentPools')) return { added: 0, poolIds: [] };
  const candidate = candidateDoc.toObject ? candidateDoc.toObject() : candidateDoc;
  if (candidate.talentPoolConsent && candidate.talentPoolConsent.optedIn === false) {
    return { added: 0, poolIds: [], skipped: 'opted_out' };
  }

  const pools = await TalentPool.find({ organizationId }).lean();
  if (!pools.length) return { added: 0, poolIds: [] };

  const selected = Array.isArray(talentPoolIds)
    ? pools.filter((p) => talentPoolIds.map(String).includes(String(p._id)))
    : selectPoolsForTrigger(pools, candidateContext(candidate, job || {}), trigger);

  if (!selected.length) return { added: 0, poolIds: [] };

  await Candidate.updateOne(
    { _id: candidate._id, organizationId },
    { $addToSet: { talentPoolIds: { $each: selected.map((p) => p._id) } } }
  );
  return { added: selected.length, poolIds: selected.map((p) => p._id) };
}

async function poolsForReject(organizationId, applicationId) {
  const Application = require('../models/Application');
  const Job = require('../models/Job');
  const application = await Application.findOne({ _id: applicationId, organizationId })
    .select('candidateId jobId')
    .lean();
  if (!application) throw httpError('Application not found', 404);

  const [job, candidate, pools] = await Promise.all([
    Job.findOne({ _id: application.jobId, organizationId }).lean(),
    Candidate.findOne({ _id: application.candidateId, organizationId })
      .select('name position skills product client remark talentPoolIds talentPoolConsent')
      .lean(),
    TalentPool.find({ organizationId }).sort({ name: 1 }).lean(),
  ]);

  const suggested = selectPoolsForReject(pools, candidateContext(candidate, job));
  const suggestedIds = new Set(suggested.map((p) => String(p._id)));

  return {
    candidateName: candidate?.name || '',
    jobTitle: job?.title || job?.role || '',
    jobIndustry: job?.industry || '',
    optedOut: candidate?.talentPoolConsent?.optedIn === false,
    pools: pools.map((p) => ({
      ...p,
      suggested: suggestedIds.has(String(p._id)),
    })),
  };
}

async function listReusableForJob(organizationId, { jobId, q = '', limit = 20 } = {}) {
  const Job = require('../models/Job');
  const Application = require('../models/Application');
  const job = jobId
    ? await Job.findOne({ _id: jobId, organizationId }).lean()
    : null;

  const pools = await TalentPool.find({ organizationId }).lean();
  if (!pools.length) return { candidates: [], pools: [], jobIndustry: job?.industry || '' };

  const matchedPools = job ? selectPoolsForJob(pools, job) : pools;
  const poolIds = (matchedPools.length ? matchedPools : pools).map((p) => p._id);
  const alreadyOnJob = jobId
    ? await Application.find({ organizationId, jobId }).distinct('candidateId')
    : [];

  const filter = {
    organizationId,
    talentPoolIds: { $in: poolIds },
    ...(alreadyOnJob.length ? { _id: { $nin: alreadyOnJob } } : {}),
  };

  const query = String(q || '').trim();
  if (query) {
    const rx = new RegExp(escapeRegex(query), 'i');
    filter.$or = [
      { name: rx },
      { email: rx },
      { position: rx },
      { skills: rx },
      { product: rx },
      { client: rx },
    ];
  }

  let candidates = await Candidate.find(filter)
    .select('name email contact phone position skills product client talentPoolIds')
    .sort({ updatedAt: -1 })
    .limit(Math.min(Number(limit) || 20, 40))
    .lean();

  if (!query && job && candidates.length) {
    const blob = contextBlob(job);
    candidates = candidates
      .map((c) => {
        const hay = `${c.position || ''} ${c.skills || ''} ${c.product || ''} ${c.client || ''}`.toLowerCase();
        const score = blob && hay
          ? blob.split(/\s+/).filter((w) => w.length >= 3 && hay.includes(w)).length
          : 0;
        const poolNames = pools
          .filter((p) => (c.talentPoolIds || []).some((id) => String(id) === String(p._id)))
          .map((p) => p.name);
        return { ...c, matchScore: score, poolNames };
      })
      .sort((a, b) => b.matchScore - a.matchScore);
  } else {
    const poolMap = new Map(pools.map((p) => [String(p._id), p.name]));
    candidates = candidates.map((c) => ({
      ...c,
      poolNames: (c.talentPoolIds || []).map((id) => poolMap.get(String(id))).filter(Boolean),
    }));
  }

  return {
    candidates,
    pools: matchedPools.map((p) => ({ _id: p._id, name: p.name, industry: p.industry || '' })),
    jobIndustry: job?.industry || '',
  };
}

async function suggestMembersForPool(organizationId, poolId, { q = '', limit = 20 } = {}) {
  const pool = await TalentPool.findOne({ _id: poolId, organizationId }).lean();
  if (!pool) throw httpError('Talent pool not found', 404);

  const inPool = await Candidate.find({ organizationId, talentPoolIds: pool._id }).distinct('_id');
  const filter = { organizationId, ...(inPool.length ? { _id: { $nin: inPool } } : {}) };
  const query = String(q || '').trim();

  if (query) {
    const rx = new RegExp(escapeRegex(query), 'i');
    filter.$or = [
      { name: rx },
      { email: rx },
      { position: rx },
      { skills: rx },
      { product: rx },
      { client: rx },
    ];
  } else {
    const needles = [pool.industry, pool.product, pool.name].map((s) => String(s || '').trim()).filter((s) => s.length >= 3);
    if (needles.length) {
      const regexes = needles.map((n) => new RegExp(escapeRegex(n), 'i'));
      filter.$or = [
        { skills: { $in: regexes } },
        { position: { $in: regexes } },
        { product: { $in: regexes } },
        { client: { $in: regexes } },
        { remark: { $in: regexes } },
      ];
    }
  }

  let candidates = await Candidate.find(filter)
    .select('name email contact phone position skills product talentPoolConsent')
    .sort({ updatedAt: -1 })
    .limit(Math.min(Number(limit) || 20, 40))
    .lean();

  if (!query && !candidates.length) {
    candidates = await Candidate.find({
      organizationId,
      ...(inPool.length ? { _id: { $nin: inPool } } : {}),
    })
      .select('name email contact phone position skills product talentPoolConsent')
      .sort({ updatedAt: -1 })
      .limit(Math.min(Number(limit) || 20, 40))
      .lean();
  }

  return { candidates, matchedByIndustry: !query && !!(pool.industry || pool.product || pool.name) };
}

async function uniqueLabels(values) {
  const seen = new Set();
  const out = [];
  for (const raw of values || []) {
    const name = String(raw || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

async function collectCatalogLabels(organizationId) {
  const Job = require('../models/Job');
  const OrgListItem = require('../models/OrgListItem');
  const { SEEDS } = require('../controller/orgListController');
  const { normalizeText } = require('../utils/textNormalize');

  const [industryItems, productItems, jobIndustries, jobSkills, candidateProducts] = await Promise.all([
    OrgListItem.find({ organizationId, listKey: 'industry', isActive: true }).select('name').lean(),
    OrgListItem.find({ organizationId, listKey: 'product', isActive: true }).select('name').lean(),
    Job.distinct('industry', { organizationId, industry: { $nin: [null, ''] } }),
    Job.distinct('skills', { organizationId }),
    Candidate.distinct('product', { organizationId, product: { $nin: [null, ''] } }),
  ]);

  let industries = await uniqueLabels([
    ...industryItems.map((i) => i.name),
    ...jobIndustries,
  ]);
  let products = await uniqueLabels([
    ...productItems.map((i) => i.name),
    ...candidateProducts,
    ...(Array.isArray(jobSkills) ? jobSkills : []),
  ]);

  if (!industries.length) {
    industries = await uniqueLabels((SEEDS.industry || []).map((n) => normalizeText(n)));
  }
  if (!products.length) {
    products = await uniqueLabels((SEEDS.product || []).map((n) => normalizeText(n)));
  }

  return { industries, products: products.slice(0, 40) };
}

async function seedStarterPools(organizationId, userId) {
  const existing = await TalentPool.find({ organizationId }).lean();
  const byName = new Map(existing.map((p) => [String(p.name || '').trim().toLowerCase(), p]));
  const byIndustry = new Map(
    existing.filter((p) => p.industry).map((p) => [String(p.industry).trim().toLowerCase(), p])
  );
  const byProduct = new Map(
    existing.filter((p) => p.product).map((p) => [String(p.product).trim().toLowerCase(), p])
  );

  const created = [];

  if (!existing.some((p) => p.isDefaultRejectPool)) {
    const warmName = 'Warm bench';
    if (!byName.has(warmName.toLowerCase())) {
      const warm = await TalentPool.create({
        organizationId,
        name: warmName,
        description: 'People rejected on one role who may fit another. Used automatically on reject.',
        color: '#0d9488',
        addOnReject: true,
        addOnDropped: true,
        isDefaultRejectPool: true,
        createdBy: userId,
      });
      created.push(warm);
    } else {
      const warm = await TalentPool.findOneAndUpdate(
        { _id: byName.get(warmName.toLowerCase())._id, organizationId },
        { $set: { addOnReject: true, addOnDropped: true, isDefaultRejectPool: true } },
        { new: true }
      );
      if (warm) created.push(warm);
    }
  }

  const { industries, products } = await collectCatalogLabels(organizationId);
  const colors = ['#0ea5e9', '#22c55e', '#f59e0b', '#a855f7', '#ef4444', '#14b8a6'];
  let colorIdx = 0;

  const makePool = async ({ name, description, industry = '', product = '' }) => {
    const key = name.toLowerCase();
    if (byName.has(key)) return;
    if (industry && byIndustry.has(industry.toLowerCase())) return;
    if (product && byProduct.has(product.toLowerCase())) return;
    const pool = await TalentPool.create({
      organizationId,
      name,
      description,
      color: colors[colorIdx % colors.length],
      industry,
      product,
      createdBy: userId,
    });
    byName.set(key, pool);
    if (industry) byIndustry.set(industry.toLowerCase(), pool);
    if (product) byProduct.set(product.toLowerCase(), pool);
    created.push(pool);
    colorIdx += 1;
  };

  for (const industry of industries) {
    await makePool({
      name: industry,
      description: `Reusable candidates for ${industry} roles.`,
      industry,
    });
  }
  for (const product of products) {
    await makePool({
      name: product,
      description: `Reusable candidates for ${product}.`,
      product,
    });
  }

  const pools = await listPools(organizationId);
  return { created: created.length, pools };
}

module.exports = {
  listPools,
  createPool,
  updatePool,
  suggestCandidates,
  runCampaign,
  deletePool,
  listPoolCandidates,
  addCandidates,
  removeCandidate,
  resolveRejectPools,
  enrollByTrigger,
  poolsForReject,
  listReusableForJob,
  suggestMembersForPool,
  seedStarterPools,
};
