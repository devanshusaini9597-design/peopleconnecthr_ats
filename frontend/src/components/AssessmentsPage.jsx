import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ClipboardList, Plus, Trash2, Lock, Loader2, Search, AlertCircle, RefreshCw,
  Clock, Filter, Info,
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
import { useAuth } from '../context/AuthContext';
import { planHasFeature } from '../config/planFeatures';
import {
  ASSESS_TOUR_KEY, ASSESS_TOUR_STEPS, SORT_OPTIONS, actionBtn,
} from './assessments/assessmentsConstants';
import { BuilderModal } from './assessments/BuilderModal';
import { AssessmentDetail } from './assessments/AssessmentDetail';

const AssessmentsPage = () => {
  const toast = useToast();
  const { organization } = useAuth();
  const canProctor = planHasFeature(organization?.plan, 'assessments.proctoring');
  const [tourOpen, setTourOpen] = usePageTour(ASSESS_TOUR_KEY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [assessments, setAssessments] = useState([]);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('title');
  const [showBuilder, setShowBuilder] = useState(false);
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await authenticatedFetch('/api/assessments');
      if (res.status === 401) return handleUnauthorized();
      const data = await readApiJson(res);
      if (res.status === 403 && data.code === 'UPGRADE_REQUIRED') {
        setUpgradeRequired(true);
        return;
      }
      if (!res.ok || !data.success) {
        setLoadError(data.message || 'Failed to load assessments');
        setAssessments([]);
        return;
      }
      setAssessments(data.data || []);
    } catch (err) {
      setLoadError(err?.message || 'Failed to load assessments');
      setAssessments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = assessments.filter((a) => {
      if (!q) return true;
      return (
        (a.title || '').toLowerCase().includes(q) ||
        (a.description || '').toLowerCase().includes(q)
      );
    });
    const sorted = [...list];
    if (sortBy === 'questions') {
      sorted.sort((a, b) => (b.questions?.length || 0) - (a.questions?.length || 0));
    } else if (sortBy === 'duration') {
      sorted.sort((a, b) => (b.durationMinutes || 0) - (a.durationMinutes || 0));
    } else {
      sorted.sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
    }
    return sorted;
  }, [assessments, query, sortBy]);

  const handleCreate = async (form) => {
    setSaving(true);
    try {
      const res = await authenticatedFetch('/api/assessments', { method: 'POST', body: JSON.stringify(form) });
      const data = await readApiJson(res);
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Failed to create assessment');
        return;
      }
      toast?.success?.('Assessment created');
      setShowBuilder(false);
      load();
    } catch (err) {
      toast?.error?.(err?.message || 'Failed to create assessment');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await authenticatedFetch(`/api/assessments/${deleteTarget._id}`, { method: 'DELETE' });
      const data = await readApiJson(res);
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Failed to delete');
        return;
      }
      toast?.success?.('Assessment deleted');
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast?.error?.(err?.message || 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="page-shell-ats">
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-9 h-9 text-brand-600 animate-spin" />
          <p className="text-sm font-medium text-stone-500">Loading assessments…</p>
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
            <h2 className="text-xl font-bold text-stone-900 tracking-tight">Assessments is a Professional feature</h2>
            <p className="text-stone-500 mt-2 text-sm leading-relaxed">
              Upgrade to Professional to build skills tests and invite candidates to complete them.
            </p>
            <a href="/billing" className="btn-primary inline-flex mt-6">View Plans</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell-ats">
      {active ? (
        <AssessmentDetail assessment={active} onBack={() => setActive(null)} />
      ) : (
        <>
          <PageHeader
            icon={ClipboardList}
            title="Assessments"
            subtitle="Build skills tests and invite candidates to complete them. Code answers are graded by your team."
            gradientTitle
          >
            <button type="button" onClick={() => setShowBuilder(true)} className="btn-primary flex-1 sm:flex-none">
              <Plus className="w-4 h-4" /> New Assessment
            </button>
          </PageHeader>

          <div
            data-tour="assess-tip"
            className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed flex flex-wrap items-center gap-x-3 gap-y-1.5"
          >
            <span className="inline-flex items-center gap-1.5 text-brand-700 font-semibold">
              <Info size={14} /> Tip
            </span>
            <span>
              Create a test, open it to invite candidates, then grade submissions when they arrive.
              Press <span className="font-semibold text-stone-800">?</span> for a tour.
            </span>
          </div>

          {loadError ? (
            <div className="card-ats-bordered border-red-200/80 bg-red-50/30">
              <EmptyState
                icon={AlertCircle}
                tone="amber"
                message="Couldn’t load assessments"
                subMessage={loadError}
                action={
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button type="button" onClick={load} className="btn-secondary">
                      <RefreshCw className="w-4 h-4" /> Retry
                    </button>
                    <button type="button" onClick={() => setShowBuilder(true)} className="btn-primary">
                      <Plus className="w-4 h-4" /> New Assessment
                    </button>
                  </div>
                }
              />
            </div>
          ) : assessments.length === 0 ? (
            <div className="card-ats-bordered">
              <EmptyState
                icon={ClipboardList}
                tone="violet"
                message="No assessments yet"
                subMessage="Create a skills test and invite candidates to take it."
                action={
                  <button type="button" onClick={() => setShowBuilder(true)} className="btn-primary">
                    <Plus className="w-4 h-4" /> New Assessment
                  </button>
                }
              />
            </div>
          ) : (
            <div className="space-y-4">
              <section
                data-tour="assess-filters"
                className="rounded-xl border border-stone-200/90 bg-white shadow-sm overflow-hidden"
              >
                <div className="h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
                <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-end gap-3">
                  <div className="flex-1 min-w-0">
                    <label className="label-ats flex items-center gap-1.5">
                      <Filter size={12} className="text-stone-400" /> Search
                    </label>
                    <div className="relative">
                      <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search assessments…"
                        className="input-ats input-ats-icon"
                      />
                    </div>
                  </div>
                  <div className="w-full sm:w-52">
                    <label className="label-ats">Sort</label>
                    <PremiumSelect
                      value={sortBy}
                      onChange={setSortBy}
                      options={SORT_OPTIONS}
                      placeholder="Sort by"
                    />
                  </div>
                  <p className="text-sm font-medium text-stone-500 lg:pb-2.5 lg:ml-auto whitespace-nowrap">
                    {filtered.length} assessment{filtered.length === 1 ? '' : 's'}
                  </p>
                </div>
              </section>

              {filtered.length === 0 ? (
                <div className="card-ats-bordered">
                  <EmptyState
                    icon={Search}
                    tone="amber"
                    message="No assessments match your search"
                    subMessage="Try a different title or clear the search."
                  />
                </div>
              ) : (
                <div data-tour="assess-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
                  {filtered.map((a) => (
                    <div
                      key={a._id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setActive(a)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActive(a); }}
                      className="card-ats p-5 cursor-pointer group hover:border-brand-200/80 relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
                      <div className="flex items-start justify-between gap-2">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-100 to-teal-100 border border-brand-200/60 flex items-center justify-center group-hover:scale-105 transition-transform">
                          {a.proctoring?.enabled
                            ? <Shield className="w-5 h-5 text-brand-600" />
                            : <ClipboardList className="w-5 h-5 text-brand-600" />}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(a); }}
                          className={`${actionBtn} text-stone-400 hover:text-red-600 hover:border-red-200 opacity-100 sm:opacity-0 sm:group-hover:opacity-100`}
                          aria-label="Delete assessment"
                          title="Delete assessment"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <h3 className="font-bold text-stone-900 mt-3.5 tracking-tight line-clamp-2 break-words">{a.title}</h3>
                      {a.description && (
                        <p className="text-sm text-stone-500 mt-1 line-clamp-2 leading-relaxed">{a.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-stone-100 text-xs font-semibold text-stone-500">
                        <span className="inline-flex items-center gap-1"><ClipboardList className="w-3.5 h-3.5" /> {a.questions?.length || 0} questions</span>
                        <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {a.durationMinutes} min</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <BuilderModal
        open={showBuilder}
        onClose={() => setShowBuilder(false)}
        onSave={handleCreate}
        saving={saving}
        canProctor={canProctor}
      />
      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete assessment?"
        message={`Delete “${deleteTarget?.title}”? All invites for it will be removed too.`}
        confirmText="Delete"
        type="delete"
        isLoading={deleting}
      />

      {!active && (
        <>
          <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of Assessments" />
          <ProductTour
            open={tourOpen}
            onClose={() => setTourOpen(false)}
            steps={ASSESS_TOUR_STEPS}
            storageKey={ASSESS_TOUR_KEY}
          />
        </>
      )}
    </div>
  );
};

export default AssessmentsPage;
