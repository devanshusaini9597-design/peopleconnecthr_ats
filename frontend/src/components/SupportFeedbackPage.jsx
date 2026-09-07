import React, { useCallback, useEffect, useState } from 'react';
import {
  LifeBuoy, Send, Loader2, MessageSquare, Bug, HelpCircle, Sparkles, Clock, Mail, MessageCircle, ChevronLeft, ChevronRight,
} from 'lucide-react';
import PageHeader from './ui/PageHeader';
import Modal from './ui/Modal';
import EmptyState from './ui/EmptyState';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import { useAuth } from '../context/AuthContext';

const TYPES = [
  { value: 'query', label: 'Guidance', hint: 'How can I…', icon: HelpCircle },
  { value: 'issue', label: 'Technical issue', hint: 'Something is not working', icon: Bug },
  { value: 'feedback', label: 'Product feedback', hint: 'Share an improvement', icon: MessageSquare },
  { value: 'feature', label: 'Feature request', hint: 'Request a capability', icon: Sparkles },
];

const STATUS = {
  open: { label: 'Open', className: 'badge-warning' },
  in_progress: { label: 'In progress', className: 'badge-info' },
  resolved: { label: 'Resolved', className: 'badge-success' },
};

function typeLabel(value) {
  return TYPES.find((t) => t.value === value)?.label || value;
}

function relativeTime(value) {
  if (!value) return '';
  const mins = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const emptyForm = { category: 'query', subject: '', message: '' };

export default function SupportFeedbackPage() {
  const toast = useToast();
  const { user, organization } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [ticketTab, setTicketTab] = useState('active');
  const [ticketPage, setTicketPage] = useState(1);
  const [ticketMeta, setTicketMeta] = useState({ total: 0, pages: 1 });

  const load = useCallback(async (page = ticketPage, status = ticketTab) => {
    try {
      const res = await authenticatedFetch(`/api/support/tickets?status=${status}&page=${page}&limit=10`);
      if (isUnauthorized(res)) return handleUnauthorized();
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not load tickets');
      setTickets(Array.isArray(data.data?.items) ? data.data.items : []);
      setTicketMeta({ total: data.data?.total || 0, pages: data.data?.pages || 1 });
    } catch (err) {
      toast.error(err.message || 'Could not load your tickets');
    } finally {
      setLoading(false);
    }
  }, [ticketPage, ticketTab, toast]);

  useEffect(() => { load(); }, [load]);

  const changeTicketTab = (tab) => {
    setTicketTab(tab);
    setTicketPage(1);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.subject.trim()) {
      toast.error('Add a subject');
      return;
    }
    if (!form.message.trim()) {
      toast.error('Add a message');
      return;
    }
    setSending(true);
    try {
      const res = await authenticatedFetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          pageUrl: `${window.location.origin}${window.location.pathname}`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Could not send');
      toast.success(`Sent to the product team · ${data.data?.ticketRef || 'ticket opened'}`);
      setForm(emptyForm);
      setComposeOpen(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  const openTicket = async (ticket) => {
    setSelectedTicket(ticket);
    setReplyText('');
    setTicketLoading(true);
    try {
      const res = await authenticatedFetch(`/api/support/tickets/${ticket._id}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Could not load ticket');
      setSelectedTicket(data.data);
    } catch (err) {
      toast.error(err.message || 'Could not load ticket');
    } finally {
      setTicketLoading(false);
    }
  };

  const submitReply = async (e) => {
    e.preventDefault();
    if (replyText.trim().length < 2 || !selectedTicket?._id) return;
    setReplySending(true);
    try {
      const res = await authenticatedFetch(`/api/support/tickets/${selectedTicket._id}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyText }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Could not send reply');
      setSelectedTicket(data.data);
      setReplyText('');
      await load();
      toast.success('Reply added to the ticket');
    } catch (err) {
      toast.error(err.message || 'Could not send reply');
    } finally {
      setReplySending(false);
    }
  };

  return (
    <div className="page-shell-ats animate-page-enter min-w-0">
      <PageHeader
        icon={LifeBuoy}
        title="Support & feedback"
        subtitle="Queries, issues, and product ideas go to the Skillnix software team. We typically reply within one business day."
      >
        <button type="button" className="btn-primary w-full sm:w-auto" onClick={() => setComposeOpen(true)}>
          <Send size={14} />
          New ticket
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 min-w-0">
        <Modal
          open={composeOpen}
          onClose={() => !sending && setComposeOpen(false)}
          title="New support ticket"
          description="Your message will be sent to the Skillnix product team."
          icon={LifeBuoy}
          size="lg"
          closeOnBackdrop={false}
          footer={(
            <>
              <button type="button" className="btn-secondary" onClick={() => setComposeOpen(false)} disabled={sending}>Cancel</button>
              <button type="submit" form="support-ticket-form" className="btn-primary" disabled={sending || form.subject.trim().length < 4 || form.message.trim().length < 10}>
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {sending ? 'Sending…' : 'Create ticket'}
              </button>
            </>
          )}
        >
        <form id="support-ticket-form" onSubmit={submit} className="space-y-5 min-w-0">
          <div className="rounded-xl border border-brand-100 bg-brand-50/60 px-3.5 py-3">
            <p className="text-xs font-semibold text-stone-800">Replies go to {user?.email || 'your signed-in email'}</p>
            <p className="text-[11px] text-stone-500 mt-0.5">{organization?.name || 'Skillnix workspace'} · Typical response within one business day</p>
          </div>

          <div className="space-y-4 min-w-0">
            <div className="min-w-0">
              <p className="label-ats">Type</p>
              <div className="grid grid-cols-2 gap-2 min-w-0">
                {TYPES.map((t) => {
                  const Icon = t.icon;
                  const active = form.category === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, category: t.value }))}
                      className={`min-w-0 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                        active
                          ? 'border-brand-200 bg-brand-50 text-brand-800'
                          : 'border-stone-200 bg-white text-stone-700 hover:border-brand-200 hover:bg-brand-50/40'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 min-w-0">
                        <Icon size={14} className={`shrink-0 ${active ? 'text-brand-600' : 'text-stone-400'}`} />
                        <span className="text-[13px] font-semibold truncate">{t.label}</span>
                      </span>
                      <span className={`block text-[11px] mt-0.5 truncate ${active ? 'text-brand-700/70' : 'text-stone-400'}`}>
                        {t.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="min-w-0">
              <label className="label-ats" htmlFor="support-subject">Subject</label>
              <input
                id="support-subject"
                value={form.subject}
                onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
                maxLength={160}
                className="input-ats w-full"
                placeholder="Short summary of the query, issue, or idea"
              />
            </div>

            <div className="min-w-0">
              <label className="label-ats" htmlFor="support-message">Details</label>
              <textarea
                id="support-message"
                value={form.message}
                onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
                rows={7}
                maxLength={4000}
                className="input-ats w-full min-h-[96px] max-h-[220px] resize-none overflow-y-auto"
                onInput={(e) => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 220)}px`; }}
                placeholder="Describe the issue, expected outcome, and relevant job or page reference."
              />
              <p className="mt-1 text-[11px] text-stone-400 tabular-nums text-right">{form.message.length}/4000</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-stone-100 pt-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">Case context</p>
                <p className="text-xs text-stone-600 mt-1 truncate" title={window.location.pathname}>{window.location.pathname}</p>
              </div>
              <div className="sm:text-right">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">Delivery</p>
                <p className="text-xs text-stone-600 mt-1">Secure product inbox</p>
              </div>
            </div>
          </div>
        </form>
        </Modal>

        <Modal
          open={!!selectedTicket}
          onClose={() => !replySending && setSelectedTicket(null)}
          title={selectedTicket?.ticketRef || 'Ticket'}
          description={selectedTicket?.subject || 'Support conversation'}
          icon={MessageCircle}
          size="lg"
        >
          {ticketLoading ? (
            <div className="space-y-3">
              <div className="h-8 skeleton-ats rounded-xl" />
              <div className="h-24 skeleton-ats rounded-xl" />
              <div className="h-24 skeleton-ats rounded-xl" />
            </div>
          ) : selectedTicket ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.1em] font-bold text-stone-400">Ticket status</p>
                  <p className="text-sm font-semibold text-stone-800 mt-1">{typeLabel(selectedTicket.category)}</p>
                </div>
                <span className={STATUS[selectedTicket.status]?.className || STATUS.open.className}>{STATUS[selectedTicket.status]?.label || STATUS.open.label}</span>
              </div>

              <div className="space-y-3 max-h-[min(38vh,24rem)] overflow-y-auto pr-1">
                <div className="rounded-2xl border border-brand-100 bg-brand-50/60 p-3.5">
                  <div className="flex items-center justify-between gap-3 text-[11px] text-brand-800">
                    <span className="font-semibold">You</span>
                    <span>{relativeTime(selectedTicket.createdAt)}</span>
                  </div>
                  <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap mt-2">{selectedTicket.message}</p>
                </div>
                {(selectedTicket.replies || []).map((reply, index) => (
                  <div key={`${reply.createdAt || 'reply'}-${index}`} className={`rounded-2xl border p-3.5 ${reply.authorType === 'support' ? 'border-stone-200 bg-white' : 'border-brand-100 bg-brand-50/60'}`}>
                    <div className="flex items-center justify-between gap-3 text-[11px] text-stone-500">
                      <span className="font-semibold text-stone-700">{reply.authorType === 'support' ? 'Skillnix support' : 'You'}</span>
                      <span>{relativeTime(reply.createdAt)}</span>
                    </div>
                    <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap mt-2">{reply.body}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={submitReply} className="border-t border-stone-100 pt-4">
                <label className="label-ats" htmlFor="support-reply">Reply to this ticket</label>
                <textarea
                  id="support-reply"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={4}
                  maxLength={4000}
                  className="input-ats w-full resize-y mt-1"
                  placeholder="Add context or reply to the product team…"
                />
                <div className="flex items-center justify-between gap-3 mt-2">
                  <span className="text-[11px] text-stone-400">{replyText.length}/4000</span>
                  <button type="submit" className="btn-primary" disabled={replySending || replyText.trim().length < 2}>
                    {replySending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    {replySending ? 'Sending…' : 'Send reply'}
                  </button>
                </div>
              </form>
            </div>
          ) : null}
        </Modal>

        <section className="lg:col-span-5 card-ats-bordered relative overflow-hidden flex flex-col min-w-0 min-h-[20rem]">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <div className="relative p-5 sm:p-6 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand-700">Freelancer support desk</p>
            <h2 className="text-xl font-bold text-stone-900 tracking-tight mt-2">Help when your desk needs it.</h2>
            <p className="text-sm text-stone-500 leading-relaxed mt-2">Share enough context for the product team to act quickly. Every request gets a ticket reference and stays available in your history.</p>
            <div className="mt-6 space-y-3">
              <div className="flex items-start gap-3 rounded-xl border border-stone-200 bg-stone-50/70 p-3">
                <Clock size={16} className="text-brand-600 mt-0.5 shrink-0" />
                <div><p className="text-xs font-semibold text-stone-800">One-business-day response</p><p className="text-[11px] text-stone-500 mt-0.5">Urgent account issues should include the affected page or job ID.</p></div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-stone-200 bg-stone-50/70 p-3">
                <Mail size={16} className="text-brand-600 mt-0.5 shrink-0" />
                <div><p className="text-xs font-semibold text-stone-800">Replies stay with your account</p><p className="text-[11px] text-stone-500 mt-0.5 break-words">{user?.email || 'Your signed-in email'}</p></div>
              </div>
            </div>
          </div>
        </section>

        <section className="lg:col-span-7 card-ats-bordered relative overflow-hidden flex flex-col min-w-0 min-h-[20rem] lg:min-h-[28rem]">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <div className="relative px-4 sm:px-5 pt-4 pb-0 border-b border-stone-100">
            <div className="flex items-center justify-between gap-2 pb-3">
            <div className="min-w-0">
              <h2 className="text-[15px] font-bold text-stone-900 tracking-tight">Your tickets</h2>
              <p className="text-[11px] text-stone-400 mt-0.5">Logged here and emailed to the product team</p>
            </div>
            <span className="badge-neutral shrink-0 tabular-nums">{tickets.length}</span>
            </div>
            <div className="flex items-center gap-5" role="tablist" aria-label="Ticket status">
              {[['active', 'Active'], ['resolved', 'Resolved'], ['all', 'All tickets']].map(([value, label]) => (
                <button key={value} type="button" role="tab" aria-selected={ticketTab === value} onClick={() => changeTicketTab(value)} className={`border-b-2 pb-2.5 text-xs font-semibold transition-colors ${ticketTab === value ? 'border-brand-600 text-brand-700' : 'border-transparent text-stone-500 hover:text-stone-800'}`}>{label}</button>
              ))}
            </div>
          </div>

          <div className="relative flex-1 min-h-0 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-16 skeleton-ats rounded-xl" />)}
              </div>
            ) : tickets.length === 0 ? (
              <EmptyState
                compact
                icon={LifeBuoy}
                tone="brand"
                message="No tickets yet"
                subMessage="Create a ticket to contact the support team."
              />
            ) : (
              <ul className="divide-y divide-stone-100">
                {tickets.map((row) => {
                  const st = STATUS[row.status] || STATUS.open;
                  return (
                    <li key={row._id} className="px-4 sm:px-5 py-3.5">
                      <button type="button" onClick={() => openTicket(row)} className="w-full text-left rounded-xl hover:bg-stone-50 -m-2 p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                      <div className="flex items-start justify-between gap-3 min-w-0">
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold text-brand-700 tabular-nums">{row.ticketRef}</p>
                          <p className="text-sm font-semibold text-stone-900 break-words mt-0.5">{row.subject}</p>
                        </div>
                        <span className={`${st.className} shrink-0`}>{st.label}</span>
                      </div>
                      <p className="text-[11px] text-stone-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span>{typeLabel(row.category)}</span>
                        <span className="inline-flex items-center gap-1 text-stone-400">
                          <Clock size={10} /> {relativeTime(row.createdAt)}
                        </span>
                      </p>
                      <p className="text-[12px] text-stone-600 mt-1.5 leading-relaxed break-words line-clamp-3">
                        {row.message}
                      </p>
                      <p className="text-[11px] font-semibold text-brand-700 mt-2">View conversation</p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {ticketMeta.total > 0 && (
            <div className="relative border-t border-stone-100 px-4 sm:px-5 py-3 flex items-center justify-between gap-3 bg-stone-50/50">
              <span className="text-[11px] text-stone-500">{ticketMeta.total} {ticketMeta.total === 1 ? 'ticket' : 'tickets'}</span>
              <div className="flex items-center gap-2">
                <button type="button" className="btn-secondary !px-2.5 !py-1.5" onClick={() => setTicketPage((page) => page - 1)} disabled={ticketPage <= 1 || loading} aria-label="Previous tickets"><ChevronLeft size={14} /></button>
                <span className="text-[11px] font-semibold text-stone-600">{ticketPage} / {ticketMeta.pages}</span>
                <button type="button" className="btn-secondary !px-2.5 !py-1.5" onClick={() => setTicketPage((page) => page + 1)} disabled={ticketPage >= ticketMeta.pages || loading} aria-label="Next tickets"><ChevronRight size={14} /></button>
              </div>
            </div>
          )}
        </section>
      </div>

      <p className="text-[12px] text-stone-400 text-center sm:text-left leading-relaxed">
        Prefer email?{' '}
        <a href="mailto:support@skillnixrecruitment.com" className="text-brand-700 font-semibold inline-flex items-center gap-1 hover:underline break-all">
          <Mail size={12} className="shrink-0" /> support@skillnixrecruitment.com
        </a>
      </p>
    </div>
  );
}
