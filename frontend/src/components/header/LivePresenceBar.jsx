import React, { useMemo, useState } from 'react';
import { Radio, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePresence } from '../../context/PresenceContext';
import PresenceBadge, { lastSeenLabel } from '../ui/PresenceBadge';
import PresenceAvatar from '../ui/PresenceAvatar';
import { formatRoleLabel } from '../organization/constants';

const SCOPE_TABS = [
  { id: 'all', label: 'Everyone' },
  { id: 'team', label: 'Team' },
  { id: 'freelancer', label: 'Freelancers' },
];

const STATUS_TABS = [
  { id: 'all', label: 'All' },
  { id: 'online', label: 'Live' },
  { id: 'away', label: 'Away' },
  { id: 'offline', label: 'Offline' },
];

export default function LivePresenceBar() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { people, liveCount, refresh, refreshing, updatedAt } = usePresence();
  const [open, setOpen] = useState(false);
  const [scopeTab, setScopeTab] = useState('all');
  const [statusTab, setStatusTab] = useState('all');

  const scoped = useMemo(() => {
    let list = [...people];
    if (scopeTab === 'freelancer') list = list.filter((p) => p.role === 'freelancer');
    else if (scopeTab === 'team') list = list.filter((p) => p.role !== 'freelancer');
    if (statusTab !== 'all') list = list.filter((p) => p.status === statusTab);
    return list.sort((a, b) => {
      const rank = { online: 0, away: 1, offline: 2 };
      const diff = (rank[a.status] ?? 3) - (rank[b.status] ?? 3);
      if (diff !== 0) return diff;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
  }, [people, scopeTab, statusTab]);

  const scopeCounts = useMemo(() => ({
    all: people.length,
    team: people.filter((p) => p.role !== 'freelancer').length,
    freelancer: people.filter((p) => p.role === 'freelancer').length,
  }), [people]);

  const faces = useMemo(() => {
    const preferred = people
      .filter((p) => p.status === 'online')
      .concat(people.filter((p) => p.status !== 'online'));
    return preferred.slice(0, 5);
  }, [people]);

  if (!people.length) return null;

  const updatedLabel = updatedAt
    ? updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 sm:gap-1.5 h-9 sm:h-10 pl-1 pr-1.5 sm:pl-1.5 sm:pr-2.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 transition-colors min-w-0"
        title="Who is online"
      >
        <span className="flex -space-x-2 sm:-space-x-1.5">
          {faces.map((person, i) => (
            <span
              key={person._id}
              className={
                i >= 4 ? 'hidden md:inline-flex' : i >= 2 ? 'hidden sm:inline-flex' : 'inline-flex'
              }
            >
              <PresenceAvatar
                name={person.name}
                email={person.email}
                photo={person.profilePicture}
                status={person.status}
                size={22}
              />
            </span>
          ))}
        </span>
        <span className="hidden md:inline text-[11px] font-bold text-stone-600 tabular-nums whitespace-nowrap">
          {liveCount} live
        </span>
        <span className="md:hidden text-[10px] font-bold text-stone-600 tabular-nums leading-none">
          {liveCount}
        </span>
      </button>

      {open ? (
        <>
          <button type="button" className="fixed inset-0 z-40 cursor-default" aria-label="Close" onClick={() => setOpen(false)} />
          <div className="fixed z-50 left-3 right-3 top-[3.35rem] sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[24rem] max-w-[calc(100vw-1.5rem)] bg-white rounded-2xl shadow-xl border border-stone-200/80 overflow-hidden animate-fade-in max-h-[min(36rem,calc(100dvh-5rem))] flex flex-col">
            <div className="h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 flex-shrink-0" />
            <div className="px-4 py-3 border-b border-stone-100 flex items-start justify-between gap-3 min-w-0">
              <div className="min-w-0">
                <p className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                  <Radio size={14} className="text-emerald-500 flex-shrink-0" />
                  Live portal
                </p>
                <p className="text-[10px] font-medium text-stone-400 mt-1 leading-snug">
                  Team and freelancers · auto-refresh{updatedLabel ? ` · last ${updatedLabel}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
                <span className="text-[11px] font-semibold text-emerald-700 whitespace-nowrap tabular-nums">
                  {liveCount} online
                </span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); refresh(); }}
                  disabled={refreshing}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 text-stone-500 hover:text-brand-700 hover:border-brand-300 disabled:opacity-50"
                  title="Refresh"
                >
                  <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            <div className="px-3 pt-2.5 pb-2 border-b border-stone-100 space-y-2">
              <div className="flex flex-wrap gap-1">
                {SCOPE_TABS.map((tab) => {
                  const active = scopeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setScopeTab(tab.id)}
                      className={`h-7 px-2.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                        active
                          ? 'bg-stone-900 text-white border-stone-900'
                          : 'bg-white text-stone-600 border-stone-200 hover:border-brand-300'
                      }`}
                    >
                      {tab.label}
                      <span className="ml-1 tabular-nums opacity-80">{scopeCounts[tab.id] || 0}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-1">
                {STATUS_TABS.map((tab) => {
                  const active = statusTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setStatusTab(tab.id)}
                      className={`h-7 px-2 rounded-md text-[10px] font-bold uppercase tracking-wide border transition-colors ${
                        active
                          ? 'bg-brand-600 text-white border-brand-600'
                          : 'bg-stone-50 text-stone-500 border-stone-200 hover:border-brand-300'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
              {scoped.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-stone-400">No one in this view</p>
              ) : scoped.map((person) => {
                const offlineLabel = person.status === 'online'
                  ? null
                  : lastSeenLabel(person.lastActiveAt || person.lastLoginAt);
                return (
                  <div
                    key={person._id}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-stone-50 min-w-0"
                  >
                    <PresenceAvatar
                      name={person.name}
                      email={person.email}
                      photo={person.profilePicture}
                      status={person.status}
                      size={32}
                    />
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <p className="text-sm font-semibold text-stone-900 truncate" title={person.name}>
                        {person.name}
                        {person.isYou ? (
                          <span className="font-medium text-stone-400"> · you</span>
                        ) : null}
                      </p>
                      <p className="text-[11px] text-stone-500 truncate">
                        {formatRoleLabel(person.role)}
                        {person.role === 'freelancer' ? ' · Freelance desk' : ''}
                      </p>
                    </div>
                    <div className="flex-shrink-0 max-w-[7.5rem]">
                      <PresenceBadge
                        compact
                        status={person.status}
                        lastLabel={offlineLabel}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex border-t border-stone-100 flex-shrink-0">
              {user?.role !== 'freelancer' ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      navigate('/team');
                    }}
                    className="flex-1 text-center text-xs font-semibold text-brand-700 py-3 hover:bg-brand-50/60 border-r border-stone-100"
                  >
                    Open team
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      navigate('/freelance-review');
                    }}
                    className="flex-1 text-center text-xs font-semibold text-brand-700 py-3 hover:bg-brand-50/60"
                  >
                    Freelance desks
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-full text-center text-xs font-semibold text-brand-700 py-3 hover:bg-brand-50/60"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
