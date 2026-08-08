import {
  Sparkles, FileText, MessageSquare, Search, Mail, AlertTriangle,
  FileUser, Wand2, ListChecks, Target, RefreshCw, Layers,
} from 'lucide-react';

export const AI_TOUR_KEY = 'skillnix_tour_ai_tools_v1';

export const AI_TOUR_STEPS = [
  {
    title: 'AI Tools',
    body: 'Generate JDs, resumes, interview questions, emails, and match scores — powered by your connected LLM provider.',
  },
  {
    target: '[data-tour="ai-tip"]',
    title: 'Quick tip',
    body: 'Connect an AI provider under Organization → Integrations before running any tool.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="ai-tabs"]',
    title: 'Tool gallery',
    body: 'Switch between generators, matching, bias check, and semantic search. Scroll sideways on mobile.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="ai-workspace"]',
    title: 'Workspace',
    body: 'Fill the form, run the tool, then copy results into Jobs, Candidates, or email.',
    placement: 'top',
  },
];

export const TABS = [
  { id: 'resume', label: 'Resume Gen', icon: FileUser, feature: 'ai.resumeGenerator', blurb: 'Build an ATS-friendly resume from bullets' },
  { id: 'summary', label: 'Resume Summary', icon: Wand2, feature: 'ai.resumeGenerator', blurb: 'Recruiter blurb from resume text' },
  { id: 'skills', label: 'Skills Extract', icon: ListChecks, feature: 'ai.skillsExtract', blurb: 'Pull skills from a resume' },
  { id: 'match', label: 'Match Score', icon: Target, feature: 'ai.matchScore', blurb: 'Score candidate vs JD fit' },
  { id: 'jd', label: 'JD Generator', icon: FileText, feature: 'ai.jdGenerator', blurb: 'Bullets → full job description' },
  { id: 'jdImprove', label: 'JD Improver', icon: RefreshCw, feature: 'ai.jdGenerator', blurb: 'Rewrite for clarity & inclusion' },
  { id: 'interview', label: 'Interview Qs', icon: MessageSquare, feature: 'ai.interviewQuestions', blurb: 'Structured interview questions' },
  { id: 'boolean', label: 'Boolean Search', icon: Search, feature: 'ai.booleanGenerator', blurb: 'Keywords → Boolean string' },
  { id: 'email', label: 'Email Draft', icon: Mail, feature: 'ai.emailDrafting', blurb: 'Rejection, offer, invite & more' },
  { id: 'bias', label: 'Bias Check', icon: AlertTriangle, feature: 'ai.biasFlagging', blurb: 'Flag exclusionary language' },
  { id: 'semantic', label: 'Semantic Search', icon: Sparkles, feature: 'ai.semanticSearch', blurb: 'Natural-language talent search' },
  { id: 'scorecard', label: 'Scorecard', icon: Layers, feature: 'ai.interviewTranscription', blurb: 'Transcript → interview scorecard' },
];

export const EMAIL_TYPE_OPTIONS = [
  { value: 'rejection', label: 'Rejection' },
  { value: 'offer', label: 'Offer' },
  { value: 'interview', label: 'Interview invite' },
  { value: 'screen', label: 'Screening call' },
  { value: 'followup', label: 'Follow-up' },
  { value: 'nurture', label: 'Nurture / talent pool' },
];

export const BIAS_TYPE_OPTIONS = [
  { value: 'jd', label: 'Job description' },
  { value: 'scorecard', label: 'Scorecard' },
];

export const AI_NOT_CONFIGURED_MSG =
  'AI integration is not configured. Add an AI provider under Organization → Integrations.';
