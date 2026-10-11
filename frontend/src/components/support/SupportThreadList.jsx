import React from 'react';
import { Search, Star, X, AlertCircle, LifeBuoy } from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import { FOLDERS, TYPES, initials, relativeTime } from './supportConstants';

export default function SupportThreadList({
  listMeta,
  q,
  setQ,
  folder,
  setFolder,
  folderCounts = {},
  loading,
  tickets,
  selectedId,
  onOpen,
}) {
  return (
    <div className="card-ats-bordered overflow-hidden flex flex-col min-w-0 min-h-[32rem] flex-1">
      <div className="px-3 sm:px-4 py-3 border-b border-stone-100 bg-white space-y-2.5">
        <p className="text-[12px] text-stone-400 truncate">{listMeta}</p>
        <div className="flex gap-1 overflow-x-auto pb-0.5">
          {FOLDERS.map((item) => {
            const Icon = item.icon;
            const on = folder === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setFolder(item.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold whitespace-nowrap border ${
                  on ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-stone-600 border-stone-200 hover:bg-brand-50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${on && item.id === 'starred' ? 'fill-white' : ''}`} />
                {item.label}
                {typeof folderCounts[item.id] === 'number' ? (
                  <span className={`ml-0.5 min-w-[1.1rem] text-center text-[10px] tabular-nums ${on ? 'text-white/90' : 'text-stone-400'}`}>
                    {folderCounts[item.id]}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="input-ats !pl-10 !pr-9 !h-10 w-full"
            placeholder="Search mail"
            aria-label="Search support tickets"
          />
          {q ? (
            <button type="button" onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-stone-400" aria-label="Clear search">
              <X className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain bg-white">
        {loading ? (
          <div className="divide-y divide-stone-100">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="h-12 skeleton-ats mx-3 my-1 rounded-lg" />
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-8 flex items-center justify-center min-h-[16rem]">
            <EmptyState
              compact
              icon={LifeBuoy}
              tone="brand"
              message="No conversations"
              subMessage="When a freelancer writes in, the thread appears here like inbox mail."
            />
          </div>
        ) : (
          tickets.map((row) => {
            const active = String(selectedId) === String(row._id);
            const unread = Boolean(row.unread);
            const name = row.userName || row.userEmail || 'Freelancer';
            return (
              <button
                key={row._id}
                type="button"
                onClick={() => onOpen(row)}
                className={`w-full text-left px-3 sm:px-4 h-12 flex items-center gap-3 min-w-0 border-b border-stone-100 ${
                  active ? 'bg-brand-50' : unread ? 'bg-amber-50 hover:bg-amber-100/70' : 'bg-white hover:bg-brand-50/40'
                }`}
              >
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${unread ? 'bg-brand-600 text-white' : 'bg-stone-200 text-stone-600'}`}>
                  {initials(name)}
                </span>
                <span className={`w-[10rem] sm:w-[13rem] truncate flex-shrink-0 text-[13px] ${unread ? 'font-bold text-stone-950' : 'font-medium text-stone-700'}`}>
                  {name}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px]">
                  <span className={unread ? 'font-semibold text-stone-900' : 'text-stone-800'}>
                    {row.subject || row.ticketRef}
                  </span>
                  <span className="text-stone-400 font-normal">
                    {' — '}
                    {row.lastPreview || TYPES[row.category] || 'No preview'}
                  </span>
                </span>
                <span className="hidden md:inline-flex items-center gap-1.5 flex-shrink-0 text-stone-400">
                  {row.starred ? <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" /> : null}
                  {unread ? <AlertCircle className="w-3.5 h-3.5 text-brand-600" /> : null}
                </span>
                <span className={`w-[4.5rem] sm:w-[5.5rem] text-right text-[11px] flex-shrink-0 tabular-nums ${unread ? 'font-bold text-stone-800' : 'text-stone-400'}`}>
                  {relativeTime(row.updatedAt || row.createdAt)}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
