import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageHeader from './ui/PageHeader';
import CallbackRemindersWidget from './CallbackRemindersWidget';
import DashboardRecentJobsWidget from './dashboard/DashboardRecentJobsWidget';
import WelcomeModal from './WelcomeModal';
import ProductTour, { shouldAutoStartTour } from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import { LayoutDashboard, UserPlus, BarChart3, Briefcase, RefreshCw, Megaphone, ChevronRight, Info } from 'lucide-react';
import { BASE_API_URL } from '../config';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import { useAuth } from '../context/AuthContext';
import { DASH_TOUR_KEY, DASH_TOUR_STEPS, FREELANCER_DASH_TOUR_KEY, FREELANCER_DASH_TOUR_STEPS } from './dashboard/dashboardConstants';
import { DashboardKpis, DashboardMainGrid, DashboardLowerGrid } from './dashboard/DashboardPanels';
import FreelancerDashboard from './dashboard/FreelancerDashboard';
import DashboardPeriodBar from './dashboard/DashboardPeriodBar';
import useAnnouncementNavUpdates from '../hooks/useAnnouncementNavUpdates';
import useJobNavUpdates from '../hooks/useJobNavUpdates';
import { appendAnalyticsParams } from '../utils/analyticsScope';
import { DATE_RANGE_LABELS } from './analytics/constants';
import { AnalyticsInlineLoader, AnalyticsPanelOverlay } from './analytics/AnalyticsPanelLoader';

const AUTO_REFRESH_MS = 45_000;

const DashboardPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, isLoading: authLoading } = useAuth();
  const userEmail = user?.email || 'User';
  const userName = user?.name || '';
  const displayName = userName || (userEmail.includes('@') ? userEmail.split('@')[0] : userEmail);
  const isFreelancer = user?.role === 'freelancer';
  const [searchParams, setSearchParams] = useSearchParams();
  const unreadAnnouncements = useAnnouncementNavUpdates();
  const newJobsCount = useJobNavUpdates();

  const dateRange = searchParams.get('period') || 'month';
  const customFrom = searchParams.get('from') || '';
  const customTo = searchParams.get('to') || '';
  const periodReady = dateRange !== 'custom' || (customFrom && customTo);

  const setDateRange = (value) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'all') next.delete('period');
    else next.set('period', value);
    if (value !== 'custom') {
      next.delete('from');
      next.delete('to');
    }
    setSearchParams(next, { replace: true });
  };
  const setCustomFrom = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set('from', value);
    else next.delete('from');
    setSearchParams(next, { replace: true });
  };
  const setCustomTo = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set('to', value);
    else next.delete('to');
    setSearchParams(next, { replace: true });
  };

  const periodLabel = dateRange === 'custom' && customFrom && customTo
    ? `${new Date(customFrom).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – ${new Date(customTo).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
    : DATE_RANGE_LABELS[dateRange] || DATE_RANGE_LABELS.month;

  const [dashData, setDashData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const hasLoadedRef = useRef(false);

  const fetchDashboardData = useCallback(async ({ silent = false } = {}) => {
    if (isFreelancer) {
      setLoading(false);
      setRefreshing(true);
      window.dispatchEvent(new CustomEvent('dashboard:refresh', { detail: { silent } }));
      setUpdatedAt(new Date());
      window.setTimeout(() => setRefreshing(false), 900);
      return;
    }
    if (!periodReady) {
      setLoading(false);
      setStatsLoading(false);
      setRefreshing(false);
      return;
    }

    const isRefetch = hasLoadedRef.current;
    if (silent) setRefreshing(true);
    else if (isRefetch) setStatsLoading(true);
    else setLoading(true);

    try {
      const url = appendAnalyticsParams(`${BASE_API_URL}/api/analytics/dashboard-stats`, {
        dateRange,
        customFrom: dateRange === 'custom' ? customFrom : undefined,
        customTo: dateRange === 'custom' ? customTo : undefined,
      });
      const res = await authenticatedFetch(url, {
        cache: 'no-store',
      });
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
      hasLoadedRef.current = true;
      setUpdatedAt(new Date());
      setError(null);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      if (!silent && !hasLoadedRef.current) setError(t('pages.dashboard.loadError'));
    } finally {
      setLoading(false);
      setStatsLoading(false);
      setRefreshing(false);
    }
  }, [t, isFreelancer, dateRange, customFrom, customTo, periodReady]);

  useEffect(() => {
    if (authLoading) return undefined;
    if (isFreelancer) {
      setLoading(false);
      return undefined;
    }
    fetchDashboardData();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') fetchDashboardData({ silent: true });
    }, AUTO_REFRESH_MS);
    const onVis = () => {
      if (document.visibilityState === 'visible') fetchDashboardData({ silent: true });
    };
    const onChanged = () => fetchDashboardData({ silent: true });
    window.addEventListener('focus', onVis);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('candidates:changed', onChanged);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', onVis);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('candidates:changed', onChanged);
    };
  }, [authLoading, isFreelancer, fetchDashboardData]);

  useEffect(() => {
    if (loading) return;
    if (sessionStorage.getItem('showWelcomeModal') === '1') {
      sessionStorage.removeItem('showWelcomeModal');
      setShowWelcome(true);
    } else if (shouldAutoStartTour(isFreelancer ? FREELANCER_DASH_TOUR_KEY : DASH_TOUR_KEY)) {
      const timer = setTimeout(() => setTourOpen(true), 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [loading, isFreelancer]);

  if (loading && !dashData) {
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
          {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-[118px] skeleton-ats rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">
          <div className="lg:col-span-2 h-80 skeleton-ats rounded-2xl" />
          <div className="h-80 skeleton-ats rounded-2xl" />
        </div>
      </div>
    );
  }

  const d = dashData || {};
  const dataFresh = !dashData
    || (
      dashData.dateRange === dateRange
      && (dateRange !== 'custom' || (
        String(dashData.customFrom || '') === customFrom
        && String(dashData.customTo || '') === customTo
      ))
    );
  const uiPeriodLabel = periodLabel;
  const tourKey = isFreelancer ? FREELANCER_DASH_TOUR_KEY : DASH_TOUR_KEY;
  const tourSteps = isFreelancer ? FREELANCER_DASH_TOUR_STEPS : DASH_TOUR_STEPS;
  const updatedLabel = updatedAt
    ? updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

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
          ? `Your freelance workspace · ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`
          : t('pages.dashboard.subtitle', {
            period: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
          })}
        gradientTitle
      >
        <button
          type="button"
          onClick={() => fetchDashboardData({ silent: true })}
          disabled={refreshing || statsLoading}
          className="btn-secondary flex-1 sm:flex-none"
          title="Refresh dashboard"
        >
          <RefreshCw size={16} className={refreshing || statsLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
        {isFreelancer ? (
          <button type="button" onClick={() => navigate('/mandates')} className="btn-secondary flex-1 sm:flex-none">
            <Briefcase size={16} /> View Mandates
          </button>
        ) : null}
        <button type="button" onClick={() => navigate('/analytics')} className="btn-secondary flex-1 sm:flex-none">
          <BarChart3 size={16} /> {t('pages.dashboard.analytics')}
        </button>
        <button type="button" onClick={() => navigate('/ats?add=1')} className="btn-primary flex-1 sm:flex-none">
          <UserPlus size={16} /> {t('pages.dashboard.addCandidate')}
        </button>
      </PageHeader>
      <p className="text-[12px] text-stone-400 -mt-2 mb-1">
        {statsLoading || refreshing ? (
          <span className="text-brand-600 font-medium">Updating metrics…</span>
        ) : updatedLabel ? (
          `Updated ${updatedLabel}`
        ) : (
          'Up to date'
        )}
        {' · '}
        {isFreelancer
          ? 'Refreshes automatically every 20 seconds · Your private desk'
          : `Refreshes automatically every 45 seconds${d.scope === 'employee' ? ' · Your assigned candidates' : ''}`}
        {!isFreelancer && uiPeriodLabel ? ` · ${uiPeriodLabel}` : ''}
      </p>

      {isFreelancer ? (
        <div
          data-tour="freelancer-dash-tip"
          className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed flex flex-wrap items-center gap-x-3 gap-y-1.5"
        >
          <span className="inline-flex items-center gap-1.5 text-brand-700 font-semibold">
            <Info size={14} /> Tip
          </span>
          <span>
            Track your candidates, submissions, and shortlist rate here. Open Mandates to submit, then follow progress on My Pipeline.
            {' '}Press the help button for a tour.
          </span>
        </div>
      ) : null}

      {!isFreelancer && (
        <DashboardPeriodBar
          userRole={user?.role}
          dateRange={dateRange}
          setDateRange={setDateRange}
          customFrom={customFrom}
          setCustomFrom={setCustomFrom}
          customTo={customTo}
          setCustomTo={setCustomTo}
          periodLabel={uiPeriodLabel}
          scope={d.scope}
        />
      )}

      {!isFreelancer && dateRange === 'custom' && !periodReady && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-2.5 text-[13px] text-amber-800">
          Select both start and end dates to load dashboard stats for your custom range.
        </div>
      )}

      {isFreelancer ? (
        <FreelancerDashboard />
      ) : (
        <>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium animate-fade-in">
              {error}. {t('common.showingCached')}
            </div>
          )}
          {statsLoading && (
            <AnalyticsInlineLoader label={`Loading stats for ${uiPeriodLabel}…`} />
          )}
          {newJobsCount > 0 ? (
            <button
              type="button"
              onClick={() => navigate('/jobs')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-brand-200/80 bg-brand-50/60 text-left hover:bg-brand-50 hover:border-brand-300 transition-colors group"
            >
              <span className="flex-shrink-0 w-9 h-9 rounded-xl bg-brand-500/15 text-brand-700 inline-flex items-center justify-center">
                <Briefcase className="w-4 h-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-stone-900">
                  {newJobsCount === 1
                    ? '1 new job opening'
                    : `${newJobsCount > 9 ? '9+' : newJobsCount} new job openings`}
                </span>
                <span className="block text-xs text-stone-500 mt-0.5">
                  View the latest job openings
                </span>
              </span>
              <span className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 group-hover:gap-1.5 transition-all">
                Open
                <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </button>
          ) : null}
          {unreadAnnouncements > 0 ? (
            <button
              type="button"
              onClick={() => navigate('/announcements')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-teal-200/80 bg-teal-50/60 text-left hover:bg-teal-50 hover:border-teal-300 transition-colors group"
            >
              <span className="flex-shrink-0 w-9 h-9 rounded-xl bg-teal-500/15 text-teal-700 inline-flex items-center justify-center">
                <Megaphone className="w-4 h-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-stone-900">
                  {unreadAnnouncements === 1
                    ? '1 unread announcement'
                    : `${unreadAnnouncements > 9 ? '9+' : unreadAnnouncements} unread announcements`}
                </span>
                <span className="block text-xs text-stone-500 mt-0.5">
                  Review and acknowledge in Announcements
                </span>
              </span>
              <span className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-teal-700 group-hover:gap-1.5 transition-all">
                Open
                <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </button>
          ) : null}
          <div className="relative min-h-[280px]">
            {statsLoading && dashData && (
              <AnalyticsPanelOverlay label={`Refreshing ${uiPeriodLabel}…`} />
            )}
            <div className={statsLoading ? 'opacity-40 pointer-events-none select-none transition-opacity duration-200' : 'transition-opacity duration-200'}>
              <DashboardKpis
                d={d}
                navigate={navigate}
                isFreelancer={false}
                periodLabel={uiPeriodLabel}
                dateRange={dateRange}
                customFrom={customFrom}
                customTo={customTo}
                dataFresh={dataFresh && !statsLoading}
              />
              <DashboardMainGrid d={d} navigate={navigate} isFreelancer={false} />
              <CallbackRemindersWidget />
              <DashboardRecentJobsWidget navigate={navigate} />
              <DashboardLowerGrid
                d={d}
                navigate={navigate}
                isFreelancer={false}
                dateRange={dateRange}
                customFrom={customFrom}
                customTo={customTo}
              />
            </div>
          </div>
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
