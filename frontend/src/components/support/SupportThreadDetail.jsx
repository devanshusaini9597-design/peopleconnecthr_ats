import React from 'react';
import {
  ArrowLeft, Star, MailOpen, Send, Loader2, LifeBuoy,
} from 'lucide-react';
import PremiumSelect from '../ui/PremiumSelect';
import { STATUS, TYPES, initials, relativeTime } from './supportConstants';

export default function SupportThreadDetail({
  ticket,
  loading,
  replyText,
  setReplyText,
  replyStatus,
  setReplyStatus,
  replySending,
  statusSaving,
  onBack,
  onStar,
  onUnread,
  onStatus,
  onSend,
}) {
  if (loading || !ticket) {
    return (
      <div className="card-ats-bordered p-6 space-y-3 min-h-[32rem]">
        <div className="h-8 skeleton-ats rounded-xl" />
        <div className="h-40 skeleton-ats rounded-xl" />
      </div>
    );
  }

  const name = ticket.userName || ticket.userEmail || 'Freelancer';
  const st = STATUS[ticket.status] || STATUS.open;

  return (
    <div className="card-ats-bordered overflow-hidden flex flex-col min-h-[32rem] min-w-0">
      <div className="px-3 sm:px-4 py-3 border-b border-stone-100 flex items-start gap-3">
        <button type="button" onClick={onBack} className="btn-secondary !px-2.5 !py-1.5 lg:hidden" aria-label="Back">
          <ArrowLeft size={16} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-brand-700 tabular-nums">{ticket.ticketRef}</p>
          <h2 className="text-[17px] font-bold text-stone-900 tracking-tight break-words">{ticket.subject}</h2>
          <p className="text-[12px] text-stone-500 mt-0.5 truncate">
            {name}{ticket.userEmail ? ` · ${ticket.userEmail}` : ''} · {TYPES[ticket.category] || ticket.category}
          </p>
        </div>
        <span className={`${st.className} shrink-0`}>{st.label}</span>
      </div>

      <div className="px-3 sm:px-4 py-2 border-b border-stone-100 flex flex-wrap items-center gap-2">
        <button type="button" onClick={onStar} className="btn-secondary !py-1.5 !px-2.5 !text-xs">
          <Star size={14} className={ticket.starred ? 'fill-amber-400 text-amber-500' : ''} />
          {ticket.starred ? 'Starred' : 'Star'}
        </button>
        <button type="button" onClick={onUnread} className="btn-secondary !py-1.5 !px-2.5 !text-xs">
          <MailOpen size={14} /> Unread
        </button>
        {Object.keys(STATUS).map((key) => (
          <button
            key={key}
            type="button"
            disabled={statusSaving}
            onClick={() => onStatus(key)}
            className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border ${
              ticket.status === key
                ? 'border-brand-300 bg-brand-50 text-brand-800'
                : 'border-stone-200 bg-white text-stone-600 hover:border-brand-200'
            }`}
          >
            {STATUS[key].label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-stone-50/40">
        <MessageBubble
          name={name}
          email={ticket.userEmail}
          at={ticket.createdAt}
          body={ticket.message}
          mine={false}
        />
        {(ticket.replies || []).map((reply, index) => (
          <MessageBubble
            key={`${reply.createdAt || index}-${index}`}
            name={reply.authorName || (reply.authorType === 'support' ? 'Hiring team' : name)}
            email={reply.authorEmail}
            at={reply.createdAt}
            body={reply.body}
            mine={reply.authorType === 'support'}
          />
        ))}
      </div>

      <form onSubmit={onSend} className="border-t border-stone-100 p-3 sm:p-4 bg-white space-y-2">
        <textarea
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          rows={4}
          maxLength={4000}
          className="input-ats w-full resize-y !min-h-[6rem]"
          placeholder="Reply — the freelancer gets this in-app and by email"
        />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="w-full sm:w-44">
            <PremiumSelect
              compact
              value={replyStatus}
              onChange={setReplyStatus}
              options={[
                { value: 'open', label: 'Keep open' },
                { value: 'in_progress', label: 'In progress' },
                { value: 'resolved', label: 'Resolved' },
              ]}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={replySending || replyText.trim().length < 2}>
            {replySending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {replySending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
}

function MessageBubble({ name, email, at, body, mine }) {
  return (
    <div className={`flex gap-3 ${mine ? 'flex-row-reverse' : ''}`}>
      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
        mine ? 'bg-brand-600 text-white' : 'bg-stone-200 text-stone-700'
      }`}
      >
        {mine ? <LifeBuoy size={14} /> : initials(name)}
      </span>
      <div className={`max-w-[85%] rounded-2xl border px-3.5 py-2.5 ${
        mine ? 'border-brand-100 bg-brand-50/80' : 'border-stone-200 bg-white'
      }`}
      >
        <div className="flex items-baseline justify-between gap-3 text-[11px] text-stone-500">
          <span className="font-semibold text-stone-800 truncate">{name}</span>
          <span className="tabular-nums shrink-0">{relativeTime(at)}</span>
        </div>
        {email ? <p className="text-[11px] text-stone-400 truncate">{email}</p> : null}
        <p className="text-sm text-stone-800 leading-relaxed whitespace-pre-wrap mt-1.5">{body}</p>
      </div>
    </div>
  );
}
