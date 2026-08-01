/**
 * Talent Pools — Add-on (feature key: candidates.talentPools)
 *
 * Silver-medalist / passive-candidate database, independent of any single
 * job requisition. Mounted at /api/talent-pools with verifyToken +
 * requireFeature('candidates.talentPools') applied in server.js, so every
 * route here can assume req.user.organizationId is present and entitled.
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const TalentPool = require('../models/TalentPool');
const Candidate = require('../models/Candidate');
const { requireRecruiterOrAbove } = require('../middleware/rbacMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');

// verifyToken is applied where this router is mounted (server.js); gate the
// whole router by plan entitlement here so every route below inherits it.
router.use(requireFeature('candidates.talentPools'));

// GET /api/talent-pools — list pools with live member counts
router.get('/', async (req, res) => {
  try {
    const pools = await TalentPool.find({ organizationId: req.user.organizationId }).sort({ createdAt: -1 }).lean();
    const counts = await Candidate.aggregate([
      { $match: { organizationId: new mongoose.Types.ObjectId(req.user.organizationId), talentPoolIds: { $exists: true, $ne: [] } } },
      { $unwind: '$talentPoolIds' },
      { $group: { _id: '$talentPoolIds', count: { $sum: 1 } } }
    ]);
    const countMap = new Map(counts.map(c => [String(c._id), c.count]));
    const data = pools.map(p => ({ ...p, memberCount: countMap.get(String(p._id)) || 0 }));
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/talent-pools — create a pool
router.post('/', requireRecruiterOrAbove, async (req, res) => {
  try {
    const { name, description = '', color = '#6366f1' } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Pool name is required' });

    const pool = await TalentPool.create({
      organizationId: req.user.organizationId,
      name: name.trim(),
      description,
      color,
      createdBy: req.user.id || req.user._id
    });
    res.status(201).json({ success: true, data: pool });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'A talent pool with this name already exists' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/talent-pools/:id — rename / restyle a pool
router.patch('/:id', requireRecruiterOrAbove, async (req, res) => {
  try {
    const { name, description, color } = req.body;
    const update = {};
    if (name !== undefined) update.name = name.trim();
    if (description !== undefined) update.description = description;
    if (color !== undefined) update.color = color;

    const pool = await TalentPool.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.user.organizationId },
      { $set: update },
      { new: true }
    );
    if (!pool) return res.status(404).json({ success: false, message: 'Talent pool not found' });
    res.json({ success: true, data: pool });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/talent-pools/:id — delete a pool and unlink it from candidates
router.delete('/:id', requireRecruiterOrAbove, async (req, res) => {
  try {
    const pool = await TalentPool.findOneAndDelete({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!pool) return res.status(404).json({ success: false, message: 'Talent pool not found' });

    await Candidate.updateMany(
      { organizationId: req.user.organizationId, talentPoolIds: pool._id },
      { $pull: { talentPoolIds: pool._id } }
    );

    res.json({ success: true, message: 'Talent pool deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/talent-pools/:id/candidates — list members of a pool
router.get('/:id/candidates', async (req, res) => {
  try {
    const pool = await TalentPool.findOne({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!pool) return res.status(404).json({ success: false, message: 'Talent pool not found' });

    const candidates = await Candidate.find({
      organizationId: req.user.organizationId,
      talentPoolIds: pool._id
    })
      .select('name email contact phone position location experience skills status createdAt')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: { pool, candidates } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/talent-pools/:id/candidates — add one or more candidates to a pool
// body: { candidateIds: [ObjectId] }
router.post('/:id/candidates', requireRecruiterOrAbove, async (req, res) => {
  try {
    const { candidateIds } = req.body;
    if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
      return res.status(400).json({ success: false, message: 'candidateIds must be a non-empty array' });
    }

    const pool = await TalentPool.findOne({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!pool) return res.status(404).json({ success: false, message: 'Talent pool not found' });

    const result = await Candidate.updateMany(
      { _id: { $in: candidateIds }, organizationId: req.user.organizationId },
      { $addToSet: { talentPoolIds: pool._id } }
    );

    res.json({ success: true, message: `${result.modifiedCount} candidate(s) added to pool` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/talent-pools/:id/candidates/:candidateId — remove one candidate
router.delete('/:id/candidates/:candidateId', requireRecruiterOrAbove, async (req, res) => {
  try {
    const pool = await TalentPool.findOne({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!pool) return res.status(404).json({ success: false, message: 'Talent pool not found' });

    await Candidate.findOneAndUpdate(
      { _id: req.params.candidateId, organizationId: req.user.organizationId },
      { $pull: { talentPoolIds: pool._id } }
    );

    res.json({ success: true, message: 'Candidate removed from pool' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
