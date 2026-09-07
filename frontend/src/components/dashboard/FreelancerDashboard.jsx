import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, UserPlus, Briefcase, Send, ArrowRight, MapPin, Clock,
  Inbox, Kanban, MessageSquare, BarChart3, Target, Building2, GitBranch,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { authenticatedFetch, isUnauthorized, handleUnauthorized, readApiJson } from '../../utils/fetchUtils';
import EmptyState from '../ui/EmptyState';
import { StatCard, QuickAction } from './DashboardWidgets';
import { formatTimeAgo } from './dashboardConstants';
import { buildFreelancerStats } from './freelancerDashStats';
import CallbackRemindersWidget from '../CallbackRemindersWidget';

function mandateTitle(job) {
  return job?.title || job?.role || 'Untitled mandate';
}

const SUB_BADGE = {
  submitted: 'badge-warning',
  reviewing: 'badge-info',
  shortlisted: 'badge-success',
  selection: 'badge-info',
  joined: 'badge-success',
  rejected: 'badge-danger',
};

const SUB_LABEL = {
  submitted: 'Submitted',
  reviewing: 'Reviewing',
  shortlisted: 'Shortlisting',
  selection: 'Selection',
  joined: 'Joined',
  rejected: 'Rejected',
};

const AUTO_REFRESH_MS = 20_000;

export default function FreelancerDashboard() {
  const navigate = useNavigate();
  const [desk, setDesk] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadDesk = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [deskRes, candRes, subRes] = await Promise.all([
        authenticatedFetch('/api/freelancer/desk'),
        authenticatedFetch('/api/freelancer/candidates'),
        authenticatedFetch('/api/freelancer/submissions'),
      ]);
      if (isUnauthorized(deskRes) || isUnauthorized(candRes) || isUnauthorized(subRes)) {
        return handleUnauthorized();
      }
      const [deskJson, candJson, subJson] = await Promise.all([
        readApiJson(deskRes),
        readApiJson(candRes),
        readApiJson(subRes),
      ]);
      setDesk(deskJson.data || {});
      setCandidates(Array.isArray(candJson.data) ? candJson.data : []);
      setSubmissions(Array.isArray(subJson.data) ? subJson.data : []);
    } catch {
      if (!silent) {
        setDesk({});
        setCandidates([]);
        setSubmissions([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDesk();
    const id = window.setInterval(() => loadDesk({ silent: true }), AUTO_REFRESH_MS);
    const onFocus = () => loadDesk({ silent: true });
    const onVis = () => {
      if (document.visibilityState === 'visible') loadDesk({ silent: true });
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    const onDashRefresh = (e) => loadDesk({ silent: e?.detail?.silent !== false });
    const onCandidatesChanged = () => loadDesk({ silent: true });
    window.addEventListener('dashboard:refresh', onDashRefresh);
    window.addEventListener('candidates:changed', onCandidatesChanged);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('dashboard:refresh', onDashRefresh);
      window.removeEventListener('candidates:changed', onCandidatesChanged);
    };
  }, [loadDesk]);

  const d = useMemo(
    () => buildFreelancerStats({ desk: desk || {}, candidates, submissions }),
    [desk, candidates, submissions]
  );
  const maxPipeline = Math.max(...d.pipeline.map((p) => p.count), 1);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-[118px] skeleton-ats rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-72 skeleton-ats rounded-2xl" />
          <div className="h-72 skeleton-ats rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div data-tour="dash-kpis" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="My candidates"
          value={d.totalCandidates}
          hint={d.thisMonth > 0 ? `+${d.thisMonth} this month` : '0 this month'}
          hintTone={d.thisMonth > 0 ? 'up' : 'neutral'}
          gradient="from-brand-500 to-teal-400"
          onClick={() => navigate('/ats')}
        />
        <StatCard
          icon={UserPlus}
          label="Added this month"
          value={d.thisMonth}
          gradient="from-emerald-500 to-lime-400"
          onClick={() => navigate('/ats')}
        />
        <StatCard
          icon={Target}
          label="Shortlist rate"
          value={`${d.conversionRate}%`}
          gradient="from-cyan-500 to-sky-400"
          onClick={() => navigate('/my-pipeline')}
        />
        <StatCard
          icon={Clock}
          label="Awaiting review"
          value={d.awaitingReview}
          hint={d.slaBreaches > 0 ? `${d.slaBreaches} past SLA` : 'Within review window'}
          hintTone={d.slaBreaches > 0 ? 'down' : 'neutral'}
          gradient="from-amber-500 to-orange-400"
          onClick={() => navigate('/my-pipeline')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div data-tour="dash-chart" className="lg:col-span-2 card-ats-bordered p-5 sm:p-6 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <h2 className="text-base font-bold text-stone-900 tracking-tight">Desk activity</h2>
              <p className="text-xs text-stone-500 mt-0.5">Candidates added and submissions in the last 7 days</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/analytics')}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 inline-flex items-center gap-1"
            >
              Full analytics <ArrowRight size={12} />
            </button>
          </div>
          {d.daily.some((row) => row.added || row.submitted) ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={d.daily} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="flAdded" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="flSubmitted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d97706" stopOpacity={0.16} />
                    <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#78716c' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#78716c' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '10px', border: '1px solid #e7e5e4', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                />
                <Area type="monotone" dataKey="added" stroke="#0d9488" strokeWidth={2.5} fill="url(#flAdded)" name="Added" />
                <Area type="monotone" dataKey="submitted" stroke="#d97706" strokeWidth={2.5} fill="url(#flSubmitted)" name="Submitted" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              icon={BarChart3}
              tone="brand"
              compact
              message="No activity this week"
              subMessage="Add a candidate or submit against a mandate to start the chart."
            />
          )}
        </div>

        <div data-tour="dash-actions" className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <h2 className="text-base font-bold text-stone-900 tracking-tight mb-4">Quick actions</h2>
          <div className="space-y-2">
            <QuickAction icon={UserPlus} label="Add candidate" desc="To your private desk" onClick={() => navigate('/ats?add=1')} tone="bg-brand-50 text-brand-600" />
            <QuickAction icon={Briefcase} label="Open mandates" desc="Requisitions you can work" onClick={() => navigate('/mandates')} tone="bg-indigo-50 text-indigo-600" />
            <QuickAction icon={Kanban} label="Pipeline Board" desc="Hiring manager status" onClick={() => navigate('/my-pipeline')} tone="bg-violet-50 text-violet-600" />
            <QuickAction icon={BarChart3} label="Analytics" desc="Your desk performance" onClick={() => navigate('/analytics')} tone="bg-fuchsia-50 text-fuchsia-600" />
            <QuickAction icon={MessageSquare} label="Support" desc="Query or product feedback" onClick={() => navigate('/feedback')} tone="bg-amber-50 text-amber-700" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div data-tour="dash-pipeline" className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <h2 className="text-base font-bold text-stone-900 tracking-tight">Submission pipeline</h2>
              <p className="text-xs text-stone-500 mt-0.5">
                {d.submittedTotal} submitted · {d.totalCandidates} on desk
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/my-pipeline')}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 shrink-0"
            >
              Open board <ArrowRight size={12} />
            </button>
          </div>
          {d.submittedTotal > 0 ? (
            <div className="space-y-3.5">
              {d.pipeline.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => navigate('/my-pipeline')}
                  className="w-full text-left group/pipe rounded-lg p-1.5 -mx-1.5 transition-colors hover:bg-stone-50"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-stone-700 group-hover/pipe:text-stone-900">{item.label}</span>
                    <span className="text-sm font-bold text-stone-900 tabular-nums">{item.count}</span>
                  </div>
                  <div className="w-full bg-stone-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`${item.color} h-2.5 rounded-full transition-all duration-700 ease-out`}
                      style={{ width: `${Math.max((item.count / maxPipeline) * 100, item.count ? 4 : 0)}%` }}
                    />
                  </div>
                </button>
              ))}
              <div className="pt-3 border-t border-stone-100 grid grid-cols-2 gap-3">
                <div className="text-center p-2.5 bg-emerald-50 rounded-xl">
                  <p className="text-lg font-bold text-emerald-700 tabular-nums">{d.shortlisted}</p>
                  <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wide">Shortlisted</p>
                </div>
                <div className="text-center p-2.5 bg-red-50 rounded-xl">
                  <p className="text-lg font-bold text-red-700 tabular-nums">{d.rejectionRate}%</p>
                  <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wide">Rejected</p>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={GitBranch}
              tone="violet"
              compact
              message="No submissions yet"
              subMessage="Submit from your desk against an open mandate. Status is updated by the hiring manager."
              action={(
                <button type="button" onClick={() => navigate('/mandates')} className="btn-secondary !text-xs">
                  <Send size={14} /> Open mandates
                </button>
              )}
            />
          )}
        </div>

        <div className="space-y-6">
          <div className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 to-fuchsia-400" />
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-stone-900 tracking-tight flex items-center gap-2">
                <Briefcase size={16} className="text-violet-500" /> Top positions
              </h2>
              <button type="button" onClick={() => navigate('/ats')} className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                View desk
              </button>
            </div>
            {d.topPositions.length > 0 ? (
              <div className="space-y-0.5">
                {d.topPositions.map((item, i) => (
                  <button
                    key={item.position}
                    type="button"
                    onClick={() => navigate(`/ats?q=${encodeURIComponent(item.position)}`)}
                    className="list-row-ats justify-between w-full text-left group/pos hover:bg-violet-50/50"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 h-6 bg-violet-50 text-violet-700 border border-violet-200/70 rounded-md text-[11px] font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium text-stone-800 truncate">{item.position}</span>
                    </div>
                    <span className="badge-neutral">{item.count}</span>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState icon={Briefcase} tone="violet" compact message="No position data" subMessage="Roles on your desk will rank here." />
            )}
          </div>

          <div className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 to-violet-400" />
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-stone-900 tracking-tight flex items-center gap-2">
                <Building2 size={16} className="text-indigo-500" /> Mandates worked
              </h2>
              <button type="button" onClick={() => navigate('/mandates')} className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                Open mandates
              </button>
            </div>
            {d.topMandates.length > 0 ? (
              <div className="space-y-0.5">
                {d.topMandates.map((item, i) => (
                  <button
                    key={item.mandate}
                    type="button"
                    onClick={() => navigate('/my-pipeline')}
                    className="list-row-ats justify-between w-full text-left hover:bg-indigo-50/50"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 h-6 bg-indigo-50 text-indigo-700 border border-indigo-200/70 rounded-md text-[11px] font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium text-stone-800 truncate">{item.mandate}</span>
                    </div>
                    <span className="badge-neutral">{item.count}</span>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState icon={Building2} tone="violet" compact message="No mandate history" subMessage="Your first submission will appear here." />
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div data-tour="dash-recent" className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-stone-900 tracking-tight">Recent candidates</h2>
            <button type="button" onClick={() => navigate('/ats')} className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1">
              View all <ArrowRight size={12} />
            </button>
          </div>
          {d.recentCandidates.length > 0 ? (
            <div className="space-y-0.5">
              {d.recentCandidates.map((c) => (
                <button
                  key={c._id || c.id}
                  type="button"
                  onClick={() => navigate(c.name ? `/ats?q=${encodeURIComponent(c.name)}` : '/ats')}
                  className="list-row-ats justify-between w-full text-left hover:bg-brand-50/50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 text-brand-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {(c.name || 'N')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-stone-900 truncate">{c.name}</p>
                      <p className="text-xs text-stone-500 truncate">{c.position || c.email || 'No position'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-stone-400">{formatTimeAgo(c.createdAt)}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Users}
              tone="brand"
              compact
              message="Your desk is empty"
              subMessage="Add people here. The company ATS will not see them until you submit."
              action={(
                <button type="button" onClick={() => navigate('/ats?add=1')} className="btn-primary !text-xs">
                  <UserPlus size={14} /> Add candidate
                </button>
              )}
            />
          )}
        </div>

        <div data-tour="dash-submissions" className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 to-orange-400" />
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-stone-900 tracking-tight">Recent submissions</h2>
            <button type="button" onClick={() => navigate('/my-pipeline')} className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1">
              Pipeline Board <ArrowRight size={12} />
            </button>
          </div>
          {d.recentSubmissions.length > 0 ? (
            <div className="space-y-0.5">
              {d.recentSubmissions.map((row) => {
                const cand = row.candidateId && typeof row.candidateId === 'object' ? row.candidateId : {};
                const job = row.jobId && typeof row.jobId === 'object' ? row.jobId : {};
                return (
                  <button
                    key={row._id}
                    type="button"
                    onClick={() => navigate('/my-pipeline')}
                    className="list-row-ats justify-between w-full text-left hover:bg-amber-50/40"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-stone-900 truncate">{cand.name || 'Candidate'}</p>
                      <p className="text-xs text-stone-500 truncate flex items-center gap-1.5">
                        {mandateTitle(job)}
                        {job.location ? (
                          <>
                            <span>·</span>
                            <MapPin size={11} className="shrink-0" />
                            <span className="truncate">{job.location}</span>
                          </>
                        ) : null}
                      </p>
                      {row.feedback ? (
                        <p className="mt-1 text-[12px] text-stone-600 line-clamp-2 leading-relaxed">
                          <span className="font-semibold text-brand-700">Review · </span>
                          {row.feedback}
                        </p>
                      ) : null}
                    </div>
                    <span className={`${SUB_BADGE[row.status] || 'badge-neutral'} flex-shrink-0`}>
                      {SUB_LABEL[row.status] || row.status}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={Inbox}
              tone="amber"
              compact
              message="No submissions yet"
              subMessage="Add a candidate, then submit them against an open mandate."
              action={(
                <button type="button" onClick={() => navigate('/mandates')} className="btn-secondary !text-xs">
                  <Send size={14} /> Open mandates
                </button>
              )}
            />
          )}
        </div>
      </div>

      <CallbackRemindersWidget />
    </>
  );
}
