/**
 * Assessments domain — take/submit + recruiter CRUD/invite/grade.
 */
const mongoose = require('mongoose');
const Assessment = require('../models/Assessment');
const AssessmentInvite = require('../models/AssessmentInvite');
const Candidate = require('../models/Candidate');
const Organization = require('../models/Organization');
const { sendEmailQueued } = require('./emailService');
const { wrapBrandedEmailHtml, brandButtonHtml, loadOrgEmailBrand, escapeHtml, publicSiteBase } = require('./emailBrandLayout');
const { excludeFreelancerCreated, orgFreelancerCreatorIds, organizationIdMatch } = require('../utils/dataScope');
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
  if (invite.expiresAt < new Date() && (invite.status === 'pending' || invite.status === 'in_progress')) {
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
  const gradedAnswers = (Array.isArray(answers) ? answers : []).slice(0, questionMap.size).map((a) => {
    const question = questionMap.get(String(a.questionId));
    if (!question) return null;
    let autoScore;
    const response = String(a.response ?? '').slice(0, 20000);
    if (question.type === 'multiple_choice') {
      autoScore = Number(response) === question.correctOptionIndex ? question.points || 0 : 0;
      autoScoreTotal += autoScore;
    }
    return { questionId: question._id, response, autoScore };
  }).filter(Boolean);

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

function redactAnswerKeys(rows) {
  return (rows || []).map((row) => ({
    ...row,
    questions: (row.questions || []).map((question) => {
      const next = { ...question };
      delete next.correctOptionIndex;
      return next;
    }),
  }));
}

function asOrgId(organizationId) {
  const raw = String(organizationId || '');
  return mongoose.Types.ObjectId.isValid(raw) ? new mongoose.Types.ObjectId(raw) : organizationId;
}

async function refreshExpiredInvites(organizationId) {
  await AssessmentInvite.updateMany(
    {
      organizationId,
      status: { $in: ['pending', 'in_progress'] },
      expiresAt: { $lt: new Date() },
    },
    { $set: { status: 'expired' } }
  );
}

async function listAssessments(organizationId) {
  await refreshExpiredInvites(organizationId);
  const rows = await Assessment.find({ organizationId }).sort({ createdAt: -1 }).lean();
  const grouped = await AssessmentInvite.aggregate([
    { $match: { organizationId: asOrgId(organizationId) } },
    { $group: { _id: { assessmentId: '$assessmentId', status: '$status' }, n: { $sum: 1 } } },
  ]);
  const byAssessment = new Map();
  for (const row of grouped) {
    const id = String(row._id.assessmentId);
    const bucket = byAssessment.get(id) || { pending: 0, in_progress: 0, submitted: 0, graded: 0, expired: 0, total: 0 };
    const status = row._id.status || 'pending';
    bucket[status] = (bucket[status] || 0) + row.n;
    bucket.total += row.n;
    byAssessment.set(id, bucket);
  }
  return rows.map((row) => ({
    ...row,
    maxScore: (row.questions || []).reduce((sum, question) => sum + (question.points || 0), 0),
    inviteStats: byAssessment.get(String(row._id)) || { pending: 0, in_progress: 0, submitted: 0, graded: 0, expired: 0, total: 0 },
  }));
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

function normalizeQuestionType(type) {
  const raw = String(type || 'text').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (['mcq', 'choice', 'single_choice', 'multiple_choice', 'multi_choice'].includes(raw)) return 'multiple_choice';
  if (['code', 'coding', 'programming'].includes(raw)) return 'code';
  return 'text';
}

function normalizeQuestions(questions) {
  const list = (Array.isArray(questions) ? questions : []).map((q) => {
    const type = normalizeQuestionType(q?.type);
    const prompt = String(q?.prompt || q?.question || q?.text || '').trim();
    const options = (Array.isArray(q?.options) ? q.options : [])
      .map((option) => String(option || '').trim())
      .filter(Boolean);
    let correctOptionIndex = Number(q?.correctOptionIndex);
    if (!Number.isInteger(correctOptionIndex) || correctOptionIndex < 0 || correctOptionIndex >= options.length) {
      correctOptionIndex = 0;
    }
    return {
      ...q,
      type,
      prompt,
      options: type === 'multiple_choice' ? options : [],
      correctOptionIndex: type === 'multiple_choice' ? correctOptionIndex : undefined,
      points: Number(q?.points) >= 0 ? Number(q.points) : 10,
      language: type === 'code' ? String(q?.language || '').trim() : '',
    };
  });
  const blank = list.find((q) => !q.prompt);
  if (blank) throw httpError('Every question needs a prompt');
  const weakChoice = list.find((q) => q.type === 'multiple_choice' && q.options.length < 2);
  if (weakChoice) throw httpError('Multiple choice questions need at least two options');
  return list;
}

async function createAssessment(organizationId, userId, body) {
  const { title, description = '', durationMinutes = 45, questions = [], proctoring } = body;
  if (!title || !title.trim()) throw httpError('Title is required');
  if (!Array.isArray(questions) || questions.length === 0) {
    throw httpError('At least one question is required');
  }

  const proctoringConfig = await resolveProctoringConfig(organizationId, proctoring);
  try {
    return await Assessment.create({
      organizationId,
      title: title.trim(),
      description,
      durationMinutes,
      questions: normalizeQuestions(questions),
      proctoring: proctoringConfig,
      createdBy: userId,
    });
  } catch (err) {
    if (err.name === 'ValidationError') throw httpError(err.message, 400);
    throw err;
  }
}

async function updateAssessment(organizationId, id, body) {
  const { title, description, durationMinutes, questions, isActive, proctoring } = body;
  const update = {};
  if (title !== undefined) update.title = title.trim();
  if (description !== undefined) update.description = description;
  if (durationMinutes !== undefined) update.durationMinutes = durationMinutes;
  if (questions !== undefined) update.questions = normalizeQuestions(questions);
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

async function searchInternalCandidates(organizationId, query) {
  const q = String(query || '').trim();
  if (!q) return [];
  const orgMatch = organizationIdMatch(organizationId) || { organizationId };
  const rx = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  const filter = await excludeFreelancerCreated(organizationId, {
    ...orgMatch,
    $or: [{ name: rx }, { email: rx }, { phone: rx }, { contact: rx }],
  });
  return Candidate.find(filter).select('name email phone').limit(10).lean();
}

async function assertInternalCandidate(organizationId, candidate) {
  const creatorId = candidate?.createdBy;
  if (!creatorId) return;
  const freelancerIds = await orgFreelancerCreatorIds(organizationId);
  if (freelancerIds.some((id) => String(id) === String(creatorId))) {
    throw httpError('Assessments are for internal hiring only. This record belongs to a freelance recruiter.', 403);
  }
}

async function inviteCandidate(organizationId, userId, assessmentId, body) {
  const { candidateId, applicationId, expiresInHours = 72 } = body;
  const assessment = await Assessment.findOne({ _id: assessmentId, organizationId });
  if (!assessment) throw httpError('Assessment not found', 404);
  if (assessment.isActive === false) throw httpError('This assessment is archived. Restore it before inviting anyone.', 400);

  const candidate = await Candidate.findOne({ _id: candidateId, organizationId });
  if (!candidate) throw httpError('Candidate not found', 404);
  await assertInternalCandidate(organizationId, candidate);

  const openInvite = await AssessmentInvite.findOne({
    organizationId,
    assessmentId: assessment._id,
    candidateId: candidate._id,
    status: { $in: ['pending', 'in_progress'] },
  });
  if (openInvite) {
    throw httpError('This candidate already has an open invite. Copy or resend that link instead.');
  }

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

  const takeUrl = `${publicSiteBase().replace(/\/$/, '')}/assessment/${token}`;
  const brand = await loadOrgEmailBrand(organizationId);
  const safeTitle = escapeHtml(assessment.title);
  const safeCandidateName = escapeHtml(candidate.name || 'Candidate');
  const html = wrapBrandedEmailHtml({
    title: `Complete your assessment — ${assessment.title}`,
    category: 'assessment',
    orgName: brand.name,
    logoUrl: brand.logoUrl,
    brandColor: brand.brandColor,
    wordmark: brand.wordmark,
    companyAddress: brand.companyAddress || '',
    websiteUrl: brand.websiteUrl || '',
    supportEmail: brand.supportEmail || '',
    socialLinks: brand.socialLinks || {},
    bodyHtml: `
      <p style="margin:0 0 16px 0;font-size:15px;color:#0f172a;font-weight:600;">Dear ${safeCandidateName},</p>
      <p style="margin:0 0 12px 0;color:#334155;line-height:1.7;">As part of the selection process, you have been invited to complete the following assessment:</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #eef0f3;border-left:3px solid ${brand.brandColor};margin:4px 0 20px 0;">
        <tr><td style="padding:16px 18px;">
          <p style="margin:0 0 4px 0;font-size:15px;font-weight:700;color:#0f172a;">${safeTitle}</p>
          ${assessment.description ? `<p style="margin:0 0 10px 0;font-size:13px;color:#64748b;line-height:1.55;">${escapeHtml(assessment.description)}</p>` : ''}
          <p style="margin:0;font-size:12px;color:#94a3b8;">${assessment.durationMinutes} minutes &nbsp;&middot;&nbsp; Link expires in ${expiresInHours} hours</p>
        </td></tr>
      </table>
      ${brandButtonHtml({ href: takeUrl, label: 'Start assessment', brandColor: brand.brandColor })}
      <p style="margin:20px 0 0 0;color:#64748b;font-size:13px;line-height:1.6;">Please attempt the assessment in a quiet environment without external assistance, unless stated otherwise. Contact us if you face any access issues.</p>`,
  });
  let emailSent = false;
  try {
    await sendEmailQueued(
      candidate.email,
      `Complete your assessment — ${assessment.title}`,
      html,
      `Start your assessment: ${takeUrl}`,
      {
        userId,
        organizationId,
        senderName: brand.name,
        directReply: true,
      }
    );
    emailSent = true;
  } catch (err) {
    console.error('[assessments] Failed to send invite email:', err.message);
    emailSent = false;
  }

  const serialized = typeof invite.toObject === 'function' ? invite.toObject() : invite;
  serialized.emailSent = emailSent;
  serialized.takeUrl = takeUrl;
  return serialized;
}

async function listInvites(organizationId, query) {
  await refreshExpiredInvites(organizationId);
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

async function resendInvite(organizationId, userId, inviteId) {
  const invite = await AssessmentInvite.findOne({ _id: inviteId, organizationId })
    .populate('candidateId')
    .populate('assessmentId');
  if (!invite) throw httpError('Invite not found', 404);
  if (invite.status === 'submitted' || invite.status === 'graded') {
    throw httpError('This assessment is already submitted');
  }
  const assessment = invite.assessmentId;
  const candidate = invite.candidateId;
  if (!assessment || !candidate?.email) throw httpError('Invite is missing a candidate email', 400);
  invite.expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
  if (invite.status === 'expired') invite.status = 'pending';
  invite.sentAt = new Date();
  invite.sentBy = userId;
  await invite.save();

  const takeUrl = `${publicSiteBase().replace(/\/$/, '')}/assessment/${invite.token}`;
  const brand = await loadOrgEmailBrand(organizationId);
  const html = wrapBrandedEmailHtml({
    title: `Complete your assessment — ${assessment.title}`,
    category: 'assessment',
    orgName: brand.name,
    logoUrl: brand.logoUrl,
    brandColor: brand.brandColor,
    wordmark: brand.wordmark,
    companyAddress: brand.companyAddress || '',
    websiteUrl: brand.websiteUrl || '',
    supportEmail: brand.supportEmail || '',
    socialLinks: brand.socialLinks || {},
    bodyHtml: `
      <p style="margin:0 0 16px 0;font-size:15px;color:#0f172a;font-weight:600;">Dear ${escapeHtml(candidate.name || 'Candidate')},</p>
      <p style="margin:0 0 12px 0;color:#334155;line-height:1.7;">Your assessment link has been refreshed. Please complete it before it expires.</p>
      <p style="margin:0 0 16px 0;font-size:15px;font-weight:700;color:#0f172a;">${escapeHtml(assessment.title)}</p>
      ${brandButtonHtml({ href: takeUrl, label: 'Start assessment', brandColor: brand.brandColor })}`,
  });
  let emailSent = false;
  try {
    await sendEmailQueued(
      candidate.email,
      `Complete your assessment — ${assessment.title}`,
      html,
      `Start your assessment: ${takeUrl}`,
      { userId, organizationId, senderName: brand.name, directReply: true }
    );
    emailSent = true;
  } catch (err) {
    console.error('[assessments] Failed to resend invite email:', err.message);
  }
  return { emailSent, status: invite.status, expiresAt: invite.expiresAt };
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
  redactAnswerKeys,
  searchInternalCandidates,
  createAssessment,
  updateAssessment,
  deleteAssessment,
  inviteCandidate,
  listInvites,
  getInvite,
  resendInvite,
  getInviteIntegrity,
  gradeInvite,
};
