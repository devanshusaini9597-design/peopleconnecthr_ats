import React from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Loader2, Users, Briefcase, GitPullRequest, X, ArrowRight,
  Filter, Sparkles, Building2,
} from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import { EXAMPLE_QUERIES, ENTITY_FILTERS, initials, statusBadgeClass } from './globalSearchConstants';

export function StatCard({ icon: Icon, label, value, gradient, loading, onClick }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`relative card-ats-bordered p-5 min-h-[108px] flex flex-col justify-between overflow-hidden text-left w-full group transition-all duration-300 ease-out ${
        onClick
          ? 'hover:-translate-y-1 hover:shadow-lg hover:shadow-stone-200/60 hover:border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400'
          : ''
      }`}
    >
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient} transition-all duration-300 group-hover:h-1.5`} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-stone-500 text-sm font-medium truncate">{label}</p>
          <p className="text-2xl sm:text-3xl font-bold text-stone-900 mt-1 tabular-nums tracking-tight">
            {loading ? '—' : value}
          </p>
        </div>
        <div className={`p-3 rounded-xl flex-shrink-0 bg-gradient-to-br ${gradient} shadow-md transition-transform duration-300 ease-out group-hover:scale-110 group-hover:rotate-3`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
    </Comp>
  );
}

export function GlobalSearchKpis({ hasQuery, totalMatches, counts, loading, setEntity }) {
  return (
    <div data-tour="search-kpis" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={Sparkles}
        label="Total matches"
        value={hasQuery ? totalMatches : '—'}
        gradient="from-brand-500 to-teal-400"
        loading={loading && hasQuery}
        onClick={() => setEntity('all')}
      />
      <StatCard
        icon={Users}
        label="Candidates"
        value={hasQuery ? counts.candidates : '—'}
        gradient="from-emerald-500 to-lime-400"
        loading={loading && hasQuery}
        onClick={() => setEntity('candidates')}
      />
      <StatCard
        icon={Briefcase}
        label="Jobs"
        value={hasQuery ? counts.jobs : '—'}
        gradient="from-sky-500 to-cyan-400"
        loading={loading && hasQuery}
        onClick={() => setEntity('jobs')}
      />
      <StatCard
        icon={GitPullRequest}
        label="Applications"
        value={hasQuery ? counts.applications : '—'}
        gradient="from-violet-500 to-fuchsia-400"
        loading={loading && hasQuery}
        onClick={() => setEntity('applications')}
      />
    </div>
  );
}

export function GlobalSearchToolbar({
  inputRef, q, setQ, clearSearch, hasQuery, loading, visibleMatches, entity, setEntity, counts, totalMatches,
}) {
  return (
    <div data-tour="search-toolbar" className="toolbar-ats flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 min-w-0 max-w-full sm:max-w-xl">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
          <input
            ref={inputRef}
            id="global-search-q"
            type="search"
            autoFocus
            className="input-ats !pl-10 !pr-9 w-full"
            placeholder="Search candidates, jobs, applications…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoComplete="off"
          />
          {q && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <p className="text-[11px] text-stone-400 font-medium sm:text-right flex-shrink-0">
          {hasQuery
            ? loading
              ? 'Searching…'
              : `${visibleMatches} result${visibleMatches === 1 ? '' : 's'} for “${q.trim()}”`
            : 'Type at least 2 characters'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 px-1">
          <Filter size={14} /> Filter
        </div>
        {ENTITY_FILTERS.map((f) => {
          const active = entity === f.key;
          const count = f.key === 'all' ? totalMatches : counts[f.key];
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setEntity(f.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                active
                  ? 'bg-brand-600 text-white border-brand-600 shadow-md shadow-brand-500/20'
                  : 'bg-white text-stone-600 border-stone-200 hover:border-brand-300 hover:bg-brand-50/50'
              }`}
            >
              {f.label}
              {hasQuery && (
                <span className="ml-1 opacity-70 tabular-nums">{count ?? 0}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function GlobalSearchResults({
  loading, hasQuery, visibleMatches, entity, totalMatches, q, clearSearch, setEntity, setQ, inputRef, columns, data,
}) {
  return (
    <div data-tour="search-results" className="min-w-0">
      {loading && hasQuery && (
        <div className="flex items-center justify-center py-16 text-stone-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Searching workspace…
        </div>
      )}

      {!loading && !hasQuery && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="lg:col-span-2 card-ats-bordered p-5 sm:p-6 relative overflow-hidden min-w-0">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 opacity-80" />
            <EmptyState
              icon={Search}
              tone="brand"
              message="Start typing to search"
              subMessage="Enter at least 2 characters to search across candidates, jobs, and applications."
            />
          </div>
          <div className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden space-y-3 h-fit min-w-0">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
            <div className="flex items-center gap-2 pt-1">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 border border-brand-200/70 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-4 h-4 text-brand-600" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-stone-900 text-sm tracking-tight">Try an example</h3>
                <p className="text-[11px] text-stone-500">Quick searches to get started</p>
              </div>
            </div>
            <div className="space-y-2">
              {EXAMPLE_QUERIES.map((ex) => (
                <button
                  key={ex.q}
                  type="button"
                  onClick={() => {
                    setQ(ex.q);
                    inputRef.current?.focus();
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-stone-200 bg-white text-left transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md hover:border-stone-300 group min-w-0"
                >
                  <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                    <Search className="w-4 h-4" />
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-stone-900 tracking-tight truncate">{ex.q}</span>
                    <span className="block text-[11px] text-stone-400 truncate">{ex.hint}</span>
                  </span>
                  <ArrowRight className="w-4 h-4 text-stone-300 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                </button>
              ))}
            </div>
            <Link to="/candidate-search" className="btn-secondary w-full !text-xs">
              <Filter className="w-3.5 h-3.5" />
              Open advanced candidate search
            </Link>
          </div>
        </div>
      )}

      {!loading && hasQuery && visibleMatches === 0 && (
        <div className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500" />
          <EmptyState
            icon={Search}
            tone="amber"
            message="No matches found"
            subMessage={
              entity !== 'all' && totalMatches > 0
                ? `No ${entity} matched “${q.trim()}”, but ${totalMatches} other result${totalMatches === 1 ? '' : 's'} exist. Switch to All to see them.`
                : `Nothing matched “${q.trim()}”. Try a different keyword or switch entity type.`
            }
            action={
              entity !== 'all' && totalMatches > 0 ? (
                <button type="button" className="btn-secondary" onClick={() => setEntity('all')}>
                  <Search className="w-4 h-4" /> Show all results
                </button>
              ) : (
                <button type="button" className="btn-secondary" onClick={clearSearch}>
                  <X className="w-4 h-4" /> Clear search
                </button>
              )
            }
          />
        </div>
      )}

      {!loading && hasQuery && visibleMatches > 0 && (
        <div
          className={`grid grid-cols-1 gap-4 sm:gap-5 ${
            columns.length === 1 ? 'md:grid-cols-1 max-w-3xl' : 'md:grid-cols-2 xl:grid-cols-3'
          }`}
        >
          {columns.map((col) => {
            const rows = data[col.key] || [];
            return (
              <div
                key={col.key}
                className="card-ats p-5 sm:p-6 relative overflow-hidden group flex flex-col min-w-0"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 opacity-80 group-hover:opacity-100 transition-opacity" />

                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 border border-brand-200/70 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                    <col.icon className="w-5 h-5 text-brand-600" />
                  </div>
                  <span className="badge-neutral tabular-nums flex-shrink-0">{rows.length}</span>
                </div>

                <h3 className="text-lg font-bold text-stone-900 tracking-tight mb-3">{col.title}</h3>

                <div className="space-y-2 flex-1 max-h-[min(50vh,28rem)] overflow-y-auto -mx-1 px-1">
                  {rows.length === 0 ? (
                    <EmptyState icon={col.icon} tone="amber" compact message="No matches" />
                  ) : (
                    rows.map((r) => {
                      const title = col.label(r);
                      const badge = statusBadgeClass(col.meta?.(r));
                      const meta = col.meta?.(r);
                      return (
                        <Link
                          key={r._id}
                          to={col.path(r)}
                          className="w-full flex items-center gap-3 p-3 rounded-xl border border-stone-200 bg-white text-left transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md hover:border-stone-300 min-w-0 group/row"
                        >
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-teal-700 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 shadow-md shadow-brand-500/20">
                            {initials(title)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm font-bold text-stone-900 tracking-tight truncate">
                                {title}
                              </span>
                              {badge && meta && (
                                <span className={`${badge} text-[10px] capitalize flex-shrink-0 max-w-[5.5rem] truncate`}>
                                  {String(meta).replace(/_/g, ' ')}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-stone-400 truncate mt-0.5">{col.sub(r)}</div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-stone-300 group-hover/row:text-brand-500 group-hover/row:translate-x-0.5 transition-all flex-shrink-0" />
                        </Link>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
