import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Clock, Radio, Search, X } from 'lucide-react';
import PresenceAvatar from '../ui/PresenceAvatar';
import { lastSeenLabel } from '../ui/PresenceBadge';
import DeskPager from './DeskPager';

const PAGE_SIZE = 8;
const COLLAPSE_KEY = 'skillnix.liveDesks.collapsed';

const STATUS_TABS = [
  { id: 'all', label: 'All' },
  { id: 'online', label: 'Live' },
  { id: 'away', label: 'Away' },
  { id: 'offline', label: 'Offline' },
];

/**
 * Enterprise presence roster — collapsed summary bar + expandable desk list.
 * Pattern: ops consoles (Greenhouse / Lever-style) keep presence above the queue.
 */
export default function LiveDesksPanel({
  desks = [],
  deskFilter = 'all',
  setDeskFilter,
  lastSyncedAt,
  relativeTime,
}) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem(COLLAPSE_KEY);
      if (saved === '0') return false;
      if (saved === '1') return true;
    } catch { /* ignore */ }
    return true;
  });
  const [statusTab, setStatusTab] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const liveCount = desks.filter((p) => p.status === 'online').length;
  const awayCount = desks.filter((p) => p.status === 'away').length;
  const offlineCount = desks.filter((p) => p.status === 'offline').length;

  const tabCounts = {
    all: desks.length,
    online: liveCount,
    away: awayCount,
    offline: offlineCount,
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return desks.filter((person) => {
      if (statusTab !== 'all' && person.status !== statusTab) return false;
      if (!q) return true;
      return `${person.name || ''} ${person.email || ''}`.toLowerCase().includes(q);
    });
  }, [desks, statusTab, query]);

  useEffect(() => { setPage(1); }, [statusTab, query, desks.length]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  const selectedDesk = deskFilter !== 'all'
    ? desks.find((p) => String(p._id) === String(deskFilter))
    : null;

  return (
    <div
      data-tour="freelance-live-desks"
      className="relative rounded-2xl border border-stone-200/90 bg-white mb-3 shadow-sm overflow-hidden"
    >
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 pointer-events-none" />

      <button
        type="button"
        onClick={toggleCollapsed}
        className="w-full px-3.5 sm:px-4 py-3 flex items-center gap-3 text-left hover:bg-stone-50/70 transition-colors"
        aria-expanded={!collapsed}
      >
        <span className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 inline-flex items-center justify-center shrink-0 shadow-sm">
          <Radio size={15} strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-semibold text-stone-900">Recruiter presence</p>
            <span className="inline-flex items-center h-5 px-1.5 rounded-md border border-emerald-200 bg-emerald-50 text-[10px] font-bold tabular-nums text-emerald-800">
              {liveCount} live
            </span>
            <span className="inline-flex items-center h-5 px-1.5 rounded-md border border-amber-200 bg-amber-50 text-[10px] font-bold tabular-nums text-amber-900">
              {awayCount} away
            </span>
            <span className="inline-flex items-center h-5 px-1.5 rounded-md border border-stone-200 bg-stone-50 text-[10px] font-bold tabular-nums text-stone-600">
              {offlineCount} offline
            </span>
          </div>
          <p className="text-[11px] text-stone-500 mt-0.5 truncate">
            {selectedDesk
              ? `Scoped to ${selectedDesk.name || selectedDesk.email}`
              : `${desks.length} freelance recruiter${desks.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <span className="text-[11px] text-stone-400 font-medium inline-flex items-center gap-1 shrink-0 tabular-nums">
          <Clock size={12} className="text-brand-600" />
          {lastSyncedAt ? relativeTime(lastSyncedAt) : '…'}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-stone-400 transition-transform ${collapsed ? '' : 'rotate-180'}`}
        />
      </button>

      {!collapsed ? (
        <div className="border-t border-stone-100">
          <div className="px-3.5 sm:px-4 py-2.5 flex flex-wrap items-center gap-2 bg-stone-50/40">
            {STATUS_TABS.map((tab) => {
              const active = statusTab === tab.id;
              const count = tabCounts[tab.id] || 0;
              const tone = tab.id === 'online'
                ? active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-800 border-emerald-200'
                : tab.id === 'away'
                  ? active ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-amber-900 border-amber-200'
                  : tab.id === 'offline'
                    ? active ? 'bg-stone-700 text-white border-stone-700' : 'bg-white text-stone-600 border-stone-200'
                    : active ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-700 border-stone-200';
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusTab(tab.id)}
                  className={`h-8 px-2.5 rounded-lg border text-[11px] font-semibold tabular-nums transition-colors ${tone}`}
                >
                  {tab.label}
                  <span className="ml-1.5 opacity-80">{count}</span>
                </button>
              );
            })}
            <div className="relative flex-1 min-w-[180px] max-w-sm ml-auto">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-600 pointer-events-none" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search recruiters…"
                className="input-ats input-ats-icon !h-8 !pr-8 !text-[12px] rounded-lg"
                aria-label="Search recruiters"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-stone-400 hover:text-stone-600"
                  aria-label="Clear"
                >
                  <X className="w-3 h-3" />
                </button>
              ) : null}
            </div>
          </div>

          {desks.length === 0 ? (
            <p className="px-4 py-6 text-[12px] text-stone-400 text-center">No freelance recruiters yet.</p>
          ) : filtered.length === 0 ? (
            <p className="px-4 py-6 text-[12px] text-stone-400 text-center">No recruiters match this view.</p>
          ) : (
            <>
              <ul className="divide-y divide-stone-100 max-h-[300px] overflow-y-auto">
                {paged.map((person) => {
                  const selected = deskFilter === String(person._id);
                  const seen = person.status === 'online'
                    ? null
                    : lastSeenLabel(person.lastActiveAt || person.lastLoginAt);
                  return (
                    <li key={person._id}>
                      <button
                        type="button"
                        onClick={() => setDeskFilter(selected ? 'all' : String(person._id))}
                        className={`w-full flex items-center gap-3 px-3.5 sm:px-4 py-2 text-left transition-colors ${
                          selected
                            ? 'bg-brand-50/90 ring-inset ring-1 ring-brand-200'
                            : 'hover:bg-stone-50'
                        }`}
                      >
                        <PresenceAvatar
                          name={person.name}
                          email={person.email}
                          photo={person.profilePicture}
                          status={person.status}
                          size={32}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] font-semibold text-stone-900 truncate" title={person.name}>
                            {person.name}
                          </p>
                          {person.email ? (
                            <p className="text-[11px] text-stone-500 truncate" title={person.email}>
                              {person.email}
                            </p>
                          ) : null}
                        </div>
                        <div className="shrink-0 text-right">
                          <span className={`inline-flex items-center h-5 px-1.5 rounded-md border text-[9px] font-bold uppercase tracking-wide ${
                            person.status === 'online'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : person.status === 'away'
                                ? 'bg-amber-50 text-amber-900 border-amber-200'
                                : 'bg-stone-50 text-stone-500 border-stone-200'
                          }`}
                          >
                            {person.status === 'online' ? 'Live' : person.status === 'away' ? 'Away' : 'Offline'}
                          </span>
                          {seen ? (
                            <p className="text-[10px] text-stone-400 mt-0.5 tabular-nums">{seen}</p>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {filtered.length > PAGE_SIZE ? (
                <div className="px-3.5 sm:px-4 py-2 border-t border-stone-100 bg-stone-50/50">
                  <DeskPager
                    page={safePage}
                    setPage={setPage}
                    total={filtered.length}
                    pageSize={PAGE_SIZE}
                    label="desks"
                  />
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
