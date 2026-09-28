import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  RefreshCw, Inbox as InboxIcon
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
import { useAuth } from '../context/AuthContext';
import {
  INBOX_TOUR_KEY, INBOX_TOUR_STEPS, EMPTY_COMPOSE,
  countrySelectOptions, dialCodeForIso, snoozeUntil, fillInboxTemplate,
} from './inbox/inboxConstants';
import InboxThreadList from './inbox/InboxThreadList';
import InboxThreadDetail from './inbox/InboxThreadDetail';
import InboxComposeModal from './inbox/InboxComposeModal';
import InboxMailboxBar from './inbox/InboxMailboxBar';

const MAILBOX_ADMIN_ROLES = ['owner', 'admin', 'hr_manager'];

class InboxRenderBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="page-shell-ats p-6">
          <div className="card-ats-bordered px-5 py-6 max-w-lg">
            <p className="text-lg font-semibold text-stone-900">Inbox could not render</p>
            <p className="text-sm text-stone-500 mt-2 break-words">
              {String(this.state.error?.message || this.state.error)}
            </p>
            <button type="button" className="btn-primary mt-4" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function InboxPage() {
  return (
    <InboxRenderBoundary>
      <InboxPageInner />
    </InboxRenderBoundary>
  );
}

function InboxPageInner() {
  const { t } = useTranslation();
  const toast = useToast();
  const { user, organization } = useAuth();
  const navigate = useNavigate();
  const { threadId } = useParams();
  const countryCodes = useCountries();
  const [tourOpen, setTourOpen] = usePageTour(INBOX_TOUR_KEY);
  const [threads, setThreads] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [channel, setChannel] = useState('all');
  const canManageMailbox = MAILBOX_ADMIN_ROLES.includes(user?.role);
  const [assigned, setAssigned] = useState('me');
  const [folder, setFolder] = useState('inbox');
  const [mailbox, setMailbox] = useState(null);
  const [mailboxSaving, setMailboxSaving] = useState(false);
  const [mailboxSyncing, setMailboxSyncing] = useState(false);
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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [assignees, setAssignees] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [replyFiles, setReplyFiles] = useState([]);
  const [composeFiles, setComposeFiles] = useState([]);
  const [savingDraft, setSavingDraft] = useState(false);

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
      if (canManageMailbox && assigned === 'all') params.set('assigned', 'all');
      else params.set('assigned', 'me');
      if (folder === 'archived') params.set('archived', 'true');
      if (folder === 'starred') params.set('starred', 'true');
      if (folder === 'unread') params.set('unread', 'true');
      if (folder === 'snoozed') params.set('snoozed', 'true');
      if (folder === 'drafts') params.set('drafts', 'true');
      const statsParams = new URLSearchParams();
      if (canManageMailbox && assigned === 'all') statsParams.set('assigned', 'all');
      else statsParams.set('assigned', 'me');
      const [tRes, sRes, mRes] = await Promise.all([
        authenticatedFetch(`/api/inbox/threads?${params}`),
        authenticatedFetch(`/api/inbox/stats?${statsParams}`),
        authenticatedFetch('/api/inbox/mailbox'),
      ]);
      const tData = await readApiJson(tRes);
      const sData = await readApiJson(sRes);
      const mData = await readApiJson(mRes);
      if (!tData.success) throw new Error(tData.message);
      setThreads(Array.isArray(tData.data) ? tData.data : []);
      if (sData.success) setStats(sData.data);
      if (mData.success) setMailbox(mData.data);
    } catch (err) {
      toast.error(err.message || 'Failed to load inbox');
    } finally {
      setLoading(false);
    }
  }, [q, channel, assigned, folder, toast, canManageMailbox]);

  useEffect(() => {
    if (!canManageMailbox) setAssigned('me');
  }, [canManageMailbox]);

  useEffect(() => {
    const t = setTimeout(loadThreads, 200);
    return () => clearTimeout(t);
  }, [loadThreads]);

  useEffect(() => {
    const tick = async () => {
      try {
        const statsParams = new URLSearchParams();
        if (canManageMailbox && assigned === 'all') statsParams.set('assigned', 'all');
        else statsParams.set('assigned', 'me');
        const sRes = await authenticatedFetch(`/api/inbox/stats?${statsParams}`);
        const sData = await readApiJson(sRes);
        if (sData.success) setStats(sData.data);
      } catch {
        /* keep last counts */
      }
    };
    const id = setInterval(tick, 10000);
    const onChange = () => { tick(); loadThreads(); };
    window.addEventListener('inbox:changed', onChange);
    return () => {
      clearInterval(id);
      window.removeEventListener('inbox:changed', onChange);
    };
  }, [assigned, canManageMailbox, loadThreads]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [aRes, tRes] = await Promise.all([
          authenticatedFetch('/api/inbox/assignees'),
          authenticatedFetch('/api/email-templates'),
        ]);
        const aData = await readApiJson(aRes);
        const tData = await readApiJson(tRes);
        if (cancelled) return;
        if (aData.success) setAssignees(Array.isArray(aData.data) ? aData.data : []);
        if (tData.success) setTemplates(Array.isArray(tData.templates) ? tData.templates : []);
      } catch {
        /* ignore */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadDetail = useCallback(async (id) => {
    setSelectedId(id);
    setDetailLoading(true);
    try {
      const res = await authenticatedFetch(`/api/inbox/threads/${id}`);
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      setDetail(data.data);
      const ch = data.data?.thread?.channel;
      setReplyChannel(ch === 'mixed' || !ch ? 'email' : ch);
      setReply('');
      setReplyFiles([]);
      setSelectedTemplateId('');
      await authenticatedFetch(`/api/inbox/threads/${id}/read`, { method: 'PATCH' });
      setThreads((prev) => prev.map((t) => (t._id === id ? { ...t, unreadCount: 0 } : t)));
      window.dispatchEvent(new Event('inbox:changed'));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDetailLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!threadId) {
      setSelectedId(null);
      setDetail(null);
      return;
    }
    loadDetail(threadId);
  }, [threadId, loadDetail]);

  const openThread = (id) => navigate(`/inbox/${id}`);
  const goList = () => navigate('/inbox');

  const openCompose = () => {
    setCompose({ ...EMPTY_COMPOSE });
    setComposeFiles([]);
    setComposeOpen(true);
  };

  const openDraft = (t) => {
    setCompose({
      ...EMPTY_COMPOSE,
      mode: 'custom',
      channel: t.channel === 'sms' || t.channel === 'whatsapp' ? t.channel : 'email',
      toAddress: t.draftTo || t.participants?.candidateEmail || '',
      subject: t.subject === '(draft)' ? '' : (t.subject || ''),
      body: t.draftBody || '',
      draftId: t._id,
    });
    setComposeFiles([]);
    setComposeOpen(true);
  };

  useEffect(() => {
    const email = String(compose.toAddress || '').trim().toLowerCase();
    if (!composeOpen || compose.channel !== 'email' || !email.includes('@')) return undefined;
    const t = setTimeout(async () => {
      try {
        const res = await authenticatedFetch(`/api/candidates?search=${encodeURIComponent(email)}&searchScope=email&limit=5`);
        const data = await readApiJson(res);
        const list = data.candidates || data.data || [];
        const hit = list.find((c) => String(c.email || '').trim().toLowerCase() === email) || list[0];
        if (!hit) {
          setCompose((prev) => ({ ...prev, matchedCandidate: null }));
          return;
        }
        const nextVars = {
          candidateName: hit.name || '',
          position: hit.position || '',
          jobTitle: hit.position || '',
          company: organization?.name || '',
          ctc: hit.ctc || hit.expectedCtc || '',
          experience: hit.experience || '',
          location: hit.location || hit.state || '',
          spoc: hit.spoc || user?.name || '',
        };
        setCompose((prev) => ({
          ...prev,
          matchedCandidate: hit,
          templateVars: { ...(prev.templateVars || {}), ...nextVars },
          templateDirty: prev.mode === 'template' ? false : prev.templateDirty,
        }));
      } catch {
        /* ignore lookup */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [compose.toAddress, composeOpen, compose.channel, organization?.name, user?.name]);

  const sendReply = async () => {
    if (!selectedId || !reply.trim()) return;
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('body', reply.trim());
      fd.append('channel', replyChannel);
      replyFiles.forEach((f) => fd.append('files', f));
      const res = await authenticatedFetch(`/api/inbox/threads/${selectedId}/reply`, {
        method: 'POST',
        body: fd,
      });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      toast.success('Message sent');
      setReply('');
      setReplyFiles([]);
      setSelectedTemplateId('');
      const nextId = data.data?.thread?._id || selectedId;
      if (String(nextId) === String(threadId)) await loadDetail(nextId);
      else openThread(nextId);
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
    if (compose.channel === 'email' && !compose.subject.trim()) {
      toast.error('To, subject, and message are required');
      return;
    }
    const toAddress = compose.channel === 'email'
      ? compose.toAddress.trim()
      : `${composeDial}${compose.phone.replace(/\D/g, '')}`;
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('channel', compose.channel);
      fd.append('toAddress', toAddress);
      fd.append('body', compose.body.trim());
      if (compose.channel === 'email') fd.append('subject', compose.subject.trim());
      if (compose.matchedCandidate?._id) fd.append('candidateId', compose.matchedCandidate._id);
      if (compose.draftId) fd.append('draftId', compose.draftId);
      composeFiles.forEach((f) => fd.append('files', f));
      const res = await authenticatedFetch('/api/inbox/threads', {
        method: 'POST',
        body: fd,
      });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      toast.success('Message sent');
      setComposeOpen(false);
      setCompose({ ...EMPTY_COMPOSE });
      setComposeFiles([]);
      loadThreads();
      if (data.data?.thread?._id) openThread(data.data.thread._id);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  const saveComposeDraft = async () => {
    const toAddress = compose.channel === 'email'
      ? compose.toAddress.trim()
      : `${composeDial}${compose.phone.replace(/\D/g, '')}`;
    if (!toAddress && !compose.subject.trim() && !compose.body.trim()) {
      toast.error('Write something before saving a draft');
      return;
    }
    setSavingDraft(true);
    try {
      const res = await authenticatedFetch('/api/inbox/threads/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: compose.channel,
          toAddress,
          subject: compose.subject,
          body: compose.body,
          draftId: compose.draftId || undefined,
          candidateName: compose.matchedCandidate?.name || '',
        }),
      });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      toast.success('Draft saved');
      setComposeOpen(false);
      setCompose({ ...EMPTY_COMPOSE });
      setComposeFiles([]);
      setFolder('drafts');
      loadThreads();
    } catch (err) {
      toast.error(err.message || 'Could not save draft');
    } finally {
      setSavingDraft(false);
    }
  };

  const saveMailbox = async (form) => {
    setMailboxSaving(true);
    try {
      const res = await authenticatedFetch('/api/inbox/mailbox', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      setMailbox(data.data);
      toast.success('Shared mailbox saved. Syncing…');
      await syncMailbox();
    } catch (err) {
      toast.error(err.message || 'Could not save mailbox');
    } finally {
      setMailboxSaving(false);
    }
  };

  const syncMailbox = async () => {
    setMailboxSyncing(true);
    try {
      const res = await authenticatedFetch('/api/inbox/mailbox/sync', { method: 'POST' });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      const ingested = data.data?.ingested || 0;
      const split = data.data?.split || 0;
      toast.success(
        split
          ? `Synced ${ingested} new message${ingested === 1 ? '' : 's'} · split ${split} mixed conversation${split === 1 ? '' : 's'}`
          : `Synced ${ingested} new message${ingested === 1 ? '' : 's'}`
      );
      loadThreads();
    } catch (err) {
      toast.error(err.message || 'Mailbox sync failed');
    } finally {
      setMailboxSyncing(false);
    }
  };

  const patchThread = async (id, body, okMessage) => {
    const res = await authenticatedFetch(`/api/inbox/threads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await readApiJson(res);
    if (!data.success) throw new Error(data.message);
    if (okMessage) toast.success(okMessage);
    window.dispatchEvent(new Event('inbox:changed'));
    return data.data;
  };

  const confirmArchive = async () => {
    if (!selectedId) return;
    setArchiving(true);
    try {
      await patchThread(selectedId, { archived: true }, 'Conversation archived');
      setArchiveOpen(false);
      goList();
      loadThreads();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setArchiving(false);
    }
  };

  const confirmDelete = async () => {
    if (!selectedId) return;
    setDeleting(true);
    try {
      const res = await authenticatedFetch(`/api/inbox/threads/${selectedId}`, { method: 'DELETE' });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      toast.success('Conversation deleted');
      setDeleteOpen(false);
      window.dispatchEvent(new Event('inbox:changed'));
      goList();
      loadThreads();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const toggleStar = async () => {
    if (!selectedId || !detail?.thread) return;
    try {
      const next = !detail.thread.starred;
      const updated = await patchThread(selectedId, { starred: next }, next ? 'Starred' : 'Star removed');
      setDetail((d) => (d ? { ...d, thread: { ...d.thread, ...updated } } : d));
      loadThreads();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const markUnread = async () => {
    if (!selectedId) return;
    try {
      await patchThread(selectedId, { unread: true }, 'Marked unread');
      goList();
      loadThreads();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const restoreThread = async () => {
    if (!selectedId) return;
    try {
      await patchThread(selectedId, { archived: false }, 'Restored to inbox');
      goList();
      loadThreads();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const assignThread = async (userId) => {
    if (!selectedId) return;
    try {
      const updated = await patchThread(selectedId, { assignedTo: userId }, 'Conversation reassigned');
      setDetail((d) => (d ? { ...d, thread: { ...d.thread, ...updated } } : d));
      loadThreads();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const snoozeThread = async (preset) => {
    if (!selectedId) return;
    try {
      await patchThread(selectedId, { snoozedUntil: snoozeUntil(preset).toISOString() }, 'Snoozed');
      goList();
      loadThreads();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const unsnoozeThread = async () => {
    if (!selectedId) return;
    try {
      const updated = await patchThread(selectedId, { snoozedUntil: null }, 'Back in inbox');
      setDetail((d) => (d ? { ...d, thread: { ...d.thread, ...updated } } : d));
      loadThreads();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const applyTemplate = (id) => {
    const tpl = templates.find((t) => String(t._id) === String(id));
    if (!tpl) return;
    const vars = {
      candidateName: detail?.thread?.participants?.candidateName || 'there',
      company: organization?.name || '',
      position: '',
    };
    setReply(fillInboxTemplate(tpl.body || '', vars));
    if (tpl.subject && replyChannel === 'email') {
      /* subject stays on thread */
    }
  };

  const threadTitle = detail?.thread?.subject
    || detail?.thread?.participants?.candidateName
    || 'Conversation';

  const listMeta = useMemo(() => {
    if (loading) return 'Loading…';
    const n = threads.length;
    const folders = stats?.folders || {};
    const unread = folders.unread ?? stats?.unreadCount;
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
        {threadId ? (
          <InboxThreadDetail
            selectedId={selectedId}
            detailLoading={detailLoading}
            detail={detail}
            threadTitle={threadTitle}
            reply={reply}
            setReply={setReply}
            replyChannel={replyChannel}
            setReplyChannel={setReplyChannel}
            sending={sending}
            onBack={goList}
            onArchive={() => setArchiveOpen(true)}
            onRestore={restoreThread}
            onStar={toggleStar}
            onUnread={markUnread}
            onDelete={() => setDeleteOpen(true)}
            onSendReply={sendReply}
            templates={templates}
            selectedTemplateId={selectedTemplateId}
            setSelectedTemplateId={setSelectedTemplateId}
            assignees={assignees}
            replyFiles={replyFiles}
            setReplyFiles={setReplyFiles}
            onApplyTemplate={applyTemplate}
            onAssign={assignThread}
            onSnooze={snoozeThread}
            onUnsnooze={unsnoozeThread}
          />
        ) : (
          <>
            <PageHeader
              icon={InboxIcon}
              title={t('pages.inbox.title')}
              subtitle="Mail list. Open a conversation to read it full screen."
              gradientTitle
            >
              <button type="button" onClick={loadThreads} className="btn-secondary w-full sm:w-auto" disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </PageHeader>
            {canManageMailbox ? (
              <InboxMailboxBar
                mailbox={mailbox}
                canEdit
                saving={mailboxSaving}
                syncing={mailboxSyncing}
                onSave={saveMailbox}
                onSync={syncMailbox}
              />
            ) : null}
            <InboxThreadList
              listMeta={listMeta}
              q={q}
              setQ={setQ}
              channel={channel}
              setChannel={setChannel}
              folder={folder}
              setFolder={setFolder}
              assigned={assigned}
              setAssigned={setAssigned}
              assignedLocked={!canManageMailbox}
              loading={loading}
              threads={threads}
              selectedId={selectedId}
              onOpenThread={(t) => (t.isDraft ? openDraft(t) : openThread(t._id))}
              onCompose={openCompose}
              folderCounts={stats?.folders || {}}
            />
          </>
        )}

        <InboxComposeModal
          open={composeOpen}
          sending={sending}
          savingDraft={savingDraft}
          compose={compose}
          setCompose={setCompose}
          composeDial={composeDial}
          composeRecipientReady={composeRecipientReady}
          countryOptions={countryOptions}
          composeFiles={composeFiles}
          setComposeFiles={setComposeFiles}
          templates={templates}
          organizationName={organization?.name || ''}
          senderName={user?.name || ''}
          onClose={() => { setComposeOpen(false); setComposeFiles([]); }}
          onSubmit={sendCompose}
          onSaveDraft={saveComposeDraft}
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

        <ConfirmationModal
          isOpen={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          onConfirm={confirmDelete}
          title="Delete conversation?"
          message="This permanently deletes the thread and its messages. This cannot be undone."
          confirmText="Delete"
          type="danger"
          isLoading={deleting}
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
