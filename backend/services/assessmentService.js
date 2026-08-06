/**
 * Assessments domain — take/submit + recruiter CRUD/invite/grade.
 */
const Assessment = require('../models/Assessment');
const AssessmentInvite = require('../models/AssessmentInvite');
const Candidate = require('../models/Candidate');
const Organization = require('../models/Organization');
const { sendEmailQueued } = require('./emailService');
const { planHasFeature } = require('../config/planFeatures');
const { computeRiskScore, summarizeEvents } = require('../utils/proctoring');

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

async function takeAssessment(token) {
  const invite = await AssessmentInvite.findOne({ token }).populate('assessmentId');
  if (!invite) throw httpError('Invalid assessment link', 404);
  if (invite.expiresAt < new Date() && invite.status === 'pending') {
    invite.status = 'expired';
    await invite.save();
  }
  if (invite.status === 'expired') {
    throw httpError('This assessment link has expired.', 410);
  }
  if (invite.status === 'submitted' || invite.status === 'graded') {
    return { submitted: true };
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
    points: q.points,
  }));

  return {
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
      trackFullscreen: assessment.proctoring?.trackFullscreen !== false,
    },
  };
}

async function recordProctoringEvents(token, body) {
  const invite = await AssessmentInvite.findOne({ token }).populate('assessmentId');
  if (!invite) throw httpError('Invalid assessment link', 404);
  if (!invite.assessmentId?.proctoring?.enabled) {
    return { ignored: true };
  }
  if (invite.status === 'submitted' || invite.status === 'graded' || invite.status === 'expired') {
    throw httpError('Assessment already closed');
  }

  const events = Array.isArray(body.events) ? body.events : [body];
  const allowed = new Set([
    'tab_switch',
    'window_blur',
    'copy',
    'paste',
    'fullscreen_exit',
    'start',
    'submit',
    'snapshot',
  ]);
  const toAdd = events
    .filter((e) => e && allowed.has(e.type))
    .slice(0, 50)
    .map((e) => {
      let meta = e.meta || undefined;
      if (e.type === 'snapshot' && meta?.image && String(meta.image).length > 120000) {
        meta = { ...meta, image: String(meta.image).slice(0, 120000), truncated: true };
      }
      return {
        type: e.type,
        at: e.at ? new Date(e.at) : new Date(),
        questionId: e.questionId ? String(e.questionId) : '',
        meta,
      };
    });

  if (!invite.proctoring) invite.proctoring = { events: [] };
  invite.proctoring.events = [...(invite.proctoring.events || []), ...toAdd].slice(-500);

  const counts = summarizeEvents(invite.proctoring.events);
  Object.assign(invite.proctoring, counts);
  const { riskScore, flagged } = computeRiskScore({
    ...counts,
    strictness: invite.assessmentId.proctoring?.strictness || 'standard',
  });
  invite.proctoring.riskScore = riskScore;
  invite.proctoring.flagged = flagged;
  invite.markModified('proctoring');
  await invite.save();

  return { riskScore, flagged, ...counts };
}

async function submitAssessment(token, body) {
  const invite = await AssessmentInvite.findOne({ token }).populate('assessmentId');
  if (!invite) throw httpError('Invalid assessment link', 404);
  if (invite.status === 'submitted' || invite.status === 'graded') {
    throw httpError('This assessment has already been submitted.');
  }
  if (invite.status === 'expired' || invite.expiresAt < new Date()) {
    throw httpError('This assessment link has expired.', 410);
  }

  const { answers = [] } = body;
  const assessment = invite.assessmentId;
  const questionMap = new Map(assessment.questions.map((q) => [String(q._id), q]));

  let autoScoreTotal = 0;
  const gradedAnswers = answers.map((a) => {
    const question = questionMap.get(String(a.questionId));
    let autoScore;
    if (question?.type === 'multiple_choice') {
      autoScore = Number(a.response) === question.correctOptionIndex ? question.points || 0 : 0;
      autoScoreTotal += autoScore;
    }
    return { questionId: a.questionId, response: String(a.response ?? ''), autoScore };
  });

  invite.answers = gradedAnswers;
  invite.status = 'submitted';
  invite.submittedAt = new Date();
  invite.maxScore = assessment.maxScore;
  invite.totalScore = autoScoreTotal;

  if (assessment.proctoring?.enabled && invite.proctoring?.events?.length) {
    const counts = summarizeEvents(invite.proctoring.events);
    Object.assign(invite.proctoring, counts);
    const { riskScore, flagged } = computeRiskScore({
      ...counts,
      strictness: assessment.proctoring?.strictness || 'standard',
    });
    invite.proctoring.riskScore = riskScore;
    invite.proctoring.flagged = flagged;
    invite.markModified('proctoring');
  }

  await invite.save();
  return { message: 'Assessment submitted. The hiring team will review your answers.' };
}

async function listAssessments(organizationId) {
  return Assessment.find({ organizationId }).sort({ createdAt: -1 });
}

async function resolveProctoringConfig(organizationId, proctoring) {
  if (!proctoring?.enabled) return { enabled: false };
  const org = await Organization.findById(organizationId).select('plan');
  if (!planHasFeature(org?.plan, 'assessments.proctoring')) {
    throw httpError('Assessment proctoring requires a Professional plan or higher.', 403, {
      code: 'UPGRADE_REQUIRED',
      feature: 'assessments.proctoring',
    });
  }
  return {
    enabled: true,
    strictness: ['off', 'standard', 'strict'].includes(proctoring.strictness)
      ? proctoring.strictness
      : 'standard',
    trackTabSwitch: proctoring.trackTabSwitch !== false,
    trackCopyPaste: proctoring.trackCopyPaste !== false,
    trackFullscreen: proctoring.trackFullscreen !== false,
  };
}

async function createAssessment(organizationId, userId, body) {
  const { title, description = '', durationMinutes = 45, questions = [], proctoring } = body;
  if (!title || !title.trim()) throw httpError('Title is required');
  if (!Array.isArray(questions) || questions.length === 0) {
    throw httpError('At least one question is required');
  }

  const proctoringConfig = await resolveProctoringConfig(organizationId, proctoring);
  return Assessment.create({
    organizationId,
    title: title.trim(),
    description,
    durationMinutes,
    questions,
    proctoring: proctoringConfig,
    createdBy: userId,
  });
}

async function updateAssessment(organizationId, id, body) {
  const { title, description, durationMinutes, questions, isActive, proctoring } = body;
  const update = {};
  if (title !== undefined) update.title = title.trim();
  if (description !== undefined) update.description = description;
  if (durationMinutes !== undefined) update.durationMinutes = durationMinutes;
  if (questions !== undefined) update.questions = questions;
  if (isActive !== undefined) update.isActive = isActive;

  if (proctoring !== undefined) {
    update.proctoring = await resolveProctoringConfig(organizationId, proctoring);
  }

  const assessment = await Assessment.findOneAndUpdate(
    { _id: id, organizationId },
    { $set: update },
    { new: true }
  );
  if (!assessment) throw httpError('Assessment not found', 404);
  return assessment;
}

async function deleteAssessment(organizationId, id) {
  const assessment = await Assessment.findOneAndDelete({ _id: id, organizationId });
  if (!assessment) throw httpError('Assessment not found', 404);
  await AssessmentInvite.deleteMany({ assessmentId: assessment._id, organizationId });
  return { message: 'Assessment deleted' };
}

async function inviteCandidate(organizationId, userId, assessmentId, body) {
  const { candidateId, applicationId, expiresInHours = 72 } = body;
  const assessment = await Assessment.findOne({ _id: assessmentId, organizationId });
  if (!assessment) throw httpError('Assessment not found', 404);

  const candidate = await Candidate.findOne({ _id: candidateId, organizationId });
  if (!candidate) throw httpError('Candidate not found', 404);

  const token = AssessmentInvite.generateToken();
  const invite = await AssessmentInvite.create({
    organizationId,
    assessmentId: assessment._id,
    candidateId: candidate._id,
    applicationId,
    token,
    sentBy: userId,
    expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000),
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
  await sendEmailQueued(
    candidate.email,
    `Assessment invite: ${assessment.title}`,
    html,
    `Start your assessment: ${takeUrl}`
  ).catch((err) => {
    console.error('[assessments] Failed to send invite email:', err.message);
  });

  return invite;
}

async function listInvites(organizationId, query) {
  const filter = { organizationId };
  if (query.assessmentId) filter.assessmentId = query.assessmentId;
  return AssessmentInvite.find(filter)
    .populate('candidateId', 'name email')
    .populate('assessmentId', 'title maxScore')
    .sort({ createdAt: -1 });
}

async function getInvite(organizationId, id) {
  const invite = await AssessmentInvite.findOne({ _id: id, organizationId })
    .populate('candidateId', 'name email')
    .populate('assessmentId');
  if (!invite) throw httpError('Invite not found', 404);
  return invite;
}

async function getInviteIntegrity(organizationId, id) {
  const invite = await AssessmentInvite.findOne({ _id: id, organizationId })
    .populate('candidateId', 'name email')
    .populate('assessmentId', 'title proctoring')
    .lean();
  if (!invite) throw httpError('Invite not found', 404);
  return {
    candidate: invite.candidateId,
    assessment: invite.assessmentId,
    status: invite.status,
    proctoring: invite.proctoring || {},
  };
}

async function gradeInvite(organizationId, userId, id, body) {
  const { scores = [], feedback = '' } = body;
  const invite = await AssessmentInvite.findOne({ _id: id, organizationId });
  if (!invite) throw httpError('Invite not found', 404);
  if (invite.status !== 'submitted' && invite.status !== 'graded') {
    throw httpError('Candidate has not submitted this assessment yet');
  }

  const scoreMap = new Map(scores.map((s) => [String(s.questionId), s.manualScore]));
  invite.answers = invite.answers.map((a) => {
    const manual = scoreMap.get(String(a.questionId));
    return manual !== undefined ? { ...a.toObject(), manualScore: manual } : a;
  });

  invite.totalScore = invite.answers.reduce(
    (sum, a) => sum + (a.autoScore || 0) + (a.manualScore || 0),
    0
  );
  invite.feedback = feedback;
  invite.status = 'graded';
  invite.gradedBy = userId;
  invite.gradedAt = new Date();
  await invite.save();
  return invite;
}

module.exports = {
  takeAssessment,
  recordProctoringEvents,
  submitAssessment,
  listAssessments,
  createAssessment,
  updateAssessment,
  deleteAssessment,
  inviteCandidate,
  listInvites,
  getInvite,
  getInviteIntegrity,
  gradeInvite,
};
