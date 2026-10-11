/**
 * Assessments domain — tenant-scoped builder, invitations, attempts, scoring.
 * The server owns deadlines, keys, scores and submission; the browser does not.
 */
const mongoose = require('mongoose');
const Assessment = require('../models/Assessment');
const AssessmentInvite = require('../models/AssessmentInvite');
const AssessmentQuestion = require('../models/AssessmentQuestion');
const Candidate = require('../models/Candidate');
const Organization = require('../models/Organization');
const { sendEmailQueued } = require('./emailService');
const { wrapBrandedEmailHtml, brandButtonHtml, loadOrgEmailBrand, escapeHtml, publicSiteBase } = require('./emailBrandLayout');
const { excludeFreelancerCreated, orgFreelancerCreatorIds, organizationIdMatch } = require('../utils/dataScope');
const { planHasFeature } = require('../config/planFeatures');
const { computeRiskScore, summarizeEvents } = require('../utils/proctoring');
const eventBus = require('../events/eventBus');
const eventTypes = require('../events/eventTypes');
const engine = require('../utils/assessmentEngine');

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

function asOrgId(organizationId) {
  const raw = String(organizationId || '');
  return mongoose.Types.ObjectId.isValid(raw) ? new mongoose.Types.ObjectId(raw) : organizationId;
}

function audit(action, data) {
  try {
    eventBus.emit(action, data);
  } catch {
    /* audit must never break the workflow */
  }
}

function isUsableForInvite(assessment) {
  if (!assessment) return false;
  if (assessment.status === 'archived' || assessment.isActive === false) return false;
  if (assessment.status === 'draft' && !assessment.publishedSnapshot) return 'draft';
  return true;
}

function activeSnapshot(assessment) {
  if (assessment.publishedSnapshot?.questions?.length) return assessment.publishedSnapshot;
  return engine.buildPublishedSnapshot(assessment);
}

function resolveInviteSnapshot(invite) {
  if (invite.snapshot?.questions?.length) return invite.snapshot;
  if (invite.assessmentId) return activeSnapshot(invite.assessmentId);
  return invite.snapshot || {};
}

function candidatePayload(invite, extra = {}) {
  const snapshot = resolveInviteSnapshot(invite);
  const rules = engine.normalizeRules(snapshot.rules, snapshot.durationMinutes);
  const questions = (snapshot.questions || []).map((q) => engine.sanitizeCandidateQuestion(q));
  return {
    submitted: false,
    phase: invite.status,
    title: snapshot.title || extra.title,
    description: snapshot.description || extra.description || '',
    candidateInstructions: snapshot.candidateInstructions || extra.candidateInstructions || '',
    durationMinutes: rules.durationMinutes,
    rules: {
      allowBack: rules.allowBack,
      requireAll: rules.requireAll,
      autoSubmit: rules.autoSubmit,
      resultVisibility: rules.resultVisibility,
      randomizeQuestions: rules.randomizeQuestions,
    },
    questions,
    answers: (invite.answers || []).map((a) => ({
      questionId: String(a.questionId),
      response: a.response || '',
    })),
    expiresAt: invite.expiresAt,
    deadlineAt: invite.deadlineAt,
    startedAt: invite.startedAt,
    remainingSeconds: engine.remainingSeconds(invite.deadlineAt),
    lastSavedAt: invite.lastSavedAt,
    proctoring: {
      enabled: !!snapshot.proctoring?.enabled,
      strictness: snapshot.proctoring?.strictness || 'standard',
      trackTabSwitch: snapshot.proctoring?.trackTabSwitch !== false,
      trackCopyPaste: snapshot.proctoring?.trackCopyPaste !== false,
      trackFullscreen: snapshot.proctoring?.trackFullscreen !== false,
    },
  };
}

function publicClosedResult(invite) {
  const rules = engine.normalizeRules(invite.snapshot?.rules, invite.snapshot?.durationMinutes);
  return {
    submitted: true,
    phase: invite.status,
    result: engine.candidateResultView({
      scoringStatus: invite.scoringStatus,
      passFail: invite.passFail,
      totalScore: invite.totalScore,
      maxScore: invite.maxScore,
      percent: invite.percent,
      feedback: invite.feedback,
    }, rules),
  };
}

async function loadInviteByToken(token) {
  const invite = await AssessmentInvite.findOne({ token }).populate('assessmentId');
  if (!invite) throw httpError('Invalid assessment link', 404);
  if (invite.status === 'revoked') throw httpError('This assessment invitation has been revoked.', 410);
  if (invite.expiresAt < new Date() && (invite.status === 'pending' || invite.status === 'in_progress')) {
    invite.status = 'expired';
    await invite.save();
  }
  return invite;
}

function expireInProgressIfTimedOut(invite) {
  if (invite.status !== 'in_progress') return false;
  if (invite.deadlineAt && invite.deadlineAt < new Date()) return true;
  return false;
}

async function takeAssessment(token) {
  const invite = await loadInviteByToken(token);
  if (invite.status === 'expired') throw httpError('This assessment link has expired.', 410);
  if (invite.status === 'submitted' || invite.status === 'graded') {
    return publicClosedResult(invite);
  }

  if (!invite.openedAt) {
    invite.openedAt = new Date();
    await invite.save();
  }

  const assessment = invite.assessmentId;
  const snapshot = activeSnapshot(assessment);
  const rules = engine.normalizeRules(snapshot.rules, snapshot.durationMinutes);

  if (invite.status === 'pending') {
    return {
      submitted: false,
      phase: 'instructions',
      title: snapshot.title,
      description: snapshot.description || '',
      candidateInstructions: snapshot.candidateInstructions || '',
      durationMinutes: rules.durationMinutes,
      questionCount: (snapshot.questions || []).length,
      rules: {
        allowBack: rules.allowBack,
        requireAll: rules.requireAll,
        autoSubmit: rules.autoSubmit,
        resultVisibility: rules.resultVisibility,
      },
      expiresAt: invite.expiresAt,
      windowStart: rules.windowStart,
      windowEnd: rules.windowEnd,
      windowOpen: engine.windowIsOpen(rules),
      privacyNotice: extraPrivacy(assessment),
      proctoring: {
        enabled: !!snapshot.proctoring?.enabled,
        strictness: snapshot.proctoring?.strictness || 'standard',
      },
    };
  }

  if (expireInProgressIfTimedOut(invite) && rules.autoSubmit) {
    return submitAssessment(token, { answers: invite.answers, auto: true });
  }
  if (expireInProgressIfTimedOut(invite)) {
    invite.status = 'expired';
    await invite.save();
    throw httpError('The assessment time has ended.', 410);
  }

  return candidatePayload(invite, snapshot);
}

function extraPrivacy() {
  return 'This session may record integrity events such as leaving the tab, copy/paste, or exiting fullscreen when proctoring is enabled. Results are stored with your application and visible to authorized hiring staff of this company only.';
}

async function startAttempt(token) {
  const invite = await loadInviteByToken(token);
  if (invite.status === 'expired') throw httpError('This assessment link has expired.', 410);
  if (invite.status === 'submitted' || invite.status === 'graded') return publicClosedResult(invite);
  if (invite.status === 'in_progress') {
    if (expireInProgressIfTimedOut(invite)) {
      return submitAssessment(token, { answers: invite.answers, auto: true });
    }
    return candidatePayload(invite);
  }

  const assessment = invite.assessmentId;
  const snapshot = engine.cloneJson(activeSnapshot(assessment));
  const rules = engine.normalizeRules(snapshot.rules, snapshot.durationMinutes);
  if (!engine.windowIsOpen(rules)) {
    throw httpError('This assessment is outside its availability window.', 403);
  }

  if (rules.randomizeQuestions) {
    snapshot.questions = engine.shuffleCopy(snapshot.questions, Date.now() + String(invite._id).length);
  }

  const startedAt = new Date();
  const deadlineAt = engine.computeDeadline({
    startedAt,
    durationMinutes: rules.durationMinutes,
    inviteExpiresAt: invite.expiresAt,
    windowEnd: rules.windowEnd,
  });

  const started = await AssessmentInvite.findOneAndUpdate(
    { _id: invite._id, status: 'pending' },
    {
      $set: {
        status: 'in_progress',
        startedAt,
        deadlineAt,
        snapshot,
        publishedVersion: snapshot.version || assessment.version || 1,
        openedAt: invite.openedAt || startedAt,
      },
    },
    { new: true }
  );
  if (!started) {
    const raced = await AssessmentInvite.findOne({ token });
    if (raced?.status === 'in_progress') return candidatePayload(raced);
    throw httpError('Could not start this assessment.', 409);
  }
  return candidatePayload(started);
}

async function saveAnswers(token, body) {
  const invite = await loadInviteByToken(token);
  if (invite.status === 'submitted' || invite.status === 'graded') {
    return { saved: false, submitted: true };
  }
  if (invite.status !== 'in_progress') throw httpError('Assessment has not been started');
  if (expireInProgressIfTimedOut(invite)) {
    return submitAssessment(token, { answers: mergeAnswers(invite.answers, body.answers), auto: true });
  }

  const snapshotQs = invite.snapshot?.questions || [];
  const allowed = new Set(snapshotQs.map((q) => String(q._id)));
  const merged = mergeAnswers(invite.answers, body.answers).filter((a) => allowed.has(String(a.questionId)));
  invite.answers = merged;
  invite.lastSavedAt = new Date();
  await invite.save();
  return { saved: true, lastSavedAt: invite.lastSavedAt, remainingSeconds: engine.remainingSeconds(invite.deadlineAt) };
}

function mergeAnswers(existing, incoming) {
  const map = new Map((existing || []).map((a) => [String(a.questionId), { questionId: a.questionId, response: a.response || '' }]));
  for (const row of Array.isArray(incoming) ? incoming : []) {
    if (!row?.questionId) continue;
    map.set(String(row.questionId), {
      questionId: row.questionId,
      response: String(row.response ?? '').slice(0, 20000),
    });
  }
  return [...map.values()];
}

async function recordProctoringEvents(token, body) {
  const invite = await AssessmentInvite.findOne({ token }).populate('assessmentId');
  if (!invite) throw httpError('Invalid assessment link', 404);
  const enabled = invite.snapshot?.proctoring?.enabled || invite.assessmentId?.proctoring?.enabled;
  if (!enabled) return { ignored: true };
  if (['submitted', 'graded', 'expired', 'revoked'].includes(invite.status)) {
    throw httpError('Assessment already closed');
  }

  const events = Array.isArray(body.events) ? body.events : [body];
  const allowed = new Set([
    'tab_switch', 'window_blur', 'copy', 'paste', 'fullscreen_exit', 'start', 'submit', 'snapshot',
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
    strictness: invite.snapshot?.proctoring?.strictness || invite.assessmentId.proctoring?.strictness || 'standard',
  });
  invite.proctoring.riskScore = riskScore;
  invite.proctoring.flagged = flagged;
  invite.markModified('proctoring');
  await invite.save();

  return { riskScore, flagged, ...counts };
}

async function submitAssessment(token, body = {}) {
  const invite = await loadInviteByToken(token);
  if (invite.status === 'submitted' || invite.status === 'graded') {
    return { success: true, message: 'Already submitted.', ...publicClosedResult(invite) };
  }
  if (invite.status === 'expired' || invite.status === 'revoked') {
    throw httpError('This assessment link has expired.', 410);
  }
  if (invite.status === 'pending') throw httpError('Start the assessment before submitting.');

  const now = new Date();
  const late = invite.deadlineAt && now > new Date(invite.deadlineAt.getTime() + 15000);
  if (late && !body.auto) throw httpError('The assessment time has ended.', 410);

  const snapshot = resolveInviteSnapshot(invite);
  const rules = engine.normalizeRules(snapshot.rules, snapshot.durationMinutes);
  const merged = mergeAnswers(invite.answers, body.answers);
  if (rules.requireAll) {
    const missing = (snapshot.questions || []).filter((q) => {
      if (q.required === false) return false;
      const found = merged.find((a) => String(a.questionId) === String(q._id));
      return !found || !String(found.response || '').trim();
    });
    if (missing.length && !body.auto) {
      throw httpError('Answer every required question before submitting.', 400);
    }
  }

  const scored = engine.scoreAttempt({ questions: snapshot.questions, answers: merged, rules });
  const codeRunner = require('./codeExecutionService');
  if (codeRunner.sandboxConfigured()) {
    for (const answer of scored.answers) {
      const question = (snapshot.questions || []).find((q) => String(q._id) === String(answer.questionId));
      if (question?.type !== 'code') continue;
      const coded = await codeRunner.scoreCodeQuestion(question, answer.response);
      if (coded.autoScore != null) {
        answer.autoScore = coded.autoScore;
        answer.evaluatorComment = `Sandbox: ${coded.passed}/${coded.total} tests passed`;
      }
    }
    const stillReview = scored.answers.some((a) => {
      const question = (snapshot.questions || []).find((q) => String(q._id) === String(a.questionId));
      if (!question || question.type === 'multiple_choice') return false;
      if (question.type === 'code' && a.autoScore != null) return false;
      return a.manualScore == null;
    });
    scored.needsReview = stillReview;
    scored.scoringStatus = stillReview ? 'pending_review' : 'scored';
    scored.totalScore = scored.answers.reduce((sum, a) => sum + (Number(a.manualScore ?? a.autoScore) || 0), 0);
    scored.percent = scored.maxScore ? Math.round((scored.totalScore / scored.maxScore) * 1000) / 10 : 0;
    if (!stillReview) {
      const passing = Number(rules.passingScorePercent) || 0;
      scored.passFail = passing > 0 && scored.percent < passing ? 'fail' : 'pass';
    }
    scored.skillBreakdown = engine.buildSkillBreakdown(snapshot.questions, scored.answers);
  }
  invite.answers = scored.answers;
  invite.status = 'submitted';
  invite.submittedAt = now;
  invite.totalScore = scored.totalScore;
  invite.maxScore = scored.maxScore;
  invite.percent = scored.percent;
  invite.scoringStatus = scored.scoringStatus;
  invite.passFail = scored.passFail;
  invite.skillBreakdown = scored.skillBreakdown || [];

  if ((invite.snapshot?.proctoring?.enabled || invite.assessmentId?.proctoring?.enabled) && invite.proctoring?.events?.length) {
    const counts = summarizeEvents(invite.proctoring.events);
    Object.assign(invite.proctoring, counts);
    const { riskScore, flagged } = computeRiskScore({
      ...counts,
      strictness: invite.snapshot?.proctoring?.strictness || invite.assessmentId.proctoring?.strictness || 'standard',
    });
    invite.proctoring.riskScore = riskScore;
    invite.proctoring.flagged = flagged;
    invite.markModified('proctoring');
  }

  await invite.save();
  audit(eventTypes.ASSESSMENT_SUBMITTED, {
    organizationId: invite.organizationId,
    resourceId: invite._id,
    candidateId: invite.candidateId,
    applicationId: invite.applicationId,
  });
  return { message: 'Assessment submitted. The hiring team will review your answers.', ...publicClosedResult(invite) };
}

function redactAnswerKeys(rows) {
  return (rows || []).map((row) => ({
    ...row,
    questions: (row.questions || []).map((question) => engine.stripSecretsFromQuestion(question)),
    publishedSnapshot: row.publishedSnapshot
      ? {
          ...row.publishedSnapshot,
          questions: (row.publishedSnapshot.questions || []).map((q) => engine.stripSecretsFromQuestion(q)),
        }
      : row.publishedSnapshot,
  }));
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
  const flagged = await AssessmentInvite.aggregate([
    { $match: { organizationId: asOrgId(organizationId), 'proctoring.flagged': true } },
    { $group: { _id: '$assessmentId', n: { $sum: 1 } } },
  ]);
  const pendingReview = await AssessmentInvite.aggregate([
    { $match: { organizationId: asOrgId(organizationId), scoringStatus: 'pending_review', status: { $in: ['submitted', 'graded'] } } },
    { $group: { _id: '$assessmentId', n: { $sum: 1 } } },
  ]);
  const byAssessment = new Map();
  for (const row of grouped) {
    const id = String(row._id.assessmentId);
    const bucket = byAssessment.get(id) || {
      pending: 0, in_progress: 0, submitted: 0, graded: 0, expired: 0, revoked: 0, total: 0,
    };
    const status = row._id.status || 'pending';
    bucket[status] = (bucket[status] || 0) + row.n;
    bucket.total += row.n;
    byAssessment.set(id, bucket);
  }
  const flaggedMap = new Map(flagged.map((r) => [String(r._id), r.n]));
  const reviewMap = new Map(pendingReview.map((r) => [String(r._id), r.n]));
  return rows.map((row) => ({
    ...row,
    status: row.status || (row.isActive === false ? 'archived' : 'published'),
    maxScore: (row.questions || []).reduce((sum, question) => sum + (question.points || 0), 0),
    inviteStats: {
      ...(byAssessment.get(String(row._id)) || {
        pending: 0, in_progress: 0, submitted: 0, graded: 0, expired: 0, revoked: 0, total: 0,
      }),
      flagged: flaggedMap.get(String(row._id)) || 0,
      pendingReview: reviewMap.get(String(row._id)) || 0,
    },
    unpublishedChanges: !!(row.publishedAt && row.updatedAt && new Date(row.updatedAt) > new Date(row.publishedAt)),
  }));
}

async function overview(organizationId) {
  const list = await listAssessments(organizationId);
  const stats = list.reduce((acc, row) => {
    acc.assessments += 1;
    acc.assigned += row.inviteStats.total || 0;
    acc.inProgress += (row.inviteStats.in_progress || 0) + (row.inviteStats.pending || 0);
    acc.completed += (row.inviteStats.submitted || 0) + (row.inviteStats.graded || 0);
    acc.pendingReview += row.inviteStats.pendingReview || 0;
    acc.flagged += row.inviteStats.flagged || 0;
    return acc;
  }, { assessments: 0, assigned: 0, inProgress: 0, completed: 0, pendingReview: 0, flagged: 0 });
  return { stats, assessments: list };
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
  if (['mcq', 'choice', 'single_choice', 'multiple_choice', 'multi_choice', 'aptitude'].includes(raw)) return 'multiple_choice';
  if (['code', 'coding', 'programming'].includes(raw)) return 'code';
  if (['communication', 'spoken', 'writing'].includes(raw)) return 'communication';
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
    const mapTests = (list) => (Array.isArray(list) ? list : []).slice(0, 20).map((t) => ({
      name: String(t?.name || '').slice(0, 80),
      input: String(t?.input || t?.stdin || '').slice(0, 4000),
      expected: String(t?.expected || '').slice(0, 4000),
    }));
    const hiddenTests = type === 'code' ? mapTests(q.hiddenTests) : [];
    const visibleTests = type === 'code' ? mapTests(q.visibleTests) : [];
    return {
      type,
      prompt,
      options: type === 'multiple_choice' ? options : [],
      correctOptionIndex: type === 'multiple_choice' ? correctOptionIndex : undefined,
      points: Number(q?.points) >= 0 ? Number(q.points) : 10,
      language: type === 'code' ? String(q?.language || '').trim() : '',
      required: q?.required !== false,
      skillTag: String(q?.skillTag || '').trim().slice(0, 80),
      section: String(q?.section || '').trim().slice(0, 80),
      rubric: String(q?.rubric || '').trim().slice(0, 2000),
      hiddenTests,
      visibleTests,
    };
  });
  const blank = list.find((q) => !q.prompt);
  if (blank) throw httpError('Every question needs a prompt');
  const weakChoice = list.find((q) => q.type === 'multiple_choice' && q.options.length < 2);
  if (weakChoice) throw httpError('Multiple choice questions need at least two options');
  return list;
}

function normalizeRulesInput(rules, durationMinutes) {
  return engine.normalizeRules(rules || {}, durationMinutes);
}

async function createAssessment(organizationId, userId, body) {
  const {
    title, description = '', candidateInstructions = '', durationMinutes = 45,
    questions = [], proctoring, rules, jobId, status, pipelineStage, advanceStage,
  } = body;
  if (!title || !title.trim()) throw httpError('Title is required');
  if (!Array.isArray(questions) || questions.length === 0) {
    throw httpError('At least one question is required');
  }

  const proctoringConfig = await resolveProctoringConfig(organizationId, proctoring);
  const normalizedQuestions = normalizeQuestions(questions);
  const normalizedRules = normalizeRulesInput(rules, durationMinutes);
  try {
    const doc = await Assessment.create({
      organizationId,
      title: title.trim(),
      description,
      candidateInstructions,
      durationMinutes: normalizedRules.durationMinutes,
      questions: normalizedQuestions,
      rules: normalizedRules,
      jobId: jobId || null,
      pipelineStage: String(pipelineStage || '').trim(),
      advanceStage: String(advanceStage || 'Interview').trim() || 'Interview',
      proctoring: proctoringConfig,
      createdBy: userId,
      status: status === 'published' ? 'published' : 'draft',
      isActive: status !== 'archived',
    });
    if (doc.status === 'published') {
      doc.version = 1;
      doc.publishedAt = new Date();
      doc.publishedSnapshot = engine.buildPublishedSnapshot(doc);
      await doc.save();
    }
    return doc;
  } catch (err) {
    if (err.name === 'ValidationError') throw httpError(err.message, 400);
    throw err;
  }
}

async function updateAssessment(organizationId, id, body) {
  const {
    title, description, candidateInstructions, durationMinutes, questions, isActive, proctoring, rules, jobId,
    pipelineStage, advanceStage,
  } = body;
  const assessment = await Assessment.findOne({ _id: id, organizationId });
  if (!assessment) throw httpError('Assessment not found', 404);

  if (title !== undefined) assessment.title = title.trim();
  if (description !== undefined) assessment.description = description;
  if (candidateInstructions !== undefined) assessment.candidateInstructions = candidateInstructions;
  if (durationMinutes !== undefined) assessment.durationMinutes = durationMinutes;
  if (questions !== undefined) assessment.questions = normalizeQuestions(questions);
  if (rules !== undefined) assessment.rules = normalizeRulesInput(rules, durationMinutes ?? assessment.durationMinutes);
  if (jobId !== undefined) assessment.jobId = jobId || null;
  if (pipelineStage !== undefined) assessment.pipelineStage = String(pipelineStage || '').trim();
  if (advanceStage !== undefined) assessment.advanceStage = String(advanceStage || 'Interview').trim() || 'Interview';
  if (isActive !== undefined) {
    assessment.isActive = isActive;
    assessment.status = isActive ? (assessment.status === 'archived' ? 'published' : assessment.status) : 'archived';
  }
  if (proctoring !== undefined) {
    assessment.proctoring = await resolveProctoringConfig(organizationId, proctoring);
  }
  await assessment.save();
  return assessment;
}

async function publishAssessment(organizationId, userId, id) {
  const assessment = await Assessment.findOne({ _id: id, organizationId });
  if (!assessment) throw httpError('Assessment not found', 404);
  if (!assessment.questions?.length) throw httpError('Add questions before publishing');
  assessment.status = 'published';
  assessment.isActive = true;
  assessment.version = assessment.publishedAt ? (Number(assessment.version) || 1) + 1 : 1;
  assessment.publishedAt = new Date();
  assessment.publishedSnapshot = engine.buildPublishedSnapshot(assessment);
  await assessment.save();
  audit(eventTypes.ASSESSMENT_PUBLISHED, {
    organizationId,
    userId,
    resourceId: assessment._id,
    title: assessment.title,
  });
  return assessment;
}

async function deleteAssessment(organizationId, id) {
  const existing = await AssessmentInvite.countDocuments({ assessmentId: id, organizationId });
  if (existing > 0) {
    throw httpError('Archive this assessment instead. Attempt history must be kept for audit.', 409);
  }
  const assessment = await Assessment.findOneAndDelete({ _id: id, organizationId });
  if (!assessment) throw httpError('Assessment not found', 404);
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

async function ensurePublished(organizationId, userId, assessment) {
  const usable = isUsableForInvite(assessment);
  if (usable === true) return assessment;
  if (usable === 'draft') {
    return publishAssessment(organizationId, userId, assessment._id);
  }
  throw httpError('This assessment is archived. Restore it before inviting anyone.', 400);
}

async function inviteCandidate(organizationId, userId, assessmentId, body) {
  const { candidateId, applicationId, expiresInHours, jobId } = body;
  let assessment = await Assessment.findOne({ _id: assessmentId, organizationId });
  if (!assessment) throw httpError('Assessment not found', 404);
  assessment = await ensurePublished(organizationId, userId, assessment);

  const candidate = await Candidate.findOne({ _id: candidateId, organizationId });
  if (!candidate) throw httpError('Candidate not found', 404);
  await assertInternalCandidate(organizationId, candidate);

  const org = await Organization.findById(organizationId).select('settings');
  const hours = Number(expiresInHours) > 0 ? Number(expiresInHours) : (org?.settings?.assessments?.defaultInviteHours || 72);
  const maxAttempts = assessment.publishedSnapshot?.rules?.maxAttempts || assessment.rules?.maxAttempts || 1;

  const openInvite = await AssessmentInvite.findOne({
    organizationId,
    assessmentId: assessment._id,
    candidateId: candidate._id,
    status: { $in: ['pending', 'in_progress'] },
  });
  if (openInvite) {
    throw httpError('This candidate already has an open invite. Copy or resend that link instead.');
  }

  const priorCount = await AssessmentInvite.countDocuments({
    organizationId,
    assessmentId: assessment._id,
    candidateId: candidate._id,
  });
  if (priorCount >= maxAttempts) {
    throw httpError(`This candidate has reached the attempt limit (${maxAttempts}).`);
  }

  const token = AssessmentInvite.generateToken();
  const invite = await AssessmentInvite.create({
    organizationId,
    assessmentId: assessment._id,
    candidateId: candidate._id,
    applicationId: applicationId || undefined,
    jobId: jobId || assessment.jobId || undefined,
    token,
    sentBy: userId,
    attemptNumber: priorCount + 1,
    publishedVersion: assessment.version,
    expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000),
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
          <p style="margin:0;font-size:12px;color:#94a3b8;">${assessment.durationMinutes} minutes &nbsp;&middot;&nbsp; Link expires in ${hours} hours</p>
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

  audit(eventTypes.ASSESSMENT_INVITED, {
    organizationId,
    userId,
    resourceId: invite._id,
    candidateId: candidate._id,
    applicationId: invite.applicationId,
  });

  const serialized = typeof invite.toObject === 'function' ? invite.toObject() : invite;
  serialized.emailSent = emailSent;
  serialized.takeUrl = takeUrl;
  return serialized;
}

function serializeInvite(invite, { includeToken = true } = {}) {
  const row = typeof invite.toObject === 'function' ? invite.toObject() : { ...invite };
  if (!includeToken) delete row.token;
  if (row.snapshot?.questions) {
    row.snapshot = { ...row.snapshot, questions: row.snapshot.questions };
  }
  return row;
}

async function listInvites(organizationId, query, { includeToken = false } = {}) {
  await refreshExpiredInvites(organizationId);
  const filter = { organizationId };
  if (query.assessmentId) filter.assessmentId = query.assessmentId;
  if (query.jobId) filter.jobId = query.jobId;
  if (query.status) filter.status = query.status;
  const rows = await AssessmentInvite.find(filter)
    .populate('candidateId', 'name email')
    .populate('assessmentId', 'title maxScore jobId')
    .sort({ createdAt: -1 });
  return rows.map((row) => serializeInvite(row, { includeToken }));
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
  if (invite.status === 'in_progress') {
    throw httpError('This attempt is already in progress. Revoke it first if you need a new link.');
  }
  const assessment = invite.assessmentId;
  const candidate = invite.candidateId;
  if (!assessment || !candidate?.email) throw httpError('Invite is missing a candidate email', 400);
  invite.token = AssessmentInvite.generateToken();
  invite.expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
  if (invite.status === 'expired' || invite.status === 'revoked') invite.status = 'pending';
  invite.sentAt = new Date();
  invite.sentBy = userId;
  invite.revokedAt = undefined;
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
  return { emailSent, status: invite.status, expiresAt: invite.expiresAt, takeUrl };
}

async function revokeInvite(organizationId, userId, inviteId) {
  const invite = await AssessmentInvite.findOne({ _id: inviteId, organizationId });
  if (!invite) throw httpError('Invite not found', 404);
  if (invite.status === 'submitted' || invite.status === 'graded') {
    throw httpError('Submitted attempts cannot be revoked');
  }
  invite.status = 'revoked';
  invite.revokedAt = new Date();
  invite.token = AssessmentInvite.generateToken();
  await invite.save();
  audit(eventTypes.ASSESSMENT_REVOKED, {
    organizationId, userId, resourceId: invite._id, candidateId: invite.candidateId,
  });
  return { status: invite.status };
}

async function getInviteIntegrity(organizationId, id) {
  const invite = await AssessmentInvite.findOne({ _id: id, organizationId })
    .populate('candidateId', 'name email')
    .populate('assessmentId', 'title proctoring')
    .lean();
  if (!invite) throw httpError('Invite not found', 404);
  const events = (invite.proctoring?.events || []).map((event) => {
    if (event.type !== 'snapshot') return event;
    return { ...event, meta: { ...(event.meta || {}), image: event.meta?.image ? '[stored]' : undefined } };
  });
  return {
    candidate: invite.candidateId,
    assessment: invite.assessmentId,
    status: invite.status,
    scoringStatus: invite.scoringStatus,
    passFail: invite.passFail,
    proctoring: { ...(invite.proctoring || {}), events },
  };
}

async function gradeInvite(organizationId, userId, id, body) {
  const { scores = [], feedback = '', reason = '' } = body;
  const invite = await AssessmentInvite.findOne({ _id: id, organizationId });
  if (!invite) throw httpError('Invite not found', 404);
  if (invite.status !== 'submitted' && invite.status !== 'graded') {
    throw httpError('Candidate has not submitted this assessment yet');
  }

  const scoreMap = new Map(scores.map((s) => [String(s.questionId), s]));
  invite.answers = invite.answers.map((a) => {
    const patch = scoreMap.get(String(a.questionId));
    if (!patch) return a;
    const next = typeof a.toObject === 'function' ? a.toObject() : { ...a };
    if (patch.manualScore !== undefined) next.manualScore = Number(patch.manualScore);
    if (patch.evaluatorComment !== undefined) next.evaluatorComment = String(patch.evaluatorComment || '').slice(0, 2000);
    return next;
  });

  const snapshot = invite.snapshot || {};
  const questions = snapshot.questions || invite.assessmentId?.questions || [];
  const questionMap = new Map(questions.map((q) => [String(q._id), q]));
  const stillPending = invite.answers.some((a) => {
    const q = questionMap.get(String(a.questionId));
    if (!q || q.type === 'multiple_choice') return false;
    return a.manualScore == null || a.manualScore === '';
  });

  invite.totalScore = invite.answers.reduce((sum, a) => {
    if (a.manualScore != null && a.manualScore !== '') return sum + Number(a.manualScore);
    return sum + (Number(a.autoScore) || 0);
  }, 0);
  invite.maxScore = questions.length
    ? questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0)
    : invite.maxScore;
  invite.percent = invite.maxScore ? Math.round((invite.totalScore / invite.maxScore) * 1000) / 10 : 0;
  invite.feedback = feedback;
  invite.status = 'graded';
  invite.gradedBy = userId;
  invite.gradedAt = new Date();
  invite.scoringStatus = stillPending ? 'pending_review' : 'scored';
  if (!stillPending) {
    const passing = Number(snapshot.rules?.passingScorePercent) || 0;
    invite.passFail = passing > 0 && invite.percent < passing ? 'fail' : 'pass';
  } else {
    invite.passFail = 'pending';
  }
  if (reason) invite.overrideReason = String(reason).slice(0, 500);
  await invite.save();
  audit(eventTypes.ASSESSMENT_GRADED, {
    organizationId, userId, resourceId: invite._id, candidateId: invite.candidateId,
  });
  return invite;
}

async function recordDecision(organizationId, userId, id, body) {
  const decision = String(body.decision || 'none');
  if (!['none', 'shortlist', 'reject', 'advance'].includes(decision)) {
    throw httpError('Invalid decision');
  }
  const invite = await AssessmentInvite.findOne({ _id: id, organizationId });
  if (!invite) throw httpError('Invite not found', 404);
  if (invite.scoringStatus === 'pending_review' && decision === 'reject') {
    throw httpError('Do not reject from this score while evaluation is still pending.');
  }
  invite.decision = decision;
  invite.decisionReason = String(body.reason || '').slice(0, 2000);
  invite.decisionBy = userId;
  invite.decisionAt = new Date();
  await invite.save();

  if (invite.applicationId && (decision === 'advance' || decision === 'reject' || decision === 'shortlist')) {
    try {
      const applicationService = require('./applicationService');
      const assessment = await Assessment.findOne({ _id: invite.assessmentId, organizationId }).select('advanceStage pipelineStage');
      if (decision === 'reject') {
        await applicationService.rejectApplication(
          { id: userId, organizationId },
          invite.applicationId,
          { reason: invite.decisionReason || 'Rejected after assessment' }
        );
      } else {
        const nextStage = decision === 'advance'
          ? (assessment?.advanceStage || 'Interview')
          : (assessment?.pipelineStage || 'Shortlisted');
        await applicationService.changeStage(
          { id: userId, organizationId },
          invite.applicationId,
          { stage: nextStage, remark: invite.decisionReason || `Assessment ${decision}` }
        );
      }
    } catch (err) {
      console.error('[assessments] pipeline update skipped:', err.message);
    }
  }

  audit(eventTypes.ASSESSMENT_DECISION, {
    organizationId, userId, resourceId: invite._id, candidateId: invite.candidateId, message: decision,
  });
  return invite;
}

async function rankInvites(organizationId, query) {
  const filter = { organizationId, status: { $in: ['submitted', 'graded'] } };
  if (query.assessmentId) filter.assessmentId = query.assessmentId;
  if (query.jobId) filter.jobId = query.jobId;
  const rows = await AssessmentInvite.find(filter)
    .populate('candidateId', 'name email')
    .populate('assessmentId', 'title jobId version')
    .lean();
  const grouped = new Map();
  for (const row of rows) {
    const key = `${row.assessmentId?._id || row.assessmentId}:${row.publishedVersion || 1}:${row.jobId || ''}`;
    const list = grouped.get(key) || [];
    list.push(row);
    grouped.set(key, list);
  }
  const groups = [];
  for (const [, list] of grouped) {
    groups.push({
      assessmentId: list[0].assessmentId,
      publishedVersion: list[0].publishedVersion,
      jobId: list[0].jobId,
      ranking: engine.rankRows(list),
    });
  }
  return groups;
}

async function evaluationQueue(organizationId) {
  const rows = await AssessmentInvite.find({
    organizationId,
    status: { $in: ['submitted', 'graded'] },
    scoringStatus: 'pending_review',
  })
    .populate('candidateId', 'name email')
    .populate('assessmentId', 'title')
    .sort({ submittedAt: 1 })
    .lean();
  return rows;
}

async function listQuestionBank(organizationId, query = {}) {
  const filter = { organizationId, archivedAt: null };
  if (query.q) {
    const rx = { $regex: String(query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    filter.$or = [{ prompt: rx }, { skillTag: rx }, { tags: rx }];
  }
  if (query.type) filter.type = normalizeQuestionType(query.type);
  return AssessmentQuestion.find(filter).sort({ updatedAt: -1 }).limit(200).lean();
}

async function upsertQuestionBank(organizationId, userId, body) {
  const questions = normalizeQuestions([body]);
  const payload = { ...questions[0], organizationId, createdBy: userId, tags: Array.isArray(body.tags) ? body.tags : [] };
  if (body._id) {
    const updated = await AssessmentQuestion.findOneAndUpdate(
      { _id: body._id, organizationId },
      { $set: payload },
      { new: true }
    );
    if (!updated) throw httpError('Question not found', 404);
    return updated;
  }
  return AssessmentQuestion.create(payload);
}

async function archiveQuestionBank(organizationId, id) {
  const row = await AssessmentQuestion.findOneAndUpdate(
    { _id: id, organizationId },
    { $set: { archivedAt: new Date() } },
    { new: true }
  );
  if (!row) throw httpError('Question not found', 404);
  return { archived: true };
}

async function getSettings(organizationId) {
  const org = await Organization.findById(organizationId).select('settings.assessments');
  return org?.settings?.assessments || {
    defaultInviteHours: 72,
    defaultResultVisibility: 'hidden',
    retentionDays: 730,
    privacyNotice: '',
    allowCandidateRetakes: false,
  };
}

async function updateSettings(organizationId, body) {
  const next = {
    defaultInviteHours: Math.min(720, Math.max(1, Number(body.defaultInviteHours) || 72)),
    defaultResultVisibility: ['hidden', 'score', 'detailed'].includes(body.defaultResultVisibility)
      ? body.defaultResultVisibility
      : 'hidden',
    retentionDays: Math.min(3650, Math.max(30, Number(body.retentionDays) || 730)),
    privacyNotice: String(body.privacyNotice || '').slice(0, 4000),
    allowCandidateRetakes: !!body.allowCandidateRetakes,
  };
  await Organization.findByIdAndUpdate(organizationId, { $set: { 'settings.assessments': next } });
  return next;
}

async function listJobsLite(organizationId) {
  const Job = require('../models/Job');
  return Job.find({ organizationId, isTemplate: { $ne: true } })
    .select('title role jobCode status pipeline')
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
}

async function listJobApplicants(organizationId, { jobId, stage }) {
  if (!jobId) throw httpError('jobId is required');
  const Application = require('../models/Application');
  const filter = { organizationId, jobId, isRejected: { $ne: true } };
  if (stage) filter.stage = stage;
  return Application.find(filter)
    .populate('candidateId', 'name email')
    .select('candidateId stage jobId')
    .sort({ updatedAt: -1 })
    .limit(200)
    .lean();
}

async function inviteJobApplicants(organizationId, userId, assessmentId, body) {
  const applicants = await listJobApplicants(organizationId, { jobId: body.jobId, stage: body.stage });
  const results = [];
  for (const app of applicants) {
    const candidateId = app.candidateId?._id || app.candidateId;
    if (!candidateId) continue;
    try {
      const data = await inviteCandidate(organizationId, userId, assessmentId, {
        candidateId,
        applicationId: app._id,
        jobId: body.jobId,
        expiresInHours: body.expiresInHours,
      });
      results.push({ candidateId, ok: true, inviteId: data._id, emailSent: data.emailSent });
    } catch (err) {
      results.push({ candidateId, ok: false, message: err.message });
    }
  }
  return { invited: results.filter((r) => r.ok).length, skipped: results.filter((r) => !r.ok).length, results };
}

async function suggestEvaluation(organizationId, inviteId) {
  const invite = await AssessmentInvite.findOne({ _id: inviteId, organizationId });
  if (!invite) throw httpError('Invite not found', 404);
  const { getAdapter } = require('../adapters');
  const adapter = await getAdapter(organizationId, 'ai');
  if (!adapter?.generateText) {
    throw httpError('AI evaluation requires an AI integration. Suggestions never auto-finalize a score.', 503, { code: 'AI_NOT_CONFIGURED' });
  }
  const snapshot = resolveInviteSnapshot(invite);
  const subjective = (snapshot.questions || []).filter((q) => q.type !== 'multiple_choice');
  const payload = subjective.map((q) => {
    const answer = (invite.answers || []).find((a) => String(a.questionId) === String(q._id));
    return {
      questionId: String(q._id),
      prompt: q.prompt,
      rubric: q.rubric || '',
      points: q.points,
      response: answer?.response || '',
    };
  });
  const prompt = `You are an assessment evaluator. Suggest scores only. A human must confirm.
Return JSON {"items":[{"questionId":"...","suggestedScore":number,"comment":"one sentence"}]}.
Do not mark the candidate as failed. Max score per question is provided.
ITEMS:\n${JSON.stringify(payload).slice(0, 12000)}`;
  const raw = await adapter.generateText({ prompt, maxTokens: 800 });
  let parsed;
  try {
    parsed = JSON.parse(String(raw).replace(/```json|```/g, '').trim());
  } catch {
    parsed = { items: [], raw: String(raw).slice(0, 2000) };
  }
  invite.aiSuggestion = { at: new Date(), items: parsed.items || [], pendingHuman: true };
  await invite.save();
  return invite.aiSuggestion;
}

async function listAssessmentAudit(organizationId, assessmentId) {
  const AuditLog = require('../models/AuditLog');
  const invites = await AssessmentInvite.find({ organizationId, assessmentId }).select('_id').lean();
  const ids = [assessmentId, ...invites.map((i) => i._id)];
  return AuditLog.find({
    organizationId,
    resourceId: { $in: ids },
  })
    .sort({ timestamp: -1 })
    .limit(80)
    .populate('userId', 'name email')
    .lean();
}

module.exports = {
  takeAssessment,
  startAttempt,
  saveAnswers,
  recordProctoringEvents,
  submitAssessment,
  listAssessments,
  overview,
  redactAnswerKeys,
  searchInternalCandidates,
  createAssessment,
  updateAssessment,
  publishAssessment,
  deleteAssessment,
  inviteCandidate,
  listInvites,
  getInvite,
  resendInvite,
  revokeInvite,
  getInviteIntegrity,
  gradeInvite,
  recordDecision,
  rankInvites,
  evaluationQueue,
  listQuestionBank,
  upsertQuestionBank,
  archiveQuestionBank,
  getSettings,
  updateSettings,
  listJobsLite,
  listJobApplicants,
  inviteJobApplicants,
  suggestEvaluation,
  listAssessmentAudit,
};
