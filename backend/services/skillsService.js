/**
 * Skills taxonomy domain logic.
 */
const Skill = require('../models/Skill');
const CandidateSkill = require('../models/CandidateSkill');
const JobSkill = require('../models/JobSkill');
const Candidate = require('../models/Candidate');
const Job = require('../models/Job');
const { slugifySkill, orgSkillSlug, computeSkillMatch } = require('../utils/skillHelpers');
const SEED = require('../data/skills-seed');

const slugify = slugifySkill;

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

function buildSkillsFilter(orgId, { q = '', category = '', source = 'all' } = {}) {
  const filter = {};
  if (source === 'system') {
    filter.isSystem = true;
  } else if (source === 'custom') {
    filter.organizationId = orgId;
    filter.isSystem = false;
  } else {
    filter.$or = [{ isSystem: true }, { organizationId: orgId }];
  }
  if (category) filter.category = category;
  if (String(q).trim()) {
    filter.name = { $regex: String(q).trim(), $options: 'i' };
  }
  return filter;
}

async function listSkills(organizationId, query = {}) {
  const { q = '', category = '', source = 'all' } = query;
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 50));
  const safeSource = ['all', 'system', 'custom'].includes(source) ? source : 'all';

  const filter = buildSkillsFilter(organizationId, { q, category, source: safeSource });
  const baseScope = { $or: [{ isSystem: true }, { organizationId }] };

  const [total, skills, categories, countAll, countSystem, countCustom] = await Promise.all([
    Skill.countDocuments(filter),
    Skill.find(filter)
      .sort({ category: 1, name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Skill.distinct('category', baseScope),
    Skill.countDocuments(buildSkillsFilter(organizationId, { q, category, source: 'all' })),
    Skill.countDocuments(buildSkillsFilter(organizationId, { q, category, source: 'system' })),
    Skill.countDocuments(buildSkillsFilter(organizationId, { q, category, source: 'custom' }))
  ]);

  const pages = Math.max(1, Math.ceil(total / limit));
  return {
    data: skills,
    total,
    categories: categories.sort(),
    counts: { total: countAll, system: countSystem, custom: countCustom },
    pagination: {
      page,
      limit,
      total,
      pages,
      hasMore: page < pages
    }
  };
}

async function createSkill(organizationId, body = {}) {
  const name = String(body.name || '').trim();
  const category = String(body.category || 'Custom').trim() || 'Custom';
  if (!name) throw httpError('Skill name is required', 400);

  const slug = orgSkillSlug(organizationId, name);

  const existing = await Skill.findOne({
    $or: [
      { slug, organizationId },
      { isSystem: true, slug: slugify(name) }
    ]
  });
  if (existing) {
    throw httpError('Skill already exists', 409, { data: existing });
  }

  try {
    return await Skill.create({
      organizationId,
      name,
      slug,
      category,
      isSystem: false
    });
  } catch (error) {
    if (error.code === 11000) {
      throw httpError('Skill already exists', 409);
    }
    throw error;
  }
}

async function seedSkills() {
  let created = 0;
  let skipped = 0;
  for (const item of SEED) {
    const slug = slugify(item.name);
    const exists = await Skill.findOne({ slug, isSystem: true });
    if (exists) {
      skipped++;
      continue;
    }
    await Skill.create({
      name: item.name,
      slug,
      category: item.category || 'Other',
      isSystem: true,
      organizationId: null
    });
    created++;
  }
  return { created, skipped, total: SEED.length };
}

async function getCandidateSkills(organizationId, candidateId) {
  return CandidateSkill.find({
    organizationId,
    candidateId
  }).populate('skillId').lean();
}

async function replaceCandidateSkills(organizationId, candidateId, body = {}) {
  const candidate = await Candidate.findOne({ _id: candidateId, organizationId });
  if (!candidate) throw httpError('Candidate not found', 404);

  const skills = Array.isArray(body.skills) ? body.skills : [];
  await CandidateSkill.deleteMany({ candidateId: candidate._id, organizationId });

  const docs = [];
  for (const s of skills) {
    if (!s.skillId) continue;
    docs.push({
      organizationId,
      candidateId: candidate._id,
      skillId: s.skillId,
      proficiency: Math.min(5, Math.max(1, Number(s.proficiency) || 3)),
      yearsUsed: s.yearsUsed != null ? Number(s.yearsUsed) : null
    });
  }
  if (docs.length) await CandidateSkill.insertMany(docs);

  const populated = await CandidateSkill.find({ candidateId: candidate._id }).populate('skillId').lean();
  const names = populated.map((r) => r.skillId?.name).filter(Boolean);
  if (names.length) {
    candidate.skills = names.join(', ');
    await candidate.save();
  }

  return populated;
}

async function getJobSkills(organizationId, jobId) {
  return JobSkill.find({
    organizationId,
    jobId
  }).populate('skillId').lean();
}

async function replaceJobSkills(organizationId, jobId, body = {}) {
  const job = await Job.findOne({ _id: jobId, organizationId });
  if (!job) throw httpError('Job not found', 404);

  const skills = Array.isArray(body.skills) ? body.skills : [];
  await JobSkill.deleteMany({ jobId: job._id, organizationId });

  const docs = skills
    .filter((s) => s.skillId)
    .map((s) => ({
      organizationId,
      jobId: job._id,
      skillId: s.skillId,
      required: s.required !== false,
      minProficiency: Math.min(5, Math.max(1, Number(s.minProficiency) || 2)),
      weight: Math.min(5, Math.max(0.5, Number(s.weight) || 1))
    }));
  if (docs.length) await JobSkill.insertMany(docs);

  return JobSkill.find({ jobId: job._id }).populate('skillId').lean();
}

async function matchSkills(organizationId, body = {}) {
  const { jobId, candidateId } = body;
  if (!jobId || !candidateId) {
    throw httpError('jobId and candidateId are required', 400);
  }

  const [jobSkills, candidateSkills] = await Promise.all([
    JobSkill.find({ organizationId, jobId }).populate('skillId').lean(),
    CandidateSkill.find({ organizationId, candidateId }).lean()
  ]);

  return computeSkillMatch(jobSkills, candidateSkills);
}

async function updateSkill(organizationId, skillId, body = {}) {
  const skill = await Skill.findOne({
    _id: skillId,
    organizationId,
    isSystem: false
  });
  if (!skill) {
    const maybeSystem = await Skill.findById(skillId).select('isSystem').lean();
    if (maybeSystem?.isSystem) {
      throw httpError('System skills cannot be edited', 403);
    }
    throw httpError('Custom skill not found', 404);
  }

  const name = body.name != null ? String(body.name).trim() : skill.name;
  const category = body.category != null
    ? (String(body.category).trim() || 'Custom')
    : skill.category;
  if (!name) throw httpError('Skill name is required', 400);

  const nextSlug = orgSkillSlug(organizationId, name);
  if (nextSlug !== skill.slug) {
    const conflict = await Skill.findOne({
      _id: { $ne: skill._id },
      $or: [
        { slug: nextSlug, organizationId },
        { isSystem: true, slug: slugify(name) }
      ]
    });
    if (conflict) {
      throw httpError('Skill already exists', 409);
    }
    skill.slug = nextSlug;
  }

  skill.name = name;
  skill.category = category;
  try {
    await skill.save();
    return skill;
  } catch (error) {
    if (error.code === 11000) {
      throw httpError('Skill already exists', 409);
    }
    throw error;
  }
}

async function deleteSkill(organizationId, skillId) {
  const skill = await Skill.findOne({
    _id: skillId,
    organizationId,
    isSystem: false
  });
  if (!skill) throw httpError('Custom skill not found', 404);
  await CandidateSkill.deleteMany({ skillId: skill._id });
  await JobSkill.deleteMany({ skillId: skill._id });
  await skill.deleteOne();
  return { success: true };
}

module.exports = {
  buildSkillsFilter,
  listSkills,
  createSkill,
  seedSkills,
  getCandidateSkills,
  replaceCandidateSkills,
  getJobSkills,
  replaceJobSkills,
  matchSkills,
  updateSkill,
  deleteSkill,
};
