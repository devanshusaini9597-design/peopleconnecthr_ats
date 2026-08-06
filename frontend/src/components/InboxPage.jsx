import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  RefreshCw, Send, Inbox as InboxIcon
} from 'lucide-react';
import { authenticatedFetch, readApiJson } from '../utils/fetchUtils';
import useCountries from '../utils/useCountries';
import { useToast } from './Toast';
import PageHeader from './ui/PageHeader';
import FeatureGate from './FeatureGate';
import UpgradeFeatureFallback from './ui/UpgradeFeatureFallback';
import ConfirmationModal from './ConfirmationModal';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';
import {
  INBOX_TOUR_KEY, INBOX_TOUR_STEPS, EMPTY_COMPOSE,
  countrySelectOptions, dialCodeForIso,
} from './inbox/inboxConstants';
import InboxThreadList from './inbox/InboxThreadList';
import InboxThreadDetail from './inbox/InboxThreadDetail';
import InboxComposeModal from './inbox/InboxComposeModal';

export default function InboxPage() {
  const toast = useToast();
  const countryCodes = useCountries();
  const [tourOpen, setTourOpen] = usePageTour(INBOX_TOUR_KEY);
  const [threads, setThreads] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [channel, setChannel] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [replyChannel, setReplyChannel] = useState('email');
  const [sending, setSending] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [compose, setCompose] = useState(EMPTY_COMPOSE);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const countryOptions = useMemo(
    () => countrySelectOptions(countryCodes),
    [countryCodes]
  );

  const composeDial = useMemo(
    () => dialCodeForIso(countryCodes, compose.countryIso),
    [countryCodes, compose.countryIso]
  );

  const composeRecipientReady = compose.channel === 'email'
    ? !!compose.toAddress.trim()
    : !!compose.phone.trim();

  const loadThreads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (channel !== 'all') params.set('channel', channel);
      const [tRes, sRes] = await Promise.all([
        authenticatedFetch(`/api/inbox/threads?${params}`),
        authenticatedFetch('/api/inbox/stats')
      ]);
      const tData = await readApiJson(tRes);
      const sData = await readApiJson(sRes);
      if (!tData.success) throw new Error(tData.message);
      setThreads(tData.data || []);
      if (sData.success) setStats(sData.data);
    } catch (err) {
      toast.error(err.message || 'Failed to load inbox');
    } finally {
      setLoading(false);
    }
  }, [q, channel, toast]);

  useEffect(() => {
    const t = setTimeout(loadThreads, 200);
    return () => clearTimeout(t);
  }, [loadThreads]);

  const openThread = async (id) => {
    setSelectedId(id);
    setDetailLoading(true);
    try {
      const res = await authenticatedFetch(`/api/inbox/threads/${id}`);
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      setDetail(data.data);
      const ch = data.data?.thread?.channel;
      setReplyChannel(ch === 'mixed' || !ch ? 'email' : ch);
      await authenticatedFetch(`/api/inbox/threads/${id}/read`, { method: 'PATCH' });
      setThreads((prev) => prev.map((t) => (t._id === id ? { ...t, unreadCount: 0 } : t)));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const sendReply = async () => {
    if (!selectedId || !reply.trim()) return;
    setSending(true);
    try {
      const res = await authenticatedFetch(`/api/inbox/threads/${selectedId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: reply.trim(), channel: replyChannel })
      });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      toast.success('Message sent');
      setReply('');
      openThread(selectedId);
      loadThreads();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  const sendCompose = async (e) => {
    e.preventDefault();
    if (!compose.body.trim() || !composeRecipientReady) return;
    const toAddress = compose.channel === 'email'
      ? compose.toAddress.trim()
      : `${composeDial}${compose.phone.replace(/\D/g, '')}`;
    setSending(true);
    try {
      const res = await authenticatedFetch('/api/inbox/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: compose.channel,
          toAddress,
          subject: compose.channel === 'email' ? compose.subject : '',
          body: compose.body.trim(),
        })
      });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      toast.success('Message sent');
      setComposeOpen(false);
      setCompose(EMPTY_COMPOSE);
      loadThreads();
      if (data.data?.thread?._id) openThread(data.data.thread._id);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  const confirmArchive = async () => {
    if (!selectedId) return;
    setArchiving(true);
    try {
      const res = await authenticatedFetch(`/api/inbox/threads/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: true })
      });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      toast.success('Conversation archived');
      setArchiveOpen(false);
      setSelectedId(null);
      setDetail(null);
      loadThreads();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setArchiving(false);
    }
  };

  const showDetailPane = !!selectedId;
  const threadTitle = detail?.thread?.subject
    || detail?.thread?.participants?.candidateName
    || 'Conversation';

  const listMeta = useMemo(() => {
    if (loading) return 'Loading…';
    const n = threads.length;
    const unread = stats?.unreadCount;
    const parts = [`${n} conversation${n === 1 ? '' : 's'}`];
    if (typeof unread === 'number' && unread > 0) parts.push(`${unread} unread`);
    return parts.join(' · ');
  }, [loading, threads.length, stats]);

  return (
    <FeatureGate
      feature="messaging.inbox"
      fallback={
        <UpgradeFeatureFallback
          title="Inbox is a Professional feature"
          description="Upgrade to get a unified email, SMS, and WhatsApp inbox for candidate conversations."
        />
      }
    >
      <div className="page-shell-ats animate-page-enter">
        <PageHeader
          icon={InboxIcon}
          title="Inbox"
          subtitle="Unified candidate conversations across email, SMS, and WhatsApp."
          gradientTitle
        >
          <button type="button" onClick={loadThreads} className="btn-secondary w-full sm:w-auto" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            data-tour="inbox-compose"
            type="button"
            onClick={() => setComposeOpen(true)}
            className="btn-primary w-full sm:w-auto"
          >
            <Send className="w-4 h-4" />
            New message
          </button>
        </PageHeader>

        <div className="rounded-xl border border-brand-200/60 bg-gradient-to-r from-brand-50/70 via-white to-teal-50/40 px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed">
          Reply from one workspace across channels. Respect messaging consent for SMS and WhatsApp.
          Press <span className="font-semibold text-stone-800">?</span> bottom-right for a tour.
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch min-h-[32rem]">
          <InboxThreadList
            showDetailPane={showDetailPane}
            listMeta={listMeta}
            q={q}
            setQ={setQ}
            channel={channel}
            setChannel={setChannel}
            loading={loading}
            threads={threads}
            selectedId={selectedId}
            onOpenThread={openThread}
            onCompose={() => setComposeOpen(true)}
          />
          <InboxThreadDetail
            showDetailPane={showDetailPane}
            selectedId={selectedId}
            detailLoading={detailLoading}
            detail={detail}
            threadTitle={threadTitle}
            reply={reply}
            setReply={setReply}
            replyChannel={replyChannel}
            setReplyChannel={setReplyChannel}
            sending={sending}
            onBack={() => { setSelectedId(null); setDetail(null); }}
            onArchive={() => setArchiveOpen(true)}
            onSendReply={sendReply}
          />
        </div>

        <InboxComposeModal
          open={composeOpen}
          sending={sending}
          compose={compose}
          setCompose={setCompose}
          composeDial={composeDial}
          composeRecipientReady={composeRecipientReady}
          countryOptions={countryOptions}
          onClose={() => setComposeOpen(false)}
          onSubmit={sendCompose}
        />

        <ConfirmationModal
          isOpen={archiveOpen}
          onClose={() => setArchiveOpen(false)}
          onConfirm={confirmArchive}
          title="Archive conversation?"
          message="This thread will be archived and removed from your active inbox. You can still find it later if your plan supports archived views."
          confirmText="Archive"
          type="warning"
          isLoading={archiving}
        />

        <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of Inbox" />
        <ProductTour
          open={tourOpen}
          onClose={() => setTourOpen(false)}
          steps={INBOX_TOUR_STEPS}
          storageKey={INBOX_TOUR_KEY}
        />
      </div>
    </FeatureGate>
  );
}
