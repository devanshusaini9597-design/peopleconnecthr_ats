import React, { useMemo, useState } from 'react';
import {
  Megaphone, Search, X, Calendar, Check, CheckCheck, Bell, Inbox,
  ChevronRight, Info, CheckCircle2, AlertTriangle, Siren,
} from 'lucide-react';
import { severityMeta, formatWhen } from './announcementsConstants';

const SEV_ICON = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  critical: Siren,
};

/**
 * Enterprise noticeboard for recruiters / non-admin roles.
 */
export default function AnnouncementInbox({
  loading,
  rows = [],
  onRefresh,
  onMarkRead,
  onMarkAllRead,
  markingAll = false,
  q,
  setQ,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [view, setView] = useState('all'); // all | unread | read

  const counts = useMemo(() => {
    const unread = rows.filter((r) => !r.isRead).length;
    return { total: rows.length, unread, read: rows.length - unread };
  }, [rows]);

  const filtered = useMemo(() => {
    const query = (q || '').trim().toLowerCase();
    return rows.filter((a) => {
      if (view === 'unread' && a.isRead) return false;
      if (view === 'read' && !a.isRead) return false;
      if (!query) return true;
      return `${a.title || ''} ${a.body || ''}`.toLowerCase().includes(query);
    });
  }, [rows, view, q]);

  const selected = filtered.find((r) => r._id === selectedId) || filtered[0] || null;

  // Keep selection in sync when list changes
  React.useEffect(() => {
    if (!filtered.length) {
      setSelectedId(null);
      return;
    }
    if (!filtered.some((r) => r._id === selectedId)) {
      setSelectedId(filtered[0]._id);
    }
  }, [filtered, selectedId]);

  return (
    <div className="space-y-4 animate-fade-in" data-tour="ann-inbox">
      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-stone-200/90 bg-white px-4 py-3 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Active notices</p>
          <p className="mt-1 text-2xl font-bold text-stone-900 tabular-nums tracking-tight">{counts.total}</p>
        </div>
        <div className="rounded-xl border border-teal-200/70 bg-gradient-to-br from-teal-50/80 to-white px-4 py-3 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-teal-700/70">Unread</p>
          <p className="mt-1 text-2xl font-bold text-teal-800 tabular-nums tracking-tight">{counts.unread}</p>
        </div>
        <div className="rounded-xl border border-stone-200/90 bg-white px-4 py-3 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Read</p>
          <p className="mt-1 text-2xl font-bold text-stone-900 tabular-nums tracking-tight">{counts.read}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="rounded-xl border border-stone-200/90 bg-white shadow-sm p-3 sm:p-4 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
            <input
              type="search"
              className="input-ats !pl-10 !pr-9 !h-10 w-full"
              placeholder="Search company notices…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q ? (
              <button
                type="button"
                onClick={() => setQ('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>
          {counts.unread > 0 ? (
            <button
              type="button"
              onClick={onMarkAllRead}
              disabled={markingAll}
              className="btn-primary whitespace-nowrap !h-10"
            >
              {markingAll ? null : <CheckCheck className="w-4 h-4" />}
              Mark all read
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { key: 'all', label: 'All', count: counts.total },
            { key: 'unread', label: 'Unread', count: counts.unread },
            { key: 'read', label: 'Read', count: counts.read },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setView(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                view === f.key
                  ? 'bg-stone-900 text-white border-stone-900'
                  : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300 hover:bg-stone-50'
              }`}
            >
              {f.label}
              <span className="ml-1.5 opacity-70 tabular-nums">{f.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Split inbox */}
      <div className="rounded-2xl border border-stone-200/90 bg-white shadow-sm overflow-hidden min-h-[28rem]">
        <div className="h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[28rem]">
          {/* List */}
          <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-stone-100 flex flex-col max-h-[32rem] lg:max-h-none">
            <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between gap-2 bg-stone-50/60">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-stone-900 tracking-tight">Noticeboard</h2>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  {loading ? 'Loading…' : `${filtered.length} notice${filtered.length === 1 ? '' : 's'}`}
                </p>
              </div>
              <Bell className="w-4 h-4 text-stone-300 flex-shrink-0" />
            </div>

            <div className="flex-1 overflow-y-auto premium-select-scroll">
              {loading ? (
                <div className="p-3 space-y-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-16 skeleton-ats rounded-xl" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-6 text-center">
                  <div className="mx-auto w-11 h-11 rounded-xl bg-stone-100 text-stone-400 flex items-center justify-center mb-3">
                    <Inbox className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-semibold text-stone-800">
                    {rows.length === 0 ? 'No company notices yet' : 'No matches'}
                  </p>
                  <p className="text-xs text-stone-500 mt-1.5 leading-relaxed max-w-[16rem] mx-auto">
                    {rows.length === 0
                      ? 'When leadership publishes a notice, it appears here and as a banner across the app.'
                      : 'Try another filter or clear your search.'}
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-stone-100">
                  {filtered.map((a) => {
                    const active = selected?._id === a._id;
                    const SevIcon = SEV_ICON[a.severity] || Info;
                    return (
                      <li key={a._id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(a._id)}
                          className={`w-full text-left px-4 py-3.5 transition-colors ${
                            active ? 'bg-brand-50/70' : 'hover:bg-stone-50/80'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              a.isRead
                                ? 'bg-stone-100 text-stone-400'
                                : 'bg-teal-100 text-teal-700'
                            }`}>
                              <SevIcon className="w-3.5 h-3.5" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                {!a.isRead ? (
                                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0" />
                                ) : null}
                                <p className={`text-[13px] truncate ${
                                  a.isRead ? 'font-medium text-stone-700' : 'font-bold text-stone-900'
                                }`}>
                                  {a.title}
                                </p>
                              </div>
                              <p className="text-[11px] text-stone-400 mt-0.5 truncate">
                                {(a.body || '').replace(/\s+/g, ' ')}
                              </p>
                              <p className="text-[10px] text-stone-400 mt-1.5 font-medium tabular-nums">
                                {formatWhen(a.createdAt)}
                              </p>
                            </div>
                            <ChevronRight className={`w-4 h-4 flex-shrink-0 mt-1 ${
                              active ? 'text-brand-600' : 'text-stone-300'
                            }`} />
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Detail */}
          <div className="lg:col-span-7 flex flex-col min-h-[20rem]">
            {loading ? (
              <div className="p-6 space-y-3">
                <div className="h-6 w-2/3 skeleton-ats rounded-lg" />
                <div className="h-4 w-1/3 skeleton-ats rounded-lg" />
                <div className="h-32 skeleton-ats rounded-xl mt-4" />
              </div>
            ) : !selected ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-50 to-teal-50 border border-brand-200/70 text-brand-600 flex items-center justify-center mb-4 shadow-sm">
                  <Megaphone className="w-7 h-7" strokeWidth={1.75} />
                </div>
                <p className="text-base font-bold text-stone-900 tracking-tight">Company noticeboard</p>
                <p className="text-sm text-stone-500 mt-1.5 max-w-sm leading-relaxed">
                  Select a notice on the left to read the full message. New notices also appear as a banner under the header.
                </p>
                {typeof onRefresh === 'function' ? (
                  <button type="button" onClick={onRefresh} className="btn-secondary mt-5">
                    Refresh
                  </button>
                ) : null}
              </div>
            ) : (
              (() => {
                const meta = severityMeta(selected.severity);
                const SevIcon = SEV_ICON[selected.severity] || Info;
                return (
                  <div className="flex flex-col h-full">
                    <div className="px-5 sm:px-6 py-4 border-b border-stone-100">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`${meta.badge} text-[10px] capitalize inline-flex items-center gap-1`}>
                          <SevIcon className="w-3 h-3" />
                          {selected.severity || 'info'}
                        </span>
                        {selected.isRead ? (
                          <span className="badge-neutral text-[10px]">Read</span>
                        ) : (
                          <span className="badge-brand text-[10px]">Unread</span>
                        )}
                      </div>
                      <h3 className="text-lg sm:text-xl font-bold text-stone-900 tracking-tight mt-2.5 break-words">
                        {selected.title}
                      </h3>
                      {selected.createdAt ? (
                        <p className="text-[11px] text-stone-400 mt-2 font-medium inline-flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          Published {formatWhen(selected.createdAt)}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex-1 px-5 sm:px-6 py-5 overflow-y-auto">
                      <p className="text-sm text-stone-700 whitespace-pre-wrap break-words leading-relaxed">
                        {selected.body}
                      </p>
                    </div>

                    <div className="px-5 sm:px-6 py-3.5 border-t border-stone-100 bg-stone-50/50 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] text-stone-400">
                        From your organization leadership
                      </p>
                      {!selected.isRead && onMarkRead ? (
                        <button
                          type="button"
                          onClick={() => onMarkRead(selected)}
                          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Mark as read
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Caught up
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
