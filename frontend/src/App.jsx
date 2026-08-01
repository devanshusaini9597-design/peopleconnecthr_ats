import React, { Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { GlobalLoaderProvider } from './context/GlobalLoaderContext';
import GlobalLoader from './components/GlobalLoader';
import { AuthProvider } from './context/AuthContext';

import Home from './components/Home'
import Login from './components/Login'
import Register from './components/Register'
import ResetPasswordPage from './components/ResetPasswordPage'
import SubscribePage from './components/SubscribePage'
import SubscribeThankYouPage from './components/SubscribeThankYouPage'
import UnsubscribePage from './components/UnsubscribePage'
import UnsubscribeThankYouPage from './components/UnsubscribeThankYouPage'
import DashboardPage from './components/DashboardPage'
import ATSPage from './components/ATSPage'
import AddCandidatePage from './components/AddCandidatePage'
import ResumeParsing from './components/ResumeParsing'
import AutoImportPage from './components/AutoImportPage'
import PendingReviewPage from './components/PendingReviewPage'
import Homeunder from './components/Homeunder'
import Jobs from './pages/Jobs'
import AnalyticsDashboard from './components/AnalyticsDashboard'
import CandidateSearch from './components/CandidateSearch'
import ManageMasterData from './components/ManageMasterData'
import EmailTemplatesPage from './components/EmailTemplatesPage'
import EmailSettingsPage from './components/EmailSettingsPage'
import ProfileSettingsPage from './components/ProfileSettingsPage'
import TeamPage from './components/TeamPage'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

const OnboardingPage = React.lazy(() => import('./components/OnboardingPage'))
const AcceptInvitePage = React.lazy(() => import('./components/AcceptInvitePage'))
const OrganizationSettingsPage = React.lazy(() => import('./components/OrganizationSettingsPage'))
const IntegrationSettingsPage = React.lazy(() => import('./components/IntegrationSettingsPage'))
const AuditLogPage = React.lazy(() => import('./components/AuditLogPage'))
const CustomRolesPage = React.lazy(() => import('./components/CustomRolesPage'))
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

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-[50vh] p-8">
    <div className="text-center">
      <div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      <p className="text-sm font-medium text-stone-500">Loading…</p>
    </div>
  </div>
);

/** Persistent shell — sidebar/header stay mounted; only Outlet content swaps (AJAX feel). */
const AppShell = ({ requiredRoles }) => (
  <ProtectedRoute requiredRoles={requiredRoles}>
    <Layout />
  </ProtectedRoute>
);

const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/subscribe', element: <SubscribePage /> },
  { path: '/subscribe/thank-you', element: <SubscribeThankYouPage /> },
  { path: '/unsubscribe', element: <UnsubscribePage /> },
  { path: '/unsubscribe/thank-you', element: <UnsubscribeThankYouPage /> },

  { path: '/accept-invite', element: <Suspense fallback={<LoadingFallback />}><AcceptInvitePage /></Suspense> },
  { path: '/careers/:orgSlug', element: <Suspense fallback={<LoadingFallback />}><CareersPage /></Suspense> },
  { path: '/careers/:orgSlug/jobs/:jobId', element: <Suspense fallback={<LoadingFallback />}><JobDetailPublic /></Suspense> },
  { path: '/portal', element: <Suspense fallback={<LoadingFallback />}><CandidatePortal /></Suspense> },
  { path: '/assessment/:token', element: <Suspense fallback={<LoadingFallback />}><AssessmentTakePage /></Suspense> },

  { path: '/onboarding', element: <ProtectedRoute><Suspense fallback={<LoadingFallback />}><OnboardingPage /></Suspense></ProtectedRoute> },
  { path: '/onboarding/create-org', element: <ProtectedRoute><Suspense fallback={<LoadingFallback />}><OnboardingPage /></Suspense></ProtectedRoute> },
  { path: '/onboarding/invite', element: <ProtectedRoute><Suspense fallback={<LoadingFallback />}><OnboardingPage /></Suspense></ProtectedRoute> },
  { path: '/sso/callback', element: <Suspense fallback={<LoadingFallback />}><SSOCallbackPage /></Suspense> },

  // ── Authenticated app shell (content-only navigation) ──────────────
  {
    element: <AppShell />,
    children: [
      // Main
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/analytics', element: <AnalyticsDashboard /> },

      // Recruitment
      { path: '/jobs', element: <Jobs /> },
      { path: '/applications', element: <Suspense fallback={<LoadingFallback />}><ApplicationsPage /></Suspense> },
      { path: '/recruitment', element: <Suspense fallback={<LoadingFallback />}><ApplicationsPage /></Suspense> },
      { path: '/ats', element: <ATSPage /> },
      { path: '/add-candidate', element: <AddCandidatePage /> },
      { path: '/resume-parsing', element: <ResumeParsing /> },
      { path: '/candidate-search', element: <CandidateSearch /> },
      { path: '/talent-pools', element: <Suspense fallback={<LoadingFallback />}><TalentPoolsPage /></Suspense> },
      { path: '/assessments', element: <Suspense fallback={<LoadingFallback />}><AssessmentsPage /></Suspense> },

      // Related / shared
      { path: '/auto-import', element: <AutoImportPage /> },
      { path: '/pending-review', element: <PendingReviewPage /> },
      { path: '/homeunder', element: <Homeunder /> },
      { path: '/manage-positions', element: <ManageMasterData key="positions" title="Positions" apiEndpoint="/api/positions" navigateBack="/dashboard" /> },
      { path: '/manage-clients', element: <ManageMasterData key="clients" title="Clients" apiEndpoint="/api/clients" navigateBack="/dashboard" /> },
      { path: '/manage-sources', element: <ManageMasterData key="sources" title="Sources" apiEndpoint="/api/sources" navigateBack="/dashboard" /> },
      { path: '/email-templates', element: <EmailTemplatesPage /> },
      { path: '/email-settings', element: <EmailSettingsPage /> },
      { path: '/settings', element: <ProfileSettingsPage /> },
      { path: '/team', element: <TeamPage /> },
      { path: '/interviews', element: <Suspense fallback={<LoadingFallback />}><InterviewsPage /></Suspense> },
      { path: '/organization', element: <Suspense fallback={<LoadingFallback />}><OrganizationSettingsPage /></Suspense> },
      { path: '/organization/integrations', element: <Suspense fallback={<LoadingFallback />}><IntegrationSettingsPage /></Suspense> },
      { path: '/organization/audit-log', element: <Suspense fallback={<LoadingFallback />}><AuditLogPage /></Suspense> },
      { path: '/organization/custom-roles', element: <Suspense fallback={<LoadingFallback />}><CustomRolesPage /></Suspense> },
      { path: '/organization/white-label', element: <Suspense fallback={<LoadingFallback />}><WhiteLabelSettingsPage /></Suspense> },
      { path: '/organization/chrome-extension', element: <Suspense fallback={<LoadingFallback />}><ChromeExtensionSettingsPage /></Suspense> },
      { path: '/organization/sso', element: <Suspense fallback={<LoadingFallback />}><SSOSettingsPage /></Suspense> },
      { path: '/organization/webhooks-api', element: <Suspense fallback={<LoadingFallback />}><WebhooksApiPage /></Suspense> },
      { path: '/organization/scheduled-reports', element: <Suspense fallback={<LoadingFallback />}><ScheduledReportsPage /></Suspense> },
      { path: '/billing', element: <Suspense fallback={<LoadingFallback />}><BillingPage /></Suspense> },
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
