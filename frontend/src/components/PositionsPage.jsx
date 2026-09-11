import React, { useState, useEffect, useCallback } from 'react';
import { Briefcase, Search, Loader2, RefreshCw, Download, X, Layers } from 'lucide-react';
import { authenticatedFetch } from '../utils/fetchUtils';
import { fetchPicklistPage } from '../utils/orgListFetch';
import { formatByFieldName } from '../utils/textFormatter';
import { useToast } from './Toast';
import PageHeader from './ui/PageHeader';
import ConfirmationModal from './ConfirmationModal';
import PremiumSelect from './ui/PremiumSelect';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';
import { POSITIONS_TOUR_KEY, POSITIONS_TOUR_STEPS, PAGE_SIZE_OPTIONS } from './positions/positionsConstants';
import PositionsComposePanel from './positions/PositionsComposePanel';
import PositionsCatalog from './positions/PositionsCatalog';
import PositionsEditModal from './positions/PositionsEditModal';
import { useAuth } from '../context/AuthContext';

export default function PositionsPage() {
  const { user } = useAuth();
  const isFreelancer = user?.role === 'freelancer';
  const toast = useToast();
  const [tourOpen, setTourOpen] = usePageTour(POSITIONS_TOUR_KEY);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 1, hasMore: false });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [creating, setCreating] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async (pageOverride) => {
    const pageNum = pageOverride != null ? pageOverride : page;
    setLoading(true);
    try {
      const data = await fetchPicklistPage('/api/positions', {
        q: q.trim(),
        page: pageNum,
        limit: pageSize,
      });
      const total = Number(data.total) || 0;
      const limit = Number(data.limit) || pageSize;
      const current = Number(data.page) || pageNum;
      const pages = Math.max(1, Math.ceil(total / limit) || 1);
      setRows(Array.isArray(data.items) ? data.items : []);
      setPagination({
        page: current,
        limit,
        total,
        pages,
        hasMore: current < pages,
      });
      if (pages > 0 && pageNum > pages) setPage(pages);
    } catch (err) {
      toast.error(err.message || 'Could not load positions');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [q, page, pageSize, toast]);

  useEffect(() => {
    setPage(1);
  }, [q, pageSize]);

  useEffect(() => {
    const t = setTimeout(() => load(page), 220);
    return () => clearTimeout(t);
  }, [load, page]);

  const seedCatalog = async () => {
    setSeeding(true);
    try {
      const res = await authenticatedFetch('/api/positions/seed', {
        method: 'POST',
        body: JSON.stringify({ force: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Could not load starter set');
      toast.success(`Loaded ${data.added ?? 0} starter roles`);
      setPage(1);
      await load(1);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSeeding(false);
    }
  };

  const createPosition = async (e) => {
    e.preventDefault();
    const name = formatByFieldName('name', draft);
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await authenticatedFetch('/api/positions', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Could not add position');
      toast.success('Position added');
      setDraft('');
      setPage(1);
      await load(1);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (item) => {
    setEditing(item);
    setEditName(item.name || '');
  };

  const resetEditForm = () => {
    setEditing(null);
    setEditName('');
  };

  const closeEdit = () => {
    if (savingEdit) return;
    resetEditForm();
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editing?._id) return;
    const name = formatByFieldName('name', editName);
    if (!name.trim()) {
      toast.error('Position name is required');
      return;
    }
    setSavingEdit(true);
    try {
      const res = await authenticatedFetch(`/api/positions/${editing._id}`, {
        method: 'PUT',
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Could not update');
      toast.success('Position updated');
      resetEditForm();
      await load(page);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await authenticatedFetch(`/api/positions/${deleteTarget._id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Could not remove');
      toast.success('Position removed');
      if (editing?._id === deleteTarget._id) resetEditForm();
      setDeleteTarget(null);
      const nextPage = rows.length <= 1 && page > 1 ? page - 1 : page;
      if (nextPage !== page) setPage(nextPage);
      await load(nextPage);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const rangeFrom = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const rangeTo = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="page-shell-ats animate-page-enter">
      <PageHeader
        icon={Briefcase}
        title="Positions"
        subtitle="Shared job-role catalog for candidates and jobs."
        gradientTitle
      >
        <button type="button" onClick={() => load(page)} className="btn-secondary w-full sm:w-auto" disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
        <button type="button" onClick={seedCatalog} disabled={seeding} className="btn-primary w-full sm:w-auto">
          {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Load starter set
        </button>
      </PageHeader>

      <div data-tour="positions-toolbar" className="toolbar-ats flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative flex-1 min-w-0 max-w-full sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="input-ats !pl-10 !pr-9 w-full"
              placeholder="Search positions…"
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
          <div className="flex flex-wrap items-center gap-2.5 flex-shrink-0">
            <span className="text-[11px] text-stone-400 font-medium whitespace-nowrap">Per page</span>
            <div className="w-[7.5rem]">
              <PremiumSelect
                compact
                value={String(pageSize)}
                onChange={(v) => setPageSize(Number(v) || 50)}
                options={PAGE_SIZE_OPTIONS}
                placeholder="50"
                icon={Layers}
              />
            </div>
            <p className="text-[11px] text-stone-400 font-medium sm:text-right whitespace-nowrap">
              {loading
                ? 'Loading…'
                : pagination.total === 0
                  ? '0 positions'
                  : `${rangeFrom}–${rangeTo} of ${pagination.total}`}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        <PositionsComposePanel
          draft={draft}
          setDraft={setDraft}
          creating={creating}
          editing={editing}
          onSubmit={createPosition}
        />
        <PositionsCatalog
          loading={loading}
          rows={rows}
          total={pagination.total}
          q={q}
          seeding={seeding}
          pagination={pagination}
          rangeFrom={rangeFrom}
          rangeTo={rangeTo}
          onSeed={seedCatalog}
          onClearSearch={() => setQ('')}
          onOpenEdit={openEdit}
          onDelete={setDeleteTarget}
          isFreelancer={isFreelancer}
          onPrevPage={() => setPage((p) => Math.max(1, p - 1))}
          onNextPage={() => setPage((p) => p + 1)}
        />
      </div>

      <PositionsEditModal
        editing={editing}
        editName={editName}
        setEditName={setEditName}
        savingEdit={savingEdit}
        onClose={closeEdit}
        onSubmit={saveEdit}
      />

      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Remove position?"
        message={`Remove “${deleteTarget?.name || 'this position'}” from the catalog? It will disappear from dropdowns.`}
        confirmText="Remove"
        type="delete"
        isLoading={deleting}
      />

      <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of Positions" />
      <ProductTour open={tourOpen} onClose={() => setTourOpen(false)} steps={POSITIONS_TOUR_STEPS} storageKey={POSITIONS_TOUR_KEY} />
    </div>
  );
}
