/**
 * AI feature domain helpers — scoring, generation, search, embed.
 */
const mongoose = require('mongoose');
const { getAdapter } = require('../adapters');
const Candidate = require('../models/Candidate');
const Organization = require('../models/Organization');
const { anonymizeText, anonymizeCandidate } = require('./anonymizeService');
const { findDuplicates } = require('./dedupeService');
const {
  cosineSimilarity,
  parseJsonLoose,
  candidateProfileText,
} = require('./aiFeatureHelpers');

const EMAIL_TYPES = ['rejection', 'offer', 'interview', 'screen', 'followup', 'nurture'];

async function loadAiAdapter(organizationId) {
  const adapter = await getAdapter(organizationId, 'ai');
  if (!adapter) {
    const err = new Error(
      'AI integration is not configured. Add an AI provider under Organization → Integrations.'
    );
    err.statusCode = 503;
    err.code = 'AI_NOT_CONFIGURED';
    throw err;
  }
  return adapter;
}

function requireEmbedSupport(adapter) {
  if (typeof adapter.embed !== 'function') {
    const err = new Error(
      'Your AI provider does not support embeddings. Use OpenAI, Azure OpenAI, Gemini, or Bedrock.'
    );
    err.statusCode = 503;
    throw err;
  }
}

function httpError(message, statusCode = 400, code) {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (code) err.code = code;
  return err;
}

async function resolveCandidateText(organizationId, { resumeText, candidateId, require = true }) {
  let text = resumeText;
  if (candidateId && !text) {
    const candidate = await Candidate.findOne({
      _id: candidateId,
      organizationId,
    });
    if (!candidate) throw httpError('Candidate not found', 404);
    text = candidate.resumeText || candidateProfileText(candidate);
  }
  if (require && !text?.trim()) {
    throw httpError('resumeText or candidateId with resume data is required');
  }
  return text;
}

/**
 * Score resume vs JD via configured AI adapter.
 */
async function scoreResume(organizationId, { resumeText, jobDescription, candidateId }) {
  if (!jobDescription) throw httpError('jobDescription is required');

  const adapter = await loadAiAdapter(organizationId);
  const text = await resolveCandidateText(organizationId, { resumeText, candidateId });

  const result = await adapter.scoreResume({ resumeText: text, jobDescription });
  return { data: result, meta: { method: 'llm' } };
}

async function generateJobDescription(organizationId, { bullets, title, company }) {
  if (!bullets) throw httpError('bullets is required');
  const adapter = await loadAiAdapter(organizationId);

  const prompt = `Write a professional job description from these bullet points.
${title ? `Job title: ${title}` : ''}
${company ? `Company: ${company}` : ''}

Bullet points:
${Array.isArray(bullets) ? bullets.map((b) => `- ${b}`).join('\n') : bullets}

Include: role summary, responsibilities, requirements, and nice-to-haves. Use clear sections.`;

  const text = await adapter.generateText({ prompt, maxTokens: 1200 });
  return { jobDescription: text };
}

async function generateInterviewQuestions(organizationId, {
  candidateProfile,
  jobDescription,
  candidateId,
  count = 8,
}) {
  if (!jobDescription) throw httpError('jobDescription is required');
  const adapter = await loadAiAdapter(organizationId);

  let profile = candidateProfile;
  if (candidateId && !profile) {
    const candidate = await Candidate.findOne({ _id: candidateId, organizationId });
    if (!candidate) throw httpError('Candidate not found', 404);
    profile = candidateProfileText(candidate);
  }
  if (!profile) throw httpError('candidateProfile or candidateId is required');

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
    parsed = {
      questions: raw
        .split('\n')
        .filter(Boolean)
        .map((q) => ({ question: q.replace(/^\d+\.\s*/, ''), category: 'behavioral' })),
    };
  }
  return parsed;
}

async function generateBooleanSearch(organizationId, { keywords, platform = 'linkedin' }) {
  if (!keywords || (Array.isArray(keywords) && !keywords.length)) {
    throw httpError('keywords is required');
  }
  const adapter = await loadAiAdapter(organizationId);
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
  return parsed;
}

async function draftEmail(organizationId, { type, context = {} }) {
  if (!type || !EMAIL_TYPES.includes(type)) {
    throw httpError(`type must be one of: ${EMAIL_TYPES.join(', ')}`);
  }
  const adapter = await loadAiAdapter(organizationId);
  const org = await Organization.findById(organizationId).select('securitySettings name');
  const tone = org?.securitySettings?.aiTone || 'professional';
  const orgName = org?.name || 'Our company';
  const role = context.role || context.position || 'the role';

  const prompt = `Draft a ${type} recruiting email in a ${tone} tone.
Organization: ${orgName}
Email type meaning: rejection=decline, offer=job offer, interview=interview invite, screen=screening call, followup=status follow-up, nurture=talent pool nurture.
Context: ${JSON.stringify(context, null, 2)}

Return JSON only: {"subject": string, "body": string}`;

  const raw = await adapter.generateText({ prompt, maxTokens: 700 });
  const parsed = parseJsonLoose(raw, {
    subject: type === 'offer' ? `Offer — ${role}` : `Update regarding ${role}`,
    body: raw.trim(),
  });
  return { data: parsed, meta: { tone } };
}

async function anonymizeContent(organizationId, { text, candidateId, name }) {
  if (candidateId) {
    const candidate = await Candidate.findOne({ _id: candidateId, organizationId });
    if (!candidate) throw httpError('Candidate not found', 404);
    return { data: anonymizeCandidate(candidate), meta: { method: 'regex_heuristic' } };
  }
  if (!text) throw httpError('text or candidateId is required');
  return {
    data: anonymizeText(text, { name }),
    meta: { method: 'regex_heuristic' },
  };
}

async function flagBias(organizationId, { text, type = 'jd' }) {
  if (!text) throw httpError('text is required');
  const adapter = await loadAiAdapter(organizationId);
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
  return parsed;
}

async function narrateMetrics(organizationId, { metrics }) {
  if (!metrics) throw httpError('metrics is required');
  const adapter = await loadAiAdapter(organizationId);
  const prompt = `You are a recruiting analytics narrator. Turn these hiring metrics into an executive summary with trends and actionable insights.
Return JSON only: {"headline":string,"narrative":string,"highlights":[string],"recommendations":[string]}

METRICS:
${typeof metrics === 'string' ? metrics : JSON.stringify(metrics, null, 2)}`;

  const raw = await adapter.generateText({ prompt, maxTokens: 900 });
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {
      headline: 'Hiring summary',
      narrative: raw.trim(),
      highlights: [],
      recommendations: [],
    };
  }
  return parsed;
}

async function transcribeScorecard(organizationId, { transcript, jobDescription }) {
  if (!transcript || !jobDescription) {
    throw httpError('transcript and jobDescription are required');
  }
  const adapter = await loadAiAdapter(organizationId);
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
  return parsed;
}

async function semanticSearch(organizationId, { query, talentPoolId, limit = 20 }) {
  const adapter = await loadAiAdapter(organizationId);
  requireEmbedSupport(adapter);

  if (!query) throw httpError('query is required');

  const [queryEmbedding] = await adapter.embed(query);
  if (!queryEmbedding?.length) {
    throw httpError('Failed to generate query embedding', 500);
  }

  const match = {
    organizationId: new mongoose.Types.ObjectId(organizationId),
    embedding: { $exists: true, $ne: [] },
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
      similarity: cosineSimilarity(queryEmbedding, c.embedding),
    }))
    .filter((r) => r.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, Math.min(limit, 50));

  return { results: scored, query };
}

async function embedCandidate(organizationId, candidateId) {
  const adapter = await loadAiAdapter(organizationId);
  requireEmbedSupport(adapter);

  const candidate = await Candidate.findOne({ _id: candidateId, organizationId });
  if (!candidate) throw httpError('Candidate not found', 404);

  const text = candidate.resumeText || candidateProfileText(candidate);
  if (!text?.trim()) throw httpError('Candidate has no resume text to embed');

  const [embedding] = await adapter.embed(text.slice(0, 8000));
  candidate.embedding = embedding;
  candidate.embeddingUpdatedAt = new Date();
  await candidate.save();

  return {
    candidateId: candidate._id,
    embeddingUpdatedAt: candidate.embeddingUpdatedAt,
    dimensions: embedding?.length,
  };
}

async function dedupeCandidates(organizationId, { candidateId, limit }) {
  const result = await findDuplicates(organizationId, { candidateId, limit });
  return { data: result, meta: { method: 'fuzzy_normalization' } };
}

async function generateResume(organizationId, {
  name,
  title,
  experience,
  skills,
  bullets,
  targetRole,
}) {
  if (!bullets && !experience && !skills) {
    throw httpError('Provide bullets, experience, or skills');
  }
  const adapter = await loadAiAdapter(organizationId);
  const bulletText = Array.isArray(bullets) ? bullets.map((b) => `- ${b}`).join('\n') : (bullets || '');
  const skillText = Array.isArray(skills) ? skills.join(', ') : (skills || '');
  const displayName = name || 'Candidate Name';
  const displayTitle = title || targetRole || 'Professional';

  const prompt = `Create a polished, ATS-friendly professional resume in Markdown.
Name: ${displayName}
Current/target title: ${displayTitle}
Target role: ${targetRole || displayTitle}
Experience notes: ${experience || 'n/a'}
Skills: ${skillText || 'n/a'}
Bullet highlights:
${bulletText || 'n/a'}

Include: header, summary, experience (invent reasonable structure from notes — do not fabricate employers if none given; use placeholders), skills, education placeholder.
Return the resume markdown only (no JSON wrapper).`;

  const text = await adapter.generateText({ prompt, maxTokens: 1400 });
  return { resume: text.trim(), format: 'markdown' };
}

async function summarizeResume(organizationId, { resumeText, candidateId, targetRole }) {
  const adapter = await loadAiAdapter(organizationId);
  const text = await resolveCandidateText(organizationId, { resumeText, candidateId });

  const prompt = `Write a concise recruiter-facing candidate summary from this resume.
Target role (optional): ${targetRole || 'general'}
Return JSON only: {"headline":string,"summary":string,"talkingPoints":[string]}

RESUME:
${text.slice(0, 6000)}`;

  const raw = await adapter.generateText({ prompt, maxTokens: 500 });
  return parseJsonLoose(raw, (r) => ({
    headline: 'Candidate summary',
    summary: r,
    talkingPoints: [],
  }));
}

async function extractSkills(organizationId, { resumeText, candidateId }) {
  const adapter = await loadAiAdapter(organizationId);
  const text = await resolveCandidateText(organizationId, { resumeText, candidateId });

  const prompt = `Extract skills from this resume.
Return JSON only: {"skills":[{"name":string,"level":"beginner"|"intermediate"|"advanced"|"expert"|"mentioned","years":number|null}],"categories":{"technical":[string],"tools":[string],"soft":[string]}}

RESUME:
${text.slice(0, 6000)}`;

  const raw = await adapter.generateText({ prompt, maxTokens: 700 });
  return parseJsonLoose(raw, { skills: [], categories: {} });
}

async function matchCandidate(organizationId, {
  candidateProfile,
  jobDescription,
  candidateId,
}) {
  if (!jobDescription?.trim()) throw httpError('jobDescription is required');
  const adapter = await loadAiAdapter(organizationId);

  let profile = candidateProfile;
  if (candidateId && !profile) {
    const candidate = await Candidate.findOne({ _id: candidateId, organizationId });
    if (!candidate) throw httpError('Candidate not found', 404);
    profile = candidateProfileText(candidate);
  }
  if (!profile?.trim()) throw httpError('candidateProfile or candidateId is required');

  return adapter.matchJobDescription({ candidateProfile: profile, jobDescription });
}

async function improveJobDescription(organizationId, { jobDescription, goals }) {
  if (!jobDescription?.trim()) throw httpError('jobDescription is required');
  const adapter = await loadAiAdapter(organizationId);

  const prompt = `Improve this job description for clarity, inclusivity, and candidate appeal.
Goals: ${goals || 'clearer structure, inclusive language, stronger responsibilities'}
Return JSON only: {"jobDescription":string,"changes":[string]}

ORIGINAL:
${jobDescription}`;

  const raw = await adapter.generateText({ prompt, maxTokens: 1400 });
  return parseJsonLoose(raw, (r) => ({ jobDescription: r, changes: [] }));
}

module.exports = {
  EMAIL_TYPES,
  loadAiAdapter,
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
};
