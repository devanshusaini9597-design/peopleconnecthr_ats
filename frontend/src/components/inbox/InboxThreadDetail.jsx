import React from 'react';
import {
  Mail, Loader2, Send, Archive, MessageSquare, ArrowLeft
} from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import PremiumSelect from '../ui/PremiumSelect';
import { REPLY_CHANNELS, formatWhen, initials } from './inboxConstants';

export default function InboxThreadDetail({
  showDetailPane,
  selectedId,
  detailLoading,
  detail,
  threadTitle,
  reply,
  setReply,
  replyChannel,
  setReplyChannel,
  sending,
  onBack,
  onArchive,
  onSendReply,
}) {
  return (
    <div
      data-tour="inbox-thread"
      className={`lg:col-span-7 card-ats-bordered relative overflow-hidden flex flex-col min-w-0 min-h-[28rem] ${
        showDetailPane ? 'flex' : 'hidden lg:flex'
      }`}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />

      {!selectedId ? (
        <div className="relative flex-1 flex flex-col justify-center p-5 sm:p-6">
          <EmptyState
            icon={MessageSquare}
            tone="brand"
            message="Select a conversation"
            subMessage="Choose a thread from the list to read messages and reply."
          />
        </div>
      ) : detailLoading ? (
        <div className="relative flex-1 p-4 sm:p-5 space-y-3">
          <div className="h-14 skeleton-ats rounded-xl" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 skeleton-ats rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="relative px-4 sm:px-5 pt-4 pb-3 border-b border-stone-100 flex items-start gap-3 min-w-0">
            <button
              type="button"
              className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 flex-shrink-0"
              onClick={onBack}
              aria-label="Back to threads"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
              {initials(detail?.thread?.participants?.candidateName || threadTitle)}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] font-bold text-stone-900 tracking-tight truncate">
                {threadTitle}
              </h2>
              <p className="text-[11px] text-stone-500 mt-0.5 truncate">
                {detail?.thread?.participants?.candidateName || 'Candidate'}
                {detail?.thread?.participants?.candidateEmail
                  ? ` · ${detail.thread.participants.candidateEmail}`
                  : ''}
                {detail?.thread?.channel ? ` · ${detail.thread.channel}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={onArchive}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-[12px] font-semibold text-stone-600 hover:border-stone-300 hover:bg-stone-50 flex-shrink-0 whitespace-nowrap"
              title="Archive conversation"
            >
              <Archive className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Archive</span>
            </button>
          </div>

          <div className="relative flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-3 min-h-[12rem] bg-[linear-gradient(180deg,#fafaf9_0%,#ffffff_48%)]">
            {(detail?.messages || []).length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                tone="amber"
                compact
                message="No messages yet"
                subMessage="Send a reply below to continue this conversation."
              />
            ) : (
              (detail?.messages || []).map((m) => (
                <div
                  key={m._id}
                  className={`max-w-[92%] sm:max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-[0_1px_0_rgba(28,25,23,0.03)] ${
                    m.direction === 'outbound'
                      ? 'ml-auto bg-brand-600 text-white rounded-br-md'
                      : 'mr-auto bg-white border border-stone-200/80 text-stone-800 rounded-bl-md'
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">{m.body}</div>
                  <div className={`mt-1.5 text-[10px] flex items-center gap-2 ${
                    m.direction === 'outbound' ? 'text-brand-100' : 'text-stone-400'
                  }`}>
                    <span className="capitalize">{m.channel}</span>
                    <span>·</span>
                    <span>{formatWhen(m.sentAt)}</span>
                    {m.status === 'failed' && (
                      <span className={m.direction === 'outbound' ? 'text-red-200' : 'text-red-500'}>
                        Failed
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="relative p-3.5 sm:p-4 border-t border-stone-100 space-y-2.5 bg-white">
            <div className="max-w-[14rem]">
              <label className="label-ats">Reply via</label>
              <PremiumSelect
                compact
                icon={Mail}
                value={replyChannel}
                onChange={(v) => setReplyChannel(v || 'email')}
                options={REPLY_CHANNELS}
                placeholder="Channel"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={2}
                className="input-ats flex-1 resize-none"
                placeholder="Write a reply…"
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    onSendReply();
                  }
                }}
              />
              <button
                type="button"
                onClick={onSendReply}
                disabled={sending || !reply.trim()}
                className="btn-primary sm:self-end whitespace-nowrap"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send
              </button>
            </div>
            <p className="text-[11px] text-stone-400">
              Tip: Ctrl/Cmd + Enter to send. Respect consent for SMS/WhatsApp.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
