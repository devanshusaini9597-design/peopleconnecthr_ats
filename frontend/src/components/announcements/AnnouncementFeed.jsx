import React from 'react';
import {
  Megaphone, Trash2, Pencil, Info, CheckCircle2, Calendar, Users, Globe2,
  LayoutTemplate, Sparkles
} from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import { AUDIENCES, severityMeta, formatWhen } from './announcementsConstants';

function ChannelGuide({ careersSlug }) {
  return (
    <div className="rounded-2xl border border-dashed border-brand-200/80 bg-gradient-to-br from-brand-50/50 via-white to-teal-50/40 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-white border border-brand-100 shadow-sm flex items-center justify-center flex-shrink-0">
          <LayoutTemplate className="w-5 h-5 text-brand-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-stone-900 tracking-tight">Where notices appear</p>
          <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">
            Keep this board lean — one clear message beats a crowded feed.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        <div className="rounded-xl border border-stone-200/80 bg-white/90 overflow-hidden shadow-sm">
          <div className="px-3 py-2 bg-brand-600 text-white text-[11px] font-semibold flex items-center gap-2">
            <Users className="w-3.5 h-3.5 opacity-90" />
            In-app · under header on every signed-in page
          </div>
          <div className="px-3 py-2.5 text-xs text-stone-600 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-sky-500 mt-0.5 flex-shrink-0" />
            <span>Example: “Office closed Friday — interviews move to Monday.”</span>
          </div>
        </div>
        <div className="rounded-xl border border-stone-200/80 bg-white/90 overflow-hidden shadow-sm">
          <div className="px-3 py-2 bg-stone-800 text-white text-[11px] font-semibold flex items-center gap-2">
            <Globe2 className="w-3.5 h-3.5 opacity-90" />
            Careers site · top strip on public job pages
          </div>
          <div className="px-3 py-2.5 text-xs text-stone-600 flex items-start gap-2">
            <Sparkles className="w-3.5 h-3.5 text-teal-600 mt-0.5 flex-shrink-0" />
            <span>
              Example: “We’re hiring across Product & Sales.”
              {careersSlug ? (
                <>
                  {' '}
                  <a
                    href={`/careers/${careersSlug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-700 font-semibold hover:underline"
                  >
                    Open careers
                  </a>
                </>
              ) : null}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AnnouncementFeed({
  loading,
  rows,
  filtered,
  filter,
  careersSlug,
  showGuide,
  onClearFilters,
  onEdit,
  onDeactivate,
  onReactivate,
}) {
  return (
    <div data-tour="ann-feed" className="lg:col-span-8 min-w-0">
      <div className="card-ats-bordered relative overflow-hidden min-h-[32rem] flex flex-col">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="relative px-4 sm:px-5 pt-5 pb-3 border-b border-stone-100 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-stone-900 tracking-tight">Notice feed</h2>
            <p className="text-[11px] text-stone-400 mt-0.5">
              {loading ? 'Loading…' : filtered.length === 0 ? 'Nothing in this view' : `${filtered.length} in this view`}
            </p>
          </div>
          <span className="badge-neutral text-[10px] flex-shrink-0">{filter}</span>
        </div>

        <div className="relative flex-1 flex flex-col p-4 sm:p-5 gap-3">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-28 skeleton-ats rounded-2xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex-1 flex flex-col justify-center">
              <EmptyState
                icon={Megaphone}
                tone="brand"
                message={rows.length === 0 ? 'No announcements yet' : 'No matching notices'}
                subMessage={
                  rows.length === 0
                    ? 'Compose on the left — your first notice will land here, then show as a live banner.'
                    : 'Try a different search or status filter.'
                }
                action={
                  rows.length > 0 ? (
                    <button type="button" className="btn-secondary" onClick={onClearFilters}>
                      Clear filters
                    </button>
                  ) : null
                }
              />
              {rows.length === 0 && (
                <div className="mt-2">
                  <ChannelGuide careersSlug={careersSlug} />
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {filtered.map((a) => {
                  const meta = severityMeta(a.severity);
                  const Icon = meta.icon;
                  return (
                    <article
                      key={a._id}
                      className={`rounded-2xl border border-stone-200/80 bg-white p-4 sm:p-5 relative overflow-hidden min-w-0 shadow-sm ${
                        !a.isActive ? 'opacity-60' : ''
                      }`}
                    >
                      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${meta.bar}`} />
                      <div className="relative flex justify-between gap-3 min-w-0">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`${meta.badge} text-[10px] capitalize inline-flex items-center gap-1`}>
                              <Icon className="w-3 h-3" />
                              {a.severity || 'info'}
                            </span>
                            <span className="badge-neutral text-[10px] capitalize">
                              {(AUDIENCES.find((x) => x.value === a.audience) || AUDIENCES[0]).label}
                            </span>
                            {a.isActive ? (
                              <span className="badge-success text-[10px]">
                                {a.audience === 'public' ? 'Active · careers site' : 'Active · in-app'}
                              </span>
                            ) : (
                              <span className="badge-neutral text-[10px]">Inactive</span>
                            )}
                          </div>
                          <h3 className="text-base font-bold text-stone-900 tracking-tight mt-2 break-words">
                            {a.title}
                          </h3>
                          <p className="text-sm text-stone-600 mt-1.5 whitespace-pre-wrap break-words leading-relaxed">
                            {a.body}
                          </p>
                          {a.createdAt && (
                            <p className="text-[11px] text-stone-400 mt-3 font-medium inline-flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5" />
                              {formatWhen(a.createdAt)}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => onEdit(a)}
                            className="p-2 rounded-xl text-stone-400 hover:text-brand-700 hover:bg-brand-50 transition-colors"
                            aria-label="Edit"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {a.isActive ? (
                            <button
                              type="button"
                              onClick={() => onDeactivate(a)}
                              className="p-2 rounded-xl text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              aria-label="Deactivate"
                              title="Deactivate"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onReactivate(a)}
                              className="p-2 rounded-xl text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                              aria-label="Reactivate"
                              title="Reactivate"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {showGuide && (
                <div className="mt-auto pt-1">
                  <ChannelGuide careersSlug={careersSlug} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
