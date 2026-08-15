import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, UserPlus, Briefcase, Send, ArrowRight, MapPin, Clock,
  ChevronRight, Inbox, Kanban,
} from 'lucide-react';
import { authenticatedFetch, isUnauthorized, handleUnauthorized, readApiJson } from '../../utils/fetchUtils';
import EmptyState from '../ui/EmptyState';
import { StatCard, QuickAction } from './DashboardWidgets';
import { formatTimeAgo, statusColor } from './dashboardConstants';
import CallbackRemindersWidget from '../CallbackRemindersWidget';

function mandateTitle(job) {
  return job?.title || job?.role || 'Untitled mandate';
}

const SUB_BADGE = {
  submitted: 'badge-warning',
  reviewing: 'badge-info',
  shortlisted: 'badge-success',
  rejected: 'badge-danger',
};

const SUB_LABEL = {
  submitted: 'Awaiting SPOC',
  reviewing: 'In review',
  shortlisted: 'Shortlisted',
  rejected: 'Returned',
};

export default function FreelancerDashboard() {
  const navigate = useNavigate();
  const [desk, setDesk] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authenticatedFetch('/api/freelancer/desk');
        if (isUnauthorized(res)) return handleUnauthorized();
        const json = await readApiJson(res);
        if (!cancelled) setDesk(json.data || {});
      } catch {
        if (!cancelled) setDesk({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const d = desk || {};
  const mandates = d.mandates || [];
  const submissions = d.recentSubmissions || [];
  const recent = d.recentCandidates || [];

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
          value={d.totalCandidates || 0}
          gradient="from-brand-500 to-teal-400"
          onClick={() => navigate('/ats')}
        />
        <StatCard
          icon={UserPlus}
          label="Added this month"
          value={d.thisMonth || 0}
          gradient="from-emerald-500 to-lime-400"
          onClick={() => navigate('/ats')}
        />
        <StatCard
          icon={Briefcase}
          label="Open mandates"
          value={d.openMandates || 0}
          gradient="from-indigo-500 to-violet-400"
          onClick={() => navigate('/mandates')}
        />
        <StatCard
          icon={Clock}
          label="Awaiting SPOC"
          value={d.awaitingReview || 0}
          gradient="from-amber-500 to-orange-400"
          onClick={() => navigate('/mandates')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div data-tour="dash-mandates" className="lg:col-span-2 card-ats-bordered p-5 sm:p-6 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-brand-500 to-teal-500" />
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-stone-900 tracking-tight">Open mandates</h2>
            <button
              type="button"
              onClick={() => navigate('/mandates')}
              className="text-brand-600 hover:text-brand-700 text-sm font-semibold flex items-center gap-1 transition-all hover:gap-1.5"
            >
              View all <ArrowRight size={14} />
            </button>
          </div>
          {mandates.length > 0 ? (
            <div className="space-y-0.5">
              {mandates.map((job) => (
                <button
                  key={job._id}
                  type="button"
                  onClick={() => navigate('/mandates')}
                  className="list-row-ats justify-between w-full text-left hover:bg-indigo-50/50 group/row"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-stone-900 truncate group-hover/row:text-brand-700">
                      {mandateTitle(job)}
                    </p>
                    <p className="text-xs text-stone-500 truncate flex items-center gap-1.5 mt-0.5">
                      {job.location && (
                        <>
                          <MapPin size={11} className="flex-shrink-0" />
                          {job.location}
                        </>
                      )}
                      {job.department ? `${job.location ? ' · ' : ''}${job.department}` : ''}
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-stone-300 flex-shrink-0" />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Briefcase}
              tone="violet"
              compact
              message="No open mandates yet"
              subMessage="When the company opens a requisition, it appears here for you to submit against."
            />
          )}
        </div>

        <div data-tour="dash-actions" className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <h2 className="text-base font-bold text-stone-900 tracking-tight mb-4">Quick actions</h2>
          <div className="space-y-2">
            <QuickAction icon={UserPlus} label="Add candidate" desc="To your private desk" onClick={() => navigate('/ats?add=1')} tone="bg-brand-50 text-brand-600" />
            <QuickAction icon={Users} label="My candidates" desc="Only people you added" onClick={() => navigate('/ats')} tone="bg-sky-50 text-sky-600" />
            <QuickAction icon={Send} label="Submit to SPOC" desc="Handoff against a mandate" onClick={() => navigate('/mandates')} tone="bg-indigo-50 text-indigo-600" />
            <QuickAction icon={Kanban} label="My pipeline" desc="Read-only SPOC status board" onClick={() => navigate('/my-pipeline')} tone="bg-violet-50 text-violet-600" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div data-tour="dash-submissions" className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 to-orange-400" />
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-stone-900 tracking-tight">Recent submissions</h2>
            <button
              type="button"
              onClick={() => navigate('/my-pipeline')}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
            >
              Pipeline <ArrowRight size={12} />
            </button>
          </div>
          {submissions.length > 0 ? (
            <div className="space-y-0.5">
              {submissions.map((row) => {
                const cand = row.candidateId || {};
                const job = row.jobId || {};
                return (
                  <div key={row._id} className="list-row-ats justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-stone-900 truncate">{cand.name || 'Candidate'}</p>
                      <p className="text-xs text-stone-500 truncate">{mandateTitle(job)}</p>
                    </div>
                    <span className={`${SUB_BADGE[row.status] || 'badge-neutral'} flex-shrink-0`}>
                      {SUB_LABEL[row.status] || row.status}
                    </span>
                  </div>
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

        <div className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-stone-900 tracking-tight">My recent candidates</h2>
            <button
              type="button"
              onClick={() => navigate('/ats')}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
            >
              View all <ArrowRight size={12} />
            </button>
          </div>
          {recent.length > 0 ? (
            <div className="space-y-0.5">
              {recent.map((c) => (
                <button
                  key={c._id}
                  type="button"
                  onClick={() => navigate(c.name ? `/ats?q=${encodeURIComponent(c.name)}` : '/ats')}
                  className="list-row-ats justify-between w-full text-left hover:bg-brand-50/50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 text-brand-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {(c.name || 'N')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-stone-900 truncate">{c.name}</p>
                      <p className="text-xs text-stone-500 truncate">{c.position || c.email || 'No position'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={statusColor(c.status)}>{c.status}</span>
                    <span className="text-xs text-stone-400 hidden sm:inline">{formatTimeAgo(c.createdAt)}</span>
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
              subMessage="Add people here. The company ATS will not see them until you submit to a SPOC."
              action={(
                <button type="button" onClick={() => navigate('/ats?add=1')} className="btn-primary !text-xs">
                  <UserPlus size={14} /> Add candidate
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
