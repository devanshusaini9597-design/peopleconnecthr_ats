/**
 * Messaging consent (TCPA) — messaging.consent
 */

const express = require('express');
const router = express.Router();
const Candidate = require('../models/Candidate');
const { verifyToken } = require('../middleware/authMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const { requireRecruiterOrAbove } = require('../middleware/rbacMiddleware');

/** Public self-service opt-in/out via token */
router.post('/public/:candidateId', async (req, res) => {
  try {
    const { token, email, sms, whatsapp, talentPoolOptIn } = req.body;
    const c = await Candidate.findById(req.params.candidateId);
    if (!c) return res.status(404).json({ success: false, message: 'Not found' });
    const expected = (c.personId || String(c._id)).slice(0, 16);
    if (!token || token !== expected) {
      return res.status(403).json({ success: false, message: 'Invalid consent token' });
    }
    if (!c.messagingConsent) c.messagingConsent = {};
    if (typeof email === 'boolean') c.messagingConsent.email = email;
    if (typeof sms === 'boolean') c.messagingConsent.sms = sms;
    if (typeof whatsapp === 'boolean') c.messagingConsent.whatsapp = whatsapp;
    c.messagingConsent.updatedAt = new Date();
    if (typeof talentPoolOptIn === 'boolean') {
      c.talentPoolConsent = { optedIn: talentPoolOptIn, updatedAt: new Date() };
    }
    await c.save();
    res.json({
      success: true,
      data: { messagingConsent: c.messagingConsent, talentPoolConsent: c.talentPoolConsent }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.use(verifyToken, requireFeature('messaging.consent'));

router.get('/candidate/:id', async (req, res) => {
  try {
    const c = await Candidate.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    }).select('name email phone contact messagingConsent phoneVerifiedAt talentPoolConsent');
    if (!c) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: c });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/candidate/:id', requireRecruiterOrAbove, async (req, res) => {
  try {
    const { email, sms, whatsapp, phoneVerified, talentPoolOptIn } = req.body;
    const update = {};
    if (typeof email === 'boolean') update['messagingConsent.email'] = email;
    if (typeof sms === 'boolean') update['messagingConsent.sms'] = sms;
    if (typeof whatsapp === 'boolean') update['messagingConsent.whatsapp'] = whatsapp;
    update['messagingConsent.updatedAt'] = new Date();
    if (phoneVerified === true) update.phoneVerifiedAt = new Date();
    if (typeof talentPoolOptIn === 'boolean') {
      update['talentPoolConsent.optedIn'] = talentPoolOptIn;
      update['talentPoolConsent.updatedAt'] = new Date();
    }

    const c = await Candidate.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.user.organizationId },
      { $set: update },
      { new: true }
    ).select('name messagingConsent phoneVerifiedAt talentPoolConsent');
    if (!c) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: c });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
