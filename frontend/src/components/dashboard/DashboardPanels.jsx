import React from 'react';
import {
  Users, Briefcase, Clock, ArrowRight, UserPlus, FileText, Mail, Kanban,
  BarChart3, Building2, Radio, ChevronRight, GitBranch,
} from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import { StatCard, QuickAction } from './DashboardWidgets';
import { formatTimeAgo, pipelineColors, stageRoutes, statusColor } from './dashboardConstants';

export function DashboardKpis({ d, navigate }) {
  const hiredCount = (d.pipeline || [])
    .filter((p) => p.stage === 'Hired' || p.stage === 'Joined')
    .reduce((sum, p) => sum + p.count, 0);

  return (
    <div data-tour="dash-kpis" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
        onClick={() => navigate('/applications')}
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
  );
}

export function DashboardMainGrid({ d, navigate }) {
  return (
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

      <div data-tour="dash-actions" className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden">
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
  );
}

export function DashboardLowerGrid({ d, navigate }) {
  const maxPipeline = Math.max(...(d.pipeline || []).map((p) => p.count), 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div data-tour="dash-pipeline" className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden">
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
                <button type="button" onClick={() => navigate('/ats')} className="btn-secondary !text-xs">
                  <Building2 size={14} /> Open Candidates
                </button>
              }
            />
          )}
        </div>

        <div className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-lime-400" />
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-stone-900 tracking-tight flex items-center gap-2">
              <Radio size={16} className="text-emerald-500" /> Top Sources
            </h2>
            <button
              type="button"
              onClick={() => navigate('/ats')}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-all hover:gap-1.5"
            >
              View candidates <ArrowRight size={12} />
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
                <button type="button" onClick={() => navigate('/ats')} className="btn-secondary !text-xs">
                  Open Candidates
                </button>
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
