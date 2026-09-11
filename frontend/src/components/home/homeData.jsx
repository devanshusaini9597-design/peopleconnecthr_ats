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
  'TechCorp India', 'Global Solutions', 'Digital Innovations',
  'Smart Systems', 'Future Tech', 'Enterprise Services',
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
  { icon: CheckCircle2, title: '14-day free trial', desc: 'Full access to all features. No credit card required to start.' },
  { icon: Server, title: '99.9% uptime guarantee', desc: 'Enterprise-grade reliability with 24/7 monitoring and support.' },
  { icon: Lock, title: 'Data security & compliance', desc: 'GDPR compliant with encryption at rest and in transit. Your data is safe.' },
  { icon: Award, title: 'Dedicated customer success', desc: 'Personal onboarding and ongoing support for Professional and Enterprise plans.' },
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
    { t: '0:15', label: 'Dashboard & Pipeline', icon: LayoutDashboard },
    { t: '1:20', label: 'AI Resume Parsing', icon: FileText },
    { t: '2:10', label: 'Interview Scheduling', icon: Calendar },
    { t: '2:55', label: 'Analytics & Reports', icon: BarChart3 },
  ],
};

export const FAQ_CATEGORIES = ['All', 'Product', 'Billing', 'Security', 'Integrations'];

export const FAQS = [
  { cat: 'Product', q: 'What is People Connect HR?', a: 'People Connect HR is a modern Applicant Tracking System (ATS) that helps companies manage their entire hiring process - from job postings to candidate tracking, interview scheduling, and final hiring decisions.' },
  { cat: 'Billing', q: 'Is there a free trial?', a: 'Yes, we offer a 14-day free trial on our Starter plan. No credit card is required to sign up. You can explore all features before committing.' },
  { cat: 'Product', q: 'Can I import existing candidates?', a: 'Absolutely. You can import candidates via Excel/CSV files. Our AI-powered resume parsing automatically extracts skills, experience, and contact information, saving you hours of manual data entry.' },
  { cat: 'Integrations', q: 'What integrations do you support?', a: 'We support email integration (Gmail, Outlook, Zoho), calendar sync (Google Calendar, Outlook), video conferencing tools, e-signature platforms, and job board postings. We also offer API access for custom integrations.' },
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
  { icon: <Mail size={20} />, label: 'Gmail & Outlook Integration' },
  { icon: <Calendar size={20} />, label: 'Google Calendar Sync' },
  { icon: <MessageSquare size={20} />, label: 'Slack & Teams Notifications' },
  { icon: <FileSignature size={20} />, label: 'Digital Offer Letters' },
  { icon: <Webhook size={20} />, label: 'Custom Webhooks & API' },
  { icon: <Plug size={20} />, label: 'Job Board Integrations' },
];

export const INDUSTRY_SOLUTIONS = [
  {
    icon: Building2, title: 'Technology & IT',
    desc: 'Streamline technical hiring with skills assessment integration and automated candidate screening for developers, engineers, and tech roles.',
    roles: ['Software Engineers', 'DevOps Engineers', 'Data Scientists', 'Product Managers'],
  },
  {
    icon: Users, title: 'Healthcare & Medical',
    desc: 'Compliant hiring workflows for healthcare organizations with credential verification and specialized candidate tracking for medical professionals.',
    roles: ['Doctors & Nurses', 'Medical Staff', 'Healthcare Administrators', 'Specialists'],
  },
  {
    icon: Briefcase, title: 'Finance & Banking',
    desc: 'Secure hiring processes for financial institutions with background check integration and compliance-ready workflows for banking and fintech roles.',
    roles: ['Financial Analysts', 'Investment Bankers', 'Risk Managers', 'Compliance Officers'],
  },
  {
    icon: Award, title: 'Manufacturing & Industrial',
    desc: 'High-volume hiring solutions for manufacturing with shift scheduling integration and skills-based candidate matching for industrial roles.',
    roles: ['Production Managers', 'Quality Engineers', 'Plant Supervisors', 'Technicians'],
  },
];

export const COMPANY_STATS = [
  { value: '500+', label: 'Companies Trust Us' },
  { value: '50K+', label: 'Candidates Managed' },
  { value: '10K+', label: 'Successful Hires' },
  { value: '99.9%', label: 'Customer Satisfaction' },
];

export const TESTIMONIALS = [
  {
    quote: "People Connect HR transformed our hiring process completely. We went from manual tracking to a professional ATS in just one day. Our team productivity increased by 40%.",
    name: 'Rajesh Kumar',
    role: 'HR Director',
    company: 'TechCorp India',
  },
  {
    quote: "The AI resume parsing feature alone saved us hours of manual data entry. Now we can focus on interviewing the right candidates instead of paperwork.",
    name: 'Priya Sharma',
    role: 'Recruitment Manager',
    company: 'Global Solutions',
  },
  {
    quote: 'The calendar integration and automated scheduling eliminated all the back-and-forth emails. Our time-to-hire dropped from 45 days to just 18 days.',
    name: 'Amit Patel',
    role: 'CEO',
    company: 'Digital Innovations',
  },
];

export const FEATURES = [
  {
    icon: <LayoutDashboard className="w-6 h-6" />, title: 'Visual Pipeline Management',
    desc: 'Drag-and-drop kanban boards give you complete visibility into your hiring process. Track candidates through every stage with color-coded status indicators.',
    big: true,
  },
  {
    icon: <Calendar className="w-6 h-6" />, title: 'Automated Interview Scheduling',
    desc: 'Sync with Google Calendar and Outlook to eliminate scheduling conflicts. Send automated reminders to reduce no-shows and streamline coordination.',
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
    desc: 'Connect with your existing tools including email providers, calendar systems, video conferencing platforms, and job boards for a unified workflow.',
  },
  {
    icon: <BarChart3 className="w-6 h-6" />, title: 'Advanced Analytics & Reporting',
    desc: 'Track key metrics like time-to-hire, source effectiveness, and pipeline conversion rates. Generate board-ready reports with one click.',
  },
];

export const STEPS = [
  { step: '01', title: 'Set Up Your Workspace', desc: 'Create your company profile, configure your hiring pipeline stages, and invite team members. Get started in under 30 minutes.' },
  { step: '02', title: 'Post Jobs & Source Candidates', desc: 'Publish openings to your branded career page. Import candidates from job boards or use AI resume parsing for direct applications.' },
  { step: '03', title: 'Manage & Hire Successfully', desc: 'Track candidates through visual pipelines, schedule interviews automatically, and collaborate with structured feedback to make confident hiring decisions.' },
];

export const COMPARISON = {
  before: [
    'Candidate information scattered across emails and spreadsheets',
    'Interview feedback lost in chat messages and email threads',
    'Scheduling interviews requires endless back-and-forth coordination',
    'No visibility into why positions remain open for months',
  ],
  after: [
    'Centralized pipeline with complete candidate history in one place',
    'Structured scorecards provide consistent, comparable feedback',
    'Automated calendar sync eliminates scheduling conflicts',
    'Real-time analytics identify bottlenecks and optimize hiring process',
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
