const fs = require('fs');
const path = 'c:/Users/hp/Downloads/ats-master-fixed/frontend/src/components/sidebar/sidebarConstants.js';
let c = fs.readFileSync(path, 'utf8');
const map = {
  Dashboard: 'nav.items.dashboard',
  Analytics: 'nav.items.analytics',
  'Global Search': 'nav.items.globalSearch',
  'Reports Studio': 'nav.items.reportsStudio',
  DEI: 'nav.items.dei',
  Announcements: 'nav.items.announcements',
  Jobs: 'nav.items.jobs',
  Applications: 'nav.items.applications',
  Candidates: 'nav.items.candidates',
  'Pipeline Board': 'nav.items.pipelineBoard',
  'Resume Parsing': 'nav.items.resumeParsing',
  'Talent Pools': 'nav.items.talentPools',
  Skills: 'nav.items.skills',
  Collaboration: 'nav.items.collaboration',
  'Form Builder': 'nav.items.formBuilder',
  Assessments: 'nav.items.assessments',
  'AI Tools': 'nav.items.aiTools',
  Inbox: 'nav.items.inbox',
  Sequences: 'nav.items.sequences',
  Consent: 'nav.items.consent',
  Interviews: 'nav.items.interviews',
  'Scorecard Templates': 'nav.items.scorecardTemplates',
  Team: 'nav.items.team',
  Organization: 'nav.items.organization',
  'Candidate Fields': 'nav.items.candidateFields',
  'Company Brand': 'nav.items.companyBrand',
  Integrations: 'nav.items.integrations',
  'Audit Log': 'nav.items.auditLog',
  'Custom Roles': 'nav.items.customRoles',
  'Single Sign-On': 'nav.items.sso',
  Security: 'nav.items.security',
  'Webhooks & API': 'nav.items.webhooksApi',
  'Scheduled Reports': 'nav.items.scheduledReports',
  'White-Label Kit': 'nav.items.whiteLabel',
  'Chrome Extension': 'nav.items.chromeExtension',
  'Careers Chatbot': 'nav.items.careersChatbot',
  Referrals: 'nav.items.referrals',
  Approvals: 'nav.items.approvals',
  'Email Templates': 'nav.items.emailTemplates',
  'Email Settings': 'nav.items.emailSettings',
  'Push Notifications': 'nav.items.pushNotifications',
  Profile: 'nav.items.profile',
  Billing: 'nav.items.billing',
};
for (const [label, key] of Object.entries(map)) {
  const needle = `{ label: '${label}'`;
  const repl = `{ labelKey: '${key}', label: '${label}'`;
  c = c.split(needle).join(repl);
}
fs.writeFileSync(path, c);
console.log('labelKeys', (c.match(/labelKey:/g) || []).length);
console.log('titleKeys', (c.match(/titleKey:/g) || []).length);
