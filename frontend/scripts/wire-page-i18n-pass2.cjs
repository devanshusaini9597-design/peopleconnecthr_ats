/**
 * Second pass: wire remaining high-traffic page headers to i18n.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', 'src', 'components');

const swaps = [
  ['TeamPage.jsx', 'title="Team Directory"', "title={t('pages.team.title')}"],
  ['BillingPage.jsx', 'title="Billing & Plans"', "title={t('pages.billing.title')}"],
  ['InboxPage.jsx', 'title="Inbox"', "title={t('pages.inbox.title')}"],
  ['TalentPoolsPage.jsx', 'title="Talent Pools"', "title={t('pages.talentPools.title')}"],
  ['SequencesPage.jsx', 'title="Sequences"', "title={t('pages.sequences.title')}"],
  ['EmailTemplatesPage.jsx', 'title="Email Templates"', "title={t('pages.emailTemplates.title')}"],
  ['EmailSettingsPage.jsx', 'title="Email Settings"', "title={t('pages.emailSettings.title')}"],
  ['SecuritySettingsPage.jsx', 'title="Security"', "title={t('pages.security.title')}"],
  ['OrganizationSettingsPage.jsx', 'title="Organization Settings"', "title={t('pages.organization.title')}"],
  ['SkillsPage.jsx', 'title="Skills"', "title={t('pages.skills.title')}"],
  ['AnnouncementsPage.jsx', 'title="Announcements"', "title={t('pages.announcements.title')}"],
  ['PushNotificationsPage.jsx', 'title="Push Notifications"', "title={t('pages.pushNotifications.title')}"],
  ['AiToolsPage.jsx', 'title="AI Tools"', "title={t('pages.aiTools.title')}"],
  ['FormBuilderPage.jsx', 'title="Form Builder"', "title={t('pages.formBuilder.title')}"],
  ['CompanyBrandPage.jsx', 'title="Company Brand"', "title={t('pages.companyBrand.title')}"],
  ['CandidateFieldsPage.jsx', 'title="Candidate Fields"', "title={t('pages.candidateFields.title')}"],
  ['ReferralsPage.jsx', 'title="Referrals"', "title={t('pages.referrals.title')}"],
];

function ensureHook(src) {
  if (src.includes('const { t } = useTranslation()')) return src;
  if (!src.includes("from 'react-i18next'") && !src.includes('from "react-i18next"')) {
    src = src.replace(/(import React[^\n]*\n)/, `$1import { useTranslation } from 'react-i18next';\n`);
  }
  const patterns = [
    /(export default function \w+\([^)]*\) \{\n)/,
    /(function \w+\([^)]*\) \{\n)/,
    /(const \w+ = \(\) => \{\n)/,
    /(const \w+ = \(\) =>\{\n)/,
  ];
  for (const re of patterns) {
    if (re.test(src)) {
      src = src.replace(re, `$1  const { t } = useTranslation();\n`);
      break;
    }
  }
  return src;
}

for (const [file, find, repl] of swaps) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    // try pages/
    const alt = path.join(root, '..', 'pages', file);
    console.warn('skip missing', file);
    continue;
  }
  let src = fs.readFileSync(full, 'utf8');
  if (!src.includes(find)) {
    console.warn('pattern miss', file, find);
    continue;
  }
  src = src.split(find).join(repl);
  src = ensureHook(src);
  fs.writeFileSync(full, src);
  console.log('ok', file);
}
