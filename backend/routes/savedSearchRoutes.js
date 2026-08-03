const express = require('express');
const router = express.Router();
const SavedSearch = require('../models/SavedSearch');
const Candidate = require('../models/Candidate');
const { requireFeature } = require('../middleware/featureMiddleware');
const { requireRecruiterOrAbove } = require('../middleware/rbacMiddleware');

router.use(requireFeature('candidates.savedSearches'));

router.get('/', async (req, res) => {
  try {
    const rows = await SavedSearch.find({
      organizationId: req.user.organizationId,
      userId: req.user.id || req.user._id
    }).sort({ updatedAt: -1 }).lean();
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', requireRecruiterOrAbove, async (req, res) => {
  try {
    const { name, query = '', filters = {}, alertFrequency = 'none' } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Name is required' });
    const row = await SavedSearch.create({
      organizationId: req.user.organizationId,
      userId: req.user.id || req.user._id,
      name: name.trim(),
      query,
      filters,
      alertFrequency
    });
    res.status(201).json({ success: true, data: row });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'Search name already exists' });
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/:id', requireRecruiterOrAbove, async (req, res) => {
  try {
    const update = {};
    ['name', 'query', 'filters', 'alertFrequency'].forEach((k) => {
      if (req.body[k] !== undefined) update[k] = req.body[k];
    });
    const row = await SavedSearch.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.user.organizationId, userId: req.user.id || req.user._id },
      { $set: update },
      { new: true }
    );
    if (!row) return res.status(404).json({ success: false, message: 'Saved search not found' });
    res.json({ success: true, data: row });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', requireRecruiterOrAbove, async (req, res) => {
  try {
    await SavedSearch.findOneAndDelete({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      userId: req.user.id || req.user._id
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/run', async (req, res) => {
  try {
    const saved = await SavedSearch.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      userId: req.user.id || req.user._id
    });
    if (!saved) return res.status(404).json({ success: false, message: 'Saved search not found' });

    const filter = { organizationId: req.user.organizationId };
    const q = (saved.query || '').trim();
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { skills: { $regex: q, $options: 'i' } },
        { position: { $regex: q, $options: 'i' } }
      ];
    }
    const f = saved.filters || {};
    if (f.position) filter.position = { $regex: f.position, $options: 'i' };
    if (f.location) filter.location = { $regex: f.location, $options: 'i' };
    if (f.source) filter.source = f.source;

    const results = await Candidate.find(filter).select('name email position skills location source status').limit(100).lean();
    saved.lastResultCount = results.length;
    saved.lastAlertAt = new Date();
    await saved.save();

    res.json({ success: true, data: { count: results.length, results, saved } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
