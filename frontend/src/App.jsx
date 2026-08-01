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
import Recruitment from './components/Recruitment'
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

const LoadingFallback = () => <div className="p-8 text-center flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div></div>;

const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/subscribe', element: <SubscribePage /> },
  { path: '/subscribe/thank-you', element: <SubscribeThankYouPage /> },
  { path: '/unsubscribe', element: <UnsubscribePage /> },
  { path: '/unsubscribe/thank-you', element: <UnsubscribeThankYouPage /> },
  
  // Public SaaS Routes
  { path: '/accept-invite', element: <Suspense fallback={<LoadingFallback />}><AcceptInvitePage /></Suspense> },
  { path: '/careers/:orgSlug', element: <Suspense fallback={<LoadingFallback />}><CareersPage /></Suspense> },
  { path: '/careers/:orgSlug/jobs/:jobId', element: <Suspense fallback={<LoadingFallback />}><JobDetailPublic /></Suspense> },
  { path: '/portal', element: <Suspense fallback={<LoadingFallback />}><CandidatePortal /></Suspense> },

  // Protected Onboarding Routes (no org required)
  { path: '/onboarding', element: <ProtectedRoute><Suspense fallback={<LoadingFallback />}><OnboardingPage /></Suspense></ProtectedRoute> },
  { path: '/onboarding/create-org', element: <ProtectedRoute><Suspense fallback={<LoadingFallback />}><OnboardingPage /></Suspense></ProtectedRoute> },
  { path: '/onboarding/invite', element: <ProtectedRoute><Suspense fallback={<LoadingFallback />}><OnboardingPage /></Suspense></ProtectedRoute> },

  // Protected Dashboard Routes
  // Pages below already render their own SkillNix sidebar/header (via <Layout> or
  // Sidebar+Header directly) internally, so the route just needs the auth gate.
  { path: '/dashboard', element: <ProtectedRoute><DashboardPage /></ProtectedRoute> },
  { path: '/ats', element: <ProtectedRoute><ATSPage /></ProtectedRoute> },
  { path: '/add-candidate', element: <ProtectedRoute><AddCandidatePage /></ProtectedRoute> },
  { path: '/resume-parsing', element: <ProtectedRoute><ResumeParsing /></ProtectedRoute> },
  { path: '/auto-import', element: <ProtectedRoute><AutoImportPage /></ProtectedRoute> },
  { path: '/pending-review', element: <ProtectedRoute><PendingReviewPage /></ProtectedRoute> },
  { path: '/analytics', element: <ProtectedRoute><AnalyticsDashboard /></ProtectedRoute> },
  { path: '/manage-positions', element: <ProtectedRoute><ManageMasterData key="positions" title="Positions" apiEndpoint="/api/positions" navigateBack="/dashboard" /></ProtectedRoute> },
  { path: '/manage-clients', element: <ProtectedRoute><ManageMasterData key="clients" title="Clients" apiEndpoint="/api/clients" navigateBack="/dashboard" /></ProtectedRoute> },
  { path: '/manage-sources', element: <ProtectedRoute><ManageMasterData key="sources" title="Sources" apiEndpoint="/api/sources" navigateBack="/dashboard" /></ProtectedRoute> },
  { path: '/email-templates', element: <ProtectedRoute><EmailTemplatesPage /></ProtectedRoute> },
  { path: '/email-settings', element: <ProtectedRoute><EmailSettingsPage /></ProtectedRoute> },
  { path: '/settings', element: <ProtectedRoute><ProfileSettingsPage /></ProtectedRoute> },
  { path: '/team', element: <ProtectedRoute><TeamPage /></ProtectedRoute> },

  // Pages below render bare content and rely on the route to supply the
  // SkillNix Layout (sidebar/header) — previously this was the leftover
  // PeopleConnect DashboardLayout, now standardized on the real Layout.
  { path: '/homeunder', element: <ProtectedRoute><Layout><Homeunder /></Layout></ProtectedRoute> },
  { path: '/jobs', element: <ProtectedRoute><Layout><Jobs /></Layout></ProtectedRoute> },
  { path: '/recruitment', element: <ProtectedRoute><Layout><Recruitment /></Layout></ProtectedRoute> },
  { path: '/candidate-search', element: <ProtectedRoute><Layout><CandidateSearch /></Layout></ProtectedRoute> },

  // New SaaS Protected Routes
  { path: '/applications', element: <ProtectedRoute requiredRoles={['owner', 'admin', 'recruiter']}><Layout><Suspense fallback={<LoadingFallback />}><ApplicationsPage /></Suspense></Layout></ProtectedRoute> },
  { path: '/interviews', element: <ProtectedRoute requiredRoles={['owner', 'admin', 'recruiter', 'interviewer']}><Layout><Suspense fallback={<LoadingFallback />}><InterviewsPage /></Suspense></Layout></ProtectedRoute> },
  { path: '/organization', element: <ProtectedRoute requiredRoles={['owner', 'admin']}><Layout><Suspense fallback={<LoadingFallback />}><OrganizationSettingsPage /></Suspense></Layout></ProtectedRoute> },
  { path: '/organization/integrations', element: <ProtectedRoute requiredRoles={['owner', 'admin']}><Layout><Suspense fallback={<LoadingFallback />}><IntegrationSettingsPage /></Suspense></Layout></ProtectedRoute> },
  { path: '/organization/audit-log', element: <ProtectedRoute requiredRoles={['owner', 'admin']}><Layout><Suspense fallback={<LoadingFallback />}><AuditLogPage /></Suspense></Layout></ProtectedRoute> },
  { path: '/organization/custom-roles', element: <ProtectedRoute requiredRoles={['owner', 'admin']}><Layout><Suspense fallback={<LoadingFallback />}><CustomRolesPage /></Suspense></Layout></ProtectedRoute> },
  { path: '/organization/sso', element: <ProtectedRoute requiredRoles={['owner', 'admin']}><Layout><Suspense fallback={<LoadingFallback />}><SSOSettingsPage /></Suspense></Layout></ProtectedRoute> },
  { path: '/sso/callback', element: <Suspense fallback={<LoadingFallback />}><SSOCallbackPage /></Suspense> },
  { path: '/billing', element: <ProtectedRoute requiredRoles={['owner']}><Layout><Suspense fallback={<LoadingFallback />}><BillingPage /></Suspense></Layout></ProtectedRoute> },
  { path: '/organization/webhooks-api', element: <ProtectedRoute requiredRoles={['owner', 'admin']}><Layout><Suspense fallback={<LoadingFallback />}><WebhooksApiPage /></Suspense></Layout></ProtectedRoute> },
  { path: '/organization/scheduled-reports', element: <ProtectedRoute requiredRoles={['owner', 'admin']}><Layout><Suspense fallback={<LoadingFallback />}><ScheduledReportsPage /></Suspense></Layout></ProtectedRoute> },
]);

function App() {
  return (
    <AuthProvider>
      <GlobalLoaderProvider>
        <GlobalLoader />
        <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <RouterProvider router={router} />
        </div>
      </GlobalLoaderProvider>
    </AuthProvider>
  );
}

export default App;