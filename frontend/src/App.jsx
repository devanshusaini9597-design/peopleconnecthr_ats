import React, { Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { GlobalLoaderProvider } from './context/GlobalLoaderContext';
import GlobalLoader from './components/GlobalLoader';
import { AuthProvider } from './context/AuthContext';

import Home from './components/Home'
import Login from './components/Login'
import TrialApprovePage from './components/TrialApprovePage'
import Register from './components/Register'
import VerifyEmailPage from './components/VerifyEmailPage'
import ResetPasswordPage from './components/ResetPasswordPage'
import SubscribePage from './components/SubscribePage'
import SubscribeThankYouPage from './components/SubscribeThankYouPage'
import SubscribeReactivatePage from './components/SubscribeReactivatePage'
import UnsubscribePage from './components/UnsubscribePage'
import UnsubscribeThankYouPage from './components/UnsubscribeThankYouPage'
import DashboardPage from './components/DashboardPage'
import ATSPage from './components/ATSPage'
import ResumeParsing from './components/ResumeParsing'
import AutoImportPage from './components/AutoImportPage'
import PendingReviewPage from './components/PendingReviewPage'
import PendingReviewWorkbench from './components/pendingReview/workbench/PendingReviewWorkbench'
import Jobs from './pages/Jobs'
import AnalyticsDashboard from './components/AnalyticsDashboard'
import CandidateSearch from './components/CandidateSearch'
import EmailTemplatesPage from './components/EmailTemplatesPage'
import EmailSettingsPage from './components/EmailSettingsPage'
import EmailReportsPage from './components/EmailReportsPage'
import ProfileSettingsPage from './components/ProfileSettingsPage'
import TeamPage from './components/TeamPage'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import AppLoadingScreen from './components/ui/AppLoadingScreen'
import RouteErrorPage, { NotFoundPage } from './components/RouteErrorPage'
import FAQPage from './components/FAQPage'
import ContactPage from './components/ContactPage'
import MandatesPage from './components/MandatesPage'
import FreelancerPipelinePage from './components/FreelancerPipelinePage'

const OnboardingPage = React.lazy(() => import('./components/OnboardingPage'))
const AcceptInvitePage = React.lazy(() => import('./components/AcceptInvitePage'))
const AcceptFreelancerInvitePage = React.lazy(() => import('./components/AcceptFreelancerInvitePage'))
const OrganizationSettingsPage = React.lazy(() => import('./components/OrganizationSettingsPage'))
const IntegrationSettingsPage = React.lazy(() => import('./components/IntegrationSettingsPage'))
const AuditLogPage = React.lazy(() => import('./components/AuditLogPage'))
const CustomRolesPage = React.lazy(() => import('./components/CustomRolesPage'))
const CandidateFieldsPage = React.lazy(() => import('./components/CandidateFieldsPage'))
const TalentPoolsPage = React.lazy(() => import('./components/TalentPoolsPage'))
const SSOCallbackPage = React.lazy(() => import('./components/SSOCallbackPage'))
const SSOSettingsPage = React.lazy(() => import('./components/SSOSettingsPage'))
const BillingPage = React.lazy(() => import('./components/BillingPage'))
const WebhooksApiPage = React.lazy(() => import('./components/WebhooksApiPage'))
const ScheduledReportsPage = React.lazy(() => import('./components/ScheduledReportsPage'))
const ApplicationsPage = React.lazy(() => import('./components/ApplicationsPage'))
const InterviewsPage = React.lazy(() => import('./components/InterviewsPage'))
const CareersPage = React.lazy(() => import('./components/CareersPage'))
const JobDetailPublic = React.lazy(() => import('./components/JobDetailPublic'))
const CandidatePortal = React.lazy(() => import('./components/CandidatePortal'))
const AssessmentsPage = React.lazy(() => import('./components/AssessmentsPage'))
const AssessmentTakePage = React.lazy(() => import('./components/AssessmentTakePage'))
const WhiteLabelSettingsPage = React.lazy(() => import('./components/WhiteLabelSettingsPage'))
const ChromeExtensionSettingsPage = React.lazy(() => import('./components/ChromeExtensionSettingsPage'))
const SecuritySettingsPage = React.lazy(() => import('./components/SecuritySettingsPage'))
const TrustCenterPage = React.lazy(() => import('./components/TrustCenterPage'))
const StatusPage = React.lazy(() => import('./components/StatusPage'))
const ApprovalsPage = React.lazy(() => import('./components/ApprovalsPage'))
const ReferralsPage = React.lazy(() => import('./components/ReferralsPage'))
const SelfBookPage = React.lazy(() => import('./components/SelfBookPage'))
const SurveyTakePage = React.lazy(() => import('./components/SurveyTakePage'))
const AiToolsPage = React.lazy(() => import('./components/AiToolsPage'))
const SkillsPage = React.lazy(() => import('./components/SkillsPage'))
const PositionsPage = React.lazy(() => import('./components/PositionsPage'))
const InboxPage = React.lazy(() => import('./components/InboxPage'))
const SequencesPage = React.lazy(() => import('./components/SequencesPage'))
const DeiPage = React.lazy(() => import('./components/DeiPage'))
const FormBuilderPage = React.lazy(() => import('./components/FormBuilderPage'))
const ChatbotSettingsPage = React.lazy(() => import('./components/ChatbotSettingsPage'))
const GlobalSearchPage = React.lazy(() => import('./components/GlobalSearchPage'))
const ReportsStudioPage = React.lazy(() => import('./components/ReportsStudioPage'))
const ScorecardTemplatesPage = React.lazy(() => import('./components/ScorecardTemplatesPage'))
const AnnouncementsPage = React.lazy(() => import('./components/AnnouncementsPage'))
const CompanyBrandPage = React.lazy(() => import('./components/CompanyBrandPage'))
const CandidateCollaborationPage = React.lazy(() => import('./components/CandidateCollaborationPage'))
const MyTeamPage = React.lazy(() => import('./components/MyTeamPage'))
const MessagingConsentPage = React.lazy(() => import('./components/MessagingConsentPage'))
const PushNotificationsPage = React.lazy(() => import('./components/PushNotificationsPage'))
const NotificationSettingsPage = React.lazy(() => import('./components/NotificationSettingsPage'))
const EmbedChatbotPage = React.lazy(() => import('./components/EmbedChatbotPage'))
const MarketingPage = React.lazy(() => import('./components/MarketingPage'))
const SupportFeedbackPage = React.lazy(() => import('./components/SupportFeedbackPage'))
const CompanySupportDeskPage = React.lazy(() => import('./components/CompanySupportDeskPage'))
const FreelanceReviewPage = React.lazy(() => import('./components/FreelanceReviewPage'))
const TrialRequestsPage = React.lazy(() => import('./components/TrialRequestsPage'))

const LoadingFallback = () => (
  <AppLoadingScreen
    fullScreen={false}
    message="Loading page"
    subMessage="Just a moment…"
  />
);

/** Persistent shell — sidebar/header stay mounted; only Outlet content swaps (AJAX feel). */
const AppShell = ({ requiredRoles }) => (
  <ProtectedRoute requiredRoles={requiredRoles}>
    <Layout />
  </ProtectedRoute>
);

const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPage />,
    children: [
  { path: '/', element: <Home /> },
  { path: '/login', element: <Login /> },
  { path: '/trial-approve', element: <TrialApprovePage /> },
  { path: '/register', element: <Register /> },
  { path: '/verify-email', element: <VerifyEmailPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/subscribe', element: <SubscribePage /> },
  { path: '/subscribe/thank-you', element: <SubscribeThankYouPage /> },
  { path: '/subscribe/reactivate', element: <SubscribeReactivatePage /> },
  { path: '/unsubscribe', element: <UnsubscribePage /> },
  { path: '/unsubscribe/thank-you', element: <UnsubscribeThankYouPage /> },

  { path: '/accept-invite', element: <Suspense fallback={<LoadingFallback />}><AcceptInvitePage /></Suspense> },
  { path: '/accept-freelancer-invite', element: <Suspense fallback={<LoadingFallback />}><AcceptFreelancerInvitePage /></Suspense> },
  { path: '/careers/:orgSlug', element: <Suspense fallback={<LoadingFallback />}><CareersPage /></Suspense> },
  { path: '/careers/:orgSlug/jobs/:jobId', element: <Suspense fallback={<LoadingFallback />}><JobDetailPublic /></Suspense> },
  { path: '/portal', element: <Suspense fallback={<LoadingFallback />}><CandidatePortal /></Suspense> },
  { path: '/assessment/:token', element: <Suspense fallback={<LoadingFallback />}><AssessmentTakePage /></Suspense> },
  { path: '/trust', element: <Suspense fallback={<LoadingFallback />}><TrustCenterPage /></Suspense> },
  { path: '/status', element: <Suspense fallback={<LoadingFallback />}><StatusPage /></Suspense> },
  { path: '/book/:tokenOrSlug', element: <Suspense fallback={<LoadingFallback />}><SelfBookPage /></Suspense> },
  { path: '/survey/:token', element: <Suspense fallback={<LoadingFallback />}><SurveyTakePage /></Suspense> },
  { path: '/embed/chatbot/:orgSlug', element: <Suspense fallback={<LoadingFallback />}><EmbedChatbotPage /></Suspense> },
  { path: '/pricing', element: <Suspense fallback={<LoadingFallback />}><MarketingPage /></Suspense> },
  { path: '/features', element: <Suspense fallback={<LoadingFallback />}><MarketingPage /></Suspense> },
  { path: '/enterprise', element: <Suspense fallback={<LoadingFallback />}><MarketingPage /></Suspense> },
  { path: '/security', element: <Suspense fallback={<LoadingFallback />}><MarketingPage /></Suspense> },
  { path: '/integrations', element: <Suspense fallback={<LoadingFallback />}><MarketingPage /></Suspense> },
  { path: '/ai-automation', element: <Suspense fallback={<LoadingFallback />}><MarketingPage /></Suspense> },
  { path: '/faq', element: <FAQPage /> },
  { path: '/contact', element: <ContactPage /> },
  { path: '/privacy', element: <Suspense fallback={<LoadingFallback />}><MarketingPage /></Suspense> },
  { path: '/terms', element: <Suspense fallback={<LoadingFallback />}><MarketingPage /></Suspense> },
  { path: '/customers', element: <Suspense fallback={<LoadingFallback />}><MarketingPage /></Suspense> },

  { path: '/onboarding', element: <ProtectedRoute><Suspense fallback={<LoadingFallback />}><OnboardingPage /></Suspense></ProtectedRoute> },
  { path: '/onboarding/create-org', element: <ProtectedRoute><Suspense fallback={<LoadingFallback />}><OnboardingPage /></Suspense></ProtectedRoute> },
  { path: '/onboarding/invite', element: <ProtectedRoute><Suspense fallback={<LoadingFallback />}><OnboardingPage /></Suspense></ProtectedRoute> },
  { path: '/sso/callback', element: <Suspense fallback={<LoadingFallback />}><SSOCallbackPage /></Suspense> },

  // ── Authenticated app shell (content-only navigation) ──────────────
  {
    element: <AppShell />,
    errorElement: <RouteErrorPage />,
    children: [
      // Main
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/analytics', element: <AnalyticsDashboard /> },

      // Recruitment
      { path: '/jobs', element: <Jobs /> },
      { path: '/mandates', element: <MandatesPage /> },
      { path: '/my-pipeline', element: <FreelancerPipelinePage /> },
      { path: '/feedback', element: <ProtectedRoute requiredRoles={['freelancer']}><Suspense fallback={<LoadingFallback />}><SupportFeedbackPage /></Suspense></ProtectedRoute> },
      { path: '/support-desk', element: <Suspense fallback={<LoadingFallback />}><CompanySupportDeskPage /></Suspense> },
      { path: '/trial-requests', element: <Suspense fallback={<LoadingFallback />}><TrialRequestsPage /></Suspense> },
      { path: '/freelance-review', element: <Suspense fallback={<LoadingFallback />}><FreelanceReviewPage /></Suspense> },
      { path: '/applications', element: <Suspense fallback={<LoadingFallback />}><ApplicationsPage /></Suspense> },
      { path: '/recruitment', element: <Suspense fallback={<LoadingFallback />}><ApplicationsPage /></Suspense> },
      { path: '/ats', element: <ATSPage /> },
      { path: '/add-candidate', element: <Navigate to="/ats?add=1" replace /> },
      { path: '/resume-parsing', element: <ResumeParsing /> },
      { path: '/candidate-search', element: <CandidateSearch /> },
      { path: '/talent-pools', element: <Suspense fallback={<LoadingFallback />}><TalentPoolsPage /></Suspense> },
      { path: '/skills', element: <Suspense fallback={<LoadingFallback />}><SkillsPage /></Suspense> },
      { path: '/positions', element: <Suspense fallback={<LoadingFallback />}><PositionsPage /></Suspense> },
      { path: '/inbox', element: <Suspense fallback={<LoadingFallback />}><InboxPage /></Suspense> },
      { path: '/sequences', element: <Suspense fallback={<LoadingFallback />}><SequencesPage /></Suspense> },
      { path: '/dei', element: <Suspense fallback={<LoadingFallback />}><DeiPage /></Suspense> },
      { path: '/form-builder', element: <Suspense fallback={<LoadingFallback />}><FormBuilderPage /></Suspense> },
      { path: '/organization/chatbot', element: <Suspense fallback={<LoadingFallback />}><ChatbotSettingsPage /></Suspense> },
      { path: '/assessments', element: <Suspense fallback={<LoadingFallback />}><AssessmentsPage /></Suspense> },
      { path: '/ai-tools', element: <Suspense fallback={<LoadingFallback />}><AiToolsPage /></Suspense> },
      { path: '/search', element: <Suspense fallback={<LoadingFallback />}><GlobalSearchPage /></Suspense> },
      { path: '/collaboration', element: <Suspense fallback={<LoadingFallback />}><CandidateCollaborationPage /></Suspense> },
      { path: '/my-team', element: <Suspense fallback={<LoadingFallback />}><MyTeamPage /></Suspense> },
      { path: '/scorecard-templates', element: <Suspense fallback={<LoadingFallback />}><ScorecardTemplatesPage /></Suspense> },
      { path: '/messaging-consent', element: <Suspense fallback={<LoadingFallback />}><MessagingConsentPage /></Suspense> },
      { path: '/announcements', element: <Suspense fallback={<LoadingFallback />}><AnnouncementsPage /></Suspense> },
      { path: '/reports-studio', element: <Suspense fallback={<LoadingFallback />}><ReportsStudioPage /></Suspense> },
      { path: '/company-brand', element: <Suspense fallback={<LoadingFallback />}><CompanyBrandPage /></Suspense> },
      { path: '/notification-settings', element: <Suspense fallback={<LoadingFallback />}><NotificationSettingsPage /></Suspense> },
      { path: '/push-notifications', element: <Suspense fallback={<LoadingFallback />}><PushNotificationsPage /></Suspense> },

      // Related / shared
      { path: '/auto-import', element: <AutoImportPage /> },
      // CSV import staging (Auto Import) — not the Dashboard Pending Review KPI
      { path: '/pending-review', element: <PendingReviewWorkbench /> },
      { path: '/homeunder', element: <Navigate to="/dashboard" replace /> },
      { path: '/manage-positions', element: <Navigate to="/positions" replace /> },
      { path: '/manage-clients', element: <Navigate to="/ats" replace /> },
      { path: '/manage-sources', element: <Navigate to="/ats" replace /> },
      { path: '/manage-ctc', element: <Navigate to="/ats" replace /> },
      { path: '/manage-notice', element: <Navigate to="/ats" replace /> },
      { path: '/email-templates', element: <EmailTemplatesPage /> },
      { path: '/email-settings', element: <EmailSettingsPage /> },
      { path: '/email-reports', element: <EmailReportsPage /> },
      { path: '/settings', element: <ProfileSettingsPage /> },
      { path: '/team', element: <TeamPage /> },
      { path: '/interviews', element: <Suspense fallback={<LoadingFallback />}><InterviewsPage /></Suspense> },
      { path: '/organization', element: <Suspense fallback={<LoadingFallback />}><OrganizationSettingsPage /></Suspense> },
      { path: '/organization/integrations', element: <Suspense fallback={<LoadingFallback />}><IntegrationSettingsPage /></Suspense> },
      { path: '/organization/audit-log', element: <Suspense fallback={<LoadingFallback />}><AuditLogPage /></Suspense> },
      { path: '/organization/custom-roles', element: <Suspense fallback={<LoadingFallback />}><CustomRolesPage /></Suspense> },
      { path: '/organization/candidate-fields', element: <Suspense fallback={<LoadingFallback />}><CandidateFieldsPage /></Suspense> },
      { path: '/organization/white-label', element: <Suspense fallback={<LoadingFallback />}><WhiteLabelSettingsPage /></Suspense> },
      { path: '/organization/chrome-extension', element: <Suspense fallback={<LoadingFallback />}><ChromeExtensionSettingsPage /></Suspense> },
      { path: '/organization/sso', element: <Suspense fallback={<LoadingFallback />}><SSOSettingsPage /></Suspense> },
      { path: '/organization/security', element: <Suspense fallback={<LoadingFallback />}><SecuritySettingsPage /></Suspense> },
      { path: '/organization/approvals', element: <Suspense fallback={<LoadingFallback />}><ApprovalsPage /></Suspense> },
      { path: '/organization/referrals', element: <Suspense fallback={<LoadingFallback />}><ReferralsPage /></Suspense> },
      { path: '/organization/webhooks-api', element: <Suspense fallback={<LoadingFallback />}><WebhooksApiPage /></Suspense> },
      { path: '/organization/scheduled-reports', element: <Suspense fallback={<LoadingFallback />}><ScheduledReportsPage /></Suspense> },
      { path: '/billing', element: <Suspense fallback={<LoadingFallback />}><BillingPage /></Suspense> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

function App() {
  return (
    <AuthProvider>
      <GlobalLoaderProvider>
        <GlobalLoader />
        <div className="min-h-dvh bg-stone-50">
          <RouterProvider router={router} />
        </div>
      </GlobalLoaderProvider>
    </AuthProvider>
  );
}

export default App;
