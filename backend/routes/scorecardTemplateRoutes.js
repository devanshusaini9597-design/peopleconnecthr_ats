const express = require('express');
const router = express.Router();
const ScorecardTemplate = require('../models/ScorecardTemplate');
const { requireFeature } = require('../middleware/featureMiddleware');
const { requireRecruiterOrAbove } = require('../middleware/rbacMiddleware');

/** List templates for scorecard filling — available to authenticated org users */
router.get('/', async (req, res) => {
  try {
    const rows = await ScorecardTemplate.find({ organizationId: req.user.organizationId }).sort({ isDefault: -1, name: 1 }).lean();
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.use(requireFeature('scorecards.templates'));

router.post('/', requireRecruiterOrAbove, async (req, res) => {
  try {
    const { name, description = '', criteria = [], isDefault = false } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Name is required' });
    if (!Array.isArray(criteria) || criteria.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one criterion is required' });
    }
    if (isDefault) {
      await ScorecardTemplate.updateMany(
        { organizationId: req.user.organizationId },
        { $set: { isDefault: false } }
      );
    }
    const row = await ScorecardTemplate.create({
      organizationId: req.user.organizationId,
      name: name.trim(),
      description,
      criteria: criteria.map((c) => ({
        name: c.name,
        description: c.description || '',
        weight: Number(c.weight) || 1,
        suggestedQuestions: Array.isArray(c.suggestedQuestions) ? c.suggestedQuestions : []
      })),
      isDefault: !!isDefault,
      createdBy: req.user.id || req.user._id
    });
    res.status(201).json({ success: true, data: row });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'Template name exists' });
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', requireRecruiterOrAbove, async (req, res) => {
  try {
    const update = {};
    ['name', 'description', 'criteria', 'isDefault'].forEach((k) => {
      if (req.body[k] !== undefined) update[k] = req.body[k];
    });
    if (update.isDefault) {
      await ScorecardTemplate.updateMany(
        { organizationId: req.user.organizationId, _id: { $ne: req.params.id } },
        { $set: { isDefault: false } }
      );
    }
    const row = await ScorecardTemplate.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.user.organizationId },
      { $set: update },
      { new: true }
    );
    if (!row) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: row });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', requireRecruiterOrAbove, async (req, res) => {
  try {
    await ScorecardTemplate.findOneAndDelete({ _id: req.params.id, organizationId: req.user.organizationId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
