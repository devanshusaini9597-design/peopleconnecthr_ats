import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import CallbackRemindersWidget from './CallbackRemindersWidget';
import WelcomeModal from './WelcomeModal';
import {
  LayoutDashboard, Users, Briefcase, Clock, TrendingUp, TrendingDown,
  ArrowRight, UserPlus, FileText, Mail, Kanban, BarChart3, Building2,
  Radio, ChevronRight, GitBranch
} from 'lucide-react';
import { BASE_API_URL } from '../config';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';

const statusColor = (status) => {
  const map = {
    Applied: 'badge-info',
    Screening: 'badge-warning',
    Interview: 'badge-brand',
    Offer: 'badge-ats bg-violet-100 text-violet-700',
    Hired: 'badge-success',
    Joined: 'badge-success',
    Rejected: 'badge-danger',
    Dropped: 'badge-neutral',
  };
  return map[status] || 'badge-neutral';
};

const pipelineColors = {
  Applied: 'bg-sky-500',
  Screening: 'bg-amber-500',
  Interview: 'bg-brand-500',
  Offer: 'bg-violet-500',
  Hired: 'bg-emerald-500',
  Joined: 'bg-teal-600',
  Rejected: 'bg-red-400',
  Dropped: 'bg-stone-400',
};

const stageRoutes = {
  Applied: '/pending-review',
  Screening: '/pending-review',
  Interview: '/applications',
  Offer: '/applications',
  Hired: '/applications',
  Joined: '/applications',
  Rejected: '/ats',
  Dropped: '/ats',
};

const StatCard = ({ icon: Icon, label, value, trend, gradient, loading, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="relative card-ats-bordered p-5 min-h-[118px] flex flex-col justify-between overflow-hidden text-left w-full group transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg hover:shadow-stone-200/60 hover:border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
  >
    <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient} transition-all duration-300 group-hover:h-1.5`} />
    <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br ${gradient} !bg-none`} style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0) 40%, rgba(0,0,0,0.02))' }} />
    <div className="relative flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-stone-500 text-sm font-medium truncate">{label}</p>
        <p className="text-2xl sm:text-3xl font-bold text-stone-900 mt-1 tabular-nums tracking-tight">
          {loading ? '—' : value}
        </p>
        {trend !== undefined && trend !== null && (
          <div className="flex items-center gap-1 mt-2">
            {trend >= 0
              ? <TrendingUp size={14} className="text-emerald-600 flex-shrink-0" />
              : <TrendingDown size={14} className="text-red-500 flex-shrink-0" />}
            <span className={`text-xs font-semibold ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {trend >= 0 ? '+' : ''}{trend}% vs last month
            </span>
          </div>
        )}
      </div>
      <div className={`p-3 rounded-xl flex-shrink-0 bg-gradient-to-br ${gradient} shadow-md transition-transform duration-300 ease-out group-hover:scale-110 group-hover:rotate-3`}>
        <Icon size={22} className="text-white" />
      </div>
    </div>
    <div className="relative mt-3 flex items-center gap-1 text-[11px] font-semibold text-stone-400 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
      View details <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
    </div>
  </button>
);

const QuickAction = ({ icon: Icon, label, desc, onClick, tone }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center gap-3 p-3 rounded-xl border border-stone-200 bg-white text-left transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md hover:border-stone-300 group"
  >
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110 ${tone}`}>
      <Icon size={18} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-bold text-stone-900 tracking-tight">{label}</p>
      <p className="text-[11px] text-stone-400 truncate">{desc}</p>
    </div>
    <ChevronRight size={16} className="text-stone-300 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all duration-300" />
  </button>
);

const DashboardPage = () => {
  const navigate = useNavigate();
  const userEmail = localStorage.getItem('userEmail') || 'User';
  const userName = localStorage.getItem('userName') || '';
  const displayName = userName || (userEmail.includes('@') ? userEmail.split('@')[0] : userEmail);

  const [dashData, setDashData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showWelcome, setShowWelcome] = useState(false);

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
    }
  }, [loading]);

  const formatTimeAgo = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const mins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / 3600000);
    const days = Math.floor(diffMs / 86400000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

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
  const maxPipeline = Math.max(...(d.pipeline || []).map((p) => p.count), 1);
  const hiredCount = (d.pipeline || [])
    .filter((p) => p.stage === 'Hired' || p.stage === 'Joined')
    .reduce((sum, p) => sum + p.count, 0);

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

      {/* Colorful KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Total Candidates"
          value={d.totalCandidates || 0}
          trend={d.candidateTrend}
          gradient="from-brand-500 to-teal-400"
          loading={false}
          onClick={() => navigate('/ats')}
        />
        <StatCard
          icon={UserPlus}
          label="Added This Month"
          value={d.thisMonth || 0}
          gradient="from-emerald-500 to-lime-400"
          loading={false}
          onClick={() => navigate('/ats')}
        />
        <StatCard
          icon={Clock}
          label="Pending Review"
          value={d.pendingReview || 0}
          gradient="from-amber-500 to-orange-400"
          loading={false}
          onClick={() => navigate('/pending-review')}
        />
        <StatCard
          icon={Briefcase}
          label="Hired / Joined"
          value={hiredCount}
          gradient="from-violet-500 to-fuchsia-400"
          loading={false}
          onClick={() => navigate('/applications')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent candidates */}
        <div className="lg:col-span-2 card-ats-bordered p-5 sm:p-6 relative overflow-hidden group/card">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 opacity-80" />
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-stone-900 tracking-tight">Recent Candidates</h2>
            <button
              type="button"
              onClick={() => navigate('/ats')}
              className="text-brand-600 hover:text-brand-700 text-sm font-semibold flex items-center gap-1 transition-all hover:gap-1.5"
            >
              View All <ArrowRight size={14} />
            </button>
          </div>
          {(d.recentCandidates || []).length > 0 ? (
            <div className="space-y-0.5">
              {d.recentCandidates.map((c, i) => (
                <button
                  key={c.id || i}
                  type="button"
                  onClick={() => navigate(c.name ? `/ats?q=${encodeURIComponent(c.name)}` : '/ats')}
                  className="list-row-ats justify-between w-full text-left transition-all duration-200 hover:bg-brand-50/50 hover:pl-4 group/row"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 text-brand-700 flex items-center justify-center text-xs font-bold flex-shrink-0 ring-1 ring-brand-200/60 transition-transform duration-300 group-hover/row:scale-105">
                      {(c.name || 'N')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-stone-900 truncate group-hover/row:text-brand-700 transition-colors">{c.name}</p>
                      <p className="text-xs text-stone-500 truncate">
                        {c.position || 'No position'}{c.source ? ` · ${c.source}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={statusColor(c.status)}>{c.status}</span>
                    <span className="text-xs text-stone-400 hidden sm:inline">{formatTimeAgo(c.createdAt)}</span>
                    <ChevronRight size={14} className="text-stone-300 opacity-0 group-hover/row:opacity-100 transition-opacity" />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Users}
              tone="brand"
              message="No candidates yet"
              subMessage="Add your first candidate to get started."
              action={
                <button type="button" onClick={() => navigate('/ats?add=1')} className="btn-primary">
                  <UserPlus size={16} /> Add Candidate
                </button>
              }
            />
          )}
        </div>

        {/* Quick actions */}
        <div className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <h2 className="text-base font-bold text-stone-900 tracking-tight mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <QuickAction icon={UserPlus} label="Add Candidate" desc="Create a new profile" onClick={() => navigate('/ats?add=1')} tone="bg-brand-50 text-brand-600" />
            <QuickAction icon={Users} label="All Candidates" desc="Open the ATS directory" onClick={() => navigate('/ats')} tone="bg-sky-50 text-sky-600" />
            <QuickAction icon={Kanban} label="Pipeline Board" desc="Kanban & applications" onClick={() => navigate('/recruitment')} tone="bg-violet-50 text-violet-600" />
            <QuickAction icon={FileText} label="Resume Parsing" desc="Upload & extract CVs" onClick={() => navigate('/resume-parsing')} tone="bg-amber-50 text-amber-600" />
            <QuickAction icon={Mail} label="Email Templates" desc="Hiring messages" onClick={() => navigate('/email-templates')} tone="bg-emerald-50 text-emerald-600" />
            <QuickAction icon={BarChart3} label="Analytics" desc="Reports & insights" onClick={() => navigate('/analytics')} tone="bg-fuchsia-50 text-fuchsia-600" />
          </div>
        </div>
      </div>

      <CallbackRemindersWidget />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline */}
        <div className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-stone-900 tracking-tight">Hiring Pipeline</h2>
            <button
              type="button"
              onClick={() => navigate('/recruitment')}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-all hover:gap-1.5"
            >
              Open board <ArrowRight size={12} />
            </button>
          </div>
          {(d.pipeline || []).length > 0 ? (
            <div className="space-y-3.5">
              {d.pipeline.filter((p) => p.count > 0).map((item) => (
                <button
                  key={item.stage}
                  type="button"
                  onClick={() => navigate(stageRoutes[item.stage] || '/ats')}
                  className="w-full text-left group/pipe rounded-lg p-1.5 -mx-1.5 transition-colors hover:bg-stone-50"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-stone-700 group-hover/pipe:text-stone-900">{item.stage}</span>
                    <span className="text-sm font-bold text-stone-900 tabular-nums flex items-center gap-1">
                      {item.count}
                      <ChevronRight size={12} className="text-stone-300 opacity-0 group-hover/pipe:opacity-100 transition-opacity" />
                    </span>
                  </div>
                  <div className="w-full bg-stone-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`${pipelineColors[item.stage] || 'bg-brand-500'} h-2.5 rounded-full transition-all duration-700 ease-out group-hover/pipe:brightness-110`}
                      style={{ width: `${Math.max((item.count / maxPipeline) * 100, 2)}%` }}
                    />
                  </div>
                </button>
              ))}
                {d.pipeline.every((p) => p.count === 0) && (
                  <EmptyState
                    icon={GitBranch}
                    tone="violet"
                    compact
                    message="No pipeline data yet"
                    subMessage="Candidates will appear here as they move through hiring stages."
                    action={
                      <button type="button" onClick={() => navigate('/ats?add=1')} className="btn-secondary !text-xs">
                        <UserPlus size={14} /> Add Candidate
                      </button>
                    }
                  />
                )}
              </div>
            ) : (
              <EmptyState
                icon={Kanban}
                tone="violet"
                compact
                message="No pipeline data yet"
                subMessage="Start hiring to fill your pipeline stages."
                action={
                  <button type="button" onClick={() => navigate('/recruitment')} className="btn-secondary !text-xs">
                    Open Pipeline Board
                  </button>
                }
              />
            )}
        </div>

        <div className="space-y-6">
          {/* Top positions */}
          <div className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 to-fuchsia-400" />
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-stone-900 tracking-tight flex items-center gap-2">
                <Briefcase size={16} className="text-violet-500" /> Top Positions
              </h2>
              <button
                type="button"
                onClick={() => navigate('/manage-positions')}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-all hover:gap-1.5"
              >
                Manage <ArrowRight size={12} />
              </button>
            </div>
            {(d.topPositions || []).length > 0 ? (
              <div className="space-y-0.5">
                {d.topPositions.map((item, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => navigate(item.position ? `/ats?q=${encodeURIComponent(item.position)}` : '/ats')}
                    className="list-row-ats justify-between w-full text-left group/pos hover:bg-violet-50/50 transition-all duration-200"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 h-6 bg-violet-50 text-violet-700 border border-violet-200/70 rounded-md text-[11px] font-bold flex items-center justify-center flex-shrink-0 transition-transform group-hover/pos:scale-110">
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium text-stone-800 truncate">{item.position}</span>
                    </div>
                    <span className="badge-neutral">{item.count}</span>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Briefcase}
                tone="violet"
                compact
                message="No position data"
                subMessage="Add job positions to track hiring by role."
                action={
                  <button type="button" onClick={() => navigate('/manage-positions')} className="btn-secondary !text-xs">
                    <Building2 size={14} /> Manage Positions
                  </button>
                }
              />
            )}
          </div>

          {/* Top sources */}
          <div className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-lime-400" />
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-stone-900 tracking-tight flex items-center gap-2">
                <Radio size={16} className="text-emerald-500" /> Top Sources
              </h2>
              <button
                type="button"
                onClick={() => navigate('/manage-sources')}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-all hover:gap-1.5"
              >
                Manage <ArrowRight size={12} />
              </button>
            </div>
            {(d.topSources || []).length > 0 ? (
              <div className="space-y-0.5">
                {d.topSources.map((item, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => navigate(item.source ? `/ats?q=${encodeURIComponent(item.source)}` : '/ats')}
                    className="list-row-ats justify-between w-full text-left group/src hover:bg-emerald-50/50 transition-all duration-200"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 h-6 bg-emerald-50 text-emerald-700 border border-emerald-200/70 rounded-md text-[11px] font-bold flex items-center justify-center flex-shrink-0 transition-transform group-hover/src:scale-110">
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium text-stone-800 truncate">{item.source}</span>
                    </div>
                    <span className="badge-neutral">{item.count}</span>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Radio}
                tone="emerald"
                compact
                message="No source data"
                subMessage="Track LinkedIn, referrals, and other channels here."
                action={
                  <button type="button" onClick={() => navigate('/manage-sources')} className="btn-secondary !text-xs">
                    Manage Sources
                  </button>
                }
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
