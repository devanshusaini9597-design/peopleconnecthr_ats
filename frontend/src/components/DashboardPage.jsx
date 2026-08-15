import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageHeader from './ui/PageHeader';
import CallbackRemindersWidget from './CallbackRemindersWidget';
import WelcomeModal from './WelcomeModal';
import ProductTour, { shouldAutoStartTour } from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import { LayoutDashboard, UserPlus, BarChart3, Briefcase } from 'lucide-react';
import { BASE_API_URL } from '../config';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import { useAuth } from '../context/AuthContext';
import { DASH_TOUR_KEY, DASH_TOUR_STEPS, FREELANCER_DASH_TOUR_KEY, FREELANCER_DASH_TOUR_STEPS } from './dashboard/dashboardConstants';
import { DashboardKpis, DashboardMainGrid, DashboardLowerGrid } from './dashboard/DashboardPanels';
import FreelancerDashboard from './dashboard/FreelancerDashboard';

const DashboardPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, isLoading: authLoading } = useAuth();
  const userEmail = user?.email || 'User';
  const userName = user?.name || '';
  const displayName = userName || (userEmail.includes('@') ? userEmail.split('@')[0] : userEmail);

  const [dashData, setDashData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    if (authLoading) return undefined;
    if (user?.role === 'freelancer') {
      setLoading(false);
      return undefined;
    }
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const res = await authenticatedFetch(`${BASE_API_URL}/api/analytics/dashboard-stats`);
        if (isUnauthorized(res)) return handleUnauthorized();
        if (!res.ok) {
          let detail = '';
          try {
            const body = await res.json();
            detail = body?.error || body?.message || '';
          } catch { /* ignore */ }
          throw new Error(detail || `Dashboard stats failed (${res.status})`);
        }
        const data = await res.json();
        setDashData(data);
        setError(null);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
        setError(t('pages.dashboard.loadError'));
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
    return undefined;
  }, [t, authLoading, user?.role]);

  useEffect(() => {
    if (loading) return;
    if (sessionStorage.getItem('showWelcomeModal') === '1') {
      sessionStorage.removeItem('showWelcomeModal');
      setShowWelcome(true);
    } else if (shouldAutoStartTour(user?.role === 'freelancer' ? FREELANCER_DASH_TOUR_KEY : DASH_TOUR_KEY)) {
      const t = setTimeout(() => setTourOpen(true), 500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [loading]);

  if (loading) {
    return (
      <div className="page-shell-ats animate-page-enter">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl skeleton-ats flex-shrink-0" />
          <div className="space-y-2 flex-1 pt-1">
            <div className="h-7 w-56 skeleton-ats rounded-lg" />
            <div className="h-4 w-72 max-w-full skeleton-ats rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-[118px] skeleton-ats rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">
          <div className="lg:col-span-2 h-80 skeleton-ats rounded-2xl" />
          <div className="h-80 skeleton-ats rounded-2xl" />
        </div>
      </div>
    );
  }

  const d = dashData || {};
  const isFreelancer = user?.role === 'freelancer';
  const tourKey = isFreelancer ? FREELANCER_DASH_TOUR_KEY : DASH_TOUR_KEY;
  const tourSteps = isFreelancer ? FREELANCER_DASH_TOUR_STEPS : DASH_TOUR_STEPS;

  return (
    <div className="page-shell-ats animate-page-enter">
      <WelcomeModal
        open={showWelcome}
        onClose={() => setShowWelcome(false)}
        displayName={displayName}
      />
      <PageHeader
        icon={LayoutDashboard}
        title={t('pages.dashboard.welcome', { name: displayName })}
        subtitle={isFreelancer
          ? `Your freelance desk · ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`
          : t('pages.dashboard.subtitle', {
            period: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
          })}
        gradientTitle
      >
        {isFreelancer ? (
          <button type="button" onClick={() => navigate('/mandates')} className="btn-secondary flex-1 sm:flex-none">
            <Briefcase size={16} /> Open Mandates
          </button>
        ) : (
          <button type="button" onClick={() => navigate('/analytics')} className="btn-secondary flex-1 sm:flex-none">
            <BarChart3 size={16} /> {t('pages.dashboard.analytics')}
          </button>
        )}
        <button type="button" onClick={() => navigate('/ats?add=1')} className="btn-primary flex-1 sm:flex-none">
          <UserPlus size={16} /> {t('pages.dashboard.addCandidate')}
        </button>
      </PageHeader>

      {isFreelancer ? (
        <FreelancerDashboard />
      ) : (
        <>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium animate-fade-in">
              {error}. {t('common.showingCached')}
            </div>
          )}
          <DashboardKpis d={d} navigate={navigate} isFreelancer={false} />
          <DashboardMainGrid d={d} navigate={navigate} isFreelancer={false} />
          <CallbackRemindersWidget />
          <DashboardLowerGrid d={d} navigate={navigate} isFreelancer={false} />
        </>
      )}

      <TourHelpFab
        onClick={() => setTourOpen(true)}
        label={t('common.takeTour')}
        title={t('pages.dashboard.tourTitle')}
      />
      <ProductTour
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        steps={tourSteps}
        storageKey={tourKey}
      />
    </div>
  );
};

export default DashboardPage;
