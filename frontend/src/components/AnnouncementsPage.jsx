import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Megaphone, Plus, RefreshCw, Filter, Search, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authenticatedFetch, readApiJson } from '../utils/fetchUtils';
import { canViewOrgAnalytics } from '../utils/analyticsScope';
import { useToast } from './Toast';
import PageHeader from './ui/PageHeader';
import FeatureGate from './FeatureGate';
import UpgradeFeatureFallback from './ui/UpgradeFeatureFallback';
import ConfirmationModal from './ConfirmationModal';
import Modal from './ui/Modal';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';
import {
  ANN_TOUR_KEY,
  ANN_TOUR_STEPS,
  FILTERS,
  EMPTY_FORM,
  BODY_MAX,
  TITLE_MAX,
  plainText,
  toLocalInput,
  formatWhen,
} from './announcements/announcementsConstants';
import AnnouncementFormModal from './announcements/AnnouncementFormModal';
import AnnouncementFeed from './announcements/AnnouncementFeed';
import AnnouncementInbox from './announcements/AnnouncementInbox';

const OPEN_ROLES = ['owner', 'admin', 'hr_manager', 'hr_recruiter', 'recruiter', 'sales', 'freelancer'];

function canOpenAnnouncements(user) {
  if (!user) return false;
  if (user.role === 'owner' || user.role === 'freelancer') return true;
  if (Array.isArray(user.permissions)) return user.permissions.includes('modules.announcements');
  return OPEN_ROLES.includes(user.role);
}

function formFromRow(row) {
  return {
    ...EMPTY_FORM,
    title: row.title || '',
    body: row.body || '',
    severity: row.severity || 'info',
    audience: row.audience || 'all',
    requiresAck: Boolean(row.requiresAck),
    pinned: Boolean(row.pinned),
    startsAt: toLocalInput(row.startsAt),
    endsAt: toLocalInput(row.endsAt),
    departments: row.targets?.departments || [],
    locations: row.targets?.locations || [],
    offices: row.targets?.offices || [],
    teams: row.targets?.teamManagerIds || [],
    status: row.status || 'published',
    notifyAgain: true,
  };
}

function payloadFromForm(form, kind) {
  return {
    title: form.title.trim(),
    body: form.body,
    severity: form.severity,
    audience: form.audience || 'all',
    notifyEmail: form.audience === 'public' || form.audience === 'freelancers' ? false : form.notifyEmail !== false,
    notifyAgain: form.notifyAgain === true,
    requiresAck: Boolean(form.requiresAck),
    pinned: Boolean(form.pinned),
    startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
    endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
    departments: form.departments || [],
    locations: form.locations || [],
    offices: form.offices || [],
    teams: form.teams || [],
    status: kind === 'draft' ? 'draft' : kind === 'publish' ? 'published' : (form.status || 'published'),
  };
}

export default function AnnouncementsPage() {
  return <AnnouncementsPageInner />;
}

function AnnouncementsPageInner() {
  const { t } = useTranslation();
  const toast = useToast();
  const { organization, user } = useAuth();
  const careersSlug = organization?.slug;
  const canManage = canViewOrgAnalytics(user?.role);
  const allowed = canOpenAnnouncements(user);
  const [tourOpen, setTourOpen] = usePageTour(ANN_TOUR_KEY);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [serverCounts, setServerCounts] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [composeOpen, setComposeOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [existingFiles, setExistingFiles] = useState([]);
  const [files, setFiles] = useState([]);
  const [targets, setTargets] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [filter, setFilter] = useState('active');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [inboxView, setInboxView] = useState('all');
  const [markingAll, setMarkingAll] = useState(false);
  const [delivery, setDelivery] = useState(null);
  const [receipts, setReceipts] = useState(null);
  const [receiptsLoading, setReceiptsLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(timer);
  }, [q]);

  const notifyLiveBanner = () => {
    window.dispatchEvent(new Event('announcements:refresh'));
    window.dispatchEvent(new Event('announcements:changed'));
  };

  const load = useCallback(async ({ append = false, pageArg = 1 } = {}) => {
    if (!append) setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pageArg), limit: '25' });
      if (debouncedQ) params.set('q', debouncedQ);
      const path = canManage
        ? `/api/announcements/all?${params}&filter=${encodeURIComponent(filter)}`
        : `/api/announcements/inbox?${params}&view=${encodeURIComponent(inboxView)}`;
      const res = await authenticatedFetch(path);
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      const next = data.data || [];
      setRows((prev) => (append ? [...prev, ...next] : next));
      setTotal(data.total || next.length);
      setPage(data.page || pageArg);
      if (data.counts) setServerCounts(data.counts);
    } catch (e) {
      toast.error(e.message || 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  }, [toast, canManage, filter, debouncedQ, inboxView]);

  useEffect(() => { load({ pageArg: 1 }); }, [load]);

  useEffect(() => {
    if (!canManage) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await authenticatedFetch('/api/announcements/targets');
        const data = await readApiJson(res);
        if (!cancelled && data.success) setTargets(data.data);
      } catch {
        /* targeting list is optional */
      }
    })();
    return () => { cancelled = true; };
  }, [canManage]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authenticatedFetch('/api/announcements/mark-seen', { method: 'POST' });
        if (!cancelled && res.ok) window.dispatchEvent(new Event('announcements:changed'));
      } catch {
        /* ignore */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const closeEditor = () => {
    if (saving) return;
    setComposeOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFiles([]);
    setExistingFiles([]);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFiles([]);
    setExistingFiles([]);
    setComposeOpen(true);
  };

  const startEdit = (row) => {
    setComposeOpen(false);
    setEditingId(row._id);
    setForm(formFromRow(row));
    setExistingFiles(row.attachments || []);
    setFiles([]);
  };

  const uploadFiles = async (id) => {
    if (!files.length) return;
    const body = new FormData();
    files.forEach((file) => body.append('files', file));
    const res = await authenticatedFetch(`/api/announcements/${id}/attachments`, { method: 'POST', body });
    const data = await readApiJson(res);
    if (!data.success) throw new Error(data.message || 'Attachment upload failed');
  };

  const submitForm = async (kind) => {
    if (!form.title.trim() || !plainText(form.body)) {
      toast.error('Title and message are required');
      return;
    }
    if (form.title.trim().length > TITLE_MAX || plainText(form.body).length > BODY_MAX) {
      toast.error('Title or message is too long');
      return;
    }
    setSaving(true);
    try {
      const editing = Boolean(editingId);
      const res = await authenticatedFetch(editing ? `/api/announcements/${editingId}` : '/api/announcements', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadFromForm(form, kind)),
      });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      const id = data.data?._id || editingId;
      if (id) await uploadFiles(id);
      const quietEmail = form.notifyEmail === false || form.audience === 'public' || form.audience === 'freelancers';
      let message = 'Announcement updated';
      if (data.warning) message = data.warning;
      else if (kind === 'draft') message = 'Draft saved';
      else if (!editing || kind === 'publish') {
        message = quietEmail ? 'Announcement published' : 'Announcement published — emailing the team';
      } else if (form.notifyAgain) message = 'Announcement updated and sent again';
      toast.success(message);
      closeEditor();
      await load({ pageArg: 1 });
      notifyLiveBanner();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const removeExisting = async (file) => {
    if (!editingId) return;
    try {
      const res = await authenticatedFetch(`/api/announcements/${editingId}/attachments/${file._id}`, { method: 'DELETE' });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      setExistingFiles((prev) => prev.filter((item) => item._id !== file._id));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const confirmDeleteAction = async () => {
    if (!deleteTarget?.row) return;
    const hard = deleteTarget.mode === 'purge';
    setDeleting(true);
    try {
      const url = hard
        ? `/api/announcements/${deleteTarget.row._id}?hard=1`
        : `/api/announcements/${deleteTarget.row._id}`;
      const res = await authenticatedFetch(url, { method: 'DELETE' });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message || 'Failed to update announcement');
      toast.success(hard || data.deleted ? 'Announcement deleted' : 'Announcement deactivated');
      if (editingId === deleteTarget.row._id) closeEditor();
      setDeleteTarget(null);
      await load({ pageArg: 1 });
      notifyLiveBanner();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const reactivate = async (row) => {
    try {
      const res = await authenticatedFetch(`/api/announcements/${row._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true, notifyAgain: false }),
      });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      toast.success(data.warning || 'Announcement reactivated');
      await load({ pageArg: 1 });
      notifyLiveBanner();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const markLocal = (id, patch) => {
    setRows((prev) => prev.map((row) => (row._id === id ? { ...row, ...patch } : row)));
  };

  const dismissOne = async (row) => {
    try {
      const res = await authenticatedFetch(`/api/announcements/${row._id}/seen`, { method: 'POST' });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message || 'Failed to mark read');
      markLocal(row._id, { isRead: true, isDismissed: true });
      notifyLiveBanner();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openNotice = async (row) => {
    markLocal(row._id, { isRead: true });
    try {
      await authenticatedFetch(`/api/announcements/${row._id}/read`, { method: 'POST' });
    } catch {
      /* the board still shows the notice */
    }
  };

  const acknowledge = async (row) => {
    try {
      const res = await authenticatedFetch(`/api/announcements/${row._id}/ack`, { method: 'POST' });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message || 'Failed to acknowledge');
      markLocal(row._id, { isRead: true, isAcked: true, isDismissed: true });
      toast.success('Acknowledged');
      notifyLiveBanner();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      const res = await authenticatedFetch('/api/announcements/dismiss-all', { method: 'POST' });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message || 'Failed to mark all read');
      toast.success(data.skippedAck
        ? 'Marked read. Notices that require acknowledgment were left for you to confirm.'
        : 'All announcements marked as read');
      await load({ pageArg: 1 });
      notifyLiveBanner();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setMarkingAll(false);
    }
  };

  const openDelivery = async (row) => {
    setDelivery(row);
    setReceipts(null);
    setReceiptsLoading(true);
    try {
      const res = await authenticatedFetch(`/api/announcements/${row._id}/receipts`);
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      setReceipts(data.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setReceiptsLoading(false);
    }
  };

  const counts = serverCounts || { total: rows.length, active: rows.length, inactive: 0, draft: 0, scheduled: 0 };
  const showGuide = !loading && rows.length > 0 && rows.length < 4;
  const editorOpen = composeOpen || Boolean(editingId);

  const pageBody = !allowed ? (
    <div className="page-shell-ats">
      <PageHeader icon={Megaphone} title={t('pages.announcements.title')} subtitle="Company notices" />
      <div className="rounded-xl border border-stone-200 bg-white p-6 text-sm text-stone-600">
        Your role does not include Announcements. An owner can turn on the Announcements permission for you.
      </div>
    </div>
  ) : (
    <div className="page-shell-ats animate-page-enter">
      <PageHeader
        icon={Megaphone}
        title={t('pages.announcements.title')}
        subtitle={canManage
          ? 'Publish, schedule, and track notices for your hiring team or the public careers site.'
          : 'Company noticeboard. Opening this page clears the sidebar badge. A notice is read when you open it.'}
        gradientTitle
      >
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {canManage ? (
            <button type="button" data-tour="ann-new" onClick={openCreate} className="btn-primary w-full sm:w-auto">
              <Plus className="w-4 h-4" /> New notice
            </button>
          ) : null}
          <button type="button" onClick={() => load({ pageArg: 1 })} className="btn-secondary w-full sm:w-auto" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </PageHeader>

      {canManage ? (
        <div className="rounded-xl border border-brand-200/70 bg-brand-50/40 px-4 py-3 text-sm text-stone-700 leading-relaxed">
          Hiring team notices show under the header. Careers site notices show on public job pages
          {careersSlug ? (
            <>
              {' '}
              (
              <a href={`/careers/${careersSlug}`} target="_blank" rel="noreferrer" className="text-brand-700 font-semibold hover:underline">
                /careers/{careersSlug}
              </a>
              )
            </>
          ) : null}
          . Deactivate hides a notice for everyone. Delete is permanent.
        </div>
      ) : null}

      {canManage ? (
        <div data-tour="ann-toolbar" className="toolbar-ats flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative flex-1 min-w-0 max-w-full sm:max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
              <input
                type="search"
                className="input-ats !pl-10 !pr-9 w-full"
                placeholder="Search all notices…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              {q ? (
                <button type="button" onClick={() => setQ('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-stone-400" aria-label="Clear search">
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>
            <p className="text-[11px] text-stone-400 font-medium sm:text-right">
              {loading ? 'Loading…' : `${counts.active || 0} active · ${counts.total || 0} total`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 px-1">
              <Filter size={14} /> Status
            </div>
            {FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  filter === item.key
                    ? 'bg-brand-600 text-white border-brand-600 shadow-md shadow-brand-500/20'
                    : 'bg-white text-stone-600 border-stone-200 hover:border-brand-300'
                }`}
              >
                {item.label}
                <span className="ml-1 opacity-70">{item.key === 'all' ? (counts.total || 0) : (counts[item.key] || 0)}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {canManage ? (
        <AnnouncementFeed
          fullWidth
          loading={loading}
          rows={rows.length === 0 && (counts.total || 0) > 0 ? [null] : rows}
          filtered={rows}
          filter={filter}
          careersSlug={careersSlug}
          showGuide={showGuide}
          onClearFilters={() => { setQ(''); setFilter('all'); }}
          onEdit={startEdit}
          onDeactivate={(row) => setDeleteTarget({ row, mode: 'deactivate' })}
          onReactivate={reactivate}
          onPurge={(row) => setDeleteTarget({ row, mode: 'purge' })}
          onDelivery={openDelivery}
          footer={rows.length < total ? (
            <button type="button" className="btn-secondary w-full" onClick={() => load({ append: true, pageArg: page + 1 })}>
              Load more
            </button>
          ) : null}
        />
      ) : (
        <AnnouncementInbox
          loading={loading}
          rows={rows}
          onRefresh={() => load({ pageArg: 1 })}
          onMarkRead={dismissOne}
          onMarkAllRead={markAllRead}
          markingAll={markingAll}
          q={q}
          setQ={setQ}
          serverCounts={serverCounts}
          onOpen={openNotice}
          onAcknowledge={acknowledge}
          onViewChange={setInboxView}
        />
      )}

      {canManage ? (
        <>
          <AnnouncementFormModal
            open={editorOpen}
            mode={editingId ? 'edit' : 'create'}
            editorKey={editingId || 'create'}
            onClose={closeEditor}
            form={form}
            setForm={setForm}
            onSubmit={submitForm}
            saving={saving}
            targetOptions={targets}
            files={files}
            setFiles={setFiles}
            existingAttachments={existingFiles}
            onRemoveAttachment={removeExisting}
          />
          <ConfirmationModal
            isOpen={!!deleteTarget}
            onClose={() => setDeleteTarget(null)}
            onConfirm={confirmDeleteAction}
            title={deleteTarget?.mode === 'purge' ? 'Delete announcement permanently?' : 'Deactivate announcement?'}
            message={
              deleteTarget?.mode === 'purge'
                ? `Permanently delete “${deleteTarget?.row?.title || 'this announcement'}”? This cannot be undone.`
                : `Deactivate “${deleteTarget?.row?.title || 'this announcement'}”? It leaves banners and the noticeboard. You can reactivate it from Inactive.`
            }
            confirmText={deleteTarget?.mode === 'purge' ? 'Delete forever' : 'Deactivate'}
            type="delete"
            isLoading={deleting}
          />
          <Modal
            open={!!delivery}
            onClose={() => setDelivery(null)}
            title="Delivery"
            description={delivery?.title || ''}
            size="lg"
          >
            {receiptsLoading ? (
              <p className="text-sm text-stone-500">Loading receipts…</p>
            ) : receipts ? (
              <div className="space-y-4 text-sm">
                <p className="text-stone-600">
                  Email: <span className="font-semibold capitalize">{receipts.emailDelivery?.status || 'skipped'}</span>
                  {receipts.emailDelivery?.total
                    ? ` · ${receipts.emailDelivery.sent || 0} sent, ${receipts.emailDelivery.failed || 0} failed, of ${receipts.emailDelivery.total}`
                    : ''}
                </p>
                <ReceiptList title="Read" people={receipts.read} />
                <ReceiptList title="Acknowledged" people={receipts.acknowledged} />
                <ReceiptList title="Dismissed the banner" people={receipts.dismissed} />
              </div>
            ) : (
              <p className="text-sm text-stone-500">No delivery details.</p>
            )}
          </Modal>
          <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of Announcements" />
          <ProductTour open={tourOpen} onClose={() => setTourOpen(false)} steps={ANN_TOUR_STEPS} storageKey={ANN_TOUR_KEY} />
        </>
      ) : null}
    </div>
  );

  return (
    <FeatureGate
      feature="announcements"
      fallback={(
        <UpgradeFeatureFallback
          title="Announcements are a Professional feature"
          description="Upgrade to publish org-wide notices for your hiring team."
        />
      )}
    >
      {pageBody}
    </FeatureGate>
  );
}

function ReceiptList({ title, people = [] }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-stone-400">{title} · {people.length}</p>
      {people.length === 0 ? (
        <p className="text-xs text-stone-400 mt-1">None yet</p>
      ) : (
        <ul className="mt-1 divide-y divide-stone-100 border border-stone-100 rounded-lg">
          {people.map((person) => (
            <li key={`${title}-${person.id}`} className="px-3 py-2 flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block font-semibold text-stone-800 truncate">{person.name}</span>
                <span className="block text-[11px] text-stone-400 truncate">{person.email}</span>
              </span>
              <span className="text-[11px] text-stone-400 flex-shrink-0">{person.at ? formatWhen(person.at) : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
