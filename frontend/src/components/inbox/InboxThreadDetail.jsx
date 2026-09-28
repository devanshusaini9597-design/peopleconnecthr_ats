import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Mail, Loader2, Send, Archive, MessageSquare, ArrowLeft, User, Star, MailOpen,
  Trash2, RotateCcw, Clock, Paperclip, ExternalLink,
} from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import PremiumSelect from '../ui/PremiumSelect';
import { REPLY_CHANNELS, SNOOZE_OPTIONS, formatWhen, initials } from './inboxConstants';
import InboxMessageBody from './InboxMessageBody';
import { buildAtsHref } from '../../utils/atsLinks';

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
  templates = [],
  selectedTemplateId,
  setSelectedTemplateId,
  assignees = [],
  replyFiles = [],
  setReplyFiles,
  onApplyTemplate,
  onAssign,
  onSnooze,
  onUnsnooze,
  onBack,
  onArchive,
  onRestore,
  onStar,
  onUnread,
  onDelete,
  onSendReply,
}) {
  const thread = detail?.thread;
  const messages = detail?.messages || [];
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const candidateQ = thread?.participants?.candidateEmail || thread?.participants?.candidateName || '';
  const candidateHref = candidateQ ? buildAtsHref({ q: candidateQ }) : '/ats';
  const snoozed = thread?.snoozedUntil && new Date(thread.snoozedUntil) > new Date();
  const assigneeOptions = assignees.map((u) => ({
    value: String(u._id),
    label: u.name || u.email,
    description: u.email,
  }));
  const templateOptions = [
    { value: '', label: 'Blank reply' },
    ...templates.map((t) => ({
      value: String(t._id),
      label: t.name,
      description: t.category || '',
    })),
  ];

  const iconBtn = 'inline-flex items-center justify-center w-9 h-9 rounded-full text-stone-600 hover:bg-brand-50 hover:text-brand-800 flex-shrink-0';

  return (
    <div
      data-tour="inbox-thread"
      className="card-ats-bordered relative overflow-hidden flex flex-col min-w-0 flex-1 min-h-[32rem]"
    >
      {!selectedId ? (
        <div className="relative flex-1 flex flex-col justify-center p-5 sm:p-6">
          <EmptyState
            icon={MessageSquare}
            tone="brand"
            message="Select a conversation"
            subMessage="Open a thread to read the original email layout and reply."
          />
        </div>
      ) : detailLoading ? (
        <div className="relative flex-1 p-4 sm:p-5 space-y-3">
          <div className="h-12 skeleton-ats rounded-xl" />
          <div className="h-64 skeleton-ats rounded-2xl" />
        </div>
      ) : (
        <>
          <div className="border-b border-stone-100 bg-white">
            <div className="flex items-center gap-1 px-2 sm:px-3 h-12">
              <button type="button" className={iconBtn} onClick={onBack} aria-label="Back to inbox" title="Back">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-stone-900 px-1">
                {threadTitle}
              </h2>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button type="button" className={iconBtn} onClick={onStar} title={thread?.starred ? 'Unstar' : 'Star'}>
                  <Star className={`w-4 h-4 ${thread?.starred ? 'text-amber-500 fill-amber-400' : ''}`} />
                </button>
                <button type="button" className={iconBtn} onClick={onUnread} title="Mark unread">
                  <MailOpen className="w-4 h-4" />
                </button>
                <div className="relative">
                  <button type="button" className={iconBtn} onClick={() => setSnoozeOpen((v) => !v)} title="Snooze">
                    <Clock className="w-4 h-4" />
                  </button>
                  {snoozeOpen ? (
                    <div className="absolute right-0 top-11 z-20 w-44 rounded-xl border border-stone-200 bg-white shadow-lg py-1">
                      {SNOOZE_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          className="w-full text-left px-3 py-1.5 text-[12px] text-stone-700 hover:bg-brand-50"
                          onClick={() => {
                            setSnoozeOpen(false);
                            onSnooze(opt.id);
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                      {snoozed ? (
                        <button
                          type="button"
                          className="w-full text-left px-3 py-1.5 text-[12px] text-stone-700 hover:bg-stone-50 border-t border-stone-100"
                          onClick={() => {
                            setSnoozeOpen(false);
                            onUnsnooze();
                          }}
                        >
                          Wake now
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {thread?.archived ? (
                  <button type="button" className={iconBtn} onClick={onRestore} title="Move to inbox">
                    <RotateCcw className="w-4 h-4" />
                  </button>
                ) : (
                  <button type="button" className={iconBtn} onClick={onArchive} title="Archive">
                    <Archive className="w-4 h-4" />
                  </button>
                )}
                <button type="button" className={`${iconBtn} text-rose-600 hover:bg-rose-50`} onClick={onDelete} title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3 px-3 sm:px-4 pb-3 min-w-0">
              <span className="w-10 h-10 rounded-full bg-brand-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                {initials(thread?.participants?.candidateName || threadTitle)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-stone-900 truncate">
                  {thread?.participants?.candidateName || 'Candidate'}
                  {thread?.participants?.candidateEmail ? (
                    <span className="font-normal text-stone-500">
                      {' <'}
                      {thread.participants.candidateEmail}
                      {'>'}
                    </span>
                  ) : null}
                </p>
                {snoozed ? (
                  <p className="text-[11px] text-amber-700">Snoozed until {formatWhen(thread.snoozedUntil)}</p>
                ) : (
                  <p className="text-[11px] text-stone-400 truncate capitalize">
                    {thread?.channel || 'email'}
                    {thread?.source === 'imap' ? ' · team mailbox' : ''}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {candidateQ ? (
                  <Link to={candidateHref} className={iconBtn} title="Open candidate">
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                ) : null}
                {assigneeOptions.length > 0 ? (
                  <div className="w-[11.5rem] hidden sm:block">
                    <PremiumSelect
                      compact
                      icon={User}
                      value={thread?.assignedTo ? String(thread.assignedTo) : ''}
                      onChange={(v) => v && onAssign(v)}
                      options={assigneeOptions}
                      placeholder="Assign"
                      searchable
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="relative flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-5 min-h-[14rem] bg-stone-50/70">
            {messages.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                tone="amber"
                compact
                message="No messages yet"
                subMessage="Send a reply below to continue this conversation."
              />
            ) : (
              messages.map((m) => (
                <article key={m._id} className="space-y-2">
                  <div className="flex items-center justify-between gap-3 px-0.5">
                    <p className="text-[12px] font-medium text-stone-600 truncate">
                      {m.direction === 'outbound' ? (m.fromName || 'You') : (m.fromName || m.fromAddress || 'Sender')}
                      {m.fromAddress && m.direction !== 'outbound' ? (
                        <span className="text-stone-400 font-normal"> · {m.fromAddress}</span>
                      ) : null}
                    </p>
                    <p className="text-[11px] text-stone-400 whitespace-nowrap">
                      {formatWhen(m.sentAt)}
                      {m.status === 'failed' ? ' · Failed' : ''}
                    </p>
                  </div>
                  <InboxMessageBody
                    message={m}
                    threadId={selectedId}
                  />
                </article>
              ))
            )}
          </div>

          <div className="relative p-3.5 sm:p-4 border-t border-stone-100 space-y-2.5 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[12px] font-semibold text-stone-700">Reply</p>
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-[12rem]">
                  <PremiumSelect
                    compact
                    value={selectedTemplateId || ''}
                    onChange={(v) => {
                      setSelectedTemplateId(v || '');
                      if (v) onApplyTemplate(v);
                    }}
                    options={templateOptions}
                    placeholder="Template"
                  />
                </div>
                <div className="w-[11rem]">
                  <PremiumSelect
                    compact
                    icon={Mail}
                    value={replyChannel}
                    onChange={(v) => setReplyChannel(v || 'email')}
                    options={REPLY_CHANNELS}
                    placeholder="Channel"
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={3}
                className="input-ats flex-1 resize-none min-h-[4.5rem]"
                placeholder="Write a reply…"
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    onSendReply();
                  }
                }}
              />
              <div className="flex sm:flex-col gap-2 sm:self-end">
                <label className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 cursor-pointer">
                  <Paperclip className="w-4 h-4" />
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const next = [...replyFiles, ...Array.from(e.target.files || [])].slice(0, 5);
                      setReplyFiles(next);
                      e.target.value = '';
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={onSendReply}
                  disabled={sending || !reply.trim()}
                  className="btn-primary whitespace-nowrap"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send
                </button>
              </div>
            </div>
            {replyFiles.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {replyFiles.map((f, i) => (
                  <button
                    key={`${f.name}-${i}`}
                    type="button"
                    className="text-[11px] px-2 py-1 rounded-md bg-stone-100 text-stone-600 hover:bg-rose-50 hover:text-rose-700"
                    onClick={() => setReplyFiles(replyFiles.filter((_, idx) => idx !== i))}
                    title="Remove"
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            ) : null}
            <p className="text-[11px] text-stone-400">Ctrl/Cmd + Enter to send. PDF, Word, Excel, and images up to 8 MB.</p>
          </div>
        </>
      )}
    </div>
  );
}
