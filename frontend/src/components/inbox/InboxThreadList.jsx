import React from 'react';
import {
  Mail, Search, Send, Star, X, Inbox as InboxIcon
} from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import PremiumSelect from '../ui/PremiumSelect';
import { CHANNEL_FILTERS, formatWhen, initials } from './inboxConstants';

export default function InboxThreadList({
  showDetailPane,
  listMeta,
  q,
  setQ,
  channel,
  setChannel,
  loading,
  threads,
  selectedId,
  onOpenThread,
  onCompose,
}) {
  return (
    <div
      data-tour="inbox-threads"
      className={`lg:col-span-5 card-ats-bordered relative overflow-hidden flex flex-col min-w-0 min-h-[28rem] ${
        showDetailPane ? 'hidden lg:flex' : 'flex'
      }`}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
      <div className="relative px-4 sm:px-5 pt-4 pb-3 border-b border-stone-100 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold text-stone-900 tracking-tight">Conversations</h2>
            <p className="text-[11px] text-stone-400 mt-0.5 truncate">{listMeta}</p>
          </div>
          <span className="badge-neutral text-[10px] flex-shrink-0 inline-flex items-center gap-1">
            <Mail className="w-3 h-3" /> Inbox
          </span>
        </div>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="input-ats !pl-10 !pr-9 w-full"
            placeholder="Search conversations…"
            aria-label="Search conversations"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <PremiumSelect
          compact
          icon={InboxIcon}
          value={channel}
          onChange={(v) => setChannel(v || 'all')}
          options={CHANNEL_FILTERS}
          placeholder="All channels"
        />
      </div>

      <div className="relative flex-1 overflow-y-auto overscroll-contain bg-[linear-gradient(180deg,#fafaf9_0%,#ffffff_40%)]">
        {loading ? (
          <div className="p-3.5 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 skeleton-ats rounded-xl" />
            ))}
          </div>
        ) : threads.length === 0 ? (
          <div className="p-4 h-full min-h-[16rem] flex items-center justify-center">
            <EmptyState
              compact
              icon={Mail}
              tone="brand"
              message="Inbox is empty"
              subMessage="Send a message to start a conversation thread."
              action={(
                <button type="button" className="btn-primary" onClick={onCompose}>
                  <Send className="w-4 h-4" /> New message
                </button>
              )}
            />
          </div>
        ) : (
          threads.map((t) => {
            const active = selectedId === t._id;
            const name = t.participants?.candidateName || t.subject || 'Conversation';
            return (
              <button
                key={t._id}
                type="button"
                onClick={() => onOpenThread(t._id)}
                className={`w-full text-left px-4 py-3 border-b border-stone-50 flex items-start gap-3 min-w-0 transition-colors ${
                  active
                    ? 'bg-brand-50/80 border-l-2 border-l-brand-500'
                    : 'hover:bg-brand-50/40 border-l-2 border-l-transparent'
                }`}
              >
                <span
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    active
                      ? 'bg-brand-600 text-white'
                      : 'bg-stone-100 text-stone-600 border border-stone-200'
                  }`}
                >
                  {initials(name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className={`text-sm truncate ${t.unreadCount ? 'font-bold text-stone-900' : 'font-semibold text-stone-800'}`}>
                      {name}
                    </span>
                    <span className="text-[10px] text-stone-400 whitespace-nowrap flex-shrink-0">
                      {formatWhen(t.lastMessageAt)}
                    </span>
                  </span>
                  <span className="block text-xs text-stone-500 truncate mt-0.5">
                    {t.lastMessagePreview || 'No messages yet'}
                  </span>
                  <span className="mt-1.5 flex items-center gap-1.5">
                    <span className="badge-neutral text-[10px] capitalize">{t.channel}</span>
                    {t.unreadCount > 0 && (
                      <span className="badge-brand text-[10px]">{t.unreadCount} new</span>
                    )}
                    {t.starred && <Star className="w-3 h-3 text-amber-500 fill-amber-400" />}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
