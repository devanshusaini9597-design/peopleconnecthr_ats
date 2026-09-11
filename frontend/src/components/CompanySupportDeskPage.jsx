import React, { useCallback, useEffect, useState } from 'react';
import {
  LifeBuoy, Send, Loader2, Search, Clock, MessageCircle, ChevronLeft, ChevronRight, RefreshCw,
} from 'lucide-react';
import PageHeader from './ui/PageHeader';
import Modal from './ui/Modal';
import EmptyState from './ui/EmptyState';
import PremiumSelect from './ui/PremiumSelect';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import { useAuth } from '../context/AuthContext';

const TYPES = {
  query: 'Guidance',
  issue: 'Technical issue',
  feedback: 'Product feedback',
  feature: 'Feature request',
};

const STATUS = {
  open: { label: 'Open', className: 'badge-warning' },
  in_progress: { label: 'In progress', className: 'badge-info' },
  resolved: { label: 'Resolved', className: 'badge-success' },
};

const COMPANY_ROLES = ['owner', 'admin', 'hr_manager', 'hr_recruiter', 'recruiter', 'sales'];

function relativeTime(value) {
  if (!value) return '';
  const mins = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function CompanySupportDeskPage() {
  const toast = useToast();
  const { user } = useAuth();
  const allowed = COMPANY_ROLES.includes(user?.role);

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ticketTab, setTicketTab] = useState('active');
  const [ticketPage, setTicketPage] = useState(1);
  const [ticketMeta, setTicketMeta] = useState({ total: 0, pages: 1 });
  const [query, setQuery] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyStatus, setReplyStatus] = useState('in_progress');
  const [replySending, setReplySending] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);

  const load = useCallback(async (page = ticketPage, status = ticketTab, q = query) => {
    try {
      const params = new URLSearchParams({ status, page: String(page), limit: '15' });
      if (q.trim()) params.set('q', q.trim());
      const res = await authenticatedFetch(`/api/support/org/tickets?${params}`);
      if (isUnauthorized(res)) return handleUnauthorized();
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not load tickets');
      setTickets(Array.isArray(data.data?.items) ? data.data.items : []);
      setTicketMeta({ total: data.data?.total || 0, pages: data.data?.pages || 1 });
    } catch (err) {
      toast.error(err.message || 'Could not load support desk');
    } finally {
      setLoading(false);
    }
  }, [ticketPage, ticketTab, query, toast]);

  useEffect(() => {
    if (!allowed) return undefined;
    setLoading(true);
    load();
    const id = setInterval(() => load(), 60000);
    return () => clearInterval(id);
  }, [allowed, load]);

  if (!allowed) {
    return (
      <div className="page-shell-ats animate-page-enter">
        <EmptyState
          icon={LifeBuoy}
          tone="brand"
          message="Support desk unavailable"
          subMessage="Only hiring-team roles can manage freelancer support tickets."
        />
      </div>
    );
  }

  const openTicket = async (ticket) => {
    setSelectedTicket(ticket);
    setReplyText('');
    setReplyStatus(ticket.status === 'resolved' ? 'resolved' : 'in_progress');
    setTicketLoading(true);
    try {
      const res = await authenticatedFetch(`/api/support/org/tickets/${ticket._id}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Could not load ticket');
      setSelectedTicket(data.data);
      setReplyStatus(data.data?.status === 'resolved' ? 'resolved' : 'in_progress');
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
      const res = await authenticatedFetch(`/api/support/org/tickets/${selectedTicket._id}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyText, status: replyStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Could not send reply');
      setSelectedTicket(data.data);
      setReplyText('');
      await load();
      toast.success('Reply sent — freelancer notified in-app and by email');
    } catch (err) {
      toast.error(err.message || 'Could not send reply');
    } finally {
      setReplySending(false);
    }
  };

  const changeStatus = async (status) => {
    if (!selectedTicket?._id || selectedTicket.status === status) return;
    setStatusSaving(true);
    try {
      const res = await authenticatedFetch(`/api/support/org/tickets/${selectedTicket._id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Could not update status');
      setSelectedTicket(data.data);
      setReplyStatus(status === 'resolved' ? 'resolved' : 'in_progress');
      await load();
      toast.success(`Status set to ${STATUS[status]?.label || status} — freelancer notified`);
    } catch (err) {
      toast.error(err.message || 'Could not update status');
    } finally {
      setStatusSaving(false);
    }
  };

  return (
    <div className="page-shell-ats animate-page-enter min-w-0">
      <PageHeader
        icon={LifeBuoy}
        title="Freelancer support desk"
        subtitle="Review, reply, and update status on freelancer guidance, issues, and product feedback. Freelancers see changes live in-app and receive email."
      >
        <button type="button" className="btn-secondary w-full sm:w-auto" onClick={() => { setLoading(true); load(); }} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 min-w-0">
        <section className="lg:col-span-4 card-ats-bordered relative overflow-hidden flex flex-col min-w-0 min-h-[18rem]">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <div className="relative p-5 sm:p-6 flex-1 space-y-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand-700">Operations</p>
            <h2 className="text-xl font-bold text-stone-900 tracking-tight">Respond with clarity.</h2>
            <p className="text-sm text-stone-500 leading-relaxed">
              Every ticket is scoped to your organization. Replies and status changes notify the freelancer immediately in the ATS and by email to their login address.
            </p>
            <ul className="space-y-2 text-[12px] text-stone-600 leading-relaxed">
              <li className="flex gap-2"><span className="text-brand-600 font-bold">1.</span> Open an active ticket and read the full thread.</li>
              <li className="flex gap-2"><span className="text-brand-600 font-bold">2.</span> Reply with next steps; status moves to In progress by default.</li>
              <li className="flex gap-2"><span className="text-brand-600 font-bold">3.</span> Mark Resolved when the case is closed — the freelancer sees it live.</li>
            </ul>
          </div>
        </section>

        <section className="lg:col-span-8 card-ats-bordered relative overflow-hidden flex flex-col min-w-0 min-h-[28rem]">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <div className="relative px-4 sm:px-5 pt-4 pb-0 border-b border-stone-100 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[15px] font-bold text-stone-900 tracking-tight">Organization tickets</h2>
                <p className="text-[11px] text-stone-400 mt-0.5">Freelancer submissions for your workspace</p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setTicketPage(1); }}
                  className="input-ats w-full !pl-9"
                  placeholder="Search ID, subject, name…"
                />
              </div>
            </div>
            <div className="flex items-center gap-5" role="tablist" aria-label="Ticket status">
              {[['active', 'Active'], ['resolved', 'Resolved'], ['all', 'All']].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={ticketTab === value}
                  onClick={() => { setTicketTab(value); setTicketPage(1); }}
                  className={`border-b-2 pb-2.5 text-xs font-semibold transition-colors ${ticketTab === value ? 'border-brand-600 text-brand-700' : 'border-transparent text-stone-500 hover:text-stone-800'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative flex-1 min-h-0 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 skeleton-ats rounded-xl" />)}
              </div>
            ) : tickets.length === 0 ? (
              <EmptyState
                compact
                icon={LifeBuoy}
                tone="brand"
                message="No tickets in this view"
                subMessage="When freelancers submit support or feedback, they appear here for your team."
              />
            ) : (
              <ul className="divide-y divide-stone-100">
                {tickets.map((row) => {
                  const st = STATUS[row.status] || STATUS.open;
                  const replyCount = Array.isArray(row.replies) ? row.replies.length : 0;
                  return (
                    <li key={row._id} className="px-4 sm:px-5 py-3.5">
                      <button type="button" onClick={() => openTicket(row)} className="w-full text-left rounded-xl hover:bg-stone-50 -m-2 p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                        <div className="flex items-start justify-between gap-3 min-w-0">
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold text-brand-700 tabular-nums">{row.ticketRef}</p>
                            <p className="text-sm font-semibold text-stone-900 break-words mt-0.5">{row.subject}</p>
                            <p className="text-[11px] text-stone-500 mt-1">
                              {row.userName || row.userEmail || 'Freelancer'}
                              {row.userEmail ? ` · ${row.userEmail}` : ''}
                            </p>
                          </div>
                          <span className={`${st.className} shrink-0`}>{st.label}</span>
                        </div>
                        <p className="text-[12px] text-stone-600 mt-1.5 leading-relaxed break-words line-clamp-2">{row.message}</p>
                        <p className="text-[11px] text-stone-400 mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          <span>{TYPES[row.category] || row.category}</span>
                          <span className="inline-flex items-center gap-1"><Clock size={10} /> {relativeTime(row.updatedAt || row.createdAt)}</span>
                          <span>{replyCount} {replyCount === 1 ? 'reply' : 'replies'}</span>
                        </p>
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
                <button type="button" className="btn-secondary !px-2.5 !py-1.5" onClick={() => setTicketPage((p) => p - 1)} disabled={ticketPage <= 1 || loading} aria-label="Previous"><ChevronLeft size={14} /></button>
                <span className="text-[11px] font-semibold text-stone-600">{ticketPage} / {ticketMeta.pages}</span>
                <button type="button" className="btn-secondary !px-2.5 !py-1.5" onClick={() => setTicketPage((p) => p + 1)} disabled={ticketPage >= ticketMeta.pages || loading} aria-label="Next"><ChevronRight size={14} /></button>
              </div>
            </div>
          )}
        </section>
      </div>

      <Modal
        open={!!selectedTicket}
        onClose={() => !replySending && !statusSaving && setSelectedTicket(null)}
        title={selectedTicket?.ticketRef || 'Ticket'}
        description={selectedTicket?.subject || 'Support conversation'}
        icon={MessageCircle}
        size="lg"
      >
        {ticketLoading ? (
          <div className="space-y-3">
            <div className="h-8 skeleton-ats rounded-xl" />
            <div className="h-24 skeleton-ats rounded-xl" />
          </div>
        ) : selectedTicket ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-3">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.1em] font-bold text-stone-400">Freelancer</p>
                <p className="text-sm font-semibold text-stone-800 mt-1 truncate">
                  {selectedTicket.userName || selectedTicket.userEmail || 'Freelancer'}
                </p>
                {selectedTicket.userEmail ? (
                  <p className="text-[11px] text-stone-500 truncate">{selectedTicket.userEmail}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {Object.keys(STATUS).map((key) => (
                  <button
                    key={key}
                    type="button"
                    disabled={statusSaving}
                    onClick={() => changeStatus(key)}
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                      selectedTicket.status === key
                        ? 'border-brand-300 bg-brand-50 text-brand-800'
                        : 'border-stone-200 bg-white text-stone-600 hover:border-brand-200'
                    }`}
                  >
                    {STATUS[key].label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 max-h-[min(38vh,24rem)] overflow-y-auto pr-1">
              <div className="rounded-2xl border border-stone-200 bg-white p-3.5">
                <div className="flex items-center justify-between gap-3 text-[11px] text-stone-500">
                  <span className="font-semibold text-stone-700">Original request · {TYPES[selectedTicket.category] || selectedTicket.category}</span>
                  <span>{relativeTime(selectedTicket.createdAt)}</span>
                </div>
                <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap mt-2">{selectedTicket.message}</p>
              </div>
              {(selectedTicket.replies || []).map((reply, index) => (
                <div
                  key={`${reply.createdAt || 'reply'}-${index}`}
                  className={`rounded-2xl border p-3.5 ${reply.authorType === 'support' ? 'border-brand-100 bg-brand-50/60' : 'border-stone-200 bg-white'}`}
                >
                  <div className="flex items-center justify-between gap-3 text-[11px] text-stone-500">
                    <span className="font-semibold text-stone-700">
                      {reply.authorType === 'support'
                        ? (reply.authorName || 'Hiring team')
                        : (reply.authorName || 'Freelancer')}
                    </span>
                    <span>{relativeTime(reply.createdAt)}</span>
                  </div>
                  <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap mt-2">{reply.body}</p>
                </div>
              ))}
            </div>

            <form onSubmit={submitReply} className="border-t border-stone-100 pt-4 space-y-3">
              <label className="label-ats" htmlFor="desk-reply">Reply to freelancer</label>
              <textarea
                id="desk-reply"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={4}
                maxLength={4000}
                className="input-ats w-full resize-y"
                placeholder="Provide a clear, professional response. The freelancer receives this in-app and by email."
              />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="w-full sm:w-48">
                  <PremiumSelect
                    value={replyStatus}
                    onChange={setReplyStatus}
                    options={[
                      { value: 'open', label: 'Keep Open' },
                      { value: 'in_progress', label: 'In progress' },
                      { value: 'resolved', label: 'Resolved' },
                    ]}
                  />
                </div>
                <button type="submit" className="btn-primary" disabled={replySending || replyText.trim().length < 2}>
                  {replySending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {replySending ? 'Sending…' : 'Send reply & notify'}
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
