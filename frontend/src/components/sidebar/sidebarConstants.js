import {
  LayoutDashboard,
  BarChart3,
  Briefcase,
  GitPullRequest,
  Users,
  Kanban,
  FileText,
  Calendar,
  UserCog,
  Building2,
  Plug,
  Mail,
  Settings,
  User,
  CreditCard,
  ScrollText,
  ShieldPlus,
  KeyRound,
  Webhook,
  CalendarClock,
  Layers,
  ClipboardList,
  ListChecks,
  Palette,
  Chrome,
  Home,
  Sparkles,
  Shield,
  Gift,
  Tags,
  Inbox,
  MailPlus,
  FormInput,
  MessageCircle,
  Search,
  MessageSquare,
  ClipboardCheck,
  ShieldCheck,
  Megaphone,
  PieChart,
  Bell,
  Columns3,
} from 'lucide-react';
import { planHasFeature } from '../../config/planFeatures';

export const AI_NAV_FEATURES = [
  'ai.jdGenerator',
  'ai.interviewQuestions',
  'ai.booleanGenerator',
  'ai.emailDrafting',
  'ai.semanticSearch',
  'ai.resumeGenerator',
  'ai.skillsExtract',
  'ai.matchScore',
];

export const planHasAnyAiFeature = (plan) =>
  AI_NAV_FEATURES.some((key) => planHasFeature(plan, key));

export const getUserData = () => {
  try {
    const data = localStorage.getItem('userData');
    if (data) return JSON.parse(data);
  } catch { /* ignore */ }
  return { name: 'User', role: 'recruiter' };
};

export const getOrgData = () => {
  try {
    const data = localStorage.getItem('orgData');
    if (data) return JSON.parse(data);
  } catch { /* ignore */ }
  return { name: 'People Connect HR', logo: null };
};

export const GROUP_STYLES = {
  main:          { iconBg: 'bg-teal-500/25',   iconColor: 'text-teal-400',   activeBg: 'bg-teal-500/10',   activeBar: 'bg-teal-400',   activeText: 'text-teal-300' },
  recruitment:   { iconBg: 'bg-teal-500/25',   iconColor: 'text-teal-400',   activeBg: 'bg-teal-500/10',   activeBar: 'bg-teal-400',   activeText: 'text-teal-300' },
  communication: { iconBg: 'bg-emerald-500/20',iconColor: 'text-emerald-400',activeBg: 'bg-emerald-500/10',activeBar: 'bg-emerald-400',activeText: 'text-emerald-300' },
  interviews:    { iconBg: 'bg-sky-500/20',    iconColor: 'text-sky-400',    activeBg: 'bg-sky-500/10',    activeBar: 'bg-sky-400',    activeText: 'text-sky-300' },
  organization:  { iconBg: 'bg-amber-500/20',  iconColor: 'text-amber-400',  activeBg: 'bg-amber-500/10',  activeBar: 'bg-amber-400',  activeText: 'text-amber-300' },
  settings:      { iconBg: 'bg-violet-500/20', iconColor: 'text-violet-400', activeBg: 'bg-violet-500/10', activeBar: 'bg-violet-400', activeText: 'text-violet-300' },
  billing:       { iconBg: 'bg-emerald-500/20',iconColor: 'text-emerald-400',activeBg: 'bg-emerald-500/10',activeBar: 'bg-emerald-400',activeText: 'text-emerald-300' },
};

export const SECTIONS = [
  {
    key: 'main',
    titleKey: 'nav.sections.main',
    title: 'Main',
    icon: Home,
    roles: ['owner', 'admin', 'recruiter', 'interviewer', 'readonly'],
    items: [
      { labelKey: 'nav.items.dashboard', label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['owner', 'admin', 'recruiter', 'interviewer', 'readonly'], module: 'modules.dashboard' },
      { labelKey: 'nav.items.analytics', label: 'Analytics', path: '/analytics', icon: BarChart3, roles: ['owner', 'admin', 'recruiter', 'interviewer', 'readonly'], module: 'modules.analytics' },
      { labelKey: 'nav.items.globalSearch', label: 'Global Search', path: '/search', icon: Search, roles: ['owner', 'admin', 'recruiter', 'interviewer', 'readonly'], feature: 'search.global', module: 'modules.search' },
      { labelKey: 'nav.items.reportsStudio', label: 'Reports Studio', path: '/reports-studio', icon: PieChart, roles: ['owner', 'admin', 'recruiter'], feature: 'analytics.advanced', module: 'modules.reports' },
      { labelKey: 'nav.items.dei', label: 'DEI', path: '/dei', icon: Shield, roles: ['owner', 'admin'], feature: 'analytics.dei', module: 'modules.dei' },
      { labelKey: 'nav.items.announcements', label: 'Announcements', path: '/announcements', icon: Megaphone, roles: ['owner', 'admin', 'recruiter'], feature: 'announcements', module: 'modules.announcements' },
    ]
  },
  {
    key: 'recruitment',
    titleKey: 'nav.sections.recruitment',
    title: 'Recruitment',
    icon: Users,
    roles: ['owner', 'admin', 'recruiter'],
    items: [
      { labelKey: 'nav.items.jobs', label: 'Jobs', path: '/jobs', icon: Briefcase, roles: ['owner', 'admin', 'recruiter'], module: 'modules.jobs' },
      { labelKey: 'nav.items.applications', label: 'Applications', path: '/applications', icon: GitPullRequest, roles: ['owner', 'admin', 'recruiter'], module: 'modules.applications' },
      { labelKey: 'nav.items.candidates', label: 'Candidates', path: '/ats', icon: Users, roles: ['owner', 'admin', 'recruiter'], module: 'modules.candidates' },
      { labelKey: 'nav.items.pipelineBoard', label: 'Pipeline Board', path: '/recruitment', icon: Kanban, roles: ['owner', 'admin', 'recruiter'], module: 'modules.pipeline' },
      { labelKey: 'nav.items.resumeParsing', label: 'Resume Parsing', path: '/resume-parsing', icon: FileText, roles: ['owner', 'admin', 'recruiter'], module: 'modules.resumeParsing' },
      { labelKey: 'nav.items.talentPools', label: 'Talent Pools', path: '/talent-pools', icon: Layers, roles: ['owner', 'admin', 'recruiter'], feature: 'candidates.talentPools', module: 'modules.talentPools' },
      { labelKey: 'nav.items.skills', label: 'Skills', path: '/skills', icon: Tags, roles: ['owner', 'admin', 'recruiter'], feature: 'candidates.skillsTaxonomy', module: 'modules.skills' },
      { labelKey: 'nav.items.collaboration', label: 'Collaboration', path: '/collaboration', icon: MessageSquare, roles: ['owner', 'admin', 'recruiter'], feature: 'candidates.collaboration', module: 'modules.collaboration' },
      { labelKey: 'nav.items.formBuilder', label: 'Form Builder', path: '/form-builder', icon: FormInput, roles: ['owner', 'admin', 'recruiter'], feature: 'careers.formBuilder', module: 'modules.formBuilder' },
      { labelKey: 'nav.items.assessments', label: 'Assessments', path: '/assessments', icon: ClipboardList, roles: ['owner', 'admin', 'recruiter'], feature: 'assessments', module: 'modules.assessments' },
      { labelKey: 'nav.items.aiTools', label: 'AI Tools', path: '/ai-tools', icon: Sparkles, roles: ['owner', 'admin', 'recruiter'], anyAi: true, module: 'modules.aiTools' },
    ]
  },
  {
    key: 'communication',
    titleKey: 'nav.sections.communication',
    title: 'Communication',
    icon: Inbox,
    roles: ['owner', 'admin', 'recruiter'],
    items: [
      { labelKey: 'nav.items.inbox', label: 'Inbox', path: '/inbox', icon: Inbox, roles: ['owner', 'admin', 'recruiter'], feature: 'messaging.inbox', module: 'modules.inbox' },
      { labelKey: 'nav.items.sequences', label: 'Sequences', path: '/sequences', icon: MailPlus, roles: ['owner', 'admin', 'recruiter'], feature: 'messaging.sequences', module: 'modules.sequences' },
      { labelKey: 'nav.items.consent', label: 'Consent', path: '/messaging-consent', icon: ShieldCheck, roles: ['owner', 'admin', 'recruiter'], feature: 'messaging.consent', module: 'modules.consent' },
    ]
  },
  {
    key: 'interviews',
    titleKey: 'nav.sections.interviews',
    title: 'Interviews',
    icon: Calendar,
    roles: ['owner', 'admin', 'recruiter', 'interviewer'],
    items: [
      { labelKey: 'nav.items.interviews', label: 'Interviews', path: '/interviews', icon: Calendar, roles: ['owner', 'admin', 'recruiter', 'interviewer'], module: 'modules.interviews' },
      { labelKey: 'nav.items.scorecardTemplates', label: 'Scorecard Templates', path: '/scorecard-templates', icon: ClipboardCheck, roles: ['owner', 'admin', 'recruiter'], feature: 'scorecards.templates', module: 'modules.scorecardTemplates' },
    ]
  },
  {
    key: 'organization',
    titleKey: 'nav.sections.organization',
    title: 'Organization',
    icon: Building2,
    roles: ['owner', 'admin'],
    items: [
      { labelKey: 'nav.items.team', label: 'Team', path: '/team', icon: UserCog, roles: ['owner', 'admin'], module: 'modules.team' },
      { labelKey: 'nav.items.organization', label: 'Organization', path: '/organization', icon: Building2, roles: ['owner', 'admin'], module: 'modules.organization' },
      { labelKey: 'nav.items.candidateFields', label: 'Candidate Fields', path: '/organization/candidate-fields', icon: Columns3, roles: ['owner', 'admin'], module: 'modules.organization' },
      { labelKey: 'nav.items.companyBrand', label: 'Company Brand', path: '/company-brand', icon: Palette, roles: ['owner', 'admin'], feature: 'careers.companyBrand', module: 'modules.companyBrand' },
      { labelKey: 'nav.items.integrations', label: 'Integrations', path: '/organization/integrations', icon: Plug, roles: ['owner', 'admin'], anyIntegration: true, module: 'modules.integrations' },
      { labelKey: 'nav.items.auditLog', label: 'Audit Log', path: '/organization/audit-log', icon: ScrollText, roles: ['owner', 'admin'], feature: 'audit.log', module: 'modules.auditLog' },
      { labelKey: 'nav.items.customRoles', label: 'Custom Roles', path: '/organization/custom-roles', icon: ShieldPlus, roles: ['owner', 'admin'], feature: 'team.customRoles', module: 'modules.customRoles' },
      { labelKey: 'nav.items.sso', label: 'Single Sign-On', path: '/organization/sso', icon: KeyRound, roles: ['owner', 'admin'], feature: 'sso', module: 'modules.sso' },
      { labelKey: 'nav.items.security', label: 'Security', path: '/organization/security', icon: Shield, roles: ['owner', 'admin'], feature: 'security.mfa', module: 'modules.security' },
      { labelKey: 'nav.items.webhooksApi', label: 'Webhooks & API', path: '/organization/webhooks-api', icon: Webhook, roles: ['owner', 'admin'], feature: 'integrations.webhooksReadOnly', module: 'modules.webhooks' },
      { labelKey: 'nav.items.scheduledReports', label: 'Scheduled Reports', path: '/organization/scheduled-reports', icon: CalendarClock, roles: ['owner', 'admin'], feature: 'reports.custom', module: 'modules.scheduledReports' },
      { labelKey: 'nav.items.whiteLabel', label: 'White-Label Kit', path: '/organization/white-label', icon: Palette, roles: ['owner', 'admin'], module: 'modules.whiteLabel' },
      { labelKey: 'nav.items.chromeExtension', label: 'Chrome Extension', path: '/organization/chrome-extension', icon: Chrome, roles: ['owner', 'admin'], module: 'modules.chromeExtension' },
      { labelKey: 'nav.items.careersChatbot', label: 'Careers Chatbot', path: '/organization/chatbot', icon: MessageCircle, roles: ['owner', 'admin'], feature: 'careers.chatbot', module: 'modules.chatbot' },
      { labelKey: 'nav.items.referrals', label: 'Referrals', path: '/organization/referrals', icon: Gift, roles: ['owner', 'admin'], feature: 'referrals.program', module: 'modules.referrals' },
      { labelKey: 'nav.items.approvals', label: 'Approvals', path: '/organization/approvals', icon: ListChecks, roles: ['owner', 'admin'], feature: 'workflows.approvals', module: 'modules.approvals' },
    ]
  },
  {
    key: 'settings',
    titleKey: 'nav.sections.settings',
    title: 'Settings',
    icon: Settings,
    roles: ['owner', 'admin', 'recruiter', 'interviewer', 'readonly'],
    items: [
      { labelKey: 'nav.items.emailTemplates', label: 'Email Templates', path: '/email-templates', icon: Mail, roles: ['owner', 'admin', 'recruiter'], module: 'modules.emailTemplates' },
      { labelKey: 'nav.items.emailSettings', label: 'Email Settings', path: '/email-settings', icon: Settings, roles: ['owner', 'admin'], feature: 'integrations.byoEmail', module: 'modules.emailSettings' },
      { labelKey: 'nav.items.pushNotifications', label: 'Push Notifications', path: '/push-notifications', icon: Bell, roles: ['owner', 'admin', 'recruiter', 'interviewer'], feature: 'push.notifications', module: 'modules.pushNotifications' },
      { labelKey: 'nav.items.profile', label: 'Profile', path: '/settings', icon: User, roles: ['owner', 'admin', 'recruiter', 'interviewer', 'readonly'], module: 'modules.profile' },
    ]
  },
  {
    key: 'billing',
    titleKey: 'nav.sections.billing',
    title: 'Billing',
    icon: CreditCard,
    roles: ['owner'],
    items: [
      { labelKey: 'nav.items.billing', label: 'Billing', path: '/billing', icon: CreditCard, roles: ['owner'], module: 'modules.billing' },
    ]
  }
];

export const ROLE_BADGE = {
  owner: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  admin: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  recruiter: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  interviewer: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  readonly: 'bg-stone-500/15 text-stone-400 border-stone-500/30',
};
