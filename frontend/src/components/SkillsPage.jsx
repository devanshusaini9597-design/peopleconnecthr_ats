import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Tags, Search, Loader2, RefreshCw, Download, X, Filter, Layers
} from 'lucide-react';
import { authenticatedFetch, readApiJson } from '../utils/fetchUtils';
import { useToast } from './Toast';
import PageHeader from './ui/PageHeader';
import FeatureGate from './FeatureGate';
import UpgradeFeatureFallback from './ui/UpgradeFeatureFallback';
import ConfirmationModal from './ConfirmationModal';
import PremiumSelect from './ui/PremiumSelect';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';
import {
  SKILLS_TOUR_KEY,
  SKILLS_TOUR_STEPS,
  SOURCE_FILTERS,
  PAGE_SIZE_OPTIONS,
} from './skills/skillsConstants';
import SkillsComposePanel from './skills/SkillsComposePanel';
import SkillsCatalog from './skills/SkillsCatalog';
import SkillsEditModal from './skills/SkillsEditModal';

export default function SkillsPage() {
  const toast = useToast();
  const [tourOpen, setTourOpen] = usePageTour(SKILLS_TOUR_KEY);
  const [skills, setSkills] = useState([]);
  const [categories, setCategories] = useState([]);
  const [counts, setCounts] = useState({ total: 0, system: 0, custom: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 1, hasMore: false });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [creating, setCreating] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [source, setSource] = useState('all');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Custom');
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('Custom');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async (pageOverride) => {
    const pageNum = pageOverride != null ? pageOverride : page;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(pageNum),
        limit: String(pageSize),
        source
      });
      if (q.trim()) params.set('q', q.trim());
      if (category) params.set('category', category);
      const res = await authenticatedFetch(`/api/skills?${params}`);
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message || 'Failed to load skills');
      setSkills(data.data || []);
      setCategories(data.categories || []);
      setCounts(data.counts || { total: 0, system: 0, custom: 0 });
      const pag = data.pagination || { page: pageNum, limit: pageSize, total: data.total || 0, pages: 1 };
      setPagination(pag);
      if (pag.page !== pageNum) setPage(pag.page);
      // If current page is past last page (e.g. after delete), snap back
      if (pag.pages > 0 && pageNum > pag.pages) {
        setPage(pag.pages);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load skills');
    } finally {
      setLoading(false);
    }
  }, [q, category, source, page, pageSize, toast]);

  // Reset to page 1 when filters / page size change
  useEffect(() => {
    setPage(1);
  }, [q, category, source, pageSize]);

  useEffect(() => {
    const t = setTimeout(() => load(page), 200);
    return () => clearTimeout(t);
  }, [load, page]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const s of skills) {
      const key = s.category || 'Other';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [skills]);

  const seedCatalog = async () => {
    setSeeding(true);
    try {
      const res = await authenticatedFetch('/api/skills/seed', { method: 'POST' });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      toast.success(`Imported ${data.created} skills (${data.skipped} already present)`);
      setPage(1);
      await load(1);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSeeding(false);
    }
  };

  const createSkill = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await authenticatedFetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), category: newCategory.trim() || 'Custom' })
      });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      toast.success('Skill created');
      setNewName('');
      setPage(1);
      await load(1);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (s) => {
    if (s.isSystem) return;
    setEditing(s);
    setEditName(s.name || '');
    setEditCategory(s.category || 'Custom');
  };

  const resetEditForm = () => {
    setEditing(null);
    setEditName('');
    setEditCategory('Custom');
  };

  const closeEdit = () => {
    if (savingEdit) return;
    resetEditForm();
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editing?._id) return;
    if (!editName.trim()) {
      toast.error('Skill name is required');
      return;
    }
    setSavingEdit(true);
    try {
      const res = await authenticatedFetch(`/api/skills/${editing._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          category: editCategory.trim() || 'Custom'
        })
      });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      toast.success('Skill updated');
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
      const res = await authenticatedFetch(`/api/skills/${deleteTarget._id}`, { method: 'DELETE' });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      toast.success('Skill removed');
      if (editing?._id === deleteTarget._id) resetEditForm();
      setDeleteTarget(null);
      const nextPage = skills.length <= 1 && page > 1 ? page - 1 : page;
      if (nextPage !== page) setPage(nextPage);
      await load(nextPage);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const showGuide = !loading && skills.length > 0 && pagination.total > 0 && pagination.total < 12;
  const rangeFrom = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const rangeTo = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <FeatureGate
      feature="candidates.skillsTaxonomy"
      fallback={
        <UpgradeFeatureFallback
          title="Skills taxonomy is a Professional feature"
          description="Upgrade to manage a structured skills catalog and match candidates to jobs with proficiency scores."
        />
      }
    >
      <div className="page-shell-ats animate-page-enter">
        <PageHeader
          icon={Tags}
          title="Skills Taxonomy"
          subtitle="Structured skills catalog for candidate–job matching."
          gradientTitle
        >
          <button type="button" onClick={() => load(page)} className="btn-secondary w-full sm:w-auto" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button type="button" onClick={seedCatalog} disabled={seeding} className="btn-primary w-full sm:w-auto">
            {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Import catalog
          </button>
        </PageHeader>

        <div data-tour="skills-toolbar" className="toolbar-ats flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative flex-1 min-w-0 max-w-full sm:max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="input-ats !pl-10 !pr-9 w-full"
                placeholder="Search skills…"
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
                    ? `0 · ${categories.length} categories`
                    : `${rangeFrom}–${rangeTo} of ${pagination.total} · ${categories.length} categories`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 px-1">
              <Filter size={14} /> Source
            </div>
            {SOURCE_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setSource(f.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  source === f.key
                    ? 'bg-brand-600 text-white border-brand-600 shadow-md shadow-brand-500/20'
                    : 'bg-white text-stone-600 border-stone-200 hover:border-brand-300 hover:bg-brand-50/50'
                }`}
              >
                {f.label}
                <span className="ml-1 opacity-70">
                  {f.key === 'all' ? counts.total : f.key === 'system' ? counts.system : counts.custom}
                </span>
              </button>
            ))}
          </div>

          {categories.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5 -mx-0.5 px-0.5 scrollbar-thin">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 px-1 flex-shrink-0">
                Category
              </div>
              <button
                type="button"
                onClick={() => setCategory('')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex-shrink-0 ${
                  !category
                    ? 'bg-stone-800 text-white border-stone-800'
                    : 'bg-white text-stone-600 border-stone-200 hover:border-brand-300 hover:bg-brand-50/50'
                }`}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c === category ? '' : c)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex-shrink-0 whitespace-nowrap ${
                    category === c
                      ? 'bg-brand-600 text-white border-brand-600 shadow-md shadow-brand-500/20'
                      : 'bg-white text-stone-600 border-stone-200 hover:border-brand-300 hover:bg-brand-50/50'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
          <SkillsComposePanel
            newName={newName}
            setNewName={setNewName}
            newCategory={newCategory}
            setNewCategory={setNewCategory}
            categories={categories}
            creating={creating}
            editing={editing}
            onSubmit={createSkill}
          />
          <SkillsCatalog
            loading={loading}
            skills={skills}
            grouped={grouped}
            counts={counts}
            q={q}
            category={category}
            source={source}
            seeding={seeding}
            pagination={pagination}
            rangeFrom={rangeFrom}
            rangeTo={rangeTo}
            showGuide={showGuide}
            onSeed={seedCatalog}
            onClearFilters={() => { setQ(''); setCategory(''); setSource('all'); }}
            onOpenEdit={openEdit}
            onDelete={setDeleteTarget}
            onPrevPage={() => setPage((p) => Math.max(1, p - 1))}
            onNextPage={() => setPage((p) => p + 1)}
          />
        </div>

        <SkillsEditModal
          editing={editing}
          editName={editName}
          setEditName={setEditName}
          editCategory={editCategory}
          setEditCategory={setEditCategory}
          categories={categories}
          savingEdit={savingEdit}
          onClose={closeEdit}
          onSubmit={saveEdit}
        />

        <ConfirmationModal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
          title="Remove custom skill?"
          message={`Remove “${deleteTarget?.name || 'this skill'}” from your catalog? It will also be detached from candidates and jobs.`}
          confirmText="Remove"
          type="delete"
          isLoading={deleting}
        />

        <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of Skills" />
        <ProductTour open={tourOpen} onClose={() => setTourOpen(false)} steps={SKILLS_TOUR_STEPS} storageKey={SKILLS_TOUR_KEY} />
      </div>
    </FeatureGate>
  );
}
