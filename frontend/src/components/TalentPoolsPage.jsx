import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Trash2, Lock, Loader2, Search, UserPlus, ArrowLeft, Layers, AlertCircle, RefreshCw } from 'lucide-react';
import { authenticatedFetch, handleUnauthorized, readApiJson } from '../utils/fetchUtils';
import { useToast } from './Toast';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import Modal from './ui/Modal';
import ConfirmationModal from './ConfirmationModal';

const POOL_COLORS = ['#0d9488', '#14b8a6', '#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#a855f7'];

const CreatePoolModal = ({ open, onClose, onSave, saving }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(POOL_COLORS[0]);

  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setColor(POOL_COLORS[0]);
    }
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Talent Pool"
      description="Group strong candidates for future roles."
      size="md"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            type="button"
            onClick={() => onSave({ name, description, color })}
            disabled={saving || !name.trim()}
            className="btn-primary"
          >
            {saving ? <><Loader2 size={16} className="animate-spin" /> Creating…</> : 'Create Pool'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label-ats">Pool name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-ats"
            placeholder="e.g. Frontend Bench, Referrals 2026"
            autoFocus
          />
        </div>
        <div>
          <label className="label-ats">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input-ats"
            placeholder="Optional"
          />
        </div>
        <div>
          <label className="label-ats mb-2">Color</label>
          <div className="flex flex-wrap gap-2.5">
            {POOL_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-9 h-9 rounded-full border-2 transition-all duration-200 ${
                  color === c ? 'border-stone-900 scale-110 shadow-md' : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Select color ${c}`}
              />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};

const AddCandidatesModal = ({ pool, open, onClose, onAdded }) => {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setSelected(new Set());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handle = setTimeout(async () => {
      if (!query.trim()) { setResults([]); return; }
      setSearching(true);
      try {
        const res = await authenticatedFetch(`/candidates?search=${encodeURIComponent(query.trim())}&limit=15`);
        const data = await res.json();
        if (data.success) setResults(data.data || []);
      } catch {
        // silent — search is best-effort
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [query, open]);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleAdd = async () => {
    if (selected.size === 0) return;
    setAdding(true);
    try {
      const res = await authenticatedFetch(`/api/talent-pools/${pool._id}/candidates`, {
        method: 'POST',
        body: JSON.stringify({ candidateIds: Array.from(selected) })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Failed to add candidates');
        return;
      }
      toast?.success?.(data.message);
      onAdded();
      onClose();
    } catch {
      toast?.error?.('Failed to add candidates');
    } finally {
      setAdding(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Add candidates to “${pool.name}”`}
      description="Search and select candidates to keep warm in this pool."
      size="lg"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="button" onClick={handleAdd} disabled={adding || selected.size === 0} className="btn-primary">
            {adding ? <><Loader2 size={16} className="animate-spin" /> Adding…</> : `Add ${selected.size || ''} candidate${selected.size === 1 ? '' : 's'}`}
          </button>
        </>
      }
    >
      <div className="relative mb-4">
        <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email, or skills…"
          className="input-ats !pl-9"
          autoFocus
        />
      </div>
      <div className="max-h-72 overflow-y-auto -mx-1 px-1">
        {searching ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-brand-600 animate-spin" /></div>
        ) : results.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-10">
            {query ? 'No candidates found.' : 'Start typing to search your candidates.'}
          </p>
        ) : (
          <div className="space-y-0.5 stagger-children">
            {results.map((c) => (
              <label key={c._id} className="list-row-ats cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.has(c._id)}
                  onChange={() => toggle(c._id)}
                  className="rounded border-stone-300 text-brand-600 focus:ring-brand-500/30"
                />
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 text-brand-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {(c.name || 'N')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-stone-900 truncate">{c.name}</div>
                  <div className="text-xs text-stone-500 truncate">{c.email}{c.position ? ` · ${c.position}` : ''}</div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};

const PoolDetail = ({ pool, onBack, toast }) => {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch(`/api/talent-pools/${pool._id}/candidates`);
      const data = await res.json();
      if (data.success) setCandidates(data.data.candidates || []);
    } finally {
      setLoading(false);
    }
  }, [pool._id]);

  useEffect(() => { load(); }, [load]);

  const handleRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      const res = await authenticatedFetch(`/api/talent-pools/${pool._id}/candidates/${removeTarget._id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Failed to remove candidate');
        return;
      }
      toast?.success?.('Removed from pool');
      setRemoveTarget(null);
      load();
    } catch {
      toast?.error?.('Failed to remove candidate');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="space-y-6 animate-page-enter">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to pools
      </button>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3 sm:gap-4 min-w-0">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm ring-1 ring-black/5"
            style={{ backgroundColor: `${pool.color}22` }}
          >
            <Layers className="w-6 h-6" style={{ color: pool.color }} />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight" style={{ letterSpacing: '-0.025em' }}>
              {pool.name}
            </h2>
            {pool.description && <p className="text-sm text-stone-500 mt-1 leading-relaxed">{pool.description}</p>}
            <span className="badge-brand mt-2">{candidates.length} candidate{candidates.length === 1 ? '' : 's'}</span>
          </div>
        </div>
        <button type="button" onClick={() => setShowAdd(true)} className="btn-primary w-full sm:w-auto">
          <UserPlus className="w-4 h-4" /> Add Candidates
        </button>
      </div>

      <div className="table-shell-ats">
        {loading ? (
          <div className="p-12 flex flex-col items-center gap-2">
            <Loader2 className="w-7 h-7 text-brand-600 animate-spin" />
            <p className="text-sm text-stone-500 font-medium">Loading candidates…</p>
          </div>
        ) : candidates.length === 0 ? (
          <EmptyState
            icon={Users}
            message="No candidates in this pool yet"
            subMessage="Add candidates to keep them warm for future roles."
            action={
              <button type="button" onClick={() => setShowAdd(true)} className="btn-primary">
                <UserPlus className="w-4 h-4" /> Add Candidates
              </button>
            }
          />
        ) : (
          <div className="divide-y divide-stone-100">
            {candidates.map((c) => (
              <div key={c._id} className="p-4 sm:px-5 flex items-center justify-between gap-3 hover:bg-brand-50/20 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 text-brand-700 flex items-center justify-center text-xs font-bold flex-shrink-0 ring-1 ring-brand-200/50">
                    {(c.name || 'N')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-stone-900 truncate">{c.name}</div>
                    <div className="text-sm text-stone-500 truncate">{c.email}{c.position ? ` · ${c.position}` : ''}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRemoveTarget(c)}
                  className="p-2.5 hover:bg-red-50 rounded-xl text-stone-400 hover:text-red-500 transition-colors touch-target"
                  title="Remove from pool"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <AddCandidatesModal pool={pool} open={showAdd} onClose={() => setShowAdd(false)} onAdded={load} />
      <ConfirmationModal
        isOpen={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemove}
        title="Remove from pool?"
        message={`${removeTarget?.name || 'This candidate'} will stay in your database — only removed from this pool.`}
        confirmText="Remove"
        type="delete"
        isLoading={removing}
      />
    </div>
  );
};

const TalentPoolsPage = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [pools, setPools] = useState([]);
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
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

  const filteredPools = pools.filter((p) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      (p.name || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q)
    );
  });

  const handleCreate = async ({ name, description, color }) => {
    setSaving(true);
    try {
      const res = await authenticatedFetch('/api/talent-pools', {
        method: 'POST',
        body: JSON.stringify({ name, description, color })
      });
      const data = await readApiJson(res);
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Failed to create pool');
        return;
      }
      toast?.success?.('Talent pool created');
      setShowCreate(false);
      load();
    } catch (err) {
      toast?.error?.(err?.message || 'Failed to create pool');
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
    <div className="page-shell-ats">
      {activePool ? (
        <PoolDetail pool={activePool} onBack={() => setActivePool(null)} toast={toast} />
      ) : (
        <>
          <PageHeader
            icon={Layers}
            title="Talent Pools"
            subtitle="Keep strong candidates warm for future roles — independent of any single requisition."
            gradientTitle
          >
            <button type="button" onClick={() => setShowCreate(true)} className="btn-primary" disabled={!!loadError}>
              <Plus className="w-4 h-4" /> New Pool
            </button>
          </PageHeader>

          {loadError ? (
            <div className="card-ats-bordered border-red-200/80 bg-red-50/30">
              <EmptyState
                icon={AlertCircle}
                message="Couldn’t load talent pools"
                subMessage={loadError}
                action={
                  <button type="button" onClick={load} className="btn-primary">
                    <RefreshCw className="w-4 h-4" /> Retry
                  </button>
                }
              />
            </div>
          ) : pools.length === 0 ? (
            <div className="card-ats-bordered">
              <EmptyState
                icon={Layers}
                message="No talent pools yet"
                subMessage={'Create one to start bucketing candidates like "Frontend Bench" or "Referrals 2026".'}
                action={
                  <button type="button" onClick={() => setShowCreate(true)} className="btn-primary">
                    <Plus className="w-4 h-4" /> New Pool
                  </button>
                }
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search pools…"
                    className="input-ats !pl-9"
                  />
                </div>
                <p className="text-sm font-medium text-stone-500 sm:ml-auto">
                  {filteredPools.length} pool{filteredPools.length === 1 ? '' : 's'}
                </p>
              </div>

              {filteredPools.length === 0 ? (
                <div className="card-ats-bordered">
                  <EmptyState
                    icon={Search}
                    message="No pools match your search"
                    subMessage="Try a different name or clear the search."
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
                  {filteredPools.map((pool) => (
                    <div
                      key={pool._id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setActivePool(pool)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActivePool(pool); }}
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
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(pool); }}
                          className="p-2 hover:bg-red-50 rounded-xl text-stone-300 hover:text-red-500 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                          aria-label="Delete pool"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <h3 className="font-bold text-stone-900 mt-3.5 tracking-tight">{pool.name}</h3>
                      {pool.description && (
                        <p className="text-sm text-stone-500 mt-1 line-clamp-2 leading-relaxed">{pool.description}</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-stone-100 text-sm font-medium text-stone-600">
                        <Users className="w-4 h-4 text-stone-400" />
                        {pool.memberCount} candidate{pool.memberCount === 1 ? '' : 's'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <CreatePoolModal open={showCreate} onClose={() => setShowCreate(false)} onSave={handleCreate} saving={saving} />
      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete talent pool?"
        message={`Delete “${deleteTarget?.name}”? Candidates stay in your database — they’re only removed from this pool.`}
        confirmText="Delete Pool"
        type="delete"
        isLoading={deleting}
      />
    </div>
  );
};

export default TalentPoolsPage;
