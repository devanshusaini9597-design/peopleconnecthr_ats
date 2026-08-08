import React from 'react';
import {
  LayoutDashboard, Calendar, Users, FileText, Plug, BarChart3,
  Lock, ShieldCheck, Server, Zap,
  Briefcase, CheckCircle2, Mail, MessageSquare, Webhook, FileSignature,
  Building2, Award, Rocket, CreditCard,
} from 'lucide-react';

/* ============================================================
   Data
   ============================================================ */

export const LOGO_CLOUD = [
  'Northwind Robotics', 'BlueOrbit Labs', 'Cascade Analytics',
  'Vertex Dynamics', 'Lumen Health', 'Ridgeline Foods',
];

export const USE_CASES = [
  {
    icon: Rocket, title: 'Startups & Scale-ups',
    desc: 'Get a real hiring pipeline running before you make your first recruiter hire.',
    stat: 'Live in an afternoon',
  },
  {
    icon: Users, title: 'Growing Teams',
    desc: 'Structured scorecards and calendar sync keep hiring consistent as headcount grows.',
    stat: 'Up to 5 seats on Starter',
  },
  {
    icon: Building2, title: 'Staffing & Recruiting Agencies',
    desc: 'Manage multiple clients with branded careers pages and a pipeline built for volume.',
    stat: 'Talent pools on Professional',
  },
  {
    icon: ShieldCheck, title: 'Enterprise & Multi-brand Orgs',
    desc: 'SSO, custom roles, and white-labeling for hiring across brands, teams, and regions.',
    stat: 'Dedicated success support',
  },
];

export const GUARANTEES = [
  { icon: CheckCircle2, title: '30-day money-back guarantee', desc: 'Not the right fit? Get a full refund, no questions asked.' },
  { icon: Server, title: '99.9% uptime SLA', desc: "Enterprise plans come with an uptime commitment in writing." },
  { icon: Lock, title: 'Cancel anytime, no lock-in', desc: 'Month-to-month or annual — you stay because you want to.' },
];

export const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#video-demo', label: 'Demo' },
  { href: '#product-tour', label: 'Product Tour' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
];

/** Swap `embedUrl` for your YouTube/Vimeo embed when ready. Empty = interactive product preview. */
export const DEMO_VIDEO = {
  embedUrl: '',
  title: 'People Connect HR in 2 minutes',
  duration: '2:14',
  chapters: [
    { t: '0:12', label: 'Pipeline overview', icon: LayoutDashboard },
    { t: '0:48', label: 'Interview scheduling', icon: Calendar },
    { t: '1:22', label: 'Scorecards & decisions', icon: Award },
    { t: '1:50', label: 'Analytics that matter', icon: BarChart3 },
  ],
};

export const FAQ_CATEGORIES = ['All', 'Product', 'Billing', 'Security', 'Integrations'];

export const FAQS = [
  { cat: 'Product', q: 'What is an ATS?', a: 'An Applicant Tracking System (ATS) is software that manages your recruiting and hiring process, including job postings, candidate applications, interview scheduling, and team collaboration.' },
  { cat: 'Billing', q: 'Is there a free trial?', a: 'Yes, we offer a 14-day free trial on our Starter plan. No credit card is required to sign up.' },
  { cat: 'Product', q: 'Can I import existing candidates?', a: 'Absolutely. You can import candidates via Excel/CSV files. Resume parsing extracts structured fields with regex/OCR — it is not an LLM. Resume scoring against a job description is the separate LLM feature (Professional+, BYOK AI keys).' },
  { cat: 'Integrations', q: 'What integrations do you support?', a: 'Bring Your Own Key (BYOK) for email (SMTP/SES/SendGrid/Mailgun/Postmark), calendar (Google/Outlook), AI providers, SMS/WhatsApp, e-sign, background checks, job boards, video, storage, CRM, HRIS, SIEM, and data warehouses — using your own accounts and keys.' },
  { cat: 'Security', q: 'How is my data secured?', a: 'Data is encrypted at rest and in transit. We support MFA, SSO (SAML/OIDC), SCIM, IP allowlisting, session policies, and optional customer-managed KMS. Tenant isolation and RBAC apply on every plan. See our Trust Center for subprocessors and DPA templates.' },
  { cat: 'Product', q: 'Can I customize the hiring pipeline?', a: 'Yes! On the Professional and Enterprise plans, you can fully configure custom pipeline stages for each specific job role to match your exact hiring workflow.' },
  { cat: 'Product', q: 'Do you support skills assessments?', a: 'Yes — Professional and Enterprise plans include a built-in assessment engine, so you can send timed skills tests as a stage in your pipeline and review scored results automatically.' },
];

export const FAQ_CAT_ICON = {
  Product: LayoutDashboard,
  Billing: CreditCard,
  Security: ShieldCheck,
  Integrations: Plug,
};

export const INTEGRATIONS = [
  { icon: <Mail size={20} />, label: 'Email — SMTP / SendGrid / Zoho' },
  { icon: <Calendar size={20} />, label: 'Calendar — Google / Outlook' },
  { icon: <MessageSquare size={20} />, label: 'Team chat notifications' },
  { icon: <FileSignature size={20} />, label: 'E-signature for offer letters' },
  { icon: <Webhook size={20} />, label: 'Webhooks & open API' },
  { icon: <Plug size={20} />, label: 'Bring your own API keys' },
];

export const TESTIMONIALS = [
  {
    quote: "We went from a shared spreadsheet to a real pipeline in an afternoon. Our recruiters actually know who's supposed to move next.",
    name: 'Priya N.',
    role: 'Head of Talent',
    company: 'Northwind Robotics',
  },
  {
    quote: "The BYOK setup meant IT didn't have to fight our security team. We plugged in our own email account and were sending in ten minutes.",
    name: 'Marcus O.',
    role: 'Recruiting Lead',
    company: 'BlueOrbit Labs',
  },
  {
    quote: 'Scorecards ended the "vibes-based" hiring debates in our team. Now every interview panel is on the same page before the debrief.',
    name: 'Elena V.',
    role: 'People Ops Manager',
    company: 'Cascade Analytics',
  },
];

export const FEATURES = [
  {
    icon: <LayoutDashboard className="w-6 h-6" />, title: 'Visual Pipeline',
    desc: 'Drag-and-drop kanban boards for every job. See exactly where each candidate stands, color-coded by stage, so nothing slips through.',
    big: true,
  },
  {
    icon: <Calendar className="w-6 h-6" />, title: 'Smart Scheduling',
    desc: 'One-click interview scheduling with Google / Outlook calendar sync. No more back-and-forth emails.',
  },
  {
    icon: <Award className="w-6 h-6" />, title: 'Structured Scorecards',
    desc: 'Every interviewer scores against the same rubric, so debriefs are decisions — not debates.',
  },
  {
    icon: <FileText className="w-6 h-6" />, title: 'AI Resume Parsing',
    desc: 'Skills, experience, and contact info extracted automatically the moment a resume lands.',
  },
  {
    icon: <Plug className="w-6 h-6" />, title: 'BYOK Integrations',
    desc: 'Bring your own email, calendar, and signing keys. Your data never routes through a third party.',
  },
  {
    icon: <BarChart3 className="w-6 h-6" />, title: 'Analytics & Reports',
    desc: 'Time-to-hire, source quality, and pipeline bottlenecks in real dashboards.',
  },
];

export const STEPS = [
  { step: '01', title: 'Create your workspace', desc: 'Sign up, name your company, and invite your hiring team to get started in minutes.' },
  { step: '02', title: 'Post jobs & source', desc: 'Publish to your branded careers page and easily import candidates from various job boards.' },
  { step: '03', title: 'Hire with confidence', desc: 'Track every candidate, gather structured feedback, and make data-driven decisions.' },
];

export const COMPARISON = {
  before: [
    'Candidate status lives in five different inboxes',
    'Interview feedback shows up as a one-line Slack message, if at all',
    'Scheduling is a 6-email round trip with a recruiter in the middle',
    'Nobody can say why a req has been open for 60 days',
  ],
  after: [
    'One pipeline, one source of truth, every stage color-coded',
    'Structured scorecards turn feedback into a comparable decision',
    'Calendar-synced scheduling links close interviews in one click',
    'Live analytics show exactly where every req is stuck, and why',
  ],
};

export const TOUR_TABS = [
  {
    id: 'pipeline',
    label: 'Pipeline',
    icon: LayoutDashboard,
    heading: 'A pipeline your whole team actually looks at',
    bullets: [
      'Drag candidates between stages, or automate moves with rules',
      'Color-coded by stage for an instant read on pipeline health',
      'Custom stages per job on Professional & Enterprise',
    ],
  },
  {
    id: 'scheduling',
    label: 'Scheduling',
    icon: Calendar,
    heading: 'Interviews that book themselves',
    bullets: [
      'One-click scheduling synced to Google or Outlook calendars',
      'Interviewer availability resolved automatically, no back-and-forth',
      'Automated reminders cut candidate no-shows',
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    heading: 'See the funnel, not just the spreadsheet',
    bullets: [
      'Time-to-hire, source quality, and stage conversion at a glance',
      'Export board-ready reports in a click',
      'Scheduled reports land in your inbox automatically',
    ],
  },
];

export const CHART_DATA = [
  { m: 'Feb', v: 32 }, { m: 'Mar', v: 41 }, { m: 'Apr', v: 38 },
  { m: 'May', v: 52 }, { m: 'Jun', v: 61 }, { m: 'Jul', v: 74 },
];

export const PLANS = [
  {
    id: 'starter', icon: Briefcase, name: 'Starter',
    tagline: 'For lean teams getting organized.',
    monthly: 0, annual: 0,
    features: ['Core ATS workspace', 'Jobs, candidates & pipeline', 'Basic analytics', 'MFA / 2FA', 'Duplicate candidate detection', 'Candidate surveys & localized portal'],
    cta: 'Start Free Trial', to: '/register', mail: false, highlight: false,
  },
  {
    id: 'professional', icon: Zap, name: 'Professional',
    tagline: 'For growing teams that need depth and automation.',
    monthly: 79, annual: 63,
    features: ['Everything in Starter', 'Talent pools & assessments', 'Calendar (Google/Outlook) + BYO email', 'LLM resume scoring (BYOK AI keys)', 'Video conferencing BYOK & self-schedule', 'Semantic search, JD generator & AI drafting'],
    cta: 'Get Started', to: '/register', mail: false, highlight: true,
  },
  {
    id: 'enterprise', icon: Building2, name: 'Enterprise',
    tagline: 'For agencies & multi-brand hiring orgs.',
    monthly: null, annual: null,
    features: ['Everything in Professional', 'SSO (SAML/OIDC) + SCIM', 'Storage/KMS/CRM/HRIS/SIEM BYOK', 'IP allowlist, retention & legal hold', 'Approvals, offer templates & white-label CMS', 'Dedicated / VPC deployment option'],
    cta: 'Talk to Sales', to: 'mailto:sales@skillnix.app', mail: true, highlight: false,
  },
];
