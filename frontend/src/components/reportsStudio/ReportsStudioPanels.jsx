import React from 'react';
import { Link } from 'react-router-dom';
import {
  Clock, GitBranch, Radio, Briefcase, Search, X, Download, ArrowRight,
} from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import { PIPELINE_BAR, SOURCE_BAR } from './reportsStudioConstants';
import { StatCard, ReportCard, BreakdownBars } from './ReportsStudioWidgets';

export function ReportsStudioBody({
  loading,
  tth,
  pipeline,
  sources,
  jobs,
  filteredJobs,
  pipelineTotal,
  sourcesTotal,
  showPipeline,
  showSources,
  showJobs,
  jobQuery,
  setJobQuery,
  exportCsv,
}) {
  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-[118px] skeleton-ats rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="h-72 skeleton-ats rounded-2xl" />
          <div className="h-72 skeleton-ats rounded-2xl" />
        </div>
        <div className="h-64 skeleton-ats rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div data-tour="reports-kpis" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Clock}
          label="Avg time-to-hire"
          value={`${tth?.averageDays ?? '—'} days`}
          sub={tth?.samples?.length ? `${tth.samples.length} hires measured` : 'Across closed hires'}
          gradient="from-brand-500 to-teal-400"
        />
        <StatCard
          icon={GitBranch}
          label="Pipeline volume"
          value={pipelineTotal}
          sub={`${pipeline.length} stage${pipeline.length === 1 ? '' : 's'} tracked`}
          gradient="from-sky-500 to-cyan-400"
        />
        <StatCard
          icon={Radio}
          label="Source volume"
          value={sourcesTotal}
          sub={`${sources.length} source${sources.length === 1 ? '' : 's'} tracked`}
          gradient="from-emerald-500 to-lime-400"
        />
        <StatCard
          icon={Briefcase}
          label="Jobs reported"
          value={jobs.length}
          sub="Performance rows available"
          gradient="from-violet-500 to-fuchsia-400"
        />
      </div>

      {(showPipeline || showSources) && (
        <div data-tour="reports-charts" className={`grid grid-cols-1 gap-4 sm:gap-6 ${showPipeline && showSources ? 'lg:grid-cols-2' : ''}`}>
          {showPipeline && (
            <ReportCard
              title="Hiring pipeline"
              icon={GitBranch}
              onExport={() => exportCsv(pipeline, 'pipeline.csv')}
              exportDisabled={!pipeline.length}
            >
              <BreakdownBars
                rows={pipeline}
                labelKey="stage"
                valueKey="count"
                colors={PIPELINE_BAR}
                emptyIcon={GitBranch}
                emptyMessage="No pipeline data yet"
              />
            </ReportCard>
          )}

          {showSources && (
            <ReportCard
              title="Source quality"
              icon={Radio}
              onExport={() => exportCsv(sources, 'sources.csv')}
              exportDisabled={!sources.length}
            >
              <BreakdownBars
                rows={sources}
                labelKey="source"
                valueKey="count"
                colors={SOURCE_BAR}
                emptyIcon={Radio}
                emptyMessage="No source data yet"
              />
            </ReportCard>
          )}
        </div>
      )}

      {showJobs && (
        <div data-tour="reports-jobs" className="table-shell-ats relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 opacity-80 z-10" />
          <div className="p-4 sm:p-5 border-b border-stone-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 border border-brand-200/70 flex items-center justify-center flex-shrink-0">
                <Briefcase className="w-4 h-4 text-brand-600" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-stone-900 tracking-tight">Job performance</h2>
                <p className="text-[11px] text-stone-400 font-medium">
                  {filteredJobs.length} of {jobs.length} role{jobs.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto min-w-0">
              <div className="relative flex-1 sm:min-w-[14rem] lg:w-64">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                <input
                  type="search"
                  className="input-ats !pl-10 !pr-9 w-full"
                  placeholder="Search jobs…"
                  value={jobQuery}
                  onChange={(e) => setJobQuery(e.target.value)}
                />
                {jobQuery && (
                  <button
                    type="button"
                    onClick={() => setJobQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                type="button"
                className="btn-secondary !py-2.5 !text-xs w-full sm:w-auto"
                onClick={() => exportCsv(filteredJobs, 'jobs-performance.csv')}
                disabled={!filteredJobs.length}
              >
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            </div>
          </div>

          {jobs.length === 0 ? (
            <div className="p-4 sm:p-6">
              <EmptyState
                icon={Briefcase}
                tone="amber"
                compact
                message="No job performance data"
                subMessage="Available on plans with custom reports, once applications exist."
                action={
                  <Link to="/jobs" className="btn-secondary !text-xs">
                    Open jobs <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                }
              />
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="p-4 sm:p-6">
              <EmptyState
                icon={Search}
                tone="amber"
                compact
                message="No matching jobs"
                subMessage="Try a different search term."
                action={
                  <button type="button" className="btn-secondary !text-xs" onClick={() => setJobQuery('')}>
                    Clear search
                  </button>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead className="bg-stone-50/80 text-stone-500 text-left">
                  <tr>
                    <th className="px-4 sm:px-5 py-3 text-xs font-bold uppercase tracking-wide">Job</th>
                    <th className="px-4 sm:px-5 py-3 text-xs font-bold uppercase tracking-wide">Apps</th>
                    <th className="px-4 sm:px-5 py-3 text-xs font-bold uppercase tracking-wide">Hired</th>
                    <th className="px-4 sm:px-5 py-3 text-xs font-bold uppercase tracking-wide">Hire rate</th>
                    <th className="px-4 sm:px-5 py-3 text-xs font-bold uppercase tracking-wide w-40">Funnel</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs.map((j) => {
                    const apps = Number(j.applications) || 0;
                    const hired = Number(j.hired) || 0;
                    const rate = Number(j.hireRate) || 0;
                    return (
                      <tr key={j.jobId || j.title} className="border-t border-stone-50 hover:bg-brand-50/30 transition-colors">
                        <td className="px-4 sm:px-5 py-3 font-semibold text-stone-800 max-w-[240px] truncate">
                          {j.title || 'Untitled role'}
                        </td>
                        <td className="px-4 sm:px-5 py-3 tabular-nums text-stone-700">{apps}</td>
                        <td className="px-4 sm:px-5 py-3 tabular-nums text-stone-700">{hired}</td>
                        <td className="px-4 sm:px-5 py-3">
                          <span className={`badge-ats text-[10px] ${
                            rate >= 20 ? 'badge-success' : rate >= 10 ? 'badge-info' : 'badge-neutral'
                          }`}>
                            {rate}%
                          </span>
                        </td>
                        <td className="px-4 sm:px-5 py-3">
                          <div className="h-2 rounded-full bg-stone-100 overflow-hidden max-w-[8rem]">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-brand-500 to-teal-500 transition-all duration-700"
                              style={{ width: `${Math.min(100, Math.max(rate > 0 ? 6 : 0, rate))}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
