import React from 'react';
import { Briefcase, ArrowRight, ChevronRight, MapPin } from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import useRecentJobs from '../../hooks/useRecentJobs';
import { formatTimeAgo } from './dashboardConstants';
import { STATUS_STYLES, DOT_STYLES } from '../jobs/jobsConstants';

/**
 * Recent job openings — enterprise dashboard widget (mirrors Company Notices).
 */
export default function DashboardRecentJobsWidget({ navigate }) {
  const { rows, loading, enabled } = useRecentJobs(5);

  if (!enabled) return null;

  return (
    <div data-tour="dash-jobs" className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-stone-900 tracking-tight flex items-center gap-2">
          <Briefcase size={16} className="text-brand-600" />
          Recent Job Openings
        </h2>
        <button
          type="button"
          onClick={() => navigate('/jobs')}
          className="text-brand-600 hover:text-brand-700 text-sm font-semibold flex items-center gap-1 transition-all hover:gap-1.5"
        >
          View All <ArrowRight size={14} />
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 skeleton-ats rounded-xl" />
          ))}
        </div>
      ) : rows.length > 0 ? (
        <div className="space-y-0.5">
          {rows.map((job) => {
            const title = job.role || job.title || 'Untitled job';
            const status = job.status || 'Open';
            return (
              <button
                key={job._id}
                type="button"
                onClick={() => navigate('/jobs')}
                className="list-row-ats justify-between w-full text-left transition-all duration-200 hover:bg-brand-50/50 hover:pl-4 group/job"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 text-brand-700 flex items-center justify-center flex-shrink-0 ring-1 ring-brand-200/60 transition-transform duration-300 group-hover/job:scale-105">
                    <Briefcase size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-stone-900 truncate uppercase group-hover/job:text-brand-700 transition-colors">
                      {title}
                    </p>
                    <p className="text-xs text-stone-500 truncate flex items-center gap-1">
                      <MapPin size={11} className="flex-shrink-0" />
                      {job.location || 'Location not set'}
                      {job.clientName ? ` · ${job.clientName}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border whitespace-nowrap ${STATUS_STYLES[status] || STATUS_STYLES.Open}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${DOT_STYLES[status] || DOT_STYLES.Open}`} />
                    {status}
                  </span>
                  <span className="text-xs text-stone-400 hidden sm:inline tabular-nums">
                    {formatTimeAgo(job.createdAt)}
                  </span>
                  <ChevronRight size={14} className="text-stone-300 opacity-0 group-hover/job:opacity-100 transition-opacity" />
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Briefcase}
          tone="brand"
          compact
          message="No open jobs yet"
          subMessage="Create a job opening to notify your hiring team by email and in-app."
          action={
            <button type="button" onClick={() => navigate('/jobs')} className="btn-primary !text-xs">
              Create job opening
            </button>
          }
        />
      )}
    </div>
  );
}
