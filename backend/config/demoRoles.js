/**
 * Public sales-demo roles. Legacy `recruiter` is the same desk as hr_recruiter,
 * so it is not a separate walkthrough.
 */
const DEMO_ROLES = [
  {
    role: 'owner',
    name: 'Asha Mehta',
    title: 'Owner',
    summary: 'Full company: billing, team, settings, and every desk.',
  },
  {
    role: 'admin',
    name: 'Rohan Kapoor',
    title: 'Admin',
    summary: 'Runs the workspace. Billing stays with the owner.',
  },
  {
    role: 'hr_manager',
    name: 'Neha Sharma',
    title: 'HR Manager',
    summary: 'Hiring operations, reports, and the team’s pipeline.',
  },
  {
    role: 'hr_recruiter',
    name: 'Arjun Desai',
    title: 'Recruiter',
    summary: 'Jobs, candidates, applications, and interviews.',
  },
  {
    role: 'sales',
    name: 'Priya Nair',
    title: 'Sales',
    summary: 'Dashboard, candidates, and the pipeline they work.',
  },
  {
    role: 'freelancer',
    name: 'Kabir Joshi',
    title: 'Freelance recruiter',
    summary: 'Own desk only. Company records stay hidden.',
  },
  {
    role: 'interviewer',
    name: 'Meera Iyer',
    title: 'Interviewer',
    summary: 'Interviews and scorecards, not the full database.',
  },
  {
    role: 'readonly',
    name: 'Vikram Shah',
    title: 'Read only',
    summary: 'Look through the workspace without changing records.',
  },
  {
    role: 'other',
    name: 'Ananya Rao',
    title: 'Limited member',
    summary: 'Dashboard and search. No hiring actions.',
  },
];

const DEMO_ORG_SLUG = 'peopleconnect-demo';
const DEMO_EMAIL_DOMAIN = 'demo.peopleconnecthr.com';

function demoEmailForRole(role) {
  return `demo.${String(role || '').trim().toLowerCase()}@${DEMO_EMAIL_DOMAIN}`;
}

function demoEmailBlockedError() {
  const err = new Error('DEMO_EMAIL_BLOCKED');
  err.code = 'DEMO_EMAIL_BLOCKED';
  err.statusCode = 403;
  err.displayMessage = 'This demo workspace does not send real email.';
  return err;
}

module.exports = {
  DEMO_ROLES,
  DEMO_ORG_SLUG,
  DEMO_EMAIL_DOMAIN,
  demoEmailForRole,
  demoEmailBlockedError,
};
