import React, { Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { GlobalLoaderProvider } from './context/GlobalLoaderContext';
import GlobalLoader from './components/GlobalLoader';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLoadingScreen from './components/ui/AppLoadingScreen';
import RouteErrorPage, { NotFoundPage } from './components/RouteErrorPage';

const Home = React.lazy(() => import('./components/Home'));
const Login = React.lazy(() => import('./components/Login'));
const DemoPage = React.lazy(() => import('./components/DemoPage'));
const TrialApprovePage = React.lazy(() => import('./components/TrialApprovePage'));
const Register = React.lazy(() => import('./components/Register'));
const VerifyEmailPage = React.lazy(() => import('./components/VerifyEmailPage'));
const ResetPasswordPage = React.lazy(() => import('./components/ResetPasswordPage'));
const SubscribePage = React.lazy(() => import('./components/SubscribePage'));
const SubscribeThankYouPage = React.lazy(() => import('./components/SubscribeThankYouPage'));
const SubscribeReactivatePage = React.lazy(() => import('./components/SubscribeReactivatePage'));
const UnsubscribePage = React.lazy(() => import('./components/UnsubscribePage'));
const UnsubscribeThankYouPage = React.lazy(() => import('./components/UnsubscribeThankYouPage'));
const DashboardPage = React.lazy(() => import('./components/DashboardPage'));
const ATSPage = React.lazy(() => import('./components/ATSPage'));
const ResumeParsing = React.lazy(() => import('./components/ResumeParsing'));
const AutoImportPage = React.lazy(() => import('./components/AutoImportPage'));
const PendingReviewWorkbench = React.lazy(() => import('./components/pendingReview/workbench/PendingReviewWorkbench'));
const Jobs = React.lazy(() => import('./pages/Jobs'));
const AnalyticsDashboard = React.lazy(() => import('./components/AnalyticsDashboard'));
const CandidateSearch = React.lazy(() => import('./components/CandidateSearch'));
const EmailTemplatesPage = React.lazy(() => import('./components/EmailTemplatesPage'));
const EmailSettingsPage = React.lazy(() => import('./components/EmailSettingsPage'));
const EmailReportsPage = React.lazy(() => import('./components/EmailReportsPage'));
const ProfileSettingsPage = React.lazy(() => import('./components/ProfileSettingsPage'));
const TeamPage = React.lazy(() => import('./components/TeamPage'));
const Layout = React.lazy(() => import('./components/Layout'));
const FAQPage = React.lazy(() => import('./components/FAQPage'));
const ContactPage = React.lazy(() => import('./components/ContactPage'));
const MandatesPage = React.lazy(() => import('./components/MandatesPage'));
const FreelancerPipelinePage = React.lazy(() => import('./components/FreelancerPipelinePage'));
const OnboardingPage = React.lazy(() => import('./components/OnboardingPage'));
const AcceptInvitePage = React.lazy(() => import('./components/AcceptInvitePage'));
const AcceptFreelancerInvitePage = React.lazy(() => import('./components/AcceptFreelancerInvitePage'));
const OrganizationSettingsPage = React.lazy(() => import('./components/OrganizationSettingsPage'));
const IntegrationSettingsPage = React.lazy(() => import('./components/IntegrationSettingsPage'));
const AuditLogPage = React.lazy(() => import('./components/AuditLogPage'));
const CustomRolesPage = React.lazy(() => import('./components/CustomRolesPage'));
const CandidateFieldsPage = React.lazy(() => import('./components/CandidateFieldsPage'));
const TalentPoolsPage = React.lazy(() => import('./components/TalentPoolsPage'));
const MisPage = React.lazy(() => import('./components/MisPage'));
const MisReportsPage = React.lazy(() => import('./components/MisReportsPage'));
const SSOCallbackPage = React.lazy(() => import('./components/SSOCallbackPage'));
const SSOSettingsPage = React.lazy(() => import('./components/SSOSettingsPage'));
const BillingPage = React.lazy(() => import('./components/BillingPage'));
const WebhooksApiPage = React.lazy(() => import('./components/WebhooksApiPage'));
const ScheduledReportsPage = React.lazy(() => import('./components/ScheduledReportsPage'));
const ApplicationsPage = React.lazy(() => import('./components/ApplicationsPage'));
const InterviewsPage = React.lazy(() => import('./components/InterviewsPage'));
const CareersPage = React.lazy(() => import('./components/CareersPage'));
const PartnerSignupPage = React.lazy(() => import('./components/PartnerSignupPage'));
const JobDetailPublic = React.lazy(() => import('./components/JobDetailPublic'));
const CandidatePortal = React.lazy(() => import('./components/CandidatePortal'));
const AssessmentsPage = React.lazy(() => import('./components/AssessmentsPage'));
const AssessmentTakePage = React.lazy(() => import('./components/AssessmentTakePage'));
const WhiteLabelSettingsPage = React.lazy(() => import('./components/WhiteLabelSettingsPage'));
const ChromeExtensionSettingsPage = React.lazy(() => import('./components/ChromeExtensionSettingsPage'));
const SecuritySettingsPage = React.lazy(() => import('./components/SecuritySettingsPage'));
const TrustCenterPage = React.lazy(() => import('./components/TrustCenterPage'));
const StatusPage = React.lazy(() => import('./components/StatusPage'));
const ApprovalsPage = React.lazy(() => import('./components/ApprovalsPage'));
const ReferralsPage = React.lazy(() => import('./components/ReferralsPage'));
const SelfBookPage = React.lazy(() => import('./components/SelfBookPage'));
const SurveyTakePage = React.lazy(() => import('./components/SurveyTakePage'));
const AiToolsPage = React.lazy(() => import('./components/AiToolsPage'));
const SkillsPage = React.lazy(() => import('./components/SkillsPage'));
const PositionsPage = React.lazy(() => import('./components/PositionsPage'));
const InboxPage = React.lazy(() => import('./components/InboxPage'));
const SequencesPage = React.lazy(() => import('./components/SequencesPage'));
const DeiPage = React.lazy(() => import('./components/DeiPage'));
const FormBuilderPage = React.lazy(() => import('./components/FormBuilderPage'));
const ChatbotSettingsPage = React.lazy(() => import('./components/ChatbotSettingsPage'));
const GlobalSearchPage = React.lazy(() => import('./components/GlobalSearchPage'));
const ReportsStudioPage = React.lazy(() => import('./components/ReportsStudioPage'));
const ScorecardTemplatesPage = React.lazy(() => import('./components/ScorecardTemplatesPage'));
const AnnouncementsPage = React.lazy(() => import('./components/AnnouncementsPage'));
const CompanyBrandPage = React.lazy(() => import('./components/CompanyBrandPage'));
const CandidateCollaborationPage = React.lazy(() => import('./components/CandidateCollaborationPage'));
const MyTeamPage = React.lazy(() => import('./components/MyTeamPage'));
const MessagingConsentPage = React.lazy(() => import('./components/MessagingConsentPage'));
const PushNotificationsPage = React.lazy(() => import('./components/PushNotificationsPage'));
const NotificationSettingsPage = React.lazy(() => import('./components/NotificationSettingsPage'));
const EmbedChatbotPage = React.lazy(() => import('./components/EmbedChatbotPage'));
const MarketingPage = React.lazy(() => import('./components/MarketingPage'));
const SupportFeedbackPage = React.lazy(() => import('./components/SupportFeedbackPage'));
const CompanySupportDeskPage = React.lazy(() => import('./components/CompanySupportDeskPage'));
const FreelanceReviewPage = React.lazy(() => import('./components/FreelanceReviewPage'));
const FreelancerApplicationsPage = React.lazy(() => import('./components/FreelancerApplicationsPage'));
const TrialRequestsPage = React.lazy(() => import('./components/TrialRequestsPage'));

const LoadingFallback = () => (
  <AppLoadingScreen
    fullScreen={false}
    message="Loading page"
    subMessage="Just a moment…"
  />
);

const LandingFallback = () => (
  <div className="min-h-dvh bg-[#f2faf8]" aria-busy="true" />
);

const withPage = (Page) => (
  <Suspense fallback={<LoadingFallback />}>
    <Page />
  </Suspense>
);

/** Persistent shell — sidebar/header stay mounted; only Outlet content swaps (AJAX feel). */
const AppShell = ({ requiredRoles }) => (
  <ProtectedRoute requiredRoles={requiredRoles}>
    <Suspense fallback={<LoadingFallback />}>
      <Layout />
    </Suspense>
  </ProtectedRoute>
);

const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPage />,
    children: [
  { path: '/', element: <Suspense fallback={<LandingFallback />}><Home /></Suspense> },
  { path: '/login', element: withPage(Login) },
  { path: '/demo', element: withPage(DemoPage) },
  { path: '/trial-approve', element: withPage(TrialApprovePage) },
  { path: '/register', element: withPage(Register) },
  { path: '/verify-email', element: withPage(VerifyEmailPage) },
  { path: '/reset-password', element: withPage(ResetPasswordPage) },
  { path: '/subscribe', element: withPage(SubscribePage) },
  { path: '/subscribe/thank-you', element: withPage(SubscribeThankYouPage) },
  { path: '/subscribe/reactivate', element: withPage(SubscribeReactivatePage) },
  { path: '/unsubscribe', element: withPage(UnsubscribePage) },
  { path: '/unsubscribe/thank-you', element: withPage(UnsubscribeThankYouPage) },

  { path: '/accept-invite', element: withPage(AcceptInvitePage) },
  { path: '/accept-freelancer-invite', element: withPage(AcceptFreelancerInvitePage) },
  { path: '/careers/:orgSlug', element: withPage(CareersPage) },
  { path: '/careers/:orgSlug/jobs/:jobId', element: withPage(JobDetailPublic) },
  { path: '/partners/:orgSlug', element: withPage(PartnerSignupPage) },
  { path: '/portal', element: withPage(CandidatePortal) },
  { path: '/assessment/:token', element: withPage(AssessmentTakePage) },
  { path: '/trust', element: withPage(TrustCenterPage) },
  { path: '/status', element: withPage(StatusPage) },
  { path: '/book/:tokenOrSlug', element: withPage(SelfBookPage) },
  { path: '/survey/:token', element: withPage(SurveyTakePage) },
  { path: '/embed/chatbot/:orgSlug', element: withPage(EmbedChatbotPage) },
  { path: '/pricing', element: withPage(MarketingPage) },
  { path: '/features', element: withPage(MarketingPage) },
  { path: '/enterprise', element: withPage(MarketingPage) },
  { path: '/security', element: withPage(MarketingPage) },
  { path: '/integrations', element: withPage(MarketingPage) },
  { path: '/ai-automation', element: withPage(MarketingPage) },
  { path: '/faq', element: withPage(FAQPage) },
  { path: '/contact', element: withPage(ContactPage) },
  { path: '/privacy', element: withPage(MarketingPage) },
  { path: '/terms', element: withPage(MarketingPage) },
  { path: '/customers', element: withPage(MarketingPage) },

  { path: '/onboarding', element: <ProtectedRoute>{withPage(OnboardingPage)}</ProtectedRoute> },
  { path: '/onboarding/create-org', element: <ProtectedRoute>{withPage(OnboardingPage)}</ProtectedRoute> },
  { path: '/onboarding/invite', element: <ProtectedRoute>{withPage(OnboardingPage)}</ProtectedRoute> },
  { path: '/sso/callback', element: withPage(SSOCallbackPage) },

  // ── Authenticated app shell (content-only navigation) ──────────────
  {
    element: <AppShell />,
    errorElement: <RouteErrorPage />,
    children: [
      { path: '/dashboard', element: withPage(DashboardPage) },
      { path: '/analytics', element: withPage(AnalyticsDashboard) },
      { path: '/jobs', element: withPage(Jobs) },
      { path: '/mandates', element: withPage(MandatesPage) },
      { path: '/my-pipeline', element: withPage(FreelancerPipelinePage) },
      { path: '/feedback', element: <ProtectedRoute requiredRoles={['freelancer']}>{withPage(SupportFeedbackPage)}</ProtectedRoute> },
      { path: '/support-desk', element: withPage(CompanySupportDeskPage) },
      { path: '/trial-requests', element: withPage(TrialRequestsPage) },
      { path: '/freelance-review', element: withPage(FreelanceReviewPage) },
      { path: '/freelancer-applications', element: <ProtectedRoute requiredRoles={['owner', 'admin']}>{withPage(FreelancerApplicationsPage)}</ProtectedRoute> },
      { path: '/applications', element: withPage(ApplicationsPage) },
      { path: '/recruitment', element: withPage(ApplicationsPage) },
      { path: '/ats', element: withPage(ATSPage) },
      { path: '/mis', element: <ProtectedRoute requiredRoles={['owner', 'admin', 'hr_manager', 'hr_recruiter', 'recruiter', 'sales']}>{withPage(MisPage)}</ProtectedRoute> },
      { path: '/mis-reports', element: <ProtectedRoute requiredRoles={['owner', 'admin', 'hr_manager', 'hr_recruiter', 'recruiter', 'sales']}>{withPage(MisReportsPage)}</ProtectedRoute> },
      { path: '/add-candidate', element: <Navigate to="/ats?add=1" replace /> },
      { path: '/resume-parsing', element: withPage(ResumeParsing) },
      { path: '/candidate-search', element: withPage(CandidateSearch) },
      { path: '/talent-pools', element: withPage(TalentPoolsPage) },
      { path: '/skills', element: withPage(SkillsPage) },
      { path: '/positions', element: withPage(PositionsPage) },
      { path: '/inbox', element: withPage(InboxPage) },
      { path: '/inbox/:threadId', element: withPage(InboxPage) },
      { path: '/sequences', element: <ProtectedRoute internalPreview>{withPage(SequencesPage)}</ProtectedRoute> },
      { path: '/dei', element: <ProtectedRoute internalPreview>{withPage(DeiPage)}</ProtectedRoute> },
      { path: '/form-builder', element: <ProtectedRoute internalPreview>{withPage(FormBuilderPage)}</ProtectedRoute> },
      { path: '/organization/chatbot', element: withPage(ChatbotSettingsPage) },
      { path: '/assessments', element: withPage(AssessmentsPage) },
      { path: '/ai-tools', element: withPage(AiToolsPage) },
      { path: '/search', element: <ProtectedRoute requiredRoles={['owner', 'admin', 'hr_manager', 'hr_recruiter', 'recruiter', 'sales', 'interviewer', 'readonly']}>{withPage(GlobalSearchPage)}</ProtectedRoute> },
      { path: '/collaboration', element: <ProtectedRoute internalPreview>{withPage(CandidateCollaborationPage)}</ProtectedRoute> },
      { path: '/my-team', element: withPage(MyTeamPage) },
      { path: '/scorecard-templates', element: <ProtectedRoute internalPreview>{withPage(ScorecardTemplatesPage)}</ProtectedRoute> },
      { path: '/messaging-consent', element: <ProtectedRoute internalPreview>{withPage(MessagingConsentPage)}</ProtectedRoute> },
      { path: '/announcements', element: withPage(AnnouncementsPage) },
      { path: '/reports-studio', element: withPage(ReportsStudioPage) },
      { path: '/company-brand', element: withPage(CompanyBrandPage) },
      { path: '/notification-settings', element: withPage(NotificationSettingsPage) },
      { path: '/push-notifications', element: withPage(PushNotificationsPage) },

      { path: '/auto-import', element: withPage(AutoImportPage) },
      { path: '/pending-review', element: withPage(PendingReviewWorkbench) },
      { path: '/homeunder', element: <Navigate to="/dashboard" replace /> },
      { path: '/manage-positions', element: <Navigate to="/positions" replace /> },
      { path: '/manage-clients', element: <Navigate to="/ats" replace /> },
      { path: '/manage-sources', element: <Navigate to="/ats" replace /> },
      { path: '/manage-ctc', element: <Navigate to="/ats" replace /> },
      { path: '/manage-notice', element: <Navigate to="/ats" replace /> },
      { path: '/email-templates', element: withPage(EmailTemplatesPage) },
      { path: '/email-settings', element: withPage(EmailSettingsPage) },
      { path: '/email-reports', element: withPage(EmailReportsPage) },
      { path: '/settings', element: withPage(ProfileSettingsPage) },
      { path: '/profile', element: <Navigate to="/settings" replace /> },
      { path: '/profile/*', element: <Navigate to="/settings" replace /> },
      { path: '/team', element: <ProtectedRoute requiredRoles={['owner', 'admin', 'hr_manager']}>{withPage(TeamPage)}</ProtectedRoute> },
      { path: '/interviews', element: withPage(InterviewsPage) },
      { path: '/organization', element: withPage(OrganizationSettingsPage) },
      { path: '/organization/integrations', element: withPage(IntegrationSettingsPage) },
      { path: '/organization/audit-log', element: withPage(AuditLogPage) },
      { path: '/organization/custom-roles', element: withPage(CustomRolesPage) },
      { path: '/organization/candidate-fields', element: withPage(CandidateFieldsPage) },
      { path: '/organization/white-label', element: withPage(WhiteLabelSettingsPage) },
      { path: '/organization/chrome-extension', element: withPage(ChromeExtensionSettingsPage) },
      { path: '/organization/sso', element: withPage(SSOSettingsPage) },
      { path: '/organization/security', element: withPage(SecuritySettingsPage) },
      { path: '/organization/approvals', element: <ProtectedRoute internalPreview>{withPage(ApprovalsPage)}</ProtectedRoute> },
      { path: '/organization/referrals', element: <ProtectedRoute internalPreview>{withPage(ReferralsPage)}</ProtectedRoute> },
      { path: '/organization/webhooks-api', element: withPage(WebhooksApiPage) },
      { path: '/organization/scheduled-reports', element: withPage(ScheduledReportsPage) },
      { path: '/billing', element: withPage(BillingPage) },
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
