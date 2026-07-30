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
import DashboardLayout from './components/DashboardLayout'

const OnboardingPage = React.lazy(() => import('./components/OnboardingPage'))
const AcceptInvitePage = React.lazy(() => import('./components/AcceptInvitePage'))
const OrganizationSettingsPage = React.lazy(() => import('./components/OrganizationSettingsPage'))
const IntegrationSettingsPage = React.lazy(() => import('./components/IntegrationSettingsPage'))
const BillingPage = React.lazy(() => import('./components/BillingPage'))
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
  { path: '/dashboard', element: <ProtectedRoute><DashboardLayout><DashboardPage /></DashboardLayout></ProtectedRoute> },
  { path: '/ats', element: <ProtectedRoute><DashboardLayout><ATSPage /></DashboardLayout></ProtectedRoute> },
  { path: '/add-candidate', element: <ProtectedRoute><DashboardLayout><AddCandidatePage /></DashboardLayout></ProtectedRoute> },
  { path: '/resume-parsing', element: <ProtectedRoute><DashboardLayout><ResumeParsing /></DashboardLayout></ProtectedRoute> },
  { path: '/auto-import', element: <ProtectedRoute><DashboardLayout><AutoImportPage /></DashboardLayout></ProtectedRoute> },
  { path: '/pending-review', element: <ProtectedRoute><DashboardLayout><PendingReviewPage /></DashboardLayout></ProtectedRoute> },
  { path: '/homeunder', element: <ProtectedRoute><DashboardLayout><Homeunder /></DashboardLayout></ProtectedRoute> },
  { path: '/jobs', element: <ProtectedRoute><DashboardLayout><Jobs /></DashboardLayout></ProtectedRoute> },
  { path: '/recruitment', element: <ProtectedRoute><DashboardLayout><Recruitment /></DashboardLayout></ProtectedRoute> },
  { path: '/analytics', element: <ProtectedRoute><DashboardLayout><AnalyticsDashboard /></DashboardLayout></ProtectedRoute> },
  { path: '/candidate-search', element: <ProtectedRoute><DashboardLayout><CandidateSearch /></DashboardLayout></ProtectedRoute> },
  { path: '/manage-positions', element: <ProtectedRoute><DashboardLayout><ManageMasterData key="positions" title="Positions" apiEndpoint="/api/positions" navigateBack="/dashboard" /></DashboardLayout></ProtectedRoute> },
  { path: '/manage-clients', element: <ProtectedRoute><DashboardLayout><ManageMasterData key="clients" title="Clients" apiEndpoint="/api/clients" navigateBack="/dashboard" /></DashboardLayout></ProtectedRoute> },
  { path: '/manage-sources', element: <ProtectedRoute><DashboardLayout><ManageMasterData key="sources" title="Sources" apiEndpoint="/api/sources" navigateBack="/dashboard" /></DashboardLayout></ProtectedRoute> },
  { path: '/email-templates', element: <ProtectedRoute><DashboardLayout><EmailTemplatesPage /></DashboardLayout></ProtectedRoute> },
  { path: '/email-settings', element: <ProtectedRoute><DashboardLayout><EmailSettingsPage /></DashboardLayout></ProtectedRoute> },
  { path: '/settings', element: <ProtectedRoute><DashboardLayout><ProfileSettingsPage /></DashboardLayout></ProtectedRoute> },
  { path: '/team', element: <ProtectedRoute><DashboardLayout><TeamPage /></DashboardLayout></ProtectedRoute> },
  
  // New SaaS Protected Routes
  { path: '/applications', element: <ProtectedRoute requiredRoles={['owner', 'admin', 'recruiter']}><DashboardLayout><Suspense fallback={<LoadingFallback />}><ApplicationsPage /></Suspense></DashboardLayout></ProtectedRoute> },
  { path: '/interviews', element: <ProtectedRoute requiredRoles={['owner', 'admin', 'recruiter', 'interviewer']}><DashboardLayout><Suspense fallback={<LoadingFallback />}><InterviewsPage /></Suspense></DashboardLayout></ProtectedRoute> },
  { path: '/organization', element: <ProtectedRoute requiredRoles={['owner', 'admin']}><DashboardLayout><Suspense fallback={<LoadingFallback />}><OrganizationSettingsPage /></Suspense></DashboardLayout></ProtectedRoute> },
  { path: '/organization/integrations', element: <ProtectedRoute requiredRoles={['owner', 'admin']}><DashboardLayout><Suspense fallback={<LoadingFallback />}><IntegrationSettingsPage /></Suspense></DashboardLayout></ProtectedRoute> },
  { path: '/billing', element: <ProtectedRoute requiredRoles={['owner']}><DashboardLayout><Suspense fallback={<LoadingFallback />}><BillingPage /></Suspense></DashboardLayout></ProtectedRoute> },
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