import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import CallbackRemindersWidget from './CallbackRemindersWidget';
import {
  LayoutDashboard, Users, Briefcase, Clock, TrendingUp, TrendingDown,
  ArrowRight, UserPlus, FileText, Loader2, Mail, Kanban
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

const StatCard = ({ icon: Icon, label, value, trend, gradient, loading, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="relative card-ats-bordered p-5 min-h-[110px] flex flex-col justify-between overflow-hidden text-left w-full group hover:border-brand-200/80 transition-all duration-300 hover:-translate-y-0.5"
  >
    <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient}`} />
    <div className="flex items-start justify-between gap-3">
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
      <div className={`p-3 rounded-xl flex-shrink-0 bg-gradient-to-br ${gradient} shadow-md group-hover:scale-105 transition-transform duration-300`}>
        <Icon size={22} className="text-white" />
      </div>
    </div>
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
      <>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <Loader2 size={40} className="animate-spin text-brand-600 mx-auto mb-4" />
            <p className="text-stone-500 text-sm font-medium">Loading dashboard…</p>
          </div>
        </div>
      </>
    );
  }

  const d = dashData || {};
  const maxPipeline = Math.max(...(d.pipeline || []).map((p) => p.count), 1);
  const hiredCount = (d.pipeline || [])
    .filter((p) => p.stage === 'Hired' || p.stage === 'Joined')
    .reduce((sum, p) => sum + p.count, 0);

  return (
    <>
      <div className="page-shell-ats">
        <PageHeader
          icon={LayoutDashboard}
          title={`Welcome back, ${displayName}`}
          subtitle={`Recruitment overview for ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}.`}
          gradientTitle
        >
          <button type="button" onClick={() => navigate('/add-candidate')} className="btn-primary">
            <UserPlus size={16} /> Add Candidate
          </button>
        </PageHeader>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium animate-fade-in">
            {error}. Showing cached data if available.
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up">
          <StatCard icon={Users} label="Total Candidates" value={d.totalCandidates || 0} trend={d.candidateTrend} gradient="from-brand-500 to-teal-400" loading={loading} onClick={() => navigate('/ats')} />
          <StatCard icon={UserPlus} label="Added This Month" value={d.thisMonth || 0} gradient="from-emerald-500 to-lime-400" loading={loading} onClick={() => navigate('/ats')} />
          <StatCard icon={Clock} label="Pending Review" value={d.pendingReview || 0} gradient="from-amber-500 to-orange-400" loading={loading} onClick={() => navigate('/pending-review')} />
          <StatCard icon={Briefcase} label="Hired / Joined" value={hiredCount} gradient="from-violet-500 to-fuchsia-400" loading={loading} onClick={() => navigate('/applications')} />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card-ats-bordered p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-stone-900">Recent Candidates</h2>
              <button
                type="button"
                onClick={() => navigate('/ats')}
                className="text-brand-600 hover:text-brand-700 text-sm font-semibold flex items-center gap-1 transition-colors"
              >
                View All <ArrowRight size={14} />
              </button>
            </div>
            {(d.recentCandidates || []).length > 0 ? (
              <div className="space-y-0.5">
                {d.recentCandidates.map((c, i) => (
                  <div key={i} className="list-row-ats justify-between cursor-pointer" onClick={() => navigate('/ats')}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 text-brand-700 flex items-center justify-center text-xs font-bold flex-shrink-0 ring-1 ring-brand-200/60">
                        {(c.name || 'N')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-stone-900 truncate">{c.name}</p>
                        <p className="text-xs text-stone-500 truncate">
                          {c.position || 'No position'}{c.source ? ` · ${c.source}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={statusColor(c.status)}>{c.status}</span>
                      <span className="text-xs text-stone-400 hidden sm:inline">{formatTimeAgo(c.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Users}
                message="No candidates yet"
                subMessage="Add your first candidate to get started."
                action={
                  <button type="button" onClick={() => navigate('/add-candidate')} className="btn-primary">
                    <UserPlus size={16} /> Add Candidate
                  </button>
                }
              />
            )}
          </div>

          <div className="space-y-6">
            <div className="card-ats-bordered p-6">
              <h2 className="text-base font-bold text-stone-900 mb-4">Quick Actions</h2>
              <div className="space-y-2.5">
                <button type="button" onClick={() => navigate('/add-candidate')} className="btn-primary w-full justify-start">
                  <UserPlus size={16} /> Add Candidate
                </button>
                <button type="button" onClick={() => navigate('/ats')} className="btn-secondary w-full justify-start">
                  <Users size={16} /> View All Candidates
                </button>
                <button type="button" onClick={() => navigate('/recruitment')} className="btn-secondary w-full justify-start">
                  <Kanban size={16} /> Pipeline Board
                </button>
                <button type="button" onClick={() => navigate('/resume-parsing')} className="btn-secondary w-full justify-start">
                  <FileText size={16} /> Resume Parsing
                </button>
                <button type="button" onClick={() => navigate('/email-templates')} className="btn-secondary w-full justify-start">
                  <Mail size={16} /> Email Templates
                </button>
              </div>
            </div>
          </div>
        </div>

        <CallbackRemindersWidget />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card-ats-bordered p-6">
            <h2 className="text-base font-bold text-stone-900 mb-5">Hiring Pipeline</h2>
            {(d.pipeline || []).length > 0 ? (
              <div className="space-y-4">
                {d.pipeline.filter((p) => p.count > 0).map((item) => (
                  <div key={item.stage}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-stone-700">{item.stage}</span>
                      <span className="text-sm font-bold text-stone-900 tabular-nums">{item.count}</span>
                    </div>
                    <div className="w-full bg-stone-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`${pipelineColors[item.stage] || 'bg-brand-500'} h-2.5 rounded-full transition-all duration-700 ease-out`}
                        style={{ width: `${Math.max((item.count / maxPipeline) * 100, 2)}%` }}
                      />
                    </div>
                  </div>
                ))}
                {d.pipeline.every((p) => p.count === 0) && (
                  <EmptyState message="No pipeline data yet" className="py-6" />
                )}
              </div>
            ) : (
              <EmptyState message="No pipeline data yet" className="py-8" />
            )}
          </div>

          <div className="space-y-6">
            <div className="card-ats-bordered p-6">
              <h2 className="text-base font-bold text-stone-900 mb-4">Top Positions</h2>
              {(d.topPositions || []).length > 0 ? (
                <div className="space-y-1">
                  {d.topPositions.map((item, i) => (
                    <div key={i} className="list-row-ats justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-6 h-6 bg-brand-50 text-brand-700 border border-brand-200/70 rounded-md text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-sm font-medium text-stone-800 truncate">{item.position}</span>
                      </div>
                      <span className="badge-neutral">{item.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState message="No position data" className="py-6" />
              )}
            </div>

            <div className="card-ats-bordered p-6">
              <h2 className="text-base font-bold text-stone-900 mb-4">Top Sources</h2>
              {(d.topSources || []).length > 0 ? (
                <div className="space-y-1">
                  {d.topSources.map((item, i) => (
                    <div key={i} className="list-row-ats justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-6 h-6 bg-emerald-50 text-emerald-700 border border-emerald-200/70 rounded-md text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-sm font-medium text-stone-800 truncate">{item.source}</span>
                      </div>
                      <span className="badge-neutral">{item.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState message="No source data" className="py-6" />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default DashboardPage;
