import React from 'react';
import {
  Inbox as InboxIcon, Mail, Search, Send, Star, X, Clock, Ban, AlertCircle, FileText
} from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import { CHANNEL_FILTERS, formatWhen, initials } from './inboxConstants';
import { listPreview } from './mailBody';

const FOLDERS = [
  { id: 'inbox', label: 'Inbox', icon: InboxIcon },
  { id: 'unread', label: 'Unread', icon: Mail },
  { id: 'starred', label: 'Starred', icon: Star },
  { id: 'snoozed', label: 'Snoozed', icon: Clock },
  { id: 'drafts', label: 'Drafts', icon: FileText },
  { id: 'archived', label: 'Archived', icon: Ban },
];

export default function InboxThreadList({
  listMeta,
  q,
  setQ,
  channel,
  setChannel,
  folder,
  setFolder,
  assigned,
  setAssigned,
  assignedLocked = false,
  loading,
  threads,
  selectedId,
  onOpenThread,
  onCompose,
  folderCounts = {},
}) {
  return (
    <div data-tour="inbox-threads" className="card-ats-bordered overflow-hidden flex flex-col min-w-0 min-h-[32rem] flex-1">
      <div className="px-3 sm:px-4 py-3 border-b border-stone-100 bg-white space-y-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-[12px] text-stone-400 truncate flex-1">{listMeta}</p>
          <button type="button" className="btn-primary !py-1.5 !px-3 !text-xs flex-shrink-0" onClick={onCompose}>
            <Send className="w-3.5 h-3.5" />
            Compose
          </button>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-0.5">
          {FOLDERS.map((f) => {
            const Icon = f.icon;
            const on = folder === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFolder(f.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold whitespace-nowrap border ${
                  on ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-stone-600 border-stone-200 hover:bg-brand-50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${on && f.id === 'starred' ? 'fill-white' : ''}`} />
                {f.label}
                {typeof folderCounts[f.id] === 'number' ? (
                  <span className={`ml-0.5 min-w-[1.1rem] text-center text-[10px] tabular-nums ${on ? 'text-white/90' : 'text-stone-400'}`}>
                    {folderCounts[f.id]}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="input-ats !pl-10 !pr-9 !h-10 w-full"
              placeholder="Search mail"
              aria-label="Search conversations"
            />
            {q ? (
              <button
                type="button"
                onClick={() => setQ('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-600"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>
          <div className="flex gap-1 overflow-x-auto flex-shrink-0">
            {CHANNEL_FILTERS.filter((f) => f.value !== 'mixed').map((f) => {
              const on = channel === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setChannel(f.value)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border whitespace-nowrap ${
                    on ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-stone-600 border-stone-200 hover:bg-brand-50'
                  }`}
                >
                  {f.value === 'all' ? 'All' : f.label}
                </button>
              );
            })}
            {assignedLocked ? (
              <span className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-brand-200 bg-brand-50 text-brand-800 whitespace-nowrap">
                My mail
              </span>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setAssigned('me')}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border whitespace-nowrap ${
                    assigned !== 'all' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-stone-600 border-stone-200'
                  }`}
                >
                  My mail
                </button>
                <button
                  type="button"
                  onClick={() => setAssigned('all')}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border whitespace-nowrap ${
                    assigned === 'all' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-stone-600 border-stone-200'
                  }`}
                >
                  All mail
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain bg-white">
        {loading ? (
          <div className="divide-y divide-stone-100">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="h-12 skeleton-ats mx-3 my-1 rounded-lg" />
            ))}
          </div>
        ) : !(Array.isArray(threads) && threads.length) ? (
          <div className="p-8 flex items-center justify-center min-h-[16rem]">
            <EmptyState
              compact
              icon={Mail}
              tone="brand"
              message="No conversations"
              subMessage="Replies to team@ appear here after mailbox sync."
              action={(
                <button type="button" className="btn-primary" onClick={onCompose}>
                  <Send className="w-4 h-4" /> New message
                </button>
              )}
            />
          </div>
        ) : (
          (Array.isArray(threads) ? threads : []).map((t) => {
            const active = selectedId === t._id;
            const name = t.fromLabel || t.participants?.candidateName || t.participants?.candidateEmail || (t.isDraft ? (t.draftTo || 'Draft') : 'Unknown sender');
            const preview = listPreview(t.lastMessagePreview || t.draftBody);
            const unread = Number(t.unreadCount || 0) > 0;
            const sn = t.snoozedUntil && new Date(t.snoozedUntil) > new Date();
            return (
              <button
                key={t._id}
                type="button"
                onClick={() => onOpenThread(t)}
                className={`w-full text-left px-3 sm:px-4 h-12 flex items-center gap-3 min-w-0 border-b border-stone-100 ${
                  active ? 'bg-brand-50' : unread ? 'bg-white' : 'bg-white hover:bg-brand-50/40'
                }`}
              >
                <span
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                    unread ? 'bg-brand-600 text-white' : 'bg-stone-200 text-stone-600'
                  }`}
                >
                  {initials(name)}
                </span>
                <span className={`w-[10rem] sm:w-[13rem] truncate flex-shrink-0 text-[13px] ${unread ? 'font-bold text-stone-900' : 'font-medium text-stone-700'}`}>
                  {name}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px]">
                  <span className={unread ? 'font-semibold text-stone-900' : 'text-stone-800'}>
                    {t.subject || 'No subject'}
                  </span>
                  <span className="text-stone-400 font-normal">
                    {' — '}
                    {preview || 'No preview'}
                  </span>
                </span>
                <span className="hidden md:inline-flex items-center gap-1.5 flex-shrink-0 text-stone-400">
                  {t.starred ? <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" /> : null}
                  {sn ? <Clock className="w-3.5 h-3.5" /> : null}
                  {unread ? <AlertCircle className="w-3.5 h-3.5 text-brand-600" /> : null}
                </span>
                <span className={`w-[4.5rem] sm:w-[5.5rem] text-right text-[11px] flex-shrink-0 tabular-nums ${unread ? 'font-bold text-stone-800' : 'text-stone-400'}`}>
                  {formatWhen(t.lastMessageAt)}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
