'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, UserPlus, Clock, Briefcase, TrendingUp, TrendingDown,
  ArrowRight, Bell, Zap, Activity, Video, FolderOpen, Calendar, LayoutDashboard,
  Crown, Search, Mail, Star, Target, Award, MessageSquare, Timer, BarChart2,
  Globe, Sparkles, CheckCircle2, AlertCircle, RefreshCw, Brain, Goal,
  Filter, Download, Keyboard, Radio, Lightbulb, TrendingUp as TrendUp,
  Calendar as CalendarIcon, Zap as ZapIcon, Bot, TrendingUpIcon, AlertTriangle,
  Info, LightbulbIcon, ArrowUpRight, MoreHorizontal, Wifi, WifiOff, Loader2
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import PageShell from '@/components/ui/PageShell';
import StatCard from '@/components/ui/StatCard';
import RoleBadge from '@/components/ui/RoleBadge';
import { ROLE_UI } from '@/lib/roleUi';
import { ROLE_DESCRIPTIONS, type Role } from '@/lib/roles';
import { useLocale } from '@/components/providers/LocaleProvider';
import { useToast } from '@/components/ui/Toast';
import { WeeklyChart, PipelineDoughnut } from '@/components/charts/DashboardCharts';
import DashboardWelcomeModal, { getShouldShowWelcome } from '@/components/DashboardWelcomeModal';
import { useAuth } from '@/hooks/useAuth';
import AdminDashboard from '@/components/dashboard/AdminDashboard';
import InterviewerDashboard from '@/components/dashboard/InterviewerDashboard';
import ViewerDashboard from '@/components/dashboard/ViewerDashboard';

// Animation variants - stable to prevent re-triggering on data refresh
// Stable animation variants - only animate once on mount, never re-trigger
const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.1 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] } } };
const slideIn = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } } };
const fadeIn = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.3 } } };

const statusColors: Record<string, string> = {
  Applied: 'bg-brand-100 text-brand-700', 
  Screening: 'bg-warm-100 text-warm-700', 
  Interview: 'bg-amber-100 text-amber-700',
  Offer: 'bg-emerald-100 text-emerald-700', 
  Hired: 'bg-green-100 text-green-700', 
  Joined: 'bg-brand-100 text-brand-700',
  Rejected: 'bg-red-100 text-red-700', 
  Dropped: 'bg-stone-100 text-stone-600',
};
const pipelineBarColors: Record<string, string> = {
  Applied: 'bg-brand-500', Screening: 'bg-warm-500', Interview: 'bg-amber-500', Offer: 'bg-emerald-500',
  Hired: 'bg-green-500', Joined: 'bg-brand-500', Rejected: 'bg-red-400', Dropped: 'bg-stone-400',
};

function formatTimeAgo(dateStr: string, t: (key: string, vars?: Record<string, string>) => string) {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (mins < 1) return t('dashboard.time.justNow');
  if (mins < 60) return t('dashboard.time.minutesAgo', { mins: String(mins) });
  if (hours < 24) return t('dashboard.time.hoursAgo', { hours: String(hours) });
  if (days < 7) return t('dashboard.time.daysAgo', { days: String(days) });
  return date.toLocaleDateString();
}

type ActivityItem = { id: string; type: string; user?: string; candidate?: string; position?: string; from?: string; to?: string; job?: string; department?: string; date?: string; time: string };
function getActivityText(a: ActivityItem, t: (key: string, vars?: Record<string, string>) => string) {
  if (a.type === 'candidate_added') return { text: t('activity.candidateAdded', { candidate: a.candidate ?? '', position: a.position ?? '' }), color: 'text-brand-600' };
  if (a.type === 'status_changed') return { text: t('activity.statusChanged', { user: a.user ?? '', from: a.from ?? '', to: a.to ?? '' }), color: 'text-amber-600' };
  if (a.type === 'interview_scheduled') return { text: t('activity.interviewScheduled', { candidate: a.candidate ?? '', date: a.date ?? '' }), color: 'text-emerald-600' };
  if (a.type === 'offer_sent') return { text: t('activity.offerSent', { candidate: a.candidate ?? '', position: a.position ?? '' }), color: 'text-emerald-600' };
  if (a.type === 'hired') return { text: t('activity.hired', { candidate: a.candidate ?? '', position: a.position ?? '' }), color: 'text-green-600' };
  if (a.type === 'job_posted') return { text: t('activity.jobPosted', { job: a.job ?? '', department: a.department ?? '' }), color: 'text-brand-600' };
  return { text: t('activity.default'), color: 'text-stone-600' };
}

type RecentCandidate = { id: string; name: string; email: string; position: string; source: string; status: string; createdAt: string; phone: string };

type DashboardSummary = {
  totalCandidates: number;
  thisMonth: number;
  pendingReview: number;
  candidateTrend: number;
  pipeline: { stage: string; count: number }[];
  recentCandidates: RecentCandidate[];
  openPositions: number;
  conversionRate: number;
  rejectionRate: number;
  avgTimeToHire: number;
  callbacks?: { id: string; candidateName: string; candidatePosition: string; callBackDate: string; daysRemaining: number; priority: string }[];
  activities?: ActivityItem[];
  upcomingInterviews?: { id: string; candidate: string; position: string; time: string; type: string; interviewer: string }[];
  dailySubmissions?: { date: string; count: number }[];
  topPositions?: { position: string; count: number }[];
  topSources?: { source: string; count: number }[];
  lastMonth?: number;
  prevMonthHires?: number;
};

type AIInsight = {
  id: string;
  type: 'warning' | 'success' | 'info' | 'tip';
  title: string;
  message: string;
  action?: string;
  href?: string;
};

// Data cache key for session persistence
const DASHBOARD_CACHE_KEY = 'dashboard_data_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function RecruiterDashboard() {
  const router = useRouter();
  const { t } = useLocale();
  const toast = useToast();
  const { user } = useAuth();
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const userEmail = typeof window !== 'undefined' ? localStorage.getItem('userEmail') ?? '' : '';
  const userName = typeof window !== 'undefined' ? localStorage.getItem('userName') ?? '' : '';
  const displayName = userName || (userEmail && userEmail.includes('@') ? userEmail.split('@')[0] : userEmail) || t('dashboard.user') || 'User';
  
  // Refs for stable rendering without flickering
  const lastDataRef = useRef<DashboardSummary | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (!token && !isLoggedIn) router.push('/login');
  }, [router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (getShouldShowWelcome()) setShowWelcomeModal(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Show single welcome toast on mount - only once per session
  useEffect(() => {
    const hasShownWelcome = sessionStorage.getItem('welcome-shown');
    if (!hasShownWelcome && userName) {
      // Show single welcome toast that auto-dismisses
      toast.success(
        `${t('login.welcomeBack') || 'Welcome back'}, ${displayName}!`,
        t('dashboard.welcome.toastMessage')
      );
      sessionStorage.setItem('welcome-shown', 'true');
    }
  }, [toast, t, userName, displayName]);

  // Data state with caching support
  const [dashboardData, setDashboardData] = useState<DashboardSummary | null>(null);
  const [displayData, setDisplayData] = useState<DashboardSummary | null>(null); // For smooth transitions
  const [loadError, setLoadError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [hiringGoal] = useState(20); // Monthly hiring goal
  const [isLive, setIsLive] = useState(true);
  
  // Load cached data on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem(DASHBOARD_CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_TTL) {
            setDashboardData(data);
            setDisplayData(data);
            setIsLoading(false);
          }
        }
      } catch {
        // Ignore cache errors
      }
    }
  }, []);

  const loadDashboardData = useCallback(async (silent = false) => {
    if (!silent) {
      setLoadError(false);
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    try {
      const res = await fetch('/api/dashboard/summary', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error('Failed');
      const json = (await res.json()) as DashboardSummary;
      
      // Only update if data actually changed to prevent unnecessary re-renders
      const hasChanged = !lastDataRef.current || JSON.stringify(lastDataRef.current) !== JSON.stringify(json);
      
      if (hasChanged) {
        lastDataRef.current = json;
        setDashboardData(json);
        setDisplayData(json);
        
        // Cache to sessionStorage
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify({
              data: json,
              timestamp: Date.now()
            }));
          } catch {
            // Ignore storage errors
          }
        }
      }
      setLastUpdated(new Date());
      setIsLive(true);
    } catch {
      if (!silent) setLoadError(true);
      setIsLive(false);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);
  
  // Smart auto-refresh every 30 seconds - only updates changed values
  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(() => {
      loadDashboardData(true); // Silent refresh
    }, 30000);
    return () => clearInterval(interval);
  }, [loadDashboardData]);
  
  // Visibility change handler - restore data from cache first
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // First restore from cache for instant display
        if (typeof window !== 'undefined') {
          const cached = sessionStorage.getItem(DASHBOARD_CACHE_KEY);
          if (cached) {
            try {
              const { data } = JSON.parse(cached);
              setDisplayData(data);
            } catch {
              // Ignore
            }
          }
        }
        // Then fetch fresh data silently
        setTimeout(() => loadDashboardData(true), 100);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loadDashboardData]);
  
  // Window focus handler - smart restore
  useEffect(() => {
    const handleFocus = () => {
      // Restore from cache first for instant display
      if (typeof window !== 'undefined') {
        const cached = sessionStorage.getItem(DASHBOARD_CACHE_KEY);
        if (cached) {
          try {
            const { data } = JSON.parse(cached);
            setDisplayData(data);
          } catch {
            // Ignore
          }
        }
      }
      // Fetch fresh data silently
      loadDashboardData(true);
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadDashboardData]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Guard: don't fire when user is typing in a form field
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) return;
      // Press 'R' to refresh
      if (e.key === 'r' || e.key === 'R') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          loadDashboardData(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loadDashboardData]);
  
  // Premium Smart Insights Generator with enhanced logic
  const generateAIInsights = useCallback((): AIInsight[] => {
    if (!displayData) return [];
    const insights: AIInsight[] = [];
    const d = displayData;
    
    // Insight 1: High Review Backlog
    if (d.pendingReview > 5) {
      insights.push({
        id: 'backlog',
        type: 'warning',
        title: t('insights.backlog.title', { count: String(d.pendingReview) }),
        message: t('insights.backlog.message', { count: String(d.pendingReview) }),
        action: t('insights.backlog.action'),
        href: '/dashboard/candidates?filter=screening',
      });
    }
    
    // Insight 2: Conversion Rate Analysis
    if (d.conversionRate > 12) {
      insights.push({
        id: 'conversion',
        type: 'success',
        title: t('insights.conversion.outstanding.title'),
        message: t('insights.conversion.outstanding.message', { rate: String(d.conversionRate) }),
        action: t('insights.conversion.action'),
        href: '/dashboard/analytics',
      });
    } else if (d.conversionRate < 5 && d.totalCandidates > 20) {
      insights.push({
        id: 'conversion-low',
        type: 'tip',
        title: t('insights.conversion.improve.title'),
        message: t('insights.conversion.improve.message', { rate: String(d.conversionRate) }),
        action: t('insights.conversion.action'),
        href: '/dashboard/analytics',
      });
    }
    
    // Insight 3: Time to Hire Optimization
    if (d.avgTimeToHire > 0) {
      if (d.avgTimeToHire <= 14) {
        insights.push({
          id: 'time-optimal',
          type: 'success',
          title: t('insights.hiring.fast.title'),
          message: t('insights.hiring.fast.message', { days: String(d.avgTimeToHire) }),
        });
      } else if (d.avgTimeToHire > 30) {
        insights.push({
          id: 'time-slow',
          type: 'warning',
          title: t('insights.hiring.slow.title'),
          message: t('insights.hiring.slow.message', { days: String(d.avgTimeToHire) }),
          action: t('insights.hiring.action'),
          href: '/dashboard/analytics',
        });
      }
    }
    
    // Insight 4: Source Performance
    if (d.topSources && d.topSources.length > 0) {
      const topSource = d.topSources[0];
      const totalFromTop = d.topSources.slice(0, 3).reduce((sum, s) => sum + s.count, 0);
      const topPercentage = Math.round((topSource.count / totalFromTop) * 100);
      
      if (topPercentage > 50) {
        insights.push({
          id: 'source-heavy',
          type: 'info',
          title: t('insights.source.dependency.title'),
          message: t('insights.source.dependency.message', { percentage: String(topPercentage), source: topSource.source }),
        });
      } else {
        insights.push({
          id: 'source-optimized',
          type: 'success',
          title: t('insights.source.balanced.title'),
          message: t('insights.source.balanced.message', { source: topSource.source }),
        });
      }
    }
    
    // Insight 5: Monthly Trend
    if (d.candidateTrend !== 0) {
      const trendType = d.candidateTrend > 0 ? 'success' : 'warning';
      insights.push({
        id: 'trend',
        type: trendType,
        title: d.candidateTrend > 0 ? t('insights.trend.growing.title') : t('insights.trend.slowing.title'),
        message: d.candidateTrend > 0 
          ? t('insights.trend.growing.message', { trend: String(d.candidateTrend) })
          : t('insights.trend.slowing.message', { trend: String(d.candidateTrend) }),
      });
    }
    
    // Return top 3 most relevant insights
    return insights.slice(0, 3);
  }, [displayData, t]);

  // Move all hooks BEFORE early returns
  // Safe data accessor with defaults - use displayData for smooth rendering
  const safeData = displayData ?? {
    totalCandidates: 0,
    thisMonth: 0,
    pendingReview: 0,
    candidateTrend: 0,
    pipeline: [],
    recentCandidates: [],
    openPositions: 0,
    conversionRate: 0,
    rejectionRate: 0,
    avgTimeToHire: 0,
    callbacks: [],
    activities: [],
    upcomingInterviews: [],
    dailySubmissions: [{ date: 'Mon', count: 0 }, { date: 'Tue', count: 0 }, { date: 'Wed', count: 0 }, { date: 'Thu', count: 0 }, { date: 'Fri', count: 0 }, { date: 'Sat', count: 0 }, { date: 'Sun', count: 0 }],
    topPositions: [],
    topSources: [],
    lastMonth: 0,
    prevMonthHires: 0,
  };

  // Filter recent candidates with smart status mapping
  const filteredCandidates = useMemo(() => {
    if (!safeData.recentCandidates || safeData.recentCandidates.length === 0) return [];
    if (selectedFilter === 'all') return safeData.recentCandidates;
    
    // Status mapping for flexible matching
    const statusMap: Record<string, string[]> = {
      'applied': ['applied', 'new', 'pending', 'pending review'],
      'screening': ['screening', 'phone screen', 'phone screening', 'under review', 'in review'],
      'interview': ['interview', 'interviewing', 'technical interview', 'final interview', 'onsite', 'on-site']
    };
    
    const allowedStatuses = statusMap[selectedFilter] || [selectedFilter];
    
    return safeData.recentCandidates.filter(c => {
      const candidateStatus = (c.status || '').toLowerCase().trim();
      return allowedStatuses.some(status => candidateStatus.includes(status));
    });
  }, [safeData.recentCandidates, selectedFilter]);

  // Calculate hiring goal progress
  const goalProgress = Math.min((safeData.thisMonth / hiringGoal) * 100, 100);

  // Calculate MoM comparison data
  const momChange = displayData?.lastMonth ? ((displayData.thisMonth - displayData.lastMonth) / displayData.lastMonth) * 100 : 0;

  // Early returns AFTER all hooks
  if (displayData === null && !loadError) {
    return (
      <PageShell className="animate-pulse">
        <div className="space-y-3 sm:space-y-4">
          <div className="h-10 w-64 rounded-xl bg-stone-200" />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 sm:h-32 rounded-2xl bg-stone-100" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 sm:h-52 rounded-2xl bg-stone-100" />
            ))}
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 sm:gap-4">
            <div className="xl:col-span-2 h-56 sm:h-64 rounded-2xl bg-stone-100" />
            <div className="h-56 sm:h-64 rounded-2xl bg-stone-100" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
            <div className="lg:col-span-2 h-64 rounded-2xl bg-stone-100" />
            <div className="h-32 rounded-2xl bg-stone-100" />
          </div>
          <div className="h-48 rounded-2xl bg-stone-100" />
        </div>
      </PageShell>
    );
  }

  // Error state with retry button
  if (loadError) {
    return (
      <PageShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-md"
          >
            <div className="w-20 h-20 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-stone-900 mb-2">
              {t('dashboard.error.loadFailed')}
            </h2>
            <p className="text-stone-500 mb-6">
              {t('dashboard.error.loadMessage')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => loadDashboardData()}
                disabled={isLoading}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? t('dashboard.button.retrying') : t('dashboard.button.tryAgain')}
              </button>
              <Link href="/dashboard" className="btn-secondary">
                {t('dashboard.button.refresh')}
              </Link>
            </div>
          </motion.div>
        </div>
      </PageShell>
    );
  }

  // Use safeData for all calculations
  const d = safeData;
  const maxPipeline = Math.max(...d.pipeline.map((p) => p.count), 1);
  const callbacks = d.callbacks ?? [];
  const activities = d.activities ?? [];
  const upcomingInterviews = d.upcomingInterviews ?? [];

  return (
    <>
      {/* --- Section: Dashboard Root - start --- */}
      <DashboardWelcomeModal open={showWelcomeModal} onClose={() => setShowWelcomeModal(false)} />
      <PageShell>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
      {/* Premium Header with Live Indicator */}
      <PageHeader
        icon={LayoutDashboard}
        title={<>{t('dashboard.welcomeBack')}, <span className="text-gradient">{displayName}</span>!</>}
        subtitle={`${t('dashboard.overviewFor')} ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}.`}
      >
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 rounded-2xl bg-white border border-stone-200 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-all duration-300">
          <div className="relative flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${isRefreshing ? 'bg-amber-500' : isLive ? 'bg-emerald-500' : 'bg-red-500'} ${isRefreshing ? 'animate-pulse' : ''}`} />
            <div className={`absolute inset-0 w-2.5 h-2.5 rounded-full ${isRefreshing ? 'bg-amber-500' : isLive ? 'bg-emerald-500' : 'bg-red-500'} animate-ping opacity-40`} />
          </div>
          <span className={`text-sm font-semibold ${isRefreshing ? 'text-amber-600' : isLive ? 'text-emerald-600' : 'text-red-600'}`}>
            {isRefreshing ? t('dashboard.status.syncing') : isLive ? t('dashboard.status.live') : t('dashboard.status.offline')}
          </span>
          {lastUpdated && (
            <span className="text-xs text-stone-400 font-medium hidden sm:inline">
              {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <div className="h-4 w-px bg-stone-200 mx-1 hidden sm:block" />
          <button
            onClick={() => loadDashboardData(true)}
            disabled={isRefreshing}
            className="btn-secondary !p-1.5 !px-1.5 !py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Press 'R' to refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : 'hover:rotate-180 transition-transform duration-300'}`} />
          </button>
        </div>
      </PageHeader>

      {/* Role Context Banner */}
      {user?.role && (() => {
        const role = user.role as Role;
        const ui = ROLE_UI[role];
        if (!ui) return null;
        const actions: Record<Role, { label: string; href: string }[]> = {
          ADMIN: [
            { label: 'Manage Users', href: '/dashboard/settings/users' },
            { label: 'Audit Logs', href: '/dashboard/settings/audit-log' },
            { label: 'Company', href: '/dashboard/company' },
          ],
          RECRUITER: [
            { label: 'Add Candidate', href: '/dashboard/candidates' },
            { label: 'Post Job', href: '/dashboard/jobs' },
            { label: 'Pipeline', href: '/dashboard/kanban' },
          ],
          HIRING_MANAGER: [
            { label: 'View Candidates', href: '/dashboard/candidates' },
            { label: 'Interviews', href: '/dashboard/calendar' },
            { label: 'Analytics', href: '/dashboard/analytics' },
          ],
          INTERVIEWER: [
            { label: 'My Interviews', href: '/dashboard/calendar' },
            { label: 'Score Interviews', href: '/dashboard/premium/scoring' },
            { label: 'Candidates', href: '/dashboard/candidates' },
          ],
          VIEWER: [
            { label: 'Candidates', href: '/dashboard/candidates' },
            { label: 'Jobs', href: '/dashboard/jobs' },
            { label: 'Analytics', href: '/dashboard/analytics' },
          ],
        };
        const roleActions = actions[role] ?? [];
        return (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`card-ats-bordered flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 ${ui.badge.replace(/text-\S+/g, '').trim()}`}
          >
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <RoleBadge role={role} showIcon />
              <div className="min-w-0">
                <span className="text-xs font-bold text-stone-500 uppercase tracking-wide">{ui.label} View</span>
                <p className="text-xs text-stone-600 truncate">{ROLE_DESCRIPTIONS[role]}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
              {roleActions.map((a) => (
                <Link key={a.href} href={a.href} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white/80 border border-stone-200 text-stone-700 hover:bg-white hover:border-stone-300 hover:text-stone-900 transition-all whitespace-nowrap">
                  {a.label}
                </Link>
              ))}
            </div>
          </motion.div>
        );
      })()}

      {/* Premium Smart Insights Section */}
      {generateAIInsights().length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.05 }}
          className="relative rounded-2xl overflow-hidden"
        >
          {/* Glassmorphism Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-brand-50 via-teal-50/80 to-brand-50/90 backdrop-blur-sm" />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(13,148,136,0.1)_0%,rgba(20,184,166,0.05)_50%,rgba(13,148,136,0.1)_100%)]" />
          
          {/* Animated Border Glow */}
          <div className="absolute inset-0 rounded-2xl p-[1px] bg-gradient-to-r from-brand-400/40 via-teal-400/40 to-brand-400/40" />
          
          <div className="relative p-4 sm:p-5">
            {/* Header with AI Badge */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative p-3 rounded-xl bg-gradient-to-br from-brand-600 via-teal-600 to-brand-700 shadow-lg shadow-brand-500/25">
                <Bot className="w-5 h-5 text-white" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-brand-700 px-2.5 py-1 rounded-full bg-white/80 border border-brand-200 shadow-sm">
                    SMART INSIGHTS
                  </span>
                  {isRefreshing && (
                    <span className="flex items-center gap-1.5 text-xs text-brand-600 font-medium">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> 
                      Analyzing...
                    </span>
                  )}
                </div>
              </div>
              <Link 
                href="/dashboard/analytics" 
                className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-800 px-3 py-1.5 rounded-lg bg-white/60 hover:bg-white/80 border border-brand-200/50 transition-all"
              >
                View All <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            
            {/* Insights Cards - Premium Glassmorphism */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <AnimatePresence mode="popLayout">
                {generateAIInsights().map((insight, index) => (
                  <motion.div
                    key={insight.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, delay: 0.1 + index * 0.1 }}
                    className={`group relative rounded-xl p-4 cursor-default transition-all duration-300 hover:scale-[1.02] ${
                      insight.type === 'warning' 
                        ? 'bg-gradient-to-br from-amber-50/90 to-orange-50/90 border border-amber-200/60 hover:border-amber-300 hover:shadow-[0_4px_20px_rgba(251,191,36,0.15)]' :
                      insight.type === 'success' 
                        ? 'bg-gradient-to-br from-emerald-50/90 to-teal-50/90 border border-emerald-200/60 hover:border-emerald-300 hover:shadow-[0_4px_20px_rgba(52,211,153,0.15)]' :
                      insight.type === 'tip' 
                        ? 'bg-gradient-to-br from-blue-50/90 to-cyan-50/90 border border-blue-200/60 hover:border-blue-300 hover:shadow-[0_4px_20px_rgba(96,165,250,0.15)]' :
                        'bg-gradient-to-br from-brand-50/90 to-teal-50/90 border border-brand-200/60 hover:border-brand-300 hover:shadow-[0_4px_20px_rgba(13,148,136,0.15)]'
                    }`}
                  >
                    {/* Icon with gradient */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
                      insight.type === 'warning' ? 'bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/25' :
                      insight.type === 'success' ? 'bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/25' :
                      insight.type === 'tip' ? 'bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/25' :
                      'bg-gradient-to-br from-brand-500 to-teal-500 shadow-lg shadow-brand-500/25'
                    }`}>
                      {insight.type === 'warning' ? <AlertTriangle className="w-5 h-5 text-white" /> :
                       insight.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-white" /> :
                       insight.type === 'tip' ? <LightbulbIcon className="w-5 h-5 text-white" /> :
                       <Info className="w-5 h-5 text-white" />}
                    </div>
                    
                    <h4 className="text-sm font-bold text-stone-900 mb-1 group-hover:text-stone-800 transition-colors">
                      {insight.title}
                    </h4>
                    <p className="text-xs text-stone-600 leading-relaxed mb-2">
                      {insight.message}
                    </p>
                    
                    {insight.action && insight.href && (
                      <Link 
                        href={insight.href} 
                        className={`inline-flex items-center gap-1 text-xs font-semibold transition-all group-hover:gap-1.5 ${
                          insight.type === 'warning' ? 'text-amber-700 hover:text-amber-800' :
                          insight.type === 'success' ? 'text-emerald-700 hover:text-emerald-800' :
                          insight.type === 'tip' ? 'text-blue-700 hover:text-blue-800' :
                          'text-brand-700 hover:text-brand-800'
                        }`}
                      >
                        {insight.action} <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}

      {/* Premium Features Info Box - Responsive Banner */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.06 }}
        className="card-ats-bordered relative overflow-hidden bg-gradient-to-r from-amber-50 via-orange-50/80 to-amber-50 border-amber-200/80 p-4 sm:p-5"
      >
        {/* Decorative background elements */}
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-transparent to-orange-500/5" />
        <div className="absolute -right-6 -top-6 w-24 h-24 bg-amber-400/10 rounded-full blur-2xl" />
        <div className="absolute -left-6 -bottom-6 w-20 h-20 bg-orange-400/10 rounded-full blur-2xl" />
        
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-start sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/20 flex-shrink-0">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600" />
                <p className="text-sm sm:text-base font-bold text-amber-900">Premium Features</p>
              </div>
              <p className="text-xs sm:text-sm text-amber-700/80 mt-0.5 leading-relaxed">9 advanced tools available - Smart recruitment at your fingertips</p>
            </div>
          </div>
          <Link 
            href="/dashboard/premium" 
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white border border-amber-200 text-sm font-semibold text-amber-700 hover:bg-amber-50 hover:border-amber-300 hover:shadow-md transition-all shadow-sm whitespace-nowrap sm:w-auto w-full"
          >
            <Crown className="w-4 h-4" />
            <span>Explore</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={Users} label={t('dashboard.totalCandidates')} value={d.totalCandidates} trend={d.candidateTrend} trendLabel={t('dashboard.trendVsLastMonth')} iconClassName="text-brand-600 bg-brand-50" />
        <StatCard icon={UserPlus} label={t('dashboard.addedThisMonth')} value={d.thisMonth} iconClassName="text-emerald-600 bg-emerald-50" />
        <StatCard icon={Clock} label={t('dashboard.pendingReview')} value={d.pendingReview} iconClassName="text-amber-600 bg-amber-50" />
        <StatCard icon={Briefcase} label={t('dashboard.hiredJoined')} value={d.pipeline.filter((p) => p.stage === 'Hired' || p.stage === 'Joined').reduce((s, p) => s + p.count, 0)} iconClassName="text-violet-600 bg-violet-50" />
      </div>

      {/* Premium Widgets - 3 columns on lg, 2 on md, 1 on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* Time to Hire - Premium Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.1 }}
          whileHover={{ y: -4 }}
          className="card-ats-bordered relative overflow-hidden rounded-2xl border border-stone-200/80 bg-white p-5 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-all duration-300"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-brand-50/30 to-transparent pointer-events-none" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-brand-100 to-brand-200 shadow-sm">
                <Timer className="w-5 h-5 text-brand-700" />
              </div>
              {d.avgTimeToHire > 0 && d.avgTimeToHire <= 21 && (
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 px-2 py-1 bg-emerald-50 rounded-full border border-emerald-100">
                  <TrendingUp className="w-3 h-3" /> On Track
                </span>
              )}
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">{d.avgTimeToHire || '--'} <span className="text-base font-semibold text-stone-500">{t('dashboard.days')}</span></p>
            <p className="text-xs text-stone-500 mt-1 font-medium">{t('dashboard.timeToHire')}</p>
            <div className="mt-4 relative">
              <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: d.avgTimeToHire > 0 ? `${Math.min((d.avgTimeToHire / 30) * 100, 100)}%` : '0%' }}
                  transition={{ duration: 1, delay: 0.5 }}
                  className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600"
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] text-stone-400 font-medium">0 {t('dashboard.days')}</span>
                <span className="text-[10px] text-stone-400 font-medium">{t('dashboard.target')}: 21 {t('dashboard.days')}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Source Effectiveness */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.15 }}
          whileHover={{ y: -4 }}
          className="card-ats-bordered relative overflow-hidden rounded-2xl border border-stone-200/80 bg-white p-5 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-all duration-300"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-warm-50/30 to-transparent pointer-events-none" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-warm-100 to-warm-200 shadow-sm">
                <Globe className="w-5 h-5 text-warm-700" />
              </div>
              <span className="text-xs font-bold text-stone-600 px-2 py-1 bg-stone-100 rounded-full border border-stone-200">{t('dashboard.topSources')}</span>
            </div>
            <div className="space-y-3">
              {d.topSources && d.topSources.length > 0 ? (
                d.topSources.slice(0, 2).map((source, idx) => {
                  const total = d.topSources?.reduce((sum, s) => sum + s.count, 0) || 1;
                  const percentage = Math.round((source.count / total) * 100);
                  const colors = ['from-brand-400 to-brand-600', 'from-warm-400 to-warm-500'];
                  return (
                    <div key={source.source}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-stone-600 font-medium">{source.source}</span>
                        <span className="font-bold text-stone-900">{percentage}%</span>
                      </div>
                      <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ duration: 0.8, delay: 0.3 + idx * 0.2 }}
                          className={`h-full rounded-full bg-gradient-to-r ${colors[idx % colors.length]}`}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-stone-400">No source data available</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Team Performance - spans full width on md, single on lg */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.2 }}
          whileHover={{ y: -4 }}
          className="card-ats-bordered relative overflow-hidden rounded-2xl border border-stone-200/80 bg-white p-5 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-all duration-300 md:col-span-2 lg:col-span-1"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/30 to-transparent pointer-events-none" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-200 shadow-sm">
                <Award className="w-5 h-5 text-emerald-700" />
              </div>
              <span className="text-xs font-bold text-emerald-700 px-2 py-1 bg-emerald-50 rounded-full border border-emerald-100">{t('dashboard.thisMonth')}</span>
            </div>
            <div className="space-y-3">
              {/* Current User Performance */}
              <div className="flex items-center gap-3 p-2 rounded-xl bg-gradient-to-r from-brand-50/50 to-transparent border border-brand-100/50">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-teal-600 flex items-center justify-center text-sm font-bold text-white shadow-md flex-shrink-0">
                  {displayName.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-stone-800 truncate">{displayName}</span>
                    <span className="text-sm font-bold text-brand-600 ml-2">{d.thisMonth} {t('dashboard.added')}</span>
                  </div>
                  <div className="w-full h-1.5 bg-stone-100 rounded-full mt-1.5 overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-500" 
                      style={{ width: d.totalCandidates > 0 ? `${Math.min((d.thisMonth / d.totalCandidates) * 100, 100)}%` : '0%' }}
                    />
                  </div>
                </div>
              </div>
              
              {/* Conversion Rate Summary */}
              <div className="flex items-center gap-3 p-2 rounded-xl bg-gradient-to-r from-emerald-50/50 to-transparent border border-emerald-100/50">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-sm font-bold text-white shadow-md flex-shrink-0">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-stone-800 truncate">{t('dashboard.conversionRate')}</span>
                    <span className="text-sm font-bold text-emerald-600 ml-2">{d.conversionRate}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-stone-100 rounded-full mt-1.5 overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500" 
                      style={{ width: `${Math.min(d.conversionRate, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Hiring Goals Widget */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.25 }}
          whileHover={{ y: -4 }}
          className="card-ats-bordered relative overflow-hidden rounded-2xl border border-stone-200/80 bg-white p-5 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-all duration-300 md:col-span-2 lg:col-span-1"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-amber-50/30 to-transparent pointer-events-none" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 shadow-sm">
                <Goal className="w-5 h-5 text-amber-700" />
              </div>
              <span className="text-xs font-bold text-amber-700 px-2 py-1 bg-amber-50 rounded-full border border-amber-100">{t('dashboard.thisMonth')}</span>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-stone-700">Monthly Hiring Goal</span>
                  <span className="text-sm font-bold text-stone-900">{Math.round(goalProgress)}%</span>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-3 overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${goalProgress}%` }}
                    transition={{ duration: 1, delay: 0.3 }}
                    className={`h-full rounded-full ${
                      goalProgress >= 80 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' :
                      goalProgress >= 50 ? 'bg-gradient-to-r from-amber-400 to-amber-600' :
                      'bg-gradient-to-r from-red-400 to-red-600'
                    }`}
                  />
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-xs text-stone-500">{d.thisMonth} hired</span>
                  <span className="text-xs text-stone-500">Goal: {hiringGoal}</span>
                </div>
              </div>
              
              {/* MoM Comparison */}
              <div className="pt-3 border-t border-stone-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-stone-500">vs Last Month</span>
                  <div className="flex items-center gap-1">
                    {momChange >= 0 ? (
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                    )}
                    <span className={`text-xs font-bold ${momChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {momChange >= 0 ? '+' : ''}{momChange.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-stone-500">New Candidates</span>
                  <div className="flex items-center gap-1">
                    {d.candidateTrend >= 0 ? (
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                    )}
                    <span className={`text-xs font-bold ${d.candidateTrend >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {d.candidateTrend >= 0 ? '+' : ''}{d.candidateTrend}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Charts Section - 2/3 + 1/3 split on xl */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 sm:gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.1 }}
          className="card-ats-bordered xl:col-span-2 rounded-2xl border border-stone-200/80 bg-white p-4 sm:p-6 shadow-sm hover:shadow-md transition-all duration-200"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base sm:text-lg font-bold text-stone-900">{t('dashboard.weeklyApplications')}</h2>
            <Link href="/dashboard/analytics" className="text-sm font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1.5 group">
              {t('dashboard.view')} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
          <div className="h-56 sm:h-64">
            <WeeklyChart dailySubmissions={d.dailySubmissions} />
          </div>
        </motion.div>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.15 }}
          className="card-ats-bordered rounded-2xl border border-stone-200/80 bg-white p-4 sm:p-6 shadow-sm hover:shadow-md transition-all duration-200"
        >
          <h2 className="text-base sm:text-lg font-bold text-stone-900 mb-4">{t('dashboard.pipelineOverview')}</h2>
          <div className="h-56 sm:h-64 flex items-center justify-center">
            <PipelineDoughnut pipeline={d.pipeline} />
          </div>
        </motion.div>
      </div>

      {/* Recent Candidates & Sidebar - Premium Redesign */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.2 }}
          className="card-ats-bordered lg:col-span-2 rounded-2xl border border-stone-200/80 bg-white p-4 sm:p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-all duration-300 overflow-hidden"
        >
          {/* Premium Header with Mobile-Optimized Tabs */}
          <div className="flex flex-col gap-3 mb-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-brand-500 to-teal-500 shadow-lg shadow-brand-500/20">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-stone-900">{t('dashboard.recentCandidates')}</h2>
                  <p className="text-xs text-stone-500 hidden sm:block">
                    {filteredCandidates.length} of {d.recentCandidates.length} candidates
                  </p>
                </div>
              </div>
              <Link 
                href="/dashboard/candidates" 
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-brand-600 hover:text-brand-700 hover:bg-brand-50 transition-all group"
              >
                {t('dashboard.viewAll')} 
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
            
            {/* Premium Filter Tabs - Mobile Optimized */}
            <div className="flex items-center gap-1.5 bg-stone-100/80 rounded-xl p-1.5 overflow-x-auto scrollbar-hide">
              {[
                { id: 'all', label: 'All', count: d.recentCandidates.length },
                { id: 'applied', label: 'Applied', count: d.recentCandidates.filter((c: RecentCandidate) => ['applied', 'new', 'pending'].some(s => c.status.toLowerCase().includes(s))).length },
                { id: 'screening', label: 'Screening', count: d.recentCandidates.filter((c: RecentCandidate) => ['screening', 'phone screen', 'under review'].some(s => c.status.toLowerCase().includes(s))).length },
                { id: 'interview', label: 'Interview', count: d.recentCandidates.filter((c: RecentCandidate) => ['interview', 'interviewing', 'onsite'].some(s => c.status.toLowerCase().includes(s))).length }
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setSelectedFilter(filter.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                    selectedFilter === filter.id 
                      ? 'bg-white text-brand-700 shadow-sm ring-1 ring-stone-200' 
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
                  }`}
                >
                  {filter.label}
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                    selectedFilter === filter.id 
                      ? 'bg-brand-100 text-brand-700' 
                      : 'bg-stone-200 text-stone-600'
                  }`}>
                    {filter.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
          
          {/* Candidates List - Premium Cards */}
          <div className="space-y-1">
            {d.recentCandidates.length > 0 ? (
              filteredCandidates.length > 0 ? (
                filteredCandidates.slice(0, 6).map((c, i) => (
                  <Link key={c.id || i} href={`/dashboard/candidates/${c.id}`}>
                    <motion.div 
                      initial={false}
                      whileHover={{ x: 4 }}
                      className="flex items-center justify-between py-3.5 px-3 -mx-3 rounded-xl group cursor-pointer hover:bg-gradient-to-r hover:from-stone-50 hover:to-stone-100/50 transition-all duration-200"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 flex items-center justify-center text-sm font-bold text-brand-700 border border-brand-200/50 flex-shrink-0 group-hover:shadow-md group-hover:scale-105 transition-all">
                          {c.name?.[0] || '?'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-stone-900 text-sm truncate">{c.name}</p>
                          <p className="text-xs text-stone-500 mt-0.5 truncate">{c.position} · {c.source}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 ml-2">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold ${statusColors[c.status] || 'bg-stone-100 text-stone-600'}`}>
                          {c.status}
                        </span>
                        <span className="text-xs text-stone-400 hidden sm:inline">{formatTimeAgo(c.createdAt, t)}</span>
                        <ArrowRight className="w-4 h-4 text-stone-300 group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </motion.div>
                  </Link>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-stone-100 to-stone-50 flex items-center justify-center mb-3 border border-stone-200">
                    <Filter className="w-5 h-5 text-stone-400" />
                  </div>
                  <p className="text-sm font-medium text-stone-600">No {selectedFilter} candidates found</p>
                  <button 
                    onClick={() => setSelectedFilter('all')}
                    className="mt-3 px-4 py-2 rounded-lg text-xs font-semibold bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors"
                  >
                    Show all candidates
                  </button>
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-stone-100 to-stone-50 flex items-center justify-center mb-4 border border-stone-200">
                  <Users className="w-7 h-7 text-stone-400" />
                </div>
                <p className="text-stone-700 font-semibold">No Candidates Yet</p>
                <p className="text-sm text-stone-500 mt-1 max-w-[240px]">Start building your talent pool by adding your first candidate</p>
                <Link href="/dashboard/candidates" className="btn-primary mt-4">
                  Add First Candidate
                </Link>
              </div>
            )}
          </div>
        </motion.div>

        <div className="space-y-3 sm:space-y-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.25 }}
            className="card-ats-bordered rounded-2xl border border-stone-200/80 bg-white p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-200"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg bg-warm-100"><Bell className="w-5 h-5 text-warm-600" /></div>
              <h2 className="text-base sm:text-lg font-bold text-stone-900">{t('dashboard.callbackReminders')}</h2>
            </div>
            {callbacks.length > 0 ? (
              <div className="space-y-3">
                {callbacks.slice(0, 3).map((cb) => (
                  <div key={cb.id} className={`rounded-xl p-4 border transition-all hover:shadow-md cursor-pointer ${
                    cb.priority === 'urgent' ? 'bg-red-50/80 border-red-200 hover:bg-red-50' : cb.priority === 'high' ? 'bg-amber-50/80 border-amber-200 hover:bg-amber-50' : 'bg-stone-50/80 border-stone-200 hover:bg-stone-50'
                  }`}>
                    <p className="font-semibold text-stone-900 text-sm">{cb.candidateName}</p>
                    <p className="text-xs text-stone-500 mt-0.5">{cb.candidatePosition}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-stone-600 font-medium"><Calendar className="w-3.5 h-3.5" />{cb.callBackDate} · {cb.daysRemaining}d</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-stone-400 text-center py-6 font-medium">{t('dashboard.noCallbacks')}</p>
            )}
          </motion.div>

          {/* Premium Quick Actions - Consistent Sizing & Styling */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.3 }}
            className="card-ats-bordered rounded-2xl border border-stone-200/80 bg-white p-4 sm:p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-all duration-300"
          >
            {/* Header - Unified Typography */}
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/20">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-stone-900">{t('dashboard.quickActions')}</h2>
            </div>
            
            {/* Action Buttons - Consistent 48px Height */}
            <div className="space-y-2.5">
              {/* Primary Action - Add Candidate */}
              <Link href="/dashboard/candidates" className="btn-primary w-full !justify-start gap-3 h-12">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                  <UserPlus className="w-4 h-4 text-white" />
                </div>
                <span className="flex-1 text-left">{t('dashboard.addCandidate')}</span>
                <ArrowRight className="w-4 h-4 text-white/70" />
              </Link>
              
              {/* Secondary Actions - Unified 44px Height */}
              <div className="grid grid-cols-1 gap-2">
                <Link href="/dashboard/candidates" className="block">
                  <motion.div 
                    whileHover={{ x: 2 }} 
                    whileTap={{ scale: 0.99 }}
                    className="w-full h-11 px-4 rounded-xl font-medium border border-stone-200 hover:border-brand-300 hover:bg-brand-50/50 text-stone-700 text-sm transition-all flex items-center gap-3 group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-stone-100 group-hover:bg-brand-100 flex items-center justify-center transition-colors flex-shrink-0">
                      <Users className="w-4 h-4 text-stone-500 group-hover:text-brand-600 transition-colors" />
                    </div>
                    <span className="flex-1">{t('dashboard.viewAllCandidates')}</span>
                    <ArrowRight className="w-4 h-4 text-stone-300 group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                  </motion.div>
                </Link>
                
                <Link href="/dashboard/jobs" className="block">
                  <motion.div 
                    whileHover={{ x: 2 }} 
                    whileTap={{ scale: 0.99 }}
                    className="w-full h-11 px-4 rounded-xl font-medium border border-stone-200 hover:border-brand-300 hover:bg-brand-50/50 text-stone-700 text-sm transition-all flex items-center gap-3 group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-stone-100 group-hover:bg-brand-100 flex items-center justify-center transition-colors flex-shrink-0">
                      <FolderOpen className="w-4 h-4 text-stone-500 group-hover:text-brand-600 transition-colors" />
                    </div>
                    <span className="flex-1">{t('dashboard.openPositionsBtn')}</span>
                    <ArrowRight className="w-4 h-4 text-stone-300 group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                  </motion.div>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Activity & Interviews - 2 columns on lg */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.35 }}
          className="card-ats-bordered rounded-2xl border border-stone-200/80 bg-white p-4 sm:p-6 shadow-sm hover:shadow-md transition-all duration-200"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base sm:text-lg font-bold text-stone-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-brand-600" /> {t('dashboard.recentActivity')}
            </h2>
          </div>
          <div className="space-y-0 divide-y divide-stone-100">
            {activities.length > 0 ? (
              activities.slice(0, 6).map((a) => {
                const { text, color } = getActivityText(a, t);
                return (
                  <div key={a.id} className="flex items-start gap-3 py-4 first:pt-0 hover:bg-stone-50 -mx-4 px-4 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Zap className="w-4 h-4 text-stone-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${color}`}>{text}</p>
                      <p className="text-xs text-stone-400 mt-0.5">{formatTimeAgo(a.time, t)}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-stone-100 to-stone-50 flex items-center justify-center mb-4 border border-stone-200">
                  <Activity className="w-7 h-7 text-stone-400" />
                </div>
                <p className="text-stone-700 font-semibold">{t('dashboard.recentActivity')}</p>
                <p className="text-sm text-stone-500 mt-1 max-w-[240px]">{t('activity.default')}</p>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.4 }}
          className="card-ats-bordered rounded-2xl border border-stone-200/80 bg-white p-4 sm:p-6 shadow-sm hover:shadow-md transition-all duration-200"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base sm:text-lg font-bold text-stone-900 flex items-center gap-2">
              <Video className="w-5 h-5 text-brand-600" /> {t('dashboard.upcomingInterviews')}
            </h2>
            <span className="text-xs font-semibold text-stone-400">{t('dashboard.today')}</span>
          </div>
          {upcomingInterviews.length > 0 ? (
            <div className="space-y-4">
              {upcomingInterviews.map((inv) => (
                <div key={inv.id} className="flex items-center gap-4 p-4 rounded-xl bg-stone-50/80 border border-stone-100 hover:border-brand-200/50 hover:bg-stone-50 hover:shadow-sm transition-all cursor-pointer">
                  <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center font-bold text-brand-700 text-sm">{inv.candidate[0]}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-stone-900">{inv.candidate}</p>
                    <p className="text-xs text-stone-500">{inv.position} · {inv.type}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-stone-900 text-sm">{inv.time}</p>
                    <p className="text-xs text-stone-500">{inv.interviewer}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-stone-400 text-center py-8 font-medium">{t('dashboard.noInterviewsToday')}</p>
          )}
        </motion.div>
      </div>

      {/* Hiring Pipeline - Full Width */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.45 }}
        className="card-ats-bordered rounded-2xl border border-stone-200/80 bg-white p-4 sm:p-6 shadow-sm hover:shadow-md transition-all duration-200"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base sm:text-lg font-bold text-stone-900">{t('dashboard.hiringPipeline')}</h2>
          <Link href="/dashboard/analytics" className="text-sm font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1.5">
            {t('dashboard.viewAnalytics')} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="space-y-4">
          {d.pipeline.filter((p) => p.count > 0).length > 0 ? (
            d.pipeline.filter((p) => p.count > 0).map((stage) => (
              <div key={stage.stage} className="group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-stone-700">{stage.stage}</span>
                  <span className="text-sm font-bold text-stone-900 tabular-nums">{stage.count}</span>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-3 rounded-full ${pipelineBarColors[stage.stage] || 'bg-brand-500'} transition-all duration-500 ease-out`}
                    style={{ width: `${Math.max((stage.count / maxPipeline) * 100, 4)}%` }}
                  />
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-stone-100 to-stone-50 flex items-center justify-center mb-4 border border-stone-200">
                <svg className="w-7 h-7 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <p className="text-stone-700 font-semibold">No Pipeline Data</p>
              <p className="text-sm text-stone-500 mt-1 max-w-[280px]">Your hiring pipeline will appear here once candidates are added and moved through stages</p>
              <Link href="/dashboard/kanban" className="mt-4 px-4 py-2 bg-brand-50 text-brand-700 text-sm font-semibold rounded-lg hover:bg-brand-100 transition-colors">
                View Kanban Board
              </Link>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
    </PageShell>
    {/* --- Section: Dashboard Root - end --- */}
    </>
  );
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user?.role === 'ADMIN') return <AdminDashboard />;
  if (user?.role === 'INTERVIEWER') return <InterviewerDashboard />;
  if (user?.role === 'VIEWER') return <ViewerDashboard />;
  return <RecruiterDashboard />;
}
