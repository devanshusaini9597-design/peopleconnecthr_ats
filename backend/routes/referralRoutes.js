/**
 * Employee referral program — Professional+, gated by referrals.program.
 */
const express = require('express');
const router = express.Router();
const Referral = require('../models/Referral');
const Organization = require('../models/Organization');
const { verifyToken } = require('../middleware/authMiddleware');
const { requireRecruiterOrAbove } = require('../middleware/rbacMiddleware');
const { requireOrganization, tenantScope } = require('../middleware/tenantMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const { planHasFeature } = require('../config/planFeatures');

const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

/** GET /public/:orgSlug/:code — validate referral code (public) */
router.get('/public/:orgSlug/:code', async (req, res) => {
  try {
    const org = await Organization.findOne({ slug: req.params.orgSlug }).select('name plan slug');
    if (!org || !planHasFeature(org.plan, 'referrals.program')) {
      return res.status(404).json({ success: false, message: 'Referral program not available' });
    }
    const referral = await Referral.findOne({
      organizationId: org._id,
      code: req.params.code.toUpperCase()
    }).select('code referrerName');
    if (!referral) return res.status(404).json({ success: false, message: 'Invalid referral code' });
    res.json({ success: true, data: { valid: true, organizationName: org.name, referrerName: referral.referrerName } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.use(verifyToken, requireOrganization, tenantScope, requireFeature('referrals.program'));

/** GET / */
router.get('/', requireRecruiterOrAbove, async (req, res) => {
  try {
    const referrals = await Referral.find({ organizationId: req.user.organizationId })
      .sort({ createdAt: -1 })
      .limit(200);
    res.json({ success: true, data: referrals });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** POST / — create referral code */
router.post('/', requireRecruiterOrAbove, async (req, res) => {
  try {
    const code = (req.body.code || Referral.generateCode()).toUpperCase();
    const existing = await Referral.findOne({ organizationId: req.user.organizationId, code });
    if (existing) return res.status(400).json({ success: false, message: 'Referral code already exists' });

    const org = await Organization.findById(req.user.organizationId).select('slug');
    const referral = new Referral({
      organizationId: req.user.organizationId,
      code,
      referrerUserId: req.user.id,
      referrerName: req.body.referrerName || req.user.name || '',
      rewardAmount: req.body.rewardAmount,
      rewardCurrency: req.body.rewardCurrency || 'INR'
    });
    await referral.save();

    const link = `${FRONTEND_URL}/careers/${org.slug}?ref=${code}`;
    res.status(201).json({ success: true, data: { ...referral.toObject(), shareLink: link } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** PATCH /:id/reward — update reward status */
router.patch('/:id/reward', requireRecruiterOrAbove, async (req, res) => {
  try {
    const referral = await Referral.findOne({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!referral) return res.status(404).json({ success: false, message: 'Referral not found' });
    const { rewardStatus, notes } = req.body;
    if (rewardStatus) referral.rewardStatus = rewardStatus;
    if (notes !== undefined) referral.notes = notes;
    if (rewardStatus === 'paid') referral.hiredAt = referral.hiredAt || new Date();
    await referral.save();
    res.json({ success: true, data: referral });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** POST /track — attach candidate to referral code */
router.post('/track', requireRecruiterOrAbove, async (req, res) => {
  try {
    const { code, candidateEmail, candidateName, applicationId, candidateId, jobId } = req.body;
    if (!code) return res.status(400).json({ success: false, message: 'code is required' });

    const referral = await Referral.findOne({
      organizationId: req.user.organizationId,
      code: code.toUpperCase()
    });
    if (!referral) return res.status(404).json({ success: false, message: 'Referral not found' });

    if (candidateEmail) referral.candidateEmail = candidateEmail;
    if (candidateName) referral.candidateName = candidateName;
    if (applicationId) referral.applicationId = applicationId;
    if (candidateId) referral.candidateId = candidateId;
    if (jobId) referral.jobId = jobId;
    await referral.save();
    res.json({ success: true, data: referral });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
