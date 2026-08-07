import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users, Plus, Trash2, Lock, Loader2, Search, Layers,
  AlertCircle, RefreshCw, Settings2, Filter, Info,
} from 'lucide-react';
import { authenticatedFetch, handleUnauthorized, readApiJson } from '../utils/fetchUtils';
import { useToast } from './Toast';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import ConfirmationModal from './ConfirmationModal';
import PremiumSelect from './ui/PremiumSelect';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';
import {
  POOLS_TOUR_KEY, POOLS_TOUR_STEPS, SORT_OPTIONS,
} from './talentPools/talentPoolsConstants';
import { PoolFormModal } from './talentPools/PoolFormModal';
import { PoolDetail } from './talentPools/PoolDetail';

const TalentPoolsPage = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const [tourOpen, setTourOpen] = usePageTour(POOLS_TOUR_KEY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [pools, setPools] = useState([]);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [showForm, setShowForm] = useState(false);
  const [editPool, setEditPool] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activePool, setActivePool] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await authenticatedFetch('/api/talent-pools');
      if (res.status === 401) return handleUnauthorized();
      const data = await readApiJson(res);
      if (res.status === 403 && data.code === 'UPGRADE_REQUIRED') {
        setUpgradeRequired(true);
        return;
      }
      if (!res.ok || !data.success) {
        setLoadError(data.message || 'Failed to load talent pools');
        setPools([]);
        return;
      }
      setPools(data.data || []);
    } catch (err) {
      setLoadError(err?.message || 'Failed to load talent pools');
      setPools([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredPools = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = pools.filter((p) => {
      if (!q) return true;
      return (
        (p.name || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      );
    });
    list = [...list].sort((a, b) => {
      if (sortBy === 'members') return (b.memberCount || 0) - (a.memberCount || 0);
      if (sortBy === 'recent') {
        const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return tb - ta;
      }
      return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
    });
    return list;
  }, [pools, query, sortBy]);

  const openCreate = () => {
    setEditPool(null);
    setShowForm(true);
  };

  const openManage = (pool) => {
    setEditPool(pool);
    setShowForm(true);
  };

  const handleSave = async ({ name, description, color }) => {
    setSaving(true);
    try {
      if (editPool?._id) {
        const res = await authenticatedFetch(`/api/talent-pools/${editPool._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description, color }),
        });
        const data = await readApiJson(res);
        if (!res.ok || !data.success) {
          toast?.error?.(data.message || 'Failed to update pool');
          return;
        }
        toast?.success?.('Pool updated');
        setShowForm(false);
        setEditPool(null);
        if (activePool?._id === editPool._id) setActivePool(data.data);
        load();
      } else {
        const res = await authenticatedFetch('/api/talent-pools', {
          method: 'POST',
          body: JSON.stringify({ name, description, color }),
        });
        const data = await readApiJson(res);
        if (!res.ok || !data.success) {
          toast?.error?.(data.message || 'Failed to create pool');
          return;
        }
        toast?.success?.('Talent pool created');
        setShowForm(false);
        load();
      }
    } catch (err) {
      toast?.error?.(err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await authenticatedFetch(`/api/talent-pools/${deleteTarget._id}`, { method: 'DELETE' });
      const data = await readApiJson(res);
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Failed to delete pool');
        return;
      }
      toast?.success?.('Talent pool deleted');
      setDeleteTarget(null);
      if (activePool?._id === deleteTarget._id) setActivePool(null);
      load();
    } catch (err) {
      toast?.error?.(err?.message || 'Failed to delete pool');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="page-shell-ats">
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-9 h-9 text-brand-600 animate-spin" />
          <p className="text-sm font-medium text-stone-500">Loading talent pools…</p>
        </div>
      </div>
    );
  }

  if (upgradeRequired) {
    return (
      <div className="page-shell-ats">
        <div className="min-h-[60vh] flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center card-ats-bordered border-amber-200/80 bg-amber-50/40 p-8 sm:p-10 animate-slide-up">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4 ring-4 ring-amber-100/60">
              <Lock className="w-7 h-7 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-stone-900 tracking-tight">Talent Pools is a Professional feature</h2>
            <p className="text-stone-500 mt-2 text-sm leading-relaxed">
              Upgrade to Professional to build a silver-medalist / passive-candidate database, independent of any single job.
            </p>
            <a href="/billing" className="btn-primary inline-flex mt-6">View Plans</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell-ats animate-page-enter">
      {activePool ? (
        <PoolDetail
          pool={activePool}
          onBack={() => { setActivePool(null); load(); }}
          toast={toast}
          onPoolUpdated={(p) => { setActivePool(p); load(); }}
          onManage={openManage}
        />
      ) : (
        <>
          <PageHeader
            icon={Layers}
            title={t('pages.talentPools.title')}
            subtitle="Keep strong candidates warm for future roles — independent of any single requisition."
            gradientTitle
          >
            <button type="button" onClick={openCreate} className="btn-primary flex-1 sm:flex-none">
              <Plus className="w-4 h-4" /> New pool
            </button>
          </PageHeader>

          <div
            data-tour="pools-tip"
            className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed flex flex-wrap items-center gap-x-3 gap-y-1.5"
          >
            <span className="inline-flex items-center gap-1.5 text-brand-700 font-semibold">
              <Info size={14} /> Tip
            </span>
            <span>
              Create pools for benches and referrals. Open a pool to add members.
              Press <span className="font-semibold text-stone-800">?</span> for a tour.
            </span>
          </div>

          {loadError ? (
            <div className="card-ats-bordered border-red-200/80 bg-red-50/30">
              <EmptyState
                icon={AlertCircle}
                tone="amber"
                message="Couldn’t load talent pools"
                subMessage={loadError}
                action={(
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button type="button" onClick={load} className="btn-secondary">
                      <RefreshCw className="w-4 h-4" /> Retry
                    </button>
                    <button type="button" onClick={openCreate} className="btn-primary">
                      <Plus className="w-4 h-4" /> New pool
                    </button>
                  </div>
                )}
              />
            </div>
          ) : pools.length === 0 ? (
            <div className="card-ats-bordered">
              <EmptyState
                icon={Layers}
                tone="violet"
                message="No talent pools yet"
                subMessage={'Create one to start bucketing candidates like "Frontend Bench" or "Referrals 2026".'}
                action={(
                  <button type="button" onClick={openCreate} className="btn-primary">
                    <Plus className="w-4 h-4" /> New pool
                  </button>
                )}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <section
                data-tour="pools-filters"
                className="rounded-xl border border-stone-200/90 bg-white shadow-sm overflow-hidden"
              >
                <div className="h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
                <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-end gap-3">
                  <div className="flex-1 min-w-0">
                    <label htmlFor="pools-search" className="label-ats flex items-center gap-1.5">
                      <Filter size={12} className="text-stone-400" aria-hidden="true" /> Search
                    </label>
                    <div className="relative">
                      <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                      <input
                        id="pools-search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search pools…"
                        className="input-ats input-ats-icon"
                      />
                    </div>
                  </div>
                  <div className="w-full sm:w-52">
                    <label htmlFor="pools-sort" className="label-ats">Sort</label>
                    <PremiumSelect
                      id="pools-sort"
                      value={sortBy}
                      onChange={setSortBy}
                      options={SORT_OPTIONS}
                      placeholder="Sort by"
                    />
                  </div>
                  <p className="text-sm font-medium text-stone-500 lg:pb-2.5 lg:ml-auto whitespace-nowrap">
                    {filteredPools.length} pool{filteredPools.length === 1 ? '' : 's'}
                  </p>
                </div>
              </section>

              {filteredPools.length === 0 ? (
                <div className="card-ats-bordered">
                  <EmptyState
                    icon={Search}
                    tone="amber"
                    message="No pools match your search"
                    subMessage="Try a different name or clear the search."
                  />
                </div>
              ) : (
                <div data-tour="pools-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
                  {filteredPools.map((pool) => (
                    <div
                      key={pool._id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setActivePool(pool)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setActivePool(pool);
                        if (e.key === ' ') { e.preventDefault(); setActivePool(pool); }
                      }}
                      className="card-ats p-5 cursor-pointer group hover:border-brand-200/80 relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: pool.color || '#0d9488' }} />
                      <div className="flex items-start justify-between gap-2">
                        <div
                          className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm ring-1 ring-black/5 group-hover:scale-105 transition-transform"
                          style={{ backgroundColor: `${pool.color || '#0d9488'}22` }}
                        >
                          <Layers className="w-5 h-5" style={{ color: pool.color || '#0d9488' }} />
                        </div>
                        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openManage(pool); }}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 hover:text-brand-600 hover:border-brand-300"
                            title="Manage"
                            aria-label="Manage pool"
                          >
                            <Settings2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(pool); }}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-400 hover:text-red-600 hover:border-red-200"
                            title="Delete pool"
                            aria-label="Delete pool"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <h3 className="font-bold text-stone-900 mt-3.5 tracking-tight break-words">{pool.name}</h3>
                      {pool.description && (
                        <p className="text-sm text-stone-500 mt-1 line-clamp-2 leading-relaxed">{pool.description}</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-stone-100 text-sm font-medium text-stone-600">
                        <Users className="w-4 h-4 text-stone-400" />
                        {pool.memberCount || 0} candidate{(pool.memberCount || 0) === 1 ? '' : 's'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <PoolFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditPool(null); }}
        onSave={handleSave}
        saving={saving}
        initial={editPool}
      />
      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete talent pool?"
        message={`Delete “${deleteTarget?.name}”? Candidates stay in your database — they’re only removed from this pool.`}
        confirmText="Delete pool"
        type="delete"
        isLoading={deleting}
      />

      {!activePool && (
        <>
          <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of Talent Pools" />
          <ProductTour
            open={tourOpen}
            onClose={() => setTourOpen(false)}
            steps={POOLS_TOUR_STEPS}
            storageKey={POOLS_TOUR_KEY}
          />
        </>
      )}
    </div>
  );
};


export default TalentPoolsPage;
