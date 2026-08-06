import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from './ui/PageHeader';
import CallbackRemindersWidget from './CallbackRemindersWidget';
import WelcomeModal from './WelcomeModal';
import ProductTour, { shouldAutoStartTour } from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import { LayoutDashboard, UserPlus, BarChart3 } from 'lucide-react';
import { BASE_API_URL } from '../config';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import { DASH_TOUR_KEY, DASH_TOUR_STEPS } from './dashboard/dashboardConstants';
import { DashboardKpis, DashboardMainGrid, DashboardLowerGrid } from './dashboard/DashboardPanels';

const DashboardPage = () => {
  const navigate = useNavigate();
  const userEmail = localStorage.getItem('userEmail') || 'User';
  const userName = localStorage.getItem('userName') || '';
  const displayName = userName || (userEmail.includes('@') ? userEmail.split('@')[0] : userEmail);

  const [dashData, setDashData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const res = await authenticatedFetch(`${BASE_API_URL}/api/analytics/dashboard-stats`);
        if (isUnauthorized(res)) return handleUnauthorized();
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setDashData(data);
        setError(null);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
        setError('Could not load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (loading) return;
    if (sessionStorage.getItem('showWelcomeModal') === '1') {
      sessionStorage.removeItem('showWelcomeModal');
      setShowWelcome(true);
    } else if (shouldAutoStartTour(DASH_TOUR_KEY)) {
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

  return (
    <div className="page-shell-ats animate-page-enter">
      <WelcomeModal
        open={showWelcome}
        onClose={() => setShowWelcome(false)}
        displayName={displayName}
      />
      <PageHeader
        icon={LayoutDashboard}
        title={`Welcome back, ${displayName}`}
        subtitle={`Recruitment overview for ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}.`}
        gradientTitle
      >
        <button type="button" onClick={() => navigate('/analytics')} className="btn-secondary flex-1 sm:flex-none">
          <BarChart3 size={16} /> Analytics
        </button>
        <button type="button" onClick={() => navigate('/ats?add=1')} className="btn-primary flex-1 sm:flex-none">
          <UserPlus size={16} /> Add Candidate
        </button>
      </PageHeader>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium animate-fade-in">
          {error}. Showing cached data if available.
        </div>
      )}

      <DashboardKpis d={d} navigate={navigate} />
      <DashboardMainGrid d={d} navigate={navigate} />
      <CallbackRemindersWidget />
      <DashboardLowerGrid d={d} navigate={navigate} />

      <TourHelpFab
        onClick={() => setTourOpen(true)}
        label="Take a tour"
        title="Take a tour of the dashboard"
      />
      <ProductTour
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        steps={DASH_TOUR_STEPS}
        storageKey={DASH_TOUR_KEY}
      />
    </div>
  );
};

export default DashboardPage;
