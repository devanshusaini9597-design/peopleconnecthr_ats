/**
 * AI Feature Routes — Phase 4 product capabilities.
 * Mounted at /api/ai with verifyToken; each route gated by requireFeature.
 */

const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const { requireFeature } = require('../middleware/featureMiddleware');
const {
  scoreResume,
  generateJobDescription,
  generateInterviewQuestions,
  generateBooleanSearch,
  draftEmail,
  anonymizeContent,
  flagBias,
  narrateMetrics,
  transcribeScorecard,
  semanticSearch,
  embedCandidate,
  dedupeCandidates,
  generateResume,
  summarizeResume,
  extractSkills,
  matchCandidate,
  improveJobDescription,
} = require('../services/aiFeatureService');

function handleAiError(res, error, label) {
  if (error.statusCode && error.statusCode < 500) {
    return res.status(error.statusCode).json({
      success: false,
      code: error.code,
      message: error.message,
    });
  }
  logger.error(`${label}:`, error);
  return res.status(500).json({ success: false, message: error.message });
}

function mount(path, feature, fn, label, wrap = (data) => ({ success: true, data })) {
  router.post(path, requireFeature(feature), async (req, res) => {
    try {
      const result = await fn(req.user.organizationId, req.body, req);
      if (result && result.data !== undefined && result.meta !== undefined) {
        return res.json({ success: true, ...result });
      }
      res.json(wrap(result));
    } catch (error) {
      handleAiError(res, error, label);
    }
  });
}

mount('/score', 'integrations.aiScoring', scoreResume, 'AI score error', (r) => ({
  success: true,
  ...r,
}));

mount('/jd-generate', 'ai.jdGenerator', generateJobDescription, 'JD generate error');
mount('/interview-questions', 'ai.interviewQuestions', generateInterviewQuestions, 'Interview questions error');
mount('/boolean-generate', 'ai.booleanGenerator', generateBooleanSearch, 'Boolean generate error');

router.post('/email-draft', requireFeature('ai.emailDrafting'), async (req, res) => {
  try {
    const result = await draftEmail(req.user.organizationId, req.body);
    res.json({ success: true, ...result });
  } catch (error) {
    handleAiError(res, error, 'Email draft error');
  }
});

router.post('/anonymize', requireFeature('candidates.anonymize'), async (req, res) => {
  try {
    const result = await anonymizeContent(req.user.organizationId, req.body);
    res.json({ success: true, ...result });
  } catch (error) {
    handleAiError(res, error, 'Anonymize error');
  }
});

mount('/bias-flag', 'ai.biasFlagging', flagBias, 'Bias flag error');
mount('/narrative', 'ai.narrativeAnalytics', narrateMetrics, 'Narrative analytics error');
mount('/transcribe-scorecard', 'ai.interviewTranscription', transcribeScorecard, 'Transcribe scorecard error');

router.post('/semantic-search', requireFeature('ai.semanticSearch'), async (req, res) => {
  try {
    const data = await semanticSearch(req.user.organizationId, req.body);
    res.json({ success: true, data });
  } catch (error) {
    handleAiError(res, error, 'Semantic search error');
  }
});

router.post('/embed-candidate/:id', requireFeature('ai.semanticSearch'), async (req, res) => {
  try {
    const data = await embedCandidate(req.user.organizationId, req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    handleAiError(res, error, 'Embed candidate error');
  }
});

router.post('/dedupe', requireFeature('candidates.dedupe'), async (req, res) => {
  try {
    const result = await dedupeCandidates(req.user.organizationId, req.body);
    res.json({ success: true, ...result });
  } catch (error) {
    handleAiError(res, error, 'Dedupe error');
  }
});

mount('/resume-generate', 'ai.resumeGenerator', generateResume, 'Resume generate error');
mount('/resume-summary', 'ai.resumeGenerator', summarizeResume, 'Resume summary error');
mount('/skills-extract', 'ai.skillsExtract', extractSkills, 'Skills extract error');
mount('/match', 'ai.matchScore', matchCandidate, 'Match score error');
mount('/jd-improve', 'ai.jdGenerator', improveJobDescription, 'JD improve error');

module.exports = router;
