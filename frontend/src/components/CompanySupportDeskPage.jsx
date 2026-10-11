import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LifeBuoy, RefreshCw } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import { useAuth } from '../context/AuthContext';
import { COMPANY_ROLES } from './support/supportConstants';
import SupportThreadList from './support/SupportThreadList';
import SupportThreadDetail from './support/SupportThreadDetail';

export default function CompanySupportDeskPage() {
  const toast = useToast();
  const { user } = useAuth();
  const allowed = user?.role === 'owner'
    || COMPANY_ROLES.includes(user?.role)
    || (Array.isArray(user?.permissions) && user.permissions.includes('modules.applications'));

  const [tickets, setTickets] = useState([]);
  const [folders, setFolders] = useState({});
  const [loading, setLoading] = useState(true);
  const [folder, setFolder] = useState('inbox');
  const [query, setQuery] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyStatus, setReplyStatus] = useState('in_progress');
  const [replySending, setReplySending] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({ folder, page: '1', limit: '50' });
      if (debouncedQ.trim()) params.set('q', debouncedQ.trim());
      const res = await authenticatedFetch(`/api/support/org/tickets?${params}`);
      if (isUnauthorized(res)) return handleUnauthorized();
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not load tickets');
      setTickets(Array.isArray(data.data?.items) ? data.data.items : []);
      setFolders(data.data?.folders || {});
    } catch (err) {
      if (!silent) toast.error(err.message || 'Could not load support desk');
    } finally {
      setLoading(false);
    }
  }, [folder, debouncedQ, toast]);

  useEffect(() => {
    if (!allowed) return undefined;
    load();
    const id = setInterval(() => load(true), 20000);
    return () => clearInterval(id);
  }, [allowed, load]);

  const openTicket = async (row) => {
    setSelectedId(row._id);
    setReplyText('');
    setReplyStatus(row.status === 'resolved' ? 'resolved' : 'in_progress');
    setDetailLoading(true);
    try {
      const res = await authenticatedFetch(`/api/support/org/tickets/${row._id}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Could not load ticket');
      setDetail(data.data);
      setReplyStatus(data.data?.status === 'resolved' ? 'resolved' : 'in_progress');
      setTickets((prev) => prev.map((item) => (
        String(item._id) === String(row._id) ? { ...item, unread: false } : item
      )));
      window.dispatchEvent(new Event('support:changed'));
    } catch (err) {
      toast.error(err.message || 'Could not load ticket');
    } finally {
      setDetailLoading(false);
    }
  };

  const patchTicket = async (body, okMessage) => {
    if (!selectedId) return;
    const res = await authenticatedFetch(`/api/support/org/tickets/${selectedId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Could not update ticket');
    if (okMessage) toast.success(okMessage);
    setDetail(data.data);
    window.dispatchEvent(new Event('support:changed'));
    load(true);
    return data.data;
  };

  const submitReply = async (e) => {
    e.preventDefault();
    if (replyText.trim().length < 2 || !selectedId) return;
    setReplySending(true);
    try {
      const res = await authenticatedFetch(`/api/support/org/tickets/${selectedId}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyText, status: replyStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Could not send reply');
      setDetail(data.data);
      setReplyText('');
      load(true);
      toast.success('Reply sent');
      window.dispatchEvent(new Event('support:changed'));
    } catch (err) {
      toast.error(err.message || 'Could not send reply');
    } finally {
      setReplySending(false);
    }
  };

  const changeStatus = async (status) => {
    if (!selectedId || detail?.status === status) return;
    setStatusSaving(true);
    try {
      const res = await authenticatedFetch(`/api/support/org/tickets/${selectedId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Could not update status');
      setDetail(data.data);
      setReplyStatus(status === 'resolved' ? 'resolved' : 'in_progress');
      load(true);
      toast.success(`Marked ${status.replace('_', ' ')}`);
    } catch (err) {
      toast.error(err.message || 'Could not update status');
    } finally {
      setStatusSaving(false);
    }
  };

  const listMeta = useMemo(() => {
    if (loading) return 'Loading…';
    const n = tickets.length;
    const unread = folders.unread || 0;
    const parts = [`${n} conversation${n === 1 ? '' : 's'}`];
    if (unread > 0) parts.push(`${unread} unread`);
    return parts.join(' · ');
  }, [loading, tickets.length, folders.unread]);

  if (!allowed) {
    return (
      <div className="page-shell-ats animate-page-enter">
        <EmptyState
          icon={LifeBuoy}
          tone="brand"
          message="Support desk unavailable"
          subMessage="Hiring-team access is required to manage freelancer support mail."
        />
      </div>
    );
  }

  const showDetail = Boolean(selectedId);

  return (
    <div className="page-shell-ats animate-page-enter min-w-0">
      <PageHeader
        icon={LifeBuoy}
        title="Freelancer support"
        subtitle="Gmail-style desk for freelancer guidance, issues, and product feedback. Replies go in-app and by email."
        gradientTitle
      >
        <button type="button" className="btn-secondary w-full sm:w-auto" onClick={() => load()} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-w-0 items-stretch">
        <section className={`lg:col-span-5 xl:col-span-5 min-w-0 ${showDetail ? 'hidden lg:flex' : 'flex'} flex-col`}>
          <SupportThreadList
            listMeta={listMeta}
            q={query}
            setQ={setQuery}
            folder={folder}
            setFolder={(next) => { setFolder(next); setSelectedId(null); setDetail(null); }}
            folderCounts={folders}
            loading={loading}
            tickets={tickets}
            selectedId={selectedId}
            onOpen={openTicket}
          />
        </section>
        <section className={`lg:col-span-7 xl:col-span-7 min-w-0 ${showDetail ? 'flex' : 'hidden lg:flex'} flex-col`}>
          {showDetail ? (
            <SupportThreadDetail
              ticket={detail}
              loading={detailLoading}
              replyText={replyText}
              setReplyText={setReplyText}
              replyStatus={replyStatus}
              setReplyStatus={setReplyStatus}
              replySending={replySending}
              statusSaving={statusSaving}
              onBack={() => { setSelectedId(null); setDetail(null); }}
              onStar={() => patchTicket({ starred: !detail?.starred }, detail?.starred ? 'Star removed' : 'Starred')}
              onUnread={async () => {
                await patchTicket({ unread: true }, 'Marked unread');
                setSelectedId(null);
                setDetail(null);
              }}
              onStatus={changeStatus}
              onSend={submitReply}
            />
          ) : (
            <div className="card-ats-bordered min-h-[32rem] hidden lg:flex items-center justify-center">
              <EmptyState
                compact
                icon={LifeBuoy}
                tone="brand"
                message="Select a conversation"
                subMessage="Open a thread from the list to read and reply, the same way Inbox works."
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
