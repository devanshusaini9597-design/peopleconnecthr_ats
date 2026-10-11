/**
 * Pure assessment scoring / snapshot helpers. Server remains authoritative:
 * candidates never receive keys, hidden tests, or scoring secrets.
 */

const CANDIDATE_SAFE_QUESTION_FIELDS = [
  '_id', 'type', 'prompt', 'language', 'options', 'points', 'required',
  'skillTag', 'section', 'allowBackHint', 'visibleTests',
];

const SECRET_QUESTION_FIELDS = [
  'correctOptionIndex', 'hiddenTests', 'rubric', 'answerKey', 'expected',
];

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value || null));
}

function normalizeRules(rules = {}, durationMinutes) {
  const passing = Number(rules.passingScorePercent);
  const negative = Number(rules.negativeMarkPercent);
  const maxAttempts = Number(rules.maxAttempts);
  const duration = Number(durationMinutes || rules.durationMinutes);
  return {
    durationMinutes: Number.isFinite(duration) && duration >= 5 ? duration : 45,
    passingScorePercent: Number.isFinite(passing) ? Math.min(100, Math.max(0, passing)) : 0,
    negativeMarkPercent: Number.isFinite(negative) ? Math.min(100, Math.max(0, negative)) : 0,
    maxAttempts: Number.isInteger(maxAttempts) && maxAttempts >= 1 ? Math.min(5, maxAttempts) : 1,
    randomizeQuestions: !!rules.randomizeQuestions,
    allowBack: rules.allowBack !== false,
    requireAll: rules.requireAll !== false,
    resultVisibility: ['hidden', 'score', 'detailed'].includes(rules.resultVisibility)
      ? rules.resultVisibility
      : 'hidden',
    autoSubmit: rules.autoSubmit !== false,
    windowStart: rules.windowStart || null,
    windowEnd: rules.windowEnd || null,
  };
}

function sanitizeCandidateQuestion(question) {
  const safe = {};
  for (const key of CANDIDATE_SAFE_QUESTION_FIELDS) {
    if (question[key] !== undefined) safe[key] = question[key];
  }
  if (question._id) safe._id = String(question._id);
  if (Array.isArray(question.visibleTests)) {
    safe.visibleTests = question.visibleTests.map((t) => ({
      name: t?.name || '',
      input: t?.input || t?.stdin || '',
    }));
  }
  return safe;
}

function stripSecretsFromQuestion(question) {
  const next = { ...question };
  for (const key of SECRET_QUESTION_FIELDS) delete next[key];
  return next;
}

function shuffleCopy(list, seed) {
  const arr = [...(list || [])];
  let s = Number(seed) || Date.now();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function remainingSeconds(deadlineAt, now = new Date()) {
  if (!deadlineAt) return null;
  return Math.max(0, Math.floor((new Date(deadlineAt).getTime() - now.getTime()) / 1000));
}

function computeDeadline({ startedAt, durationMinutes, inviteExpiresAt, windowEnd }) {
  const start = new Date(startedAt || Date.now());
  const durationMs = Math.max(5, Number(durationMinutes) || 45) * 60 * 1000;
  let deadline = new Date(start.getTime() + durationMs);
  const caps = [inviteExpiresAt, windowEnd].filter(Boolean).map((d) => new Date(d));
  for (const cap of caps) {
    if (cap < deadline) deadline = cap;
  }
  return deadline;
}

function windowIsOpen(rules, now = new Date()) {
  if (rules?.windowStart && now < new Date(rules.windowStart)) return false;
  if (rules?.windowEnd && now > new Date(rules.windowEnd)) return false;
  return true;
}

function scoreObjectiveAnswer(question, response, negativeMarkPercent = 0) {
  const points = Number(question.points) || 0;
  if (question.type !== 'multiple_choice') return { autoScore: undefined, needsReview: true };
  const selected = Number(response);
  const correct = Number(question.correctOptionIndex);
  if (Number.isInteger(selected) && selected === correct) {
    return { autoScore: points, needsReview: false };
  }
  const penalty = points * (Number(negativeMarkPercent) || 0) / 100;
  return { autoScore: penalty ? -penalty : 0, needsReview: false };
}

function scoreAttempt({ questions, answers, rules }) {
  const questionMap = new Map((questions || []).map((q) => [String(q._id), q]));
  const answerList = Array.isArray(answers) ? answers : [];
  const negative = rules?.negativeMarkPercent || 0;
  let needsReview = false;
  const graded = [];

  for (const raw of answerList) {
    const question = questionMap.get(String(raw.questionId));
    if (!question) continue;
    const response = String(raw.response ?? '').slice(0, 20000);
    const scored = scoreObjectiveAnswer(question, response, negative);
    if (scored.needsReview) needsReview = true;
    graded.push({
      questionId: question._id,
      response,
      autoScore: scored.autoScore,
      manualScore: raw.manualScore,
    });
  }

  const answeredIds = new Set(graded.map((a) => String(a.questionId)));
  for (const question of questions || []) {
    if (answeredIds.has(String(question._id))) continue;
    const scored = scoreObjectiveAnswer(question, '', negative);
    if (question.type !== 'multiple_choice') needsReview = true;
    graded.push({
      questionId: question._id,
      response: '',
      autoScore: question.type === 'multiple_choice' ? scored.autoScore : undefined,
    });
  }

  const maxScore = (questions || []).reduce((sum, q) => sum + (Number(q.points) || 0), 0);
  const totalScore = graded.reduce((sum, a) => {
    if (a.manualScore != null && a.manualScore !== '') return sum + Number(a.manualScore);
    return sum + (Number(a.autoScore) || 0);
  }, 0);

  const percent = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
  const passing = Number(rules?.passingScorePercent) || 0;
  let passFail = 'pending';
  if (!needsReview) {
    passFail = passing > 0 && percent < passing ? 'fail' : 'pass';
  }

  return {
    answers: graded,
    totalScore,
    maxScore,
    percent: Math.round(percent * 10) / 10,
    needsReview,
    scoringStatus: needsReview ? 'pending_review' : 'scored',
    passFail,
    skillBreakdown: buildSkillBreakdown(questions, graded),
  };
}

function buildSkillBreakdown(questions, answers) {
  const bySkill = new Map();
  const answerMap = new Map((answers || []).map((a) => [String(a.questionId), a]));
  for (const question of questions || []) {
    const skill = String(question.skillTag || question.section || 'Overall').trim() || 'Overall';
    const bucket = bySkill.get(skill) || { skill, earned: 0, max: 0 };
    bucket.max += Number(question.points) || 0;
    const answer = answerMap.get(String(question._id));
    if (answer) {
      const earned = answer.manualScore != null && answer.manualScore !== ''
        ? Number(answer.manualScore)
        : Number(answer.autoScore) || 0;
      bucket.earned += earned;
    }
    bySkill.set(skill, bucket);
  }
  return [...bySkill.values()].map((row) => ({
    ...row,
    percent: row.max ? Math.round((row.earned / row.max) * 1000) / 10 : 0,
  }));
}

function candidateResultView(invite, rules) {
  const visibility = rules?.resultVisibility || 'hidden';
  if (visibility === 'hidden') {
    return { visibility, message: 'The hiring team will review your answers and follow up.' };
  }
  if (invite.scoringStatus === 'pending_review' || invite.passFail === 'pending') {
    return { visibility, pending: true, message: 'Submitted. Some answers still need human review before a result is ready.' };
  }
  if (visibility === 'score') {
    return {
      visibility,
      totalScore: invite.totalScore,
      maxScore: invite.maxScore,
      percent: invite.percent,
      passFail: invite.passFail,
    };
  }
  return {
    visibility,
    totalScore: invite.totalScore,
    maxScore: invite.maxScore,
    percent: invite.percent,
    passFail: invite.passFail,
    feedback: invite.feedback || '',
  };
}

function rankRows(rows) {
  return [...(rows || [])]
    .filter((row) => ['submitted', 'graded'].includes(row.status) && row.scoringStatus !== 'pending_review')
    .sort((a, b) => (Number(b.totalScore) || 0) - (Number(a.totalScore) || 0))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function buildPublishedSnapshot(assessment) {
  const questions = (assessment.questions || []).map((q) => cloneJson(typeof q.toObject === 'function' ? q.toObject() : q));
  return {
    version: Number(assessment.version) || 1,
    title: assessment.title,
    description: assessment.description || '',
    candidateInstructions: assessment.candidateInstructions || '',
    durationMinutes: assessment.durationMinutes,
    questions,
    rules: normalizeRules(assessment.rules, assessment.durationMinutes),
    proctoring: assessment.proctoring || { enabled: false },
    frozenAt: new Date().toISOString(),
  };
}

module.exports = {
  CANDIDATE_SAFE_QUESTION_FIELDS,
  SECRET_QUESTION_FIELDS,
  cloneJson,
  normalizeRules,
  sanitizeCandidateQuestion,
  stripSecretsFromQuestion,
  shuffleCopy,
  remainingSeconds,
  computeDeadline,
  windowIsOpen,
  scoreObjectiveAnswer,
  scoreAttempt,
  candidateResultView,
  rankRows,
  buildPublishedSnapshot,
  buildSkillBreakdown,
};
