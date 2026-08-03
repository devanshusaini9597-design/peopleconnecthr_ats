/**
 * Custom job application forms — careers.formBuilder (Professional+)
 */

const express = require('express');
const router = express.Router();
const JobApplicationForm = require('../models/JobApplicationForm');
const Job = require('../models/Job');
const { verifyToken } = require('../middleware/authMiddleware');
const { requireOrganization, tenantScope } = require('../middleware/tenantMiddleware');
const { requireRecruiterOrAbove } = require('../middleware/rbacMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');

router.use(verifyToken, requireOrganization, tenantScope, requireFeature('careers.formBuilder'));

const slugKey = (label, idx) => {
  const base = String(label || `field_${idx}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
  return base || `field_${idx}`;
};

// GET /api/forms — list forms for org
router.get('/', async (req, res) => {
  try {
    const forms = await JobApplicationForm.find({ organizationId: req.user.organizationId })
      .populate('jobId', 'title status isPublished')
      .sort({ updatedAt: -1 })
      .lean();
    res.json({ success: true, data: forms });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/forms/job/:jobId
router.get('/job/:jobId', async (req, res) => {
  try {
    const form = await JobApplicationForm.findOne({
      organizationId: req.user.organizationId,
      jobId: req.params.jobId
    }).lean();
    res.json({ success: true, data: form });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/forms/job/:jobId — upsert form
router.put('/job/:jobId', requireRecruiterOrAbove, async (req, res) => {
  try {
    const job = await Job.findOne({ _id: req.params.jobId, organizationId: req.user.organizationId });
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

    const { title = 'Application Form', fields = [], isActive = true } = req.body;
    if (!Array.isArray(fields) || fields.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one field is required' });
    }

    const normalized = fields.map((f, idx) => ({
      key: f.key || slugKey(f.label, idx),
      label: String(f.label || '').trim() || `Field ${idx + 1}`,
      type: f.type || 'text',
      required: !!f.required,
      placeholder: f.placeholder || '',
      options: Array.isArray(f.options) ? f.options.filter(Boolean) : [],
      order: idx,
      showWhen: {
        fieldKey: f.showWhen?.fieldKey || '',
        equals: f.showWhen?.equals || ''
      }
    }));

    const form = await JobApplicationForm.findOneAndUpdate(
      { organizationId: req.user.organizationId, jobId: job._id },
      {
        $set: {
          title: String(title).trim() || 'Application Form',
          fields: normalized,
          isActive: !!isActive
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, data: form });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/forms/job/:jobId
router.delete('/job/:jobId', requireRecruiterOrAbove, async (req, res) => {
  try {
    await JobApplicationForm.findOneAndDelete({
      organizationId: req.user.organizationId,
      jobId: req.params.jobId
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
