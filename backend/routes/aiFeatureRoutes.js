/**
 * AI Feature Routes — Phase 4 product capabilities.
 * Mounted at /api/ai with verifyToken; each route gated by requireFeature.
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { requireFeature } = require('../middleware/featureMiddleware');
const { getAdapter } = require('../adapters');
const Candidate = require('../models/Candidate');
const Organization = require('../models/Organization');
const { anonymizeText, anonymizeCandidate } = require('../services/anonymizeService');
const { findDuplicates } = require('../services/dedupeService');

const cosineSimilarity = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom ? dot / denom : 0;
};

const loadAiAdapter = async (req, res) => {
  const adapter = await getAdapter(req.user.organizationId, 'ai');
  if (!adapter) {
    res.status(503).json({
      success: false,
      code: 'AI_NOT_CONFIGURED',
      message: 'AI integration is not configured. Add an AI provider under Organization → Integrations.'
    });
    return null;
  }
  return adapter;
};

const candidateProfileText = (c) => [
  c.name && `Name: ${c.name}`,
  c.position && `Position: ${c.position}`,
  c.experience && `Experience: ${c.experience}`,
  c.skills && `Skills: ${c.skills}`,
  c.companyName && `Company: ${c.companyName}`,
  c.resumeText && `Resume:\n${c.resumeText}`
].filter(Boolean).join('\n');

// POST /score — LLM resume scoring vs JD
router.post('/score', requireFeature('integrations.aiScoring'), async (req, res) => {
  try {
    const adapter = await loadAiAdapter(req, res);
    if (!adapter) return;

    let { resumeText, jobDescription, candidateId } = req.body;
    if (!jobDescription) {
      return res.status(400).json({ success: false, message: 'jobDescription is required' });
    }

    if (candidateId && !resumeText) {
      const candidate = await Candidate.findOne({
        _id: candidateId,
        organizationId: req.user.organizationId
      }).select('resumeText name skills position experience companyName');
      if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });
      resumeText = candidate.resumeText || candidateProfileText(candidate);
    }

    if (!resumeText) {
      return res.status(400).json({ success: false, message: 'resumeText or candidateId with resume data is required' });
    }

    const result = await adapter.scoreResume({ resumeText, jobDescription });
    res.json({ success: true, data: result, meta: { method: 'llm' } });
  } catch (error) {
    console.error('AI score error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /jd-generate — bullets → full JD
router.post('/jd-generate', requireFeature('ai.jdGenerator'), async (req, res) => {
  try {
    const adapter = await loadAiAdapter(req, res);
    if (!adapter) return;

    const { bullets, title, company } = req.body;
    if (!bullets) {
      return res.status(400).json({ success: false, message: 'bullets is required' });
    }

    const prompt = `Write a professional job description from these bullet points.
${title ? `Job title: ${title}` : ''}
${company ? `Company: ${company}` : ''}

Bullet points:
${Array.isArray(bullets) ? bullets.map((b) => `- ${b}`).join('\n') : bullets}

Include: role summary, responsibilities, requirements, and nice-to-haves. Use clear sections.`;

    const text = await adapter.generateText({ prompt, maxTokens: 1200 });
    res.json({ success: true, data: { jobDescription: text } });
  } catch (error) {
    console.error('JD generate error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /interview-questions
router.post('/interview-questions', requireFeature('ai.interviewQuestions'), async (req, res) => {
  try {
    const adapter = await loadAiAdapter(req, res);
    if (!adapter) return;

    const { candidateProfile, jobDescription, candidateId, count = 8 } = req.body;
    if (!jobDescription) {
      return res.status(400).json({ success: false, message: 'jobDescription is required' });
    }

    let profile = candidateProfile;
    if (candidateId && !profile) {
      const candidate = await Candidate.findOne({
        _id: candidateId,
        organizationId: req.user.organizationId
      });
      if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });
      profile = candidateProfileText(candidate);
    }
    if (!profile) {
      return res.status(400).json({ success: false, message: 'candidateProfile or candidateId is required' });
    }

    const prompt = `Generate ${count} structured interview questions for this role and candidate.
Return JSON only: {"questions":[{"question":string,"category":"technical"|"behavioral"|"culture","rationale":string}]}

JOB DESCRIPTION:
${jobDescription}

CANDIDATE:
${profile}`;

    const raw = await adapter.generateText({ prompt, maxTokens: 1000 });
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { questions: raw.split('\n').filter(Boolean).map((q) => ({ question: q.replace(/^\d+\.\s*/, ''), category: 'behavioral' })) };
    }
    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error('Interview questions error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /boolean-generate
router.post('/boolean-generate', requireFeature('ai.booleanGenerator'), async (req, res) => {
  try {
    const adapter = await loadAiAdapter(req, res);
    if (!adapter) return;

    const { keywords, platform = 'linkedin' } = req.body;
    if (!keywords || (Array.isArray(keywords) && !keywords.length)) {
      return res.status(400).json({ success: false, message: 'keywords is required' });
    }

    const kw = Array.isArray(keywords) ? keywords.join(', ') : keywords;
    const prompt = `Convert these recruiting keywords into a Boolean search string for ${platform}.
Keywords: ${kw}
Return JSON only: {"booleanString": string, "tips": string}`;

    const raw = await adapter.generateText({ prompt, maxTokens: 400 });
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { booleanString: raw.trim(), tips: '' };
    }
    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error('Boolean generate error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /email-draft
router.post('/email-draft', requireFeature('ai.emailDrafting'), async (req, res) => {
  try {
    const adapter = await loadAiAdapter(req, res);
    if (!adapter) return;

    const { type, context = {} } = req.body;
    if (!type || !['rejection', 'offer'].includes(type)) {
      return res.status(400).json({ success: false, message: "type must be 'rejection' or 'offer'" });
    }

    const org = await Organization.findById(req.user.organizationId).select('securitySettings name');
    const tone = org?.securitySettings?.aiTone || 'professional';

    const prompt = `Draft a ${type} email for a candidate in a ${tone} tone.
Organization: ${org?.name || 'Our company'}
Context: ${JSON.stringify(context, null, 2)}

Return JSON only: {"subject": string, "body": string}`;

    const raw = await adapter.generateText({ prompt, maxTokens: 700 });
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { subject: `${type === 'offer' ? 'Offer' : 'Application update'}`, body: raw.trim() };
    }
    res.json({ success: true, data: parsed, meta: { tone } });
  } catch (error) {
    console.error('Email draft error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /anonymize — regex/heuristic PII strip
router.post('/anonymize', requireFeature('candidates.anonymize'), async (req, res) => {
  try {
    const { text, candidateId } = req.body;

    if (candidateId) {
      const candidate = await Candidate.findOne({
        _id: candidateId,
        organizationId: req.user.organizationId
      });
      if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });
      return res.json({
        success: true,
        data: anonymizeCandidate(candidate),
        meta: { method: 'regex_heuristic' }
      });
    }

    if (!text) {
      return res.status(400).json({ success: false, message: 'text or candidateId is required' });
    }

    const result = anonymizeText(text, { name: req.body.name });
    res.json({ success: true, data: result, meta: { method: 'regex_heuristic' } });
  } catch (error) {
    console.error('Anonymize error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /bias-flag
router.post('/bias-flag', requireFeature('ai.biasFlagging'), async (req, res) => {
  try {
    const adapter = await loadAiAdapter(req, res);
    if (!adapter) return;

    const { text, type = 'jd' } = req.body;
    if (!text) return res.status(400).json({ success: false, message: 'text is required' });

    const prompt = `Review this ${type === 'scorecard' ? 'interview scorecard' : 'job description'} for biased or exclusionary language.
Return JSON only: {"flags":[{"phrase":string,"issue":string,"suggestion":string}],"overallRisk":"low"|"medium"|"high","summary":string}

TEXT:
${text}`;

    const raw = await adapter.generateText({ prompt, maxTokens: 800 });
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { flags: [], overallRisk: 'unknown', summary: raw.trim() };
    }
    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error('Bias flag error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /narrative — metrics → narrative analytics
router.post('/narrative', requireFeature('ai.narrativeAnalytics'), async (req, res) => {
  try {
    const adapter = await loadAiAdapter(req, res);
    if (!adapter) return;

    const { metrics } = req.body;
    if (!metrics) return res.status(400).json({ success: false, message: 'metrics is required' });

    const prompt = `You are a recruiting analytics narrator. Turn these hiring metrics into an executive summary with trends and actionable insights.
Return JSON only: {"headline":string,"narrative":string,"highlights":[string],"recommendations":[string]}

METRICS:
${typeof metrics === 'string' ? metrics : JSON.stringify(metrics, null, 2)}`;

    const raw = await adapter.generateText({ prompt, maxTokens: 900 });
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { headline: 'Hiring summary', narrative: raw.trim(), highlights: [], recommendations: [] };
    }
    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error('Narrative analytics error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /transcribe-scorecard
router.post('/transcribe-scorecard', requireFeature('ai.interviewTranscription'), async (req, res) => {
  try {
    const adapter = await loadAiAdapter(req, res);
    if (!adapter) return;

    const { transcript, jobDescription } = req.body;
    if (!transcript || !jobDescription) {
      return res.status(400).json({ success: false, message: 'transcript and jobDescription are required' });
    }

    const prompt = `From this interview transcript and job description, draft a structured scorecard.
Return JSON only: {"overallRecommendation":"strong_yes"|"yes"|"no"|"strong_no","scores":[{"competency":string,"rating":1-5,"evidence":string}],"summary":string,"strengths":[string],"concerns":[string]}

JOB DESCRIPTION:
${jobDescription}

TRANSCRIPT:
${transcript}`;

    const raw = await adapter.generateText({ prompt, maxTokens: 1200 });
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { summary: raw.trim(), scores: [], strengths: [], concerns: [] };
    }
    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error('Transcribe scorecard error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /semantic-search
router.post('/semantic-search', requireFeature('ai.semanticSearch'), async (req, res) => {
  try {
    const adapter = await loadAiAdapter(req, res);
    if (!adapter) return;

    if (typeof adapter.embed !== 'function') {
      return res.status(503).json({
        success: false,
        message: 'Your AI provider does not support embeddings. Use OpenAI, Azure OpenAI, Gemini, or Bedrock.'
      });
    }

    const { query, talentPoolId, limit = 20 } = req.body;
    if (!query) return res.status(400).json({ success: false, message: 'query is required' });

    const [queryEmbedding] = await adapter.embed(query);
    if (!queryEmbedding?.length) {
      return res.status(500).json({ success: false, message: 'Failed to generate query embedding' });
    }

    const match = {
      organizationId: new mongoose.Types.ObjectId(req.user.organizationId),
      embedding: { $exists: true, $ne: [] }
    };
    if (talentPoolId) {
      match.talentPoolIds = new mongoose.Types.ObjectId(talentPoolId);
    }

    const candidates = await Candidate.find(match)
      .select('name email position skills experience embedding resumeText')
      .lean();

    const scored = candidates
      .map((c) => ({
        candidateId: c._id,
        name: c.name,
        email: c.email,
        position: c.position,
        skills: c.skills,
        similarity: cosineSimilarity(queryEmbedding, c.embedding)
      }))
      .filter((r) => r.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, Math.min(limit, 50));

    res.json({ success: true, data: { results: scored, query } });
  } catch (error) {
    console.error('Semantic search error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /embed-candidate/:id
router.post('/embed-candidate/:id', requireFeature('ai.semanticSearch'), async (req, res) => {
  try {
    const adapter = await loadAiAdapter(req, res);
    if (!adapter) return;

    if (typeof adapter.embed !== 'function') {
      return res.status(503).json({
        success: false,
        message: 'Your AI provider does not support embeddings.'
      });
    }

    const candidate = await Candidate.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    });
    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });

    const text = candidate.resumeText || candidateProfileText(candidate);
    if (!text?.trim()) {
      return res.status(400).json({ success: false, message: 'Candidate has no resume text to embed' });
    }

    const [embedding] = await adapter.embed(text.slice(0, 8000));
    candidate.embedding = embedding;
    candidate.embeddingUpdatedAt = new Date();
    await candidate.save();

    res.json({
      success: true,
      data: { candidateId: candidate._id, embeddingUpdatedAt: candidate.embeddingUpdatedAt, dimensions: embedding?.length }
    });
  } catch (error) {
    console.error('Embed candidate error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /dedupe — fuzzy duplicate detection (not LLM)
router.post('/dedupe', requireFeature('candidates.dedupe'), async (req, res) => {
  try {
    const { candidateId, limit } = req.body;
    const result = await findDuplicates(req.user.organizationId, { candidateId, limit });
    res.json({ success: true, data: result, meta: { method: 'fuzzy_normalization' } });
  } catch (error) {
    console.error('Dedupe error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
