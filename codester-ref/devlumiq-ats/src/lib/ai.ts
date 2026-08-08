// ─────────────────────────────────────────────────────────────────────────────
// AI Utility — Central OpenAI integration with graceful fallback
//
// All AI features work WITHOUT an API key (rule-based fallbacks).
// When OPENAI_API_KEY is set, AI enhances every feature automatically.
//
// Supported models: gpt-4o-mini (default, cheapest), gpt-4o, gpt-3.5-turbo
// Cost: ~$0.15 per 1M input tokens with gpt-4o-mini
// ─────────────────────────────────────────────────────────────────────────────

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';

/** Check if AI is available (API key configured) */
export function isAIEnabled(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/** Get configured model or default */
function getModel(): string {
  return process.env.OPENAI_MODEL || DEFAULT_MODEL;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core API call
// ─────────────────────────────────────────────────────────────────────────────

interface AICallOptions {
  systemPrompt: string;
  userPrompt: string;
  jsonMode?: boolean;
  temperature?: number;
  maxTokens?: number;
}

interface AIResponse {
  content: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

/** Call OpenAI API. Returns null if key is missing or call fails. */
export async function callAI(options: AICallOptions): Promise<AIResponse | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: getModel(),
        messages: [
          { role: 'system', content: options.systemPrompt },
          { role: 'user', content: options.userPrompt },
        ],
        temperature: options.temperature ?? 0.1,
        max_tokens: options.maxTokens ?? 2000,
        ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('[AI] OpenAI API error:', response.status, err);
      return null;
    }

    const data = await response.json();
    return {
      content: data.choices?.[0]?.message?.content ?? '',
      usage: data.usage,
    };
  } catch (error) {
    console.error('[AI] OpenAI call failed:', error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Resume Parser
// ─────────────────────────────────────────────────────────────────────────────

export interface AIResumeResult {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  portfolio: string;
  currentTitle: string;
  summary: string;
  skills: string[];
  experienceYears: number | null;
  workExperience: { title: string; company: string; startDate: string; endDate: string; current: boolean; description: string }[];
  education: { degree: string; institution: string; year: string; gpa: string }[];
  certifications: string[];
  languages: string[];
}

const RESUME_SYSTEM_PROMPT = `You are an expert resume parser. Extract structured data from the resume text provided.
Return a JSON object with these exact fields:
{
  "name": "Full name",
  "email": "Email address",
  "phone": "Phone number",
  "location": "City, State/Country",
  "linkedin": "LinkedIn URL if found",
  "github": "GitHub URL if found",
  "portfolio": "Portfolio/website URL if found",
  "currentTitle": "Most recent job title",
  "summary": "Professional summary (max 300 chars)",
  "skills": ["skill1", "skill2", ...],
  "experienceYears": total years as number or null,
  "workExperience": [{"title": "", "company": "", "startDate": "", "endDate": "", "current": false, "description": ""}],
  "education": [{"degree": "", "institution": "", "year": "", "gpa": ""}],
  "certifications": ["cert1", ...],
  "languages": ["English", ...]
}
Be accurate. If a field is not found, use empty string or empty array. For experienceYears, calculate from work history dates.`;

export async function parseResumeWithAI(text: string): Promise<AIResumeResult | null> {
  const result = await callAI({
    systemPrompt: RESUME_SYSTEM_PROMPT,
    userPrompt: text.slice(0, 8000),
    jsonMode: true,
    temperature: 0.1,
    maxTokens: 2000,
  });

  if (!result?.content) return null;

  try {
    const parsed = JSON.parse(result.content);
    return {
      name: parsed.name || '',
      email: parsed.email || '',
      phone: parsed.phone || '',
      location: parsed.location || '',
      linkedin: parsed.linkedin || '',
      github: parsed.github || '',
      portfolio: parsed.portfolio || '',
      currentTitle: parsed.currentTitle || '',
      summary: parsed.summary || '',
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      experienceYears: typeof parsed.experienceYears === 'number' ? parsed.experienceYears : null,
      workExperience: Array.isArray(parsed.workExperience) ? parsed.workExperience : [],
      education: Array.isArray(parsed.education) ? parsed.education : [],
      certifications: Array.isArray(parsed.certifications) ? parsed.certifications : [],
      languages: Array.isArray(parsed.languages) ? parsed.languages : [],
    };
  } catch {
    console.error('[AI] Failed to parse resume JSON response');
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Candidate Ranking
// ─────────────────────────────────────────────────────────────────────────────

export interface CandidateForRanking {
  id: string;
  name: string;
  skills: string[];
  experience: number | null;
  currentTitle: string | null;
  summary?: string | null;
}

export interface JobForRanking {
  title: string;
  department: string | null;
  description: string | null;
  requirements: string | null;
  skills: string[];
}

export interface RankedCandidate {
  candidateId: string;
  score: number;
  reasoning: string;
  strengths: string[];
  gaps: string[];
}

const RANKING_SYSTEM_PROMPT = `You are an expert recruiter. Score and rank candidates against a job posting.
For each candidate, provide:
- score: 0-100 (how well they match the job)
- reasoning: one sentence explaining the score
- strengths: top 2-3 matching qualifications
- gaps: top 1-2 missing requirements

Return JSON: { "rankings": [{ "candidateId": "", "score": 0, "reasoning": "", "strengths": [], "gaps": [] }] }
Be objective and fair. Base scores on skill match, experience relevance, and title alignment.`;

export async function rankCandidatesWithAI(
  candidates: CandidateForRanking[],
  job: JobForRanking
): Promise<RankedCandidate[] | null> {
  const candidateSummaries = candidates.map(c =>
    `ID: ${c.id} | Name: ${c.name} | Title: ${c.currentTitle || 'N/A'} | Experience: ${c.experience ?? 'N/A'} years | Skills: ${c.skills.join(', ') || 'None listed'}${c.summary ? ` | Summary: ${c.summary.slice(0, 200)}` : ''}`
  ).join('\n');

  const jobSummary = `Title: ${job.title}\nDepartment: ${job.department || 'N/A'}\nDescription: ${(job.description || '').slice(0, 500)}\nRequirements: ${(job.requirements || '').slice(0, 500)}\nSkills: ${job.skills.join(', ') || 'None specified'}`;

  const result = await callAI({
    systemPrompt: RANKING_SYSTEM_PROMPT,
    userPrompt: `JOB:\n${jobSummary}\n\nCANDIDATES:\n${candidateSummaries}`,
    jsonMode: true,
    temperature: 0.2,
    maxTokens: 3000,
  });

  if (!result?.content) return null;

  try {
    const parsed = JSON.parse(result.content);
    return Array.isArray(parsed.rankings) ? parsed.rankings : null;
  } catch {
    console.error('[AI] Failed to parse ranking JSON response');
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Job Description Generator
// ─────────────────────────────────────────────────────────────────────────────

export interface GeneratedJobDescription {
  title: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  niceToHave: string[];
  skills: string[];
  salaryRange: string;
}

const JD_SYSTEM_PROMPT = `You are an expert HR copywriter. Generate a professional, inclusive job description.
Return JSON:
{
  "title": "Job title",
  "description": "2-3 paragraph overview",
  "responsibilities": ["resp1", "resp2", ...],
  "requirements": ["req1", "req2", ...],
  "niceToHave": ["nice1", "nice2", ...],
  "skills": ["skill1", "skill2", ...],
  "salaryRange": "estimated range like $80,000 - $120,000"
}
Use inclusive language. Avoid gendered terms. Keep it concise and compelling.`;

export async function generateJobDescriptionWithAI(input: {
  title: string;
  department?: string;
  level?: string;
  type?: string;
  notes?: string;
}): Promise<GeneratedJobDescription | null> {
  const prompt = `Generate a job description for:
Title: ${input.title}
Department: ${input.department || 'Not specified'}
Level: ${input.level || 'Mid-level'}
Type: ${input.type || 'Full-time'}
${input.notes ? `Additional notes: ${input.notes}` : ''}`;

  const result = await callAI({
    systemPrompt: JD_SYSTEM_PROMPT,
    userPrompt: prompt,
    jsonMode: true,
    temperature: 0.6,
    maxTokens: 2000,
  });

  if (!result?.content) return null;

  try {
    return JSON.parse(result.content);
  } catch {
    console.error('[AI] Failed to parse JD JSON response');
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Email Drafting
// ─────────────────────────────────────────────────────────────────────────────

export interface DraftedEmail {
  subject: string;
  body: string;
  tone: string;
}

const EMAIL_SYSTEM_PROMPT = `You are a professional recruiter writing emails to candidates.
Draft a clear, warm, and professional email based on the context provided.
Return JSON: { "subject": "", "body": "", "tone": "professional" }
Use appropriate greeting and sign-off. Keep the body concise (3-5 paragraphs max).
Do NOT include placeholder brackets — write complete sentences.`;

export async function draftEmailWithAI(input: {
  type: 'outreach' | 'rejection' | 'interview_invite' | 'offer' | 'follow_up' | 'custom';
  candidateName: string;
  jobTitle?: string;
  companyName?: string;
  senderName?: string;
  customInstructions?: string;
  interviewDate?: string;
  interviewTime?: string;
  salary?: string;
}): Promise<DraftedEmail | null> {
  const prompt = `Draft a ${input.type.replace('_', ' ')} email:
Candidate: ${input.candidateName}
Job: ${input.jobTitle || 'N/A'}
Company: ${input.companyName || 'Our company'}
Sender: ${input.senderName || 'Recruitment Team'}
${input.interviewDate ? `Interview Date: ${input.interviewDate}` : ''}
${input.interviewTime ? `Interview Time: ${input.interviewTime}` : ''}
${input.salary ? `Salary: ${input.salary}` : ''}
${input.customInstructions ? `Instructions: ${input.customInstructions}` : ''}`;

  const result = await callAI({
    systemPrompt: EMAIL_SYSTEM_PROMPT,
    userPrompt: prompt,
    jsonMode: true,
    temperature: 0.7,
    maxTokens: 1000,
  });

  if (!result?.content) return null;

  try {
    return JSON.parse(result.content);
  } catch {
    console.error('[AI] Failed to parse email JSON response');
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Candidate Screening
// ─────────────────────────────────────────────────────────────────────────────

export interface ScreeningResult {
  verdict: 'strong_match' | 'potential_match' | 'weak_match';
  score: number;
  summary: string;
  matchingSkills: string[];
  missingSkills: string[];
  experienceMatch: string;
  recommendation: string;
}

const SCREENING_SYSTEM_PROMPT = `You are an expert recruiter screening a candidate against a job.
Analyze the candidate's profile and the job requirements, then provide an honest assessment.
Return JSON:
{
  "verdict": "strong_match" | "potential_match" | "weak_match",
  "score": 0-100,
  "summary": "2-3 sentence overall assessment",
  "matchingSkills": ["skill1", ...],
  "missingSkills": ["skill1", ...],
  "experienceMatch": "one sentence about experience fit",
  "recommendation": "one sentence recommendation for the hiring team"
}
Be objective. Do not discriminate based on name, gender, or background.`;

export async function screenCandidateWithAI(
  candidate: {
    name: string;
    skills: string[];
    experience: number | null;
    currentTitle: string | null;
    resumeText?: string | null;
  },
  job: {
    title: string;
    description: string | null;
    requirements: string | null;
    skills: string[];
  }
): Promise<ScreeningResult | null> {
  const prompt = `CANDIDATE:
Name: ${candidate.name}
Current Title: ${candidate.currentTitle || 'N/A'}
Experience: ${candidate.experience ?? 'N/A'} years
Skills: ${candidate.skills.join(', ') || 'None listed'}
${candidate.resumeText ? `Resume Summary: ${candidate.resumeText.slice(0, 1000)}` : ''}

JOB:
Title: ${job.title}
Description: ${(job.description || '').slice(0, 500)}
Requirements: ${(job.requirements || '').slice(0, 500)}
Required Skills: ${job.skills.join(', ') || 'None specified'}`;

  const result = await callAI({
    systemPrompt: SCREENING_SYSTEM_PROMPT,
    userPrompt: prompt,
    jsonMode: true,
    temperature: 0.2,
    maxTokens: 1000,
  });

  if (!result?.content) return null;

  try {
    return JSON.parse(result.content);
  } catch {
    console.error('[AI] Failed to parse screening JSON response');
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Interview transcript summary
// ─────────────────────────────────────────────────────────────────────────────

export interface InterviewAiSummary {
  feedbackSummary: string;
  overallScore: number | null;
  recommendation: string;
  keyMoments: { label: string; startMs?: number; note?: string }[];
  scorecardSuggestions: { name: string; suggestedScore: number; rationale: string }[];
}

const INTERVIEW_SUMMARY_PROMPT = `You are an interview note assistant. Summarize the transcript for a hiring team.
Return JSON:
{
  "feedbackSummary": "3-6 sentence balanced summary",
  "overallScore": number 1-5 or null,
  "recommendation": "strong_hire|hire|leaning_hire|neutral|leaning_no|no_hire",
  "keyMoments": [{"label":"","startMs":0,"note":""}],
  "scorecardSuggestions": [{"name":"Communication","suggestedScore":1-5,"rationale":""}]
}
Do not invent facts not supported by the transcript. Stay bias-aware: ignore name/gender/school prestige.`;

export async function summarizeInterviewTranscript(
  transcript: string,
  context?: { jobTitle?: string; candidateName?: string; criteria?: string[] },
): Promise<InterviewAiSummary | null> {
  const criteria = context?.criteria?.length
    ? context.criteria.join(', ')
    : 'Communication, Technical depth, Problem solving, Culture add, Ownership';

  const result = await callAI({
    systemPrompt: INTERVIEW_SUMMARY_PROMPT,
    userPrompt: `Job: ${context?.jobTitle || 'N/A'}
Candidate: ${context?.candidateName || 'Candidate'}
Scorecard criteria to consider: ${criteria}

TRANSCRIPT:
${transcript.slice(0, 12000)}`,
    jsonMode: true,
    temperature: 0.2,
    maxTokens: 1500,
  });

  if (!result?.content) {
    // Rule fallback
    const words = transcript.trim().split(/\s+/).length;
    return {
      feedbackSummary: `Interview transcript captured (${words} words). AI is not configured — review the transcript manually and fill the scorecard.`,
      overallScore: null,
      recommendation: 'neutral',
      keyMoments: [],
      scorecardSuggestions: [],
    };
  }

  try {
    const parsed = JSON.parse(result.content);
    return {
      feedbackSummary: parsed.feedbackSummary || '',
      overallScore: typeof parsed.overallScore === 'number' ? parsed.overallScore : null,
      recommendation: parsed.recommendation || 'neutral',
      keyMoments: Array.isArray(parsed.keyMoments) ? parsed.keyMoments : [],
      scorecardSuggestions: Array.isArray(parsed.scorecardSuggestions) ? parsed.scorecardSuggestions : [],
    };
  } catch {
    return null;
  }
}
