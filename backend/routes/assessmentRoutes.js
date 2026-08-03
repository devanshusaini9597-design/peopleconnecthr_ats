/**
 * Assessments — Add-on (feature key: assessments, Professional+)
 *
 * Recruiter-facing routes (template CRUD, sending invites, grading) require
 * a session + plan entitlement. Candidate-facing routes (view/submit a
 * specific invite) are token-gated instead, same magic-link pattern as
 * routes/portalRoutes.js, and are mounted BEFORE the session-gate
 * middleware below so they stay reachable without a recruiter login.
 */

const express = require('express');
const router = express.Router();
const Assessment = require('../models/Assessment');
const AssessmentInvite = require('../models/AssessmentInvite');
const Candidate = require('../models/Candidate');
const { verifyToken } = require('../middleware/authMiddleware');
const { requireOrganization, tenantScope } = require('../middleware/tenantMiddleware');
const { requireRecruiterOrAbove } = require('../middleware/rbacMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const { sendEmail } = require('../services/emailService');
const { planHasFeature } = require('../config/planFeatures');
const Organization = require('../models/Organization');
const { computeRiskScore, summarizeEvents } = require('../utils/proctoring');

// ── Candidate-facing (token auth, no session) ─────────────────────────

/** GET /api/assessments/take/:token — fetch the assessment (never leaks correctOptionIndex) */
router.get('/take/:token', async (req, res) => {
  try {
    const invite = await AssessmentInvite.findOne({ token: req.params.token }).populate('assessmentId');
    if (!invite) return res.status(404).json({ success: false, message: 'Invalid assessment link' });
    if (invite.expiresAt < new Date() && invite.status === 'pending') {
      invite.status = 'expired';
      await invite.save();
    }
    if (invite.status === 'expired') {
      return res.status(410).json({ success: false, message: 'This assessment link has expired.' });
    }
    if (invite.status === 'submitted' || invite.status === 'graded') {
      return res.json({ success: true, data: { submitted: true } });
    }

    if (invite.status === 'pending') {
      invite.status = 'in_progress';
      invite.startedAt = new Date();
      await invite.save();
    }

    const assessment = invite.assessmentId;
    const safeQuestions = (assessment.questions || []).map((q) => ({
      _id: q._id,
      type: q.type,
      prompt: q.prompt,
      language: q.language,
      options: q.options,
      points: q.points
    }));

    res.json({
      success: true,
      data: {
        submitted: false,
        title: assessment.title,
        description: assessment.description,
        durationMinutes: assessment.durationMinutes,
        questions: safeQuestions,
        expiresAt: invite.expiresAt,
        proctoring: {
          enabled: !!assessment.proctoring?.enabled,
          strictness: assessment.proctoring?.strictness || 'standard',
          trackTabSwitch: assessment.proctoring?.trackTabSwitch !== false,
          trackCopyPaste: assessment.proctoring?.trackCopyPaste !== false,
          trackFullscreen: assessment.proctoring?.trackFullscreen !== false
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** POST /api/assessments/take/:token/events — proctoring events (public token) */
router.post('/take/:token/events', async (req, res) => {
  try {
    const invite = await AssessmentInvite.findOne({ token: req.params.token }).populate('assessmentId');
    if (!invite) return res.status(404).json({ success: false, message: 'Invalid assessment link' });
    if (!invite.assessmentId?.proctoring?.enabled) {
      return res.json({ success: true, ignored: true });
    }
    if (invite.status === 'submitted' || invite.status === 'graded' || invite.status === 'expired') {
      return res.status(400).json({ success: false, message: 'Assessment already closed' });
    }

    const events = Array.isArray(req.body.events) ? req.body.events : [req.body];
    const allowed = new Set(['tab_switch', 'window_blur', 'copy', 'paste', 'fullscreen_exit', 'start', 'submit', 'snapshot']);
    const toAdd = events
      .filter((e) => e && allowed.has(e.type))
      .slice(0, 50)
      .map((e) => {
        let meta = e.meta || undefined;
        // Cap snapshot payloads so Mongo docs stay lean
        if (e.type === 'snapshot' && meta?.image && String(meta.image).length > 120000) {
          meta = { ...meta, image: String(meta.image).slice(0, 120000), truncated: true };
        }
        return {
          type: e.type,
          at: e.at ? new Date(e.at) : new Date(),
          questionId: e.questionId ? String(e.questionId) : '',
          meta
        };
      });

    if (!invite.proctoring) invite.proctoring = { events: [] };
    invite.proctoring.events = [...(invite.proctoring.events || []), ...toAdd].slice(-500);

    const counts = summarizeEvents(invite.proctoring.events);
    Object.assign(invite.proctoring, counts);
    const { riskScore, flagged } = computeRiskScore({
      ...counts,
      strictness: invite.assessmentId.proctoring?.strictness || 'standard'
    });
    invite.proctoring.riskScore = riskScore;
    invite.proctoring.flagged = flagged;
    invite.markModified('proctoring');
    await invite.save();

    res.json({ success: true, data: { riskScore, flagged, ...counts } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** POST /api/assessments/take/:token/submit — body: { answers: [{ questionId, response }] } */
router.post('/take/:token/submit', async (req, res) => {
  try {
    const invite = await AssessmentInvite.findOne({ token: req.params.token }).populate('assessmentId');
    if (!invite) return res.status(404).json({ success: false, message: 'Invalid assessment link' });
    if (invite.status === 'submitted' || invite.status === 'graded') {
      return res.status(400).json({ success: false, message: 'This assessment has already been submitted.' });
    }
    if (invite.status === 'expired' || invite.expiresAt < new Date()) {
      return res.status(410).json({ success: false, message: 'This assessment link has expired.' });
    }

    const { answers = [] } = req.body;
    const assessment = invite.assessmentId;
    const questionMap = new Map(assessment.questions.map((q) => [String(q._id), q]));

    let autoScoreTotal = 0;
    const gradedAnswers = answers.map((a) => {
      const question = questionMap.get(String(a.questionId));
      let autoScore;
      if (question?.type === 'multiple_choice') {
        autoScore = Number(a.response) === question.correctOptionIndex ? (question.points || 0) : 0;
        autoScoreTotal += autoScore;
      }
      return { questionId: a.questionId, response: String(a.response ?? ''), autoScore };
    });

    invite.answers = gradedAnswers;
    invite.status = 'submitted';
    invite.submittedAt = new Date();
    invite.maxScore = assessment.maxScore;
    // Provisional score = sum of auto-graded MCQ only; manual questions add in once graded.
    invite.totalScore = autoScoreTotal;

    if (assessment.proctoring?.enabled && invite.proctoring?.events?.length) {
      const counts = summarizeEvents(invite.proctoring.events);
      Object.assign(invite.proctoring, counts);
      const { riskScore, flagged } = computeRiskScore({
        ...counts,
        strictness: assessment.proctoring?.strictness || 'standard'
      });
      invite.proctoring.riskScore = riskScore;
      invite.proctoring.flagged = flagged;
      invite.markModified('proctoring');
    }

    await invite.save();

    res.json({ success: true, message: 'Assessment submitted. The hiring team will review your answers.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Recruiter-facing (session + plan entitlement) ─────────────────────
router.use(verifyToken, requireOrganization, tenantScope, requireFeature('assessments'));

router.get('/', async (req, res) => {
  try {
    const assessments = await Assessment.find({ organizationId: req.user.organizationId }).sort({ createdAt: -1 });
    res.json({ success: true, data: assessments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', requireRecruiterOrAbove, async (req, res) => {
  try {
    const { title, description = '', durationMinutes = 45, questions = [], proctoring } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ success: false, message: 'Title is required' });
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one question is required' });
    }

    let proctoringConfig = { enabled: false };
    if (proctoring?.enabled) {
      const org = await Organization.findById(req.user.organizationId).select('plan');
      if (!planHasFeature(org?.plan, 'assessments.proctoring')) {
        return res.status(403).json({
          success: false,
          code: 'UPGRADE_REQUIRED',
          message: 'Assessment proctoring requires a Professional plan or higher.',
          feature: 'assessments.proctoring'
        });
      }
      proctoringConfig = {
        enabled: true,
        strictness: ['off', 'standard', 'strict'].includes(proctoring.strictness) ? proctoring.strictness : 'standard',
        trackTabSwitch: proctoring.trackTabSwitch !== false,
        trackCopyPaste: proctoring.trackCopyPaste !== false,
        trackFullscreen: proctoring.trackFullscreen !== false
      };
    }

    const assessment = await Assessment.create({
      organizationId: req.user.organizationId,
      title: title.trim(),
      description,
      durationMinutes,
      questions,
      proctoring: proctoringConfig,
      createdBy: req.user.id
    });
    res.status(201).json({ success: true, data: assessment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', requireRecruiterOrAbove, async (req, res) => {
  try {
    const { title, description, durationMinutes, questions, isActive, proctoring } = req.body;
    const update = {};
    if (title !== undefined) update.title = title.trim();
    if (description !== undefined) update.description = description;
    if (durationMinutes !== undefined) update.durationMinutes = durationMinutes;
    if (questions !== undefined) update.questions = questions;
    if (isActive !== undefined) update.isActive = isActive;

    if (proctoring !== undefined) {
      if (proctoring?.enabled) {
        const org = await Organization.findById(req.user.organizationId).select('plan');
        if (!planHasFeature(org?.plan, 'assessments.proctoring')) {
          return res.status(403).json({
            success: false,
            code: 'UPGRADE_REQUIRED',
            message: 'Assessment proctoring requires a Professional plan or higher.',
            feature: 'assessments.proctoring'
          });
        }
      }
      update.proctoring = {
        enabled: !!proctoring?.enabled,
        strictness: ['off', 'standard', 'strict'].includes(proctoring?.strictness) ? proctoring.strictness : 'standard',
        trackTabSwitch: proctoring?.trackTabSwitch !== false,
        trackCopyPaste: proctoring?.trackCopyPaste !== false,
        trackFullscreen: proctoring?.trackFullscreen !== false
      };
    }

    const assessment = await Assessment.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.user.organizationId },
      { $set: update },
      { new: true }
    );
    if (!assessment) return res.status(404).json({ success: false, message: 'Assessment not found' });
    res.json({ success: true, data: assessment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', requireRecruiterOrAbove, async (req, res) => {
  try {
    const assessment = await Assessment.findOneAndDelete({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!assessment) return res.status(404).json({ success: false, message: 'Assessment not found' });
    await AssessmentInvite.deleteMany({ assessmentId: assessment._id, organizationId: req.user.organizationId });
    res.json({ success: true, message: 'Assessment deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** POST /api/assessments/:id/invite — body: { candidateId, applicationId?, expiresInHours? } */
router.post('/:id/invite', requireRecruiterOrAbove, async (req, res) => {
  try {
    const { candidateId, applicationId, expiresInHours = 72 } = req.body;
    const assessment = await Assessment.findOne({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!assessment) return res.status(404).json({ success: false, message: 'Assessment not found' });

    const candidate = await Candidate.findOne({ _id: candidateId, organizationId: req.user.organizationId });
    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });

    const token = AssessmentInvite.generateToken();
    const invite = await AssessmentInvite.create({
      organizationId: req.user.organizationId,
      assessmentId: assessment._id,
      candidateId: candidate._id,
      applicationId,
      token,
      sentBy: req.user.id,
      expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const takeUrl = `${frontendUrl}/assessment/${token}`;
    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>You've been invited to complete an assessment</h2>
        <p><strong>${assessment.title}</strong></p>
        ${assessment.description ? `<p>${assessment.description}</p>` : ''}
        <p>Estimated time: ${assessment.durationMinutes} minutes. This link expires in ${expiresInHours} hours.</p>
        <p><a href="${takeUrl}" style="display:inline-block;padding:10px 20px;background:#4F46E5;color:#fff;border-radius:6px;text-decoration:none;">Start Assessment</a></p>
      </div>`;
    await sendEmail(candidate.email, `Assessment invite: ${assessment.title}`, html, `Start your assessment: ${takeUrl}`).catch((err) => {
      console.error('[assessments] Failed to send invite email:', err.message);
    });

    res.status(201).json({ success: true, data: invite });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** GET /api/assessments/invites — list invites, optionally filtered by ?assessmentId= */
router.get('/invites', async (req, res) => {
  try {
    const filter = { organizationId: req.user.organizationId };
    if (req.query.assessmentId) filter.assessmentId = req.query.assessmentId;

    const invites = await AssessmentInvite.find(filter)
      .populate('candidateId', 'name email')
      .populate('assessmentId', 'title maxScore')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: invites });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** GET /api/assessments/invites/:id — full detail incl. answers, for grading */
router.get('/invites/:id', async (req, res) => {
  try {
    const invite = await AssessmentInvite.findOne({ _id: req.params.id, organizationId: req.user.organizationId })
      .populate('candidateId', 'name email')
      .populate('assessmentId');
    if (!invite) return res.status(404).json({ success: false, message: 'Invite not found' });
    res.json({ success: true, data: invite });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** GET /api/assessments/invites/:id/integrity — proctoring report (plan-gated) */
router.get('/invites/:id/integrity', requireFeature('assessments.proctoring'), async (req, res) => {
  try {
    const invite = await AssessmentInvite.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    })
      .populate('candidateId', 'name email')
      .populate('assessmentId', 'title proctoring')
      .lean();
    if (!invite) return res.status(404).json({ success: false, message: 'Invite not found' });
    res.json({
      success: true,
      data: {
        candidate: invite.candidateId,
        assessment: invite.assessmentId,
        status: invite.status,
        proctoring: invite.proctoring || {}
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** POST /api/assessments/invites/:id/grade — body: { scores: [{questionId, manualScore}], feedback } */
router.post('/invites/:id/grade', requireRecruiterOrAbove, async (req, res) => {
  try {
    const { scores = [], feedback = '' } = req.body;
    const invite = await AssessmentInvite.findOne({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!invite) return res.status(404).json({ success: false, message: 'Invite not found' });
    if (invite.status !== 'submitted' && invite.status !== 'graded') {
      return res.status(400).json({ success: false, message: 'Candidate has not submitted this assessment yet' });
    }

    const scoreMap = new Map(scores.map((s) => [String(s.questionId), s.manualScore]));
    invite.answers = invite.answers.map((a) => {
      const manual = scoreMap.get(String(a.questionId));
      return manual !== undefined ? { ...a.toObject(), manualScore: manual } : a;
    });

    invite.totalScore = invite.answers.reduce((sum, a) => sum + (a.autoScore || 0) + (a.manualScore || 0), 0);
    invite.feedback = feedback;
    invite.status = 'graded';
    invite.gradedBy = req.user.id;
    invite.gradedAt = new Date();
    await invite.save();

    res.json({ success: true, data: invite });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
