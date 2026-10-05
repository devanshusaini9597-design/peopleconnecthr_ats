import React from 'react';
import {
  LayoutDashboard, Calendar, Users, FileText, Plug, BarChart3,
  Lock, ShieldCheck, Server, Zap,
  Briefcase, CheckCircle2, Mail, MessageSquare, Webhook, FileSignature,
  Building2, Award, Rocket, CreditCard, Gift,
} from 'lucide-react';

/* ============================================================
   Data
   ============================================================ */

/** Screenshots live in frontend/public/landing. Replace the file; the frame keeps the layout. */
export const PRODUCT_SHOTS = {
  dashboard: { src: '/landing/dashboard.png', alt: 'People Connect HR dashboard', caption: 'Dashboard · plan usage', variant: 'dashboard' },
  pipeline: { src: '/landing/pipeline.png', alt: 'Candidate pipeline', caption: 'Pipeline', variant: 'pipeline' },
  mail: { src: '/landing/mail.png', alt: 'Email settings with plan allowance', caption: 'Mail on your plan', variant: 'mail' },
  reports: { src: '/landing/reports.png', alt: 'Email and hiring reports', caption: 'Reports', variant: 'reports' },
  billing: { src: '/landing/billing.png', alt: 'Billing and remaining plan capacity', caption: 'Billing', variant: 'billing' },
  careers: { src: '/landing/careers.png', alt: 'Branded careers page', caption: 'Careers page', variant: 'careers' },
};

export const WORKSPACE_MODULES = [
  'Dashboard', 'Jobs', 'Pipeline', 'Candidates', 'Interviews',
  'Careers page', 'Mail', 'Reports', 'Billing',
];

export const USE_CASES = [
  {
    icon: Rocket, title: 'Startups & Growing Companies',
    desc: 'Establish a professional hiring process from day one. Scale your recruitment operations as your team expands.',
    stat: 'Setup in under 1 hour',
  },
  {
    icon: Users, title: 'SMEs & Mid-Sized Companies',
    desc: 'Streamline hiring across departments with standardized processes and collaborative tools for your hiring teams.',
    stat: 'Supports 5-50 hiring managers',
  },
  {
    icon: Building2, title: 'Recruitment Agencies',
    desc: 'Manage multiple client accounts with branded career pages and efficient candidate pipelines for high-volume hiring.',
    stat: 'Multi-tenant architecture',
  },
  {
    icon: ShieldCheck, title: 'Enterprise Organizations',
    desc: 'Advanced security with SSO, custom workflows, and dedicated support for complex hiring operations across multiple locations.',
    stat: 'Enterprise SLA & support',
  },
];

export const GUARANTEES = [
  { icon: CheckCircle2, title: '21-day trial', desc: 'A new workspace starts on a 21-day trial. Seats, jobs, and email follow the trial plan. Backup is not included on trial.' },
  { icon: Server, title: 'One organization, one database', desc: 'Each customer’s jobs, people, and mail stay inside their own workspace.' },
  { icon: Lock, title: 'Roles and MFA', desc: 'Owners, admins, and recruiters see only what their role allows. MFA is available on the account.' },
  { icon: Award, title: 'Enterprise controls', desc: 'SSO, SCIM, a verified sending domain, and a careers hostname are on the Enterprise plan.' },
];

export const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#industries', label: 'Industries' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#demo', label: 'Contact' },
];

/** Swap `embedUrl` for your YouTube/Vimeo embed when ready. Empty = interactive product preview. */
export const DEMO_VIDEO = {
  embedUrl: '',
  title: 'People Connect HR Platform Overview',
  duration: '3:45',
  chapters: [
    { t: '0:15', label: 'Dashboard & plan usage', icon: LayoutDashboard },
    { t: '1:20', label: 'Pipeline & candidates', icon: FileText },
    { t: '2:10', label: 'Mail on your plan', icon: Mail },
    { t: '2:55', label: 'Reports & billing', icon: BarChart3 },
  ],
};

export const FAQ_CATEGORIES = ['All', 'Product', 'Billing', 'Security', 'Integrations'];

export const FAQS = [
  { cat: 'Product', q: 'What is People Connect HR?', a: 'People Connect HR is a modern Applicant Tracking System (ATS) that helps companies manage their entire hiring process - from job postings to candidate tracking, interview scheduling, and final hiring decisions.' },
  { cat: 'Billing', q: 'Is there a free trial?', a: 'Yes. A new workspace starts on a 21-day trial with 5 users, 15 job postings, and 2,000 emails. Backup is not included on trial. List prices exclude 18% GST.' },
  { cat: 'Product', q: 'Can I import existing candidates?', a: 'Old data import is included on Premium and Custom. Starter does not include historical import. Imports count toward your plan limits.' },
  { cat: 'Integrations', q: 'How does email work?', a: 'Mail is included with the plan. You set the sender name and the reply-to address. The platform sends the message. Enterprise workspaces can verify their own domain so mail can come from noreply@yourcompany.com. Customers do not configure a mail vendor.' },
  { cat: 'Security', q: 'How is my data secured?', a: 'Your data is protected with enterprise-grade encryption at rest and in transit. We offer two-factor authentication, role-based access control, and regular security audits. We comply with data protection regulations.' },
  { cat: 'Product', q: 'Can I customize the hiring pipeline?', a: 'Yes! You can create custom pipeline stages that match your exact hiring workflow. Whether you need simple screening or complex multi-stage interviews, People Connect HR adapts to your process.' },
  { cat: 'Product', q: 'Do you support skills assessments?', a: 'Yes — our Professional and Enterprise plans include built-in skills assessment tools. You can send customized tests to candidates and automatically score results to make better hiring decisions.' },
];

export const FAQ_CAT_ICON = {
  Product: LayoutDashboard,
  Billing: CreditCard,
  Security: ShieldCheck,
  Integrations: Plug,
};

export const INTEGRATIONS = [
  { icon: <Mail size={20} />, label: 'Plan mail, reply-to, and sending domain' },
  { icon: <Calendar size={20} />, label: 'Google and Outlook calendar' },
  { icon: <MessageSquare size={20} />, label: 'Slack on Professional and above' },
  { icon: <FileSignature size={20} />, label: 'Offer templates on Enterprise' },
  { icon: <Webhook size={20} />, label: 'Webhooks and API' },
  { icon: <ShieldCheck size={20} />, label: 'SSO and SCIM on Enterprise' },
];

export const INDUSTRY_SOLUTIONS = [
  {
    icon: Building2, title: 'In-house recruiting',
    desc: 'One company, one careers page, and a pipeline the hiring managers can follow. Seats and open jobs stay inside the plan.',
    roles: ['HR teams', 'Hiring managers', 'Interviewers', 'Recruiters'],
  },
  {
    icon: Users, title: 'Recruitment agencies',
    desc: 'Run many openings from one workspace, with a public careers page candidates can search and apply on.',
    roles: ['Agency recruiters', 'Client openings', 'High-volume roles', 'Talent pools'],
  },
  {
    icon: Briefcase, title: 'Growing teams',
    desc: 'Professional adds custom pipelines, assessments, campaigns, calendar, and a higher monthly mail allowance.',
    roles: ['Custom stages', 'Assessments', 'Campaigns', 'Audit log'],
  },
  {
    icon: Award, title: 'Enterprise workspaces',
    desc: 'Unlimited seats, jobs, candidates, and email, plus SSO, SCIM, a verified sending domain, and a careers hostname.',
    roles: ['SSO & SCIM', 'Own sending domain', 'Own careers domain', 'Approvals'],
  },
];

export const PLAN_CAPS = [
  { plan: 'Free Trial', seats: '5', jobs: '15', candidates: '2,000', emails: '2,000' },
  { plan: 'Starter', seats: '3', jobs: '30', candidates: '3,000', emails: '6,000 / month' },
  { plan: 'Premium', seats: '10', jobs: '50', candidates: '10,000', emails: '10,000 / month' },
  { plan: 'Custom', seats: 'Quoted', jobs: 'Quoted', candidates: 'Quoted', emails: 'Quoted' },
];

export const FEATURES = [
  {
    icon: <LayoutDashboard className="w-6 h-6" />, title: 'Visual Pipeline Management',
    desc: 'Move candidates through the stages on each job. Professional and Enterprise can rename the pipeline to match how that team actually hires.',
    big: true,
  },
  {
    icon: <Calendar className="w-6 h-6" />, title: 'Automated Interview Scheduling',
    desc: 'Book interviews on the job, keep the time in the workspace timezone, and notify the team. Calendar sync is included on Professional and Enterprise.',
  },
  {
    icon: <Award className="w-6 h-6" />, title: 'Structured Evaluation Scorecards',
    desc: 'Standardized assessment criteria ensure consistent evaluations across all interviewers. Make data-driven hiring decisions based on comparable feedback.',
  },
  {
    icon: <FileText className="w-6 h-6" />, title: 'AI-Powered Resume Parsing',
    desc: 'Automatically extract key information from resumes including skills, experience, education, and contact details. Save hours of manual data entry.',
  },
  {
    icon: <Plug className="w-6 h-6" />, title: 'Seamless Integrations',
    desc: 'Mail is included with the plan. Replies go to your company address. Enterprise workspaces can verify their own sending domain. Calendar, Slack, webhooks, and SSO connect where the plan allows.',
  },
  {
    icon: <BarChart3 className="w-6 h-6" />, title: 'Advanced Analytics & Reporting',
    desc: 'See funnel, source, and delivery in the workspace. Email reports show what was sent this month against the plan, in the organization timezone.',
  },
];

export const STEPS = [
  { step: '01', title: 'Open a workspace', desc: 'Create the organization, pick the plan, and invite the people who will hire. Seats count against the plan.' },
  { step: '02', title: 'Publish jobs', desc: 'Openings go on your careers page. Applicants and imports become candidates, up to the plan limit.' },
  { step: '03', title: 'Move them through the hire', desc: 'Pipeline, interviews, scorecards, and mail stay on the same person. Reports show what this workspace used this month.' },
];

export const COMPARISON = {
  before: [
    'Candidate information scattered across emails and spreadsheets',
    'Interview feedback lost in chat messages and email threads',
    'Scheduling interviews requires endless back-and-forth coordination',
    'No visibility into why positions remain open for months',
  ],
  after: [
    'One pipeline, one candidate record, and a careers page for the organization',
    'Scorecards keep interview feedback on the candidate',
    'Mail is included, replies go to your address, and usage shows against the plan',
    'Reports and billing show what this workspace has used',
  ],
};

export const TOUR_TABS = [
  {
    id: 'pipeline',
    label: 'Pipeline',
    icon: LayoutDashboard,
    shot: 'pipeline',
    heading: 'Every candidate sits on a stage',
    bullets: [
      'The pipeline is the job. Move people as the interview progresses.',
      'Professional and Enterprise can rename stages for that role.',
      'The same candidate record is what mail, interviews, and reports use.',
    ],
  },
  {
    id: 'scheduling',
    label: 'Mail',
    icon: Mail,
    shot: 'mail',
    heading: 'Mail is part of the plan, not a separate vendor screen',
    bullets: [
      'One-to-one mail is included. Campaigns follow the plan.',
      'You set the name and the address replies should reach.',
      'Enterprise can verify a sending domain and send as noreply@yourcompany.com.',
    ],
  },
  {
    id: 'analytics',
    label: 'Reports',
    icon: BarChart3,
    shot: 'reports',
    heading: 'Reports stay inside the workspace',
    bullets: [
      'Hiring analytics and email delivery are counted for this organization.',
      'Email reports show this month against the plan, in your timezone.',
      'Owners see remaining seats, jobs, candidates, and emails on Billing.',
    ],
  },
];

export const CHART_DATA = [
  { m: 'Feb', v: 32 }, { m: 'Mar', v: 41 }, { m: 'Apr', v: 38 },
  { m: 'May', v: 52 }, { m: 'Jun', v: 61 }, { m: 'Jul', v: 74 },
];

export const PLANS = [
  {
    id: 'free_trial', icon: Gift, name: 'Free Trial',
    tagline: 'Try hiring on People Connect HR for 21 days.',
    monthly: 0, annual: null,
    features: [
      '21 days',
      '5 users (owner plus admin, manager, recruiters, sales — roles the owner assigns)',
      '15 job postings',
      '2,000 emails',
      'No backup',
    ],
    cta: 'Start Free Trial', to: '/register', mail: false, highlight: false,
  },
  {
    id: 'starter', icon: Briefcase, name: 'Starter',
    tagline: 'For lean teams getting organized.',
    monthly: 2499, annual: null,
    features: [
      'Billed monthly',
      '3 users (owner plus 2 seats the owner assigns)',
      '30 job postings',
      '6,000 emails',
      'No backup',
      'No old data import',
    ],
    cta: 'Get Started', to: '/register', mail: false, highlight: false,
  },
  {
    id: 'professional', icon: Zap, name: 'Premium',
    tagline: 'For growing teams that need depth and backup.',
    monthly: 8499, annual: Math.round(8499 * 0.75), yearlyOffPct: 25,
    features: [
      'Monthly, or 25% off yearly',
      '10 users (owner plus 9 seats the owner assigns)',
      '50 job postings',
      '10,000 emails',
      'Backup included',
      'Old data import',
    ],
    cta: 'Get Started', to: '/register', mail: false, highlight: true,
  },
  {
    id: 'enterprise', icon: Building2, name: 'Custom',
    tagline: 'Scoped to your seats, jobs, mail, and support.',
    monthly: null, annual: null,
    features: [
      'Users, jobs, and mail volume agreed with sales',
      'Backup and data import as scoped',
      'Dedicated onboarding and commercial terms',
    ],
    cta: 'Talk to Sales', to: 'mailto:sales@peopleconnecthr.com', mail: true, highlight: false,
  },
];
