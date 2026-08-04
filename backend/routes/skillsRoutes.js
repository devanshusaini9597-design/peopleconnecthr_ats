/**
 * Skills taxonomy — Professional+ (candidates.skillsTaxonomy)
 */

const express = require('express');
const router = express.Router();
const Skill = require('../models/Skill');
const CandidateSkill = require('../models/CandidateSkill');
const JobSkill = require('../models/JobSkill');
const Candidate = require('../models/Candidate');
const Job = require('../models/Job');
const { requireRecruiterOrAbove } = require('../middleware/rbacMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const { slugifySkill, orgSkillSlug, computeSkillMatch } = require('../utils/skillHelpers');
const SEED = require('../data/skills-seed');

router.use(requireFeature('candidates.skillsTaxonomy'));

const slugify = slugifySkill;

// GET /api/skills
router.get('/', async (req, res) => {
  try {
    const { q = '', category = '', limit = 200 } = req.query;
    const orgId = req.user.organizationId;
    const filter = {
      $or: [{ isSystem: true }, { organizationId: orgId }]
    };
    if (category) filter.category = category;
    if (q.trim()) {
      filter.name = { $regex: q.trim(), $options: 'i' };
    }

    const skills = await Skill.find(filter)
      .sort({ category: 1, name: 1 })
      .limit(Math.min(Number(limit) || 200, 500))
      .lean();

    const categories = await Skill.distinct('category', {
      $or: [{ isSystem: true }, { organizationId: orgId }]
    });

    res.json({ success: true, data: skills, total: skills.length, categories: categories.sort() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/skills — create org custom skill
router.post('/', requireRecruiterOrAbove, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const category = String(req.body.category || 'Custom').trim() || 'Custom';
    if (!name) return res.status(400).json({ success: false, message: 'Skill name is required' });

    const orgId = req.user.organizationId;
    const slug = orgSkillSlug(orgId, name);

    const existing = await Skill.findOne({
      $or: [
        { slug, organizationId: orgId },
        { isSystem: true, slug: slugify(name) }
      ]
    });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Skill already exists', data: existing });
    }

    const skill = await Skill.create({
      organizationId: orgId,
      name,
      slug,
      category,
      isSystem: false
    });
    res.status(201).json({ success: true, data: skill });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Skill already exists' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/skills/seed — import system catalog
router.post('/seed', requireRecruiterOrAbove, async (req, res) => {
  try {
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
    res.json({ success: true, created, skipped, total: SEED.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/skills/candidate/:candidateId
router.get('/candidate/:candidateId', async (req, res) => {
  try {
    const rows = await CandidateSkill.find({
      organizationId: req.user.organizationId,
      candidateId: req.params.candidateId
    }).populate('skillId').lean();
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/skills/candidate/:candidateId — replace candidate skills
router.put('/candidate/:candidateId', requireRecruiterOrAbove, async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const candidate = await Candidate.findOne({ _id: req.params.candidateId, organizationId: orgId });
    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });

    const skills = Array.isArray(req.body.skills) ? req.body.skills : [];
    await CandidateSkill.deleteMany({ candidateId: candidate._id, organizationId: orgId });

    const docs = [];
    for (const s of skills) {
      if (!s.skillId) continue;
      docs.push({
        organizationId: orgId,
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

    res.json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/skills/job/:jobId
router.get('/job/:jobId', async (req, res) => {
  try {
    const rows = await JobSkill.find({
      organizationId: req.user.organizationId,
      jobId: req.params.jobId
    }).populate('skillId').lean();
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/skills/job/:jobId
router.put('/job/:jobId', requireRecruiterOrAbove, async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const job = await Job.findOne({ _id: req.params.jobId, organizationId: orgId });
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

    const skills = Array.isArray(req.body.skills) ? req.body.skills : [];
    await JobSkill.deleteMany({ jobId: job._id, organizationId: orgId });

    const docs = skills
      .filter((s) => s.skillId)
      .map((s) => ({
        organizationId: orgId,
        jobId: job._id,
        skillId: s.skillId,
        required: s.required !== false,
        minProficiency: Math.min(5, Math.max(1, Number(s.minProficiency) || 2)),
        weight: Math.min(5, Math.max(0.5, Number(s.weight) || 1))
      }));
    if (docs.length) await JobSkill.insertMany(docs);

    const populated = await JobSkill.find({ jobId: job._id }).populate('skillId').lean();
    res.json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/skills/match — { jobId, candidateId }
router.post('/match', async (req, res) => {
  try {
    const { jobId, candidateId } = req.body;
    const orgId = req.user.organizationId;
    if (!jobId || !candidateId) {
      return res.status(400).json({ success: false, message: 'jobId and candidateId are required' });
    }

    const [jobSkills, candidateSkills] = await Promise.all([
      JobSkill.find({ organizationId: orgId, jobId }).populate('skillId').lean(),
      CandidateSkill.find({ organizationId: orgId, candidateId }).lean()
    ]);

    const result = computeSkillMatch(jobSkills, candidateSkills);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/skills/:id — rename / recategorize org custom skills only
router.patch('/:id', requireRecruiterOrAbove, async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const skill = await Skill.findOne({
      _id: req.params.id,
      organizationId: orgId,
      isSystem: false
    });
    if (!skill) {
      const maybeSystem = await Skill.findById(req.params.id).select('isSystem').lean();
      if (maybeSystem?.isSystem) {
        return res.status(403).json({ success: false, message: 'System skills cannot be edited' });
      }
      return res.status(404).json({ success: false, message: 'Custom skill not found' });
    }

    const name = req.body.name != null ? String(req.body.name).trim() : skill.name;
    const category = req.body.category != null
      ? (String(req.body.category).trim() || 'Custom')
      : skill.category;
    if (!name) return res.status(400).json({ success: false, message: 'Skill name is required' });

    const nextSlug = orgSkillSlug(orgId, name);
    if (nextSlug !== skill.slug) {
      const conflict = await Skill.findOne({
        _id: { $ne: skill._id },
        $or: [
          { slug: nextSlug, organizationId: orgId },
          { isSystem: true, slug: slugify(name) }
        ]
      });
      if (conflict) {
        return res.status(409).json({ success: false, message: 'Skill already exists' });
      }
      skill.slug = nextSlug;
    }

    skill.name = name;
    skill.category = category;
    await skill.save();
    res.json({ success: true, data: skill });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Skill already exists' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/skills/:id — only org custom skills
router.delete('/:id', requireRecruiterOrAbove, async (req, res) => {
  try {
    const skill = await Skill.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      isSystem: false
    });
    if (!skill) return res.status(404).json({ success: false, message: 'Custom skill not found' });
    await CandidateSkill.deleteMany({ skillId: skill._id });
    await JobSkill.deleteMany({ skillId: skill._id });
    await skill.deleteOne();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
