/**
 * Candidate surveys — Starter+, gated by candidates.surveys.
 */
const express = require('express');
const router = express.Router();
const CandidateSurvey = require('../models/CandidateSurvey');
const { verifyToken } = require('../middleware/authMiddleware');
const { requireRecruiterOrAbove } = require('../middleware/rbacMiddleware');
const { requireOrganization, tenantScope } = require('../middleware/tenantMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');

const DEFAULT_QUESTIONS = [
  { prompt: 'How would you rate your overall experience?', type: 'rating', required: true },
  { prompt: 'How likely are you to recommend this company? (0-10)', type: 'nps', required: true },
  { prompt: 'Any additional feedback?', type: 'text', required: false }
];

/** GET /take/:token — public fetch survey */
router.get('/take/:token', async (req, res) => {
  try {
    const survey = await CandidateSurvey.findOne({ token: req.params.token });
    if (!survey) return res.status(404).json({ success: false, message: 'Survey not found' });
    if (survey.expiresAt && survey.expiresAt < new Date() && survey.status === 'pending') {
      survey.status = 'expired';
      await survey.save();
    }
    if (survey.status === 'submitted') {
      return res.json({ success: true, data: { submitted: true } });
    }
    if (survey.status === 'expired') {
      return res.status(410).json({ success: false, message: 'This survey has expired.' });
    }
    res.json({
      success: true,
      data: {
        submitted: false,
        title: survey.title,
        triggerType: survey.triggerType,
        questions: survey.questions
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** POST /take/:token/submit — public submit */
router.post('/take/:token/submit', async (req, res) => {
  try {
    const survey = await CandidateSurvey.findOne({ token: req.params.token });
    if (!survey) return res.status(404).json({ success: false, message: 'Survey not found' });
    if (survey.status === 'submitted') {
      return res.status(400).json({ success: false, message: 'Survey already submitted.' });
    }

    const { answers } = req.body;
    if (!Array.isArray(answers)) {
      return res.status(400).json({ success: false, message: 'answers array is required' });
    }

    survey.answers = answers;
    survey.status = 'submitted';
    survey.submittedAt = new Date();
    await survey.save();
    res.json({ success: true, message: 'Thank you for your feedback!' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.use(verifyToken, requireOrganization, tenantScope, requireFeature('candidates.surveys'));

/** GET / — list surveys */
router.get('/', requireRecruiterOrAbove, async (req, res) => {
  try {
    const filter = { organizationId: req.user.organizationId };
    if (req.query.triggerType) filter.triggerType = req.query.triggerType;
    if (req.query.status) filter.status = req.query.status;
    const surveys = await CandidateSurvey.find(filter).sort({ createdAt: -1 }).limit(200);
    res.json({ success: true, data: surveys });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** POST / — create and send survey */
router.post('/', requireRecruiterOrAbove, async (req, res) => {
  try {
    const { applicationId, candidateId, triggerType, title, questions, expiresInDays } = req.body;
    if (!triggerType || !['post_interview', 'post_rejection'].includes(triggerType)) {
      return res.status(400).json({ success: false, message: "triggerType must be 'post_interview' or 'post_rejection'" });
    }

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const survey = new CandidateSurvey({
      organizationId: req.user.organizationId,
      applicationId,
      candidateId,
      triggerType,
      title: title || 'Candidate Experience Survey',
      questions: questions || DEFAULT_QUESTIONS,
      expiresAt,
      sentBy: req.user.id
    });
    await survey.save();

    const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    res.status(201).json({
      success: true,
      data: {
        ...survey.toObject(),
        surveyUrl: `${FRONTEND_URL}/survey/${survey.token}`
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
