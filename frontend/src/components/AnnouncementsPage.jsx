import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Megaphone, Plus, Loader2, RefreshCw, Filter, Search, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authenticatedFetch, readApiJson } from '../utils/fetchUtils';
import { useToast } from './Toast';
import PageHeader from './ui/PageHeader';
import FeatureGate from './FeatureGate';
import UpgradeFeatureFallback from './ui/UpgradeFeatureFallback';
import ConfirmationModal from './ConfirmationModal';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';
import {
  ANN_TOUR_KEY,
  ANN_TOUR_STEPS,
  FILTERS,
  EMPTY_FORM,
  severityMeta,
} from './announcements/announcementsConstants';
import AnnouncementFormModal, { AnnouncementFields } from './announcements/AnnouncementFormModal';
import AnnouncementFeed from './announcements/AnnouncementFeed';

export default function AnnouncementsPage() {
  const toast = useToast();
  const { organization } = useAuth();
  const careersSlug = organization?.slug;
  const [tourOpen, setTourOpen] = usePageTour(ANN_TOUR_KEY);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [compose, setCompose] = useState(EMPTY_FORM);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [filter, setFilter] = useState('active');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch('/api/announcements/all');
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      setRows(data.data || []);
    } catch (e) {
      toast.error(e.message || 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const notifyLiveBanner = () => {
    window.dispatchEvent(new Event('announcements:refresh'));
  };

  const closeEditModal = () => {
    if (saving) return;
    setEditingId(null);
    setEditForm(EMPTY_FORM);
  };

  const startEdit = (a) => {
    setEditingId(a._id);
    setEditForm({
      title: a.title || '',
      body: a.body || '',
      severity: a.severity || 'info',
      audience: a.audience || 'all'
    });
  };

  const publishCompose = async (e) => {
    e.preventDefault();
    if (!compose.title.trim() || !compose.body.trim()) {
      toast.error('Title and message are required');
      return;
    }
    setSaving(true);
    try {
      const res = await authenticatedFetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: compose.title.trim(),
          body: compose.body.trim(),
          severity: compose.severity,
          audience: compose.audience || 'all'
        })
      });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      toast.success('Announcement published');
      setCompose(EMPTY_FORM);
      await load();
      notifyLiveBanner();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editingId) return;
    if (!editForm.title.trim() || !editForm.body.trim()) {
      toast.error('Title and message are required');
      return;
    }
    setSaving(true);
    try {
      const res = await authenticatedFetch(`/api/announcements/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title.trim(),
          body: editForm.body.trim(),
          severity: editForm.severity,
          audience: editForm.audience || 'all'
        })
      });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      toast.success('Announcement updated');
      closeEditModal();
      await load();
      notifyLiveBanner();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await authenticatedFetch(`/api/announcements/${deleteTarget._id}`, { method: 'DELETE' });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message || 'Failed to deactivate');
      toast.success('Announcement deactivated');
      if (editingId === deleteTarget._id) closeEditModal();
      setDeleteTarget(null);
      await load();
      notifyLiveBanner();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const reactivate = async (a) => {
    try {
      const res = await authenticatedFetch(`/api/announcements/${a._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true })
      });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      toast.success('Announcement reactivated');
      await load();
      notifyLiveBanner();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const counts = useMemo(() => ({
    total: rows.length,
    active: rows.filter((r) => r.isActive).length,
    inactive: rows.filter((r) => !r.isActive).length
  }), [rows]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((a) => {
      if (filter === 'active' && !a.isActive) return false;
      if (filter === 'inactive' && a.isActive) return false;
      if (!query) return true;
      return `${a.title || ''} ${a.body || ''} ${a.severity || ''}`.toLowerCase().includes(query);
    });
  }, [rows, filter, q]);

  const composeSeverity = severityMeta(compose.severity);
  const showGuide = !loading && filtered.length > 0 && filtered.length < 4;

  return (
    <FeatureGate
      feature="announcements"
      fallback={
        <UpgradeFeatureFallback
          title="Announcements are a Professional feature"
          description="Upgrade to publish org-wide notices for your hiring team."
        />
      }
    >
      <div className="page-shell-ats animate-page-enter">
        <PageHeader
          icon={Megaphone}
          title="Announcements"
          subtitle="Publish notices for your hiring team (in-app) or public careers site — enterprise-style banners."
          gradientTitle
        >
          <button type="button" onClick={load} className="btn-secondary w-full sm:w-auto" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </PageHeader>

        <div className="rounded-xl border border-brand-200/70 bg-brand-50/40 px-4 py-3 text-sm text-stone-700 leading-relaxed space-y-1">
          <p>
            <span className="font-semibold text-stone-900">Hiring team</span> → banner under the header on every signed-in page.
            {' '}<span className="font-semibold text-stone-900">Careers site</span> → slim strip on public careers / job pages
            {careersSlug ? (
              <>
                {' '}(
                <a
                  href={`/careers/${careersSlug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-700 font-semibold hover:underline"
                >
                  /careers/{careersSlug}
                </a>
                ).
              </>
            ) : '.'}
          </p>
          <p className="text-xs text-stone-500">Teammates can dismiss in-app notices for themselves. Deactivate removes a notice for everyone.</p>
        </div>

        <div data-tour="ann-toolbar" className="toolbar-ats flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative flex-1 min-w-0 max-w-full sm:max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
              <input
                type="search"
                className="input-ats !pl-10 !pr-9 w-full"
                placeholder="Search notices…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
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
            <p className="text-[11px] text-stone-400 font-medium sm:text-right flex-shrink-0">
              {loading ? 'Loading…' : `${counts.active} active · ${counts.total} total`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 px-1">
              <Filter size={14} /> Status
            </div>
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  filter === f.key
                    ? 'bg-brand-600 text-white border-brand-600 shadow-md shadow-brand-500/20'
                    : 'bg-white text-stone-600 border-stone-200 hover:border-brand-300 hover:bg-brand-50/50'
                }`}
              >
                {f.label}
                <span className="ml-1 opacity-70">
                  {f.key === 'all' ? counts.total : f.key === 'active' ? counts.active : counts.inactive}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
          {/* Compose — create only */}
          <form
            data-tour="ann-compose"
            onSubmit={publishCompose}
            className="lg:col-span-4 card-ats-bordered p-5 sm:p-6 relative overflow-hidden space-y-4 h-fit lg:sticky lg:top-4 min-w-0"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
            <div className="relative flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-stone-900 tracking-tight">Compose notice</h2>
                <p className="text-[11px] text-stone-400 mt-0.5">Publish a new banner. Edit existing ones from the feed.</p>
              </div>
              <span className={`${composeSeverity.badge} text-[10px] capitalize flex-shrink-0`}>
                {compose.severity}
              </span>
            </div>

            <AnnouncementFields form={compose} setForm={setCompose} idPrefix="compose" />

            <button type="submit" className="btn-primary w-full relative" disabled={saving || !!editingId}>
              {saving && !editingId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Publish
            </button>
          </form>

          <AnnouncementFeed
            loading={loading}
            rows={rows}
            filtered={filtered}
            filter={filter}
            careersSlug={careersSlug}
            showGuide={showGuide}
            onClearFilters={() => { setQ(''); setFilter('all'); }}
            onEdit={startEdit}
            onDeactivate={setDeleteTarget}
            onReactivate={reactivate}
          />
        </div>

        <AnnouncementFormModal
          open={!!editingId}
          onClose={closeEditModal}
          form={editForm}
          setForm={setEditForm}
          onSubmit={saveEdit}
          saving={saving}
        />

        <ConfirmationModal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={deactivate}
          title="Deactivate announcement?"
          message={`Deactivate “${deleteTarget?.title || 'this announcement'}”? It will disappear from team banners.`}
          confirmText="Deactivate"
          type="delete"
          isLoading={deleting}
        />

        <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of Announcements" />
        <ProductTour open={tourOpen} onClose={() => setTourOpen(false)} steps={ANN_TOUR_STEPS} storageKey={ANN_TOUR_KEY} />
      </div>
    </FeatureGate>
  );
}
