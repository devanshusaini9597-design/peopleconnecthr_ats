import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, UserPlus, Briefcase, Send, ArrowRight, MapPin, Inbox,
  Kanban, MessageSquare, BarChart3, Building2, GitBranch, CalendarPlus, ChevronRight,
} from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import { QuickAction } from './DashboardWidgets';
import { DashboardKpis } from './DashboardPanels';
import { formatTimeAgo, displayStatus, statusColor } from './dashboardConstants';
import { buildFreelancerStats } from './freelancerDashStats';
import CallbackRemindersWidget from '../CallbackRemindersWidget';
import { authenticatedFetch, isUnauthorized, handleUnauthorized, readApiJson } from '../../utils/fetchUtils';
import { pickCleanStageNote } from '../freelance/stageNoteUtils';

function mandateTitle(job) {
  return job?.title || job?.role || 'Untitled mandate';
}

/** Current-stage note only (matches My Pipeline hiring review). */
function currentStageFeedback(row) {
  const stage = String(
    (row?.candidateId && typeof row.candidateId === 'object' ? row.candidateId.status : '')
    || row?.boardStatus
    || ''
  ).trim();
  return pickCleanStageNote(row, stage);
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

/**
 * Freelancer dashboard — same card chrome / grid as company DashboardKpis + panels,
 * with desk-scoped metrics and pipeline links.
 */
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
        <div className="min-w-0 w-full mb-2">
          <div className="grid gap-4 sm:gap-5 min-w-0 w-full grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
              <div key={i} className="h-[120px] skeleton-ats rounded-2xl" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-72 skeleton-ats rounded-2xl" />
          <div className="h-72 skeleton-ats rounded-2xl" />
        </div>
      </div>
    );
  }

  // Same DashboardKpis component + StatCard chrome as company owner dashboard
  const kpiData = {
    ...d,
    totalCandidatesAllTime: d.totalCandidatesAllTime ?? d.totalCandidates,
    totalCandidates: d.thisMonth,
    statusCards: d.statusCards,
    pipeline: d.statusCards,
    scope: 'employee',
    atsView: 'mine',
  };

  return (
    <>
      <DashboardKpis
        d={kpiData}
        navigate={navigate}
        isFreelancer
        periodLabel="This Month"
        dateRange="month"
        dataFresh
      />

      {/* Main grid — company order: Recent candidates (2 cols) + Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div data-tour="dash-recent" className="lg:col-span-2 card-ats-bordered p-5 sm:p-6 relative overflow-hidden group/card">
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
          {d.recentCandidates.length > 0 ? (
            <div className="space-y-0.5">
              {d.recentCandidates.map((c) => (
                <button
                  key={c._id || c.id}
                  type="button"
                  onClick={() => navigate(c.name ? `/ats?q=${encodeURIComponent(c.name)}` : '/ats')}
                  className="list-row-ats justify-between w-full text-left transition-all duration-200 hover:bg-brand-50/50 hover:pl-4 group/row"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 text-brand-700 flex items-center justify-center text-xs font-bold flex-shrink-0 ring-1 ring-brand-200/60 transition-transform duration-300 group-hover/row:scale-105">
                      {(c.name || 'N')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-stone-900 truncate group-hover/row:text-brand-700 transition-colors">
                        {c.name}
                      </p>
                      <p className="text-xs text-stone-500 truncate">
                        {c.position || c.email || 'Position not set'}
                        {c.source ? ` · ${c.source}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={statusColor(c.status)}>{displayStatus(c.status || 'APPLIED')}</span>
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
              subMessage="Add people to your private desk. The company ATS will not see them until you submit."
              action={(
                <button type="button" onClick={() => navigate('/ats?add=1')} className="btn-primary">
                  <UserPlus size={16} /> Add Candidate
                </button>
              )}
            />
          )}
        </div>

        <div data-tour="dash-actions" className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <h2 className="text-base font-bold text-stone-900 tracking-tight mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <QuickAction icon={UserPlus} label="Add Candidate" desc="Create a new profile on your desk" onClick={() => navigate('/ats?add=1')} tone="bg-brand-50 text-brand-600" />
            <QuickAction icon={Users} label="My Candidates" desc="Open your ATS desk" onClick={() => navigate('/ats')} tone="bg-sky-50 text-sky-600" />
            <QuickAction icon={Briefcase} label="Open Mandates" desc="Jobs you can submit against" onClick={() => navigate('/mandates')} tone="bg-indigo-50 text-indigo-600" />
            <QuickAction icon={Kanban} label="Pipeline Board" desc="Hiring manager status updates" onClick={() => navigate('/my-pipeline')} tone="bg-violet-50 text-violet-600" />
            <QuickAction icon={BarChart3} label="Analytics" desc="Your desk performance" onClick={() => navigate('/analytics')} tone="bg-fuchsia-50 text-fuchsia-600" />
            <QuickAction icon={MessageSquare} label="Support" desc="Tickets · hiring team replies live" onClick={() => navigate('/feedback')} tone="bg-amber-50 text-amber-700" />
          </div>
        </div>
      </div>

      {/* Lower grid — company-style pipeline bars + side lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div data-tour="dash-pipeline" className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-bold text-stone-900 tracking-tight">Hiring Pipeline</h2>
              <p className="text-xs text-stone-500 mt-0.5">
                {d.submittedTotal} submitted · {d.totalCandidates} on desk
                {d.awaitingReview > 0 ? ` · ${d.awaitingReview} awaiting review` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/my-pipeline')}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-all hover:gap-1.5"
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
                    <span className="text-sm font-bold text-stone-900 tabular-nums flex items-center gap-1">
                      {item.count}
                      <ChevronRight size={12} className="text-stone-300 opacity-0 group-hover/pipe:opacity-100 transition-opacity" />
                    </span>
                  </div>
                  <div className="w-full bg-stone-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`${item.color} h-2.5 rounded-full transition-all duration-700 ease-out group-hover/pipe:brightness-110`}
                      style={{ width: `${Math.max((item.count / maxPipeline) * 100, item.count ? 4 : 0)}%` }}
                    />
                  </div>
                </button>
              ))}
              <div className="pt-3 border-t border-stone-100 grid grid-cols-3 gap-2.5">
                <div className="text-center p-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
                  <p className="text-lg font-bold text-emerald-700 tabular-nums">{d.shortlisted}</p>
                  <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wide">Shortlisted</p>
                </div>
                <div className="text-center p-2.5 bg-amber-50 rounded-xl border border-amber-100">
                  <p className="text-lg font-bold text-amber-700 tabular-nums">{d.awaitingReview}</p>
                  <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide">Awaiting</p>
                </div>
                <div className="text-center p-2.5 bg-red-50 rounded-xl border border-red-100">
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
              message="No pipeline data yet"
              subMessage="Submit from your desk against an open mandate. Status is updated by the hiring manager."
              action={(
                <button type="button" onClick={() => navigate('/mandates')} className="btn-secondary !text-xs">
                  <Send size={14} /> Open Mandates
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
                <Briefcase size={16} className="text-violet-500" /> Top Positions
              </h2>
              <button
                type="button"
                onClick={() => navigate('/ats')}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-all hover:gap-1.5"
              >
                View candidates <ArrowRight size={12} />
              </button>
            </div>
            {d.topPositions.length > 0 ? (
              <div className="space-y-0.5">
                {d.topPositions.map((item, i) => (
                  <button
                    key={item.position}
                    type="button"
                    onClick={() => navigate(`/ats?q=${encodeURIComponent(item.position)}`)}
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
                message="No positions to display"
                subMessage="Roles on your desk will rank here."
                action={(
                  <button type="button" onClick={() => navigate('/ats')} className="btn-secondary !text-xs">
                    <Building2 size={14} /> Open Candidates
                  </button>
                )}
              />
            )}
          </div>

          <div className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 to-violet-400" />
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-stone-900 tracking-tight flex items-center gap-2">
                <Building2 size={16} className="text-indigo-500" /> Top Mandates
              </h2>
              <button
                type="button"
                onClick={() => navigate('/mandates')}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-all hover:gap-1.5"
              >
                Open mandates <ArrowRight size={12} />
              </button>
            </div>
            {d.topMandates.length > 0 ? (
              <div className="space-y-0.5">
                {d.topMandates.map((item, i) => (
                  <button
                    key={item.mandate}
                    type="button"
                    onClick={() => navigate('/my-pipeline')}
                    className="list-row-ats justify-between w-full text-left group/pos hover:bg-indigo-50/50 transition-all duration-200"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 h-6 bg-indigo-50 text-indigo-700 border border-indigo-200/70 rounded-md text-[11px] font-bold flex items-center justify-center flex-shrink-0 transition-transform group-hover/pos:scale-110">
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium text-stone-800 truncate">{item.mandate}</span>
                    </div>
                    <span className="badge-neutral">{item.count}</span>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Building2}
                tone="violet"
                compact
                message="No mandate history"
                subMessage="Your first submission will appear here."
              />
            )}
          </div>
        </div>
      </div>

      {/* Recent submissions — freelancer-specific, same card chrome */}
      <div data-tour="dash-submissions" className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 to-orange-400" />
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-stone-900 tracking-tight">Recent Submissions</h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Status is company-updated · shortlist rate {d.conversionRate}%
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/my-pipeline')}
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-all hover:gap-1.5"
          >
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
                  className="list-row-ats justify-between w-full text-left transition-all duration-200 hover:bg-amber-50/40 hover:pl-4 group/row"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-stone-900 truncate group-hover/row:text-brand-700 transition-colors">
                      {cand.name || 'Candidate'}
                    </p>
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
                    {(() => {
                      const review = currentStageFeedback(row);
                      return review ? (
                        <p className="mt-1 text-[12px] text-stone-600 line-clamp-2 leading-relaxed">
                          <span className="font-semibold text-brand-700">Review · </span>
                          {review}
                        </p>
                      ) : null;
                    })()}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`${SUB_BADGE[row.status] || 'badge-neutral'}`}>
                      {SUB_LABEL[row.status] || row.status}
                    </span>
                    <ChevronRight size={14} className="text-stone-300 opacity-0 group-hover/row:opacity-100 transition-opacity" />
                  </div>
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
                <Send size={14} /> Open Mandates
              </button>
            )}
          />
        )}
      </div>

      <CallbackRemindersWidget />
    </>
  );
}
