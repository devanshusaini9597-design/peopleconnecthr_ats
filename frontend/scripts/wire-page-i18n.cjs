/**
 * Wire PageHeader title/subtitle hardcodes to i18n keys across page components.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'src', 'components');

const replacements = [
  // [file, find, replace] — conservative exact string swaps
  ['WhiteLabelSettingsPage.jsx', 'title="White-Label Kit"', "title={t('pages.whiteLabel.title')}"],
  ['WhiteLabelSettingsPage.jsx', 'subtitle="Brand candidate-facing surfaces as your company — not the ATS vendor."', "subtitle={t('pages.whiteLabel.subtitle')}"],
  ['ProfileSettingsPage.jsx', 'title="Profile"', "title={t('pages.profile.title')}"],
  ['ProfileSettingsPage.jsx', 'subtitle="Your identity, security, and account preferences."', "subtitle={t('pages.profile.subtitle')}"],
  ['InterviewsPage.jsx', 'title="Interviews"', "title={t('pages.interviews.title')}"],
  ['InterviewsPage.jsx', 'subtitle="Schedule interviews, join meetings, and submit scorecards."', "subtitle={t('pages.interviews.subtitle')}"],
  ['AddCandidatePage.jsx', 'title="Add New Candidate"', "title={t('candidates.addNew')}"],
  ['AddCandidatePage.jsx', 'subtitle="Fill in the candidate details below — required fields are marked."', "subtitle={t('candidates.addSubtitle')}"],
  ['ScheduledReportsPage.jsx', 'title="Scheduled Reports"', "title={t('pages.scheduledReports.title')}"],
  ['ScheduledReportsPage.jsx', 'subtitle="Automatically email reports to your team on a recurring cadence."', "subtitle={t('pages.scheduledReports.subtitle')}"],
  ['AssessmentsPage.jsx', 'title="Assessments"', "title={t('pages.assessments.title')}"],
  ['AssessmentsPage.jsx', 'subtitle="Build skills tests and invite candidates to complete them. Code answers are graded by your team."', "subtitle={t('pages.assessments.subtitle')}"],
  ['AutoImportPage.jsx', 'title="Bulk Import"', "title={t('pages.bulkImport.title')}"],
  ['AutoImportPage.jsx', 'subtitle="Enterprise spreadsheet intake — download template, validate, select, then import."', "subtitle={t('pages.bulkImport.subtitle')}"],
  ['ScorecardTemplatesPage.jsx', 'title="Scorecard Templates"', "title={t('pages.scorecardTemplates.title')}"],
  ['ScorecardTemplatesPage.jsx', 'subtitle="Reusable weighted interview criteria for hiring managers."', "subtitle={t('pages.scorecardTemplates.subtitle')}"],
  ['MessagingConsentPage.jsx', 'title="Messaging Consent"', "title={t('pages.messagingConsent.title')}"],
  ['DeiPage.jsx', 'title="DEI & Fair Hiring"', "title={t('pages.dei.title')}"],
  ['GlobalSearchPage.jsx', 'title="Global Search"', "title={t('pages.globalSearch.title')}"],
  ['CandidateCollaborationPage.jsx', 'title="Team Collaboration"', "title={t('pages.collaboration.title')}"],
  ['ReportsStudioPage.jsx', 'title="Reports Studio"', "title={t('pages.reportsStudio.title')}"],
  ['PendingReviewPage.jsx', 'title="Pending Review"', "title={t('pages.pendingReview.title')}"],
  ['AuditLogPage.jsx', 'title="Audit Log"', "title={t('pages.auditLog.title')}"],
  ['IntegrationSettingsPage.jsx', 'title="Integrations"', "title={t('pages.integrations.title')}"],
  ['ApprovalsPage.jsx', 'title="Approval workflows"', "title={t('pages.approvals.title')}"],
];

const needImport = new Set();

for (const [file, find, repl] of replacements) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    console.warn('missing', file);
    continue;
  }
  let src = fs.readFileSync(full, 'utf8');
  if (!src.includes(find)) {
    console.warn('not found in', file, ':', find.slice(0, 40));
    continue;
  }
  src = src.split(find).join(repl);
  needImport.add(file);
  fs.writeFileSync(full, src);
  console.log('updated', file);
}

for (const file of needImport) {
  const full = path.join(root, file);
  let src = fs.readFileSync(full, 'utf8');
  if (src.includes("useTranslation")) {
    // ensure const { t } exists in component — inject if missing after function start
    if (!src.includes('const { t } = useTranslation()') && !src.includes('const { t } = useTranslation(')) {
      src = src.replace(
        /(const \w+Page[^=]*=\s*\([^)]*\)\s*=>\s*\{|function \w+Page\s*\([^)]*\)\s*\{|export default function \w+[^{]*\{)/,
        (m) => `${m}\n  const { t } = useTranslation();`
      );
      // also handle `const X = () => {`
      if (!src.includes('const { t } = useTranslation()')) {
        src = src.replace(
          /((?:export default )?function \w+\([^)]*\) \{\n)/,
          `$1  const { t } = useTranslation();\n`
        );
      }
      if (!src.includes('const { t } = useTranslation()')) {
        src = src.replace(
          /(const \w+ = \(\) => \{\n)/,
          `$1  const { t } = useTranslation();\n`
        );
      }
    }
    if (!src.includes("from 'react-i18next'") && !src.includes('from "react-i18next"')) {
      src = src.replace(
        /(import React[^\n]*\n)/,
        `$1import { useTranslation } from 'react-i18next';\n`
      );
    }
  } else {
    src = src.replace(
      /(import React[^\n]*\n)/,
      `$1import { useTranslation } from 'react-i18next';\n`
    );
    if (!src.includes('const { t } = useTranslation()')) {
      src = src.replace(
        /(const \w+ = \(\) => \{\n)/,
        `$1  const { t } = useTranslation();\n`
      );
      if (!src.includes('const { t } = useTranslation()')) {
        src = src.replace(
          /(export default function \w+\([^)]*\) \{\n)/,
          `$1  const { t } = useTranslation();\n`
        );
      }
      if (!src.includes('const { t } = useTranslation()')) {
        src = src.replace(
          /(function \w+\([^)]*\) \{\n)/,
          `$1  const { t } = useTranslation();\n`
        );
      }
    }
  }
  fs.writeFileSync(full, src);
  console.log('hooked', file);
}
