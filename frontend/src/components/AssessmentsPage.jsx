import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ClipboardList, Plus, Lock, Loader2, Search, AlertCircle, RefreshCw,
  Clock, Filter, Info, Send, FileEdit, Flag, CheckCircle2,
  LayoutGrid, Table2, X,
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
import { StatCard } from './dashboard/DashboardWidgets';
import {
  ASSESS_TOUR_KEY, ASSESS_TOUR_STEPS, SORT_OPTIONS,
} from './assessments/assessmentsConstants';
import { BuilderModal } from './assessments/BuilderModal';
import { AssessmentDetail } from './assessments/AssessmentDetail';
import { EvaluationQueuePanel, QuestionBankPanel, AssessmentSettingsPanel, LIBRARY_TABS } from './assessments/AssessmentOpsPanels';
import { GradeModal } from './assessments/GradeModal';
import AssessmentListCard from './assessments/AssessmentListCard';
import AssessmentLibraryTable from './assessments/AssessmentLibraryTable';
import useTableDragScroll from '../hooks/useTableDragScroll';

const AssessmentsPage = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const { organization, user } = useAuth();
  const allow = (key) => {
    if (user?.role === 'owner') return true;
    if (Array.isArray(user?.permissions)) return user.permissions.includes(key);
    return ['admin', 'hr_manager', 'hr_recruiter', 'recruiter'].includes(user?.role);
  };
  const canCreate = allow('assessments.create');
  const canEdit = allow('assessments.edit');
  const canInvite = allow('assessments.invite');
  const canGrade = allow('assessments.grade');
  const canDelete = allow('assessments.delete');
  const canPublish = allow('assessments.publish');
  const canDecide = allow('assessments.decide');
  const canSettings = allow('assessments.settings');
  const canProctor = planHasFeature(organization?.plan, 'assessments.proctoring');
  const [tab, setTab] = useState('library');
  const [tourOpen, setTourOpen] = usePageTour(ASSESS_TOUR_KEY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [assessments, setAssessments] = useState([]);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('title');
  const [showBuilder, setShowBuilder] = useState(false);
  const [editing, setEditing] = useState(null);
  const [library, setLibrary] = useState('active');
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [gradingInvite, setGradingInvite] = useState(null);
  const [viewMode, setViewMode] = useState('cards');
  const {
    tableScrollRef,
    onTableDragScrollStart,
    onTableDragScrollMove,
    onTableDragScrollEnd,
  } = useTableDragScroll();

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
      const archived = a.isActive === false;
      if (library === 'active' && archived) return false;
      if (library === 'archived' && !archived) return false;
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
  }, [assessments, query, sortBy, library]);

  const libraryCounts = useMemo(() => {
    const live = assessments.filter((a) => a.isActive !== false).length;
    const archived = assessments.filter((a) => a.isActive === false).length;
    return { live, archived, all: assessments.length };
  }, [assessments]);

  const totals = useMemo(() => assessments.reduce((acc, row) => {
    acc.assigned += row.inviteStats?.total || 0;
    acc.open += (row.inviteStats?.pending || 0) + (row.inviteStats?.in_progress || 0);
    acc.review += row.inviteStats?.pendingReview || 0;
    acc.flagged += row.inviteStats?.flagged || 0;
    acc.graded += row.inviteStats?.graded || 0;
    return acc;
  }, { assigned: 0, open: 0, review: 0, flagged: 0, graded: 0 }), [assessments]);

  const openCreate = () => {
    setEditing(null);
    setShowBuilder(true);
  };

  const openEdit = async (assessment) => {
    try {
      const res = await authenticatedFetch(`/api/assessments/${assessment._id}`);
      const data = await readApiJson(res);
      setEditing(data.success ? data.data : assessment);
    } catch {
      setEditing(assessment);
    }
    setShowBuilder(true);
  };

  const duplicate = async (assessment) => {
    try {
      const res = await authenticatedFetch(`/api/assessments/${assessment._id}/duplicate`, { method: 'POST' });
      const data = await readApiJson(res);
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Could not duplicate');
        return;
      }
      toast?.success?.('A draft copy was created. You can edit it independently of the original assessment.');
      setActive(data.data);
      load();
    } catch (err) {
      toast?.error?.(err?.message || 'Could not duplicate');
    }
  };

  const handleSave = async (form) => {
    setSaving(true);
    const isEdit = Boolean(editing?._id);
    try {
      const res = await authenticatedFetch(
        isEdit ? `/api/assessments/${editing._id}` : '/api/assessments',
        { method: isEdit ? 'PUT' : 'POST', body: JSON.stringify(form) }
      );
      const data = await readApiJson(res);
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || (isEdit ? 'Failed to update assessment' : 'Failed to create assessment'));
        return;
      }
      toast?.success?.(isEdit ? 'Assessment updated' : 'Assessment created. Invite candidates when you are ready.');
      setShowBuilder(false);
      setEditing(null);
      setActive(data.data);
      load();
    } catch (err) {
      toast?.error?.(err?.message || 'Failed to save assessment');
    } finally {
      setSaving(false);
    }
  };

  const openQueueGrade = async (row) => {
    try {
      const res = await authenticatedFetch(`/api/assessments/invites/${row._id}`);
      const data = await readApiJson(res);
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Could not open this submission');
        return;
      }
      setGradingInvite(data.data);
    } catch (err) {
      toast?.error?.(err?.message || 'Could not open this submission');
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
              Upgrade to Professional to create assessments, invite candidates, and review submissions.
            </p>
            <a href="/billing" className="btn-primary inline-flex mt-6">View Plans</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell-ats animate-page-enter">
      {active ? (
        <AssessmentDetail
          assessment={active}
          onBack={() => { setActive(null); load(); }}
          onEdit={canEdit ? openEdit : null}
          onUpdated={(next) => { setActive(next); load(); }}
          access={{ edit: canEdit, invite: canInvite, grade: canGrade, archive: canEdit, publish: canPublish, decide: canDecide, create: canCreate, remove: canDelete }}
          onDelete={canDelete ? setDeleteTarget : null}
          onDuplicate={canCreate ? duplicate : null}
        />
      ) : (
        <>
          <PageHeader
            icon={ClipboardList}
            title={t('pages.assessments.title')}
            subtitle={t('pages.assessments.subtitle')}
            gradientTitle
          >
            {canCreate ? (
            <button type="button" onClick={openCreate} className="btn-primary flex-1 sm:flex-none">
              <Plus className="w-4 h-4" /> Create assessment
            </button>
            ) : null}
          </PageHeader>

          <div
            data-tour="assess-tip"
            className="rounded-xl border border-stone-200 bg-white px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-[13px] text-stone-600 leading-relaxed flex flex-wrap items-center gap-x-3 gap-y-1.5"
          >
            <span className="inline-flex items-center gap-1.5 text-brand-700 font-semibold">
              <Info size={14} /> Note
            </span>
            <span>
              Sending an invitation does not lock the assessment. You may continue to edit, duplicate, invite additional candidates, or delete. Candidates who have already started retain the version they received.
              Press <span className="font-semibold text-stone-800">?</span> for a product tour.
            </span>
          </div>

          <div className="grid gap-4 sm:gap-5 min-w-0 w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: 'Invitations', value: totals.assigned, icon: Send, caption: 'Sent to candidates', gradient: 'from-indigo-500 to-sky-400', tab: 'library' },
              { label: 'In progress', value: totals.open, icon: Clock, caption: 'Not yet submitted', gradient: 'from-teal-500 to-emerald-400', tab: 'library' },
              { label: 'Pending review', value: totals.review, icon: FileEdit, caption: 'Awaiting evaluation', gradient: 'from-amber-500 to-orange-400', tab: 'queue' },
              { label: 'Integrity flags', value: totals.flagged, icon: Flag, caption: 'Proctoring alerts', gradient: 'from-rose-500 to-pink-400', tab: 'library' },
              { label: 'Graded', value: totals.graded, icon: CheckCircle2, caption: 'Scoring complete', gradient: 'from-emerald-500 to-teal-400', tab: 'library' },
            ].map((card) => (
              <StatCard
                key={card.label}
                icon={card.icon}
                label={card.label}
                value={card.value}
                caption={card.caption}
                gradient={card.gradient}
                aligned
                onClick={() => setTab(card.tab)}
              />
            ))}
          </div>

          <div
            data-tour="assess-filters"
            className="rounded-2xl border border-stone-200/90 bg-white shadow-[var(--shadow-card)] overflow-hidden"
          >
            <div className="h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
            <div className="px-4 sm:px-5 py-4 border-b border-stone-100 space-y-3">
              <div className="flex items-center gap-2">
                <Filter size={15} className="text-brand-600 flex-shrink-0" />
                <p className="text-sm font-bold text-stone-900 tracking-tight">
                  {tab === 'library' ? 'Assessments' : tab === 'queue' ? 'Evaluation queue' : tab === 'bank' ? 'Question library' : 'Policies'}
                </p>
              </div>
              <div className="flex overflow-x-auto scrollbar-hide gap-1">
                {LIBRARY_TABS.filter((item) => {
                  if (item.id === 'bank') return canEdit;
                  if (item.id === 'settings') return canSettings;
                  return true;
                }).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className={`flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-xl transition-all whitespace-nowrap
                      ${tab === id
                        ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200/70'
                        : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50'}`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
              {tab === 'library' || tab === 'queue' ? (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-600 pointer-events-none" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={tab === 'queue' ? 'Search by candidate, email, or assessment' : 'Search by title or description'}
                    className="input-ats input-ats-icon !pr-9 !h-10 rounded-xl w-full"
                    aria-label="Find"
                  />
                  {query ? (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100"
                      aria-label="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                </div>
              ) : null}
              {tab === 'library' ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <div className="inline-flex flex-wrap rounded-xl border border-stone-200 bg-stone-50/80 p-1 gap-0.5">
                    {[
                      { key: 'active', label: 'Live', count: libraryCounts.live },
                      { key: 'archived', label: 'Archived', count: libraryCounts.archived },
                      { key: 'all', label: 'All', count: libraryCounts.all },
                    ].map((s) => {
                      const active = library === s.key;
                      return (
                        <button
                          key={s.key}
                          type="button"
                          onClick={() => setLibrary(s.key)}
                          className={`h-8 px-3 text-[12px] font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors ${
                            active
                              ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/20'
                              : 'text-stone-600 hover:bg-white hover:text-stone-900'
                          }`}
                        >
                          {s.label}
                          <span className={active ? 'text-white/80' : 'text-stone-400'}>{s.count}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="w-40">
                    <PremiumSelect value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} placeholder="Sort by" compact />
                  </div>
                  <div className="ml-auto inline-flex rounded-xl border border-stone-200 bg-stone-50/80 p-0.5">
                    <button
                      type="button"
                      onClick={() => setViewMode('cards')}
                      className={`h-8 w-8 inline-flex items-center justify-center rounded-lg ${viewMode === 'cards' ? 'bg-white text-brand-700 shadow-sm' : 'text-stone-400 hover:text-stone-700'}`}
                      title="Card view"
                      aria-label="Card view"
                    >
                      <LayoutGrid size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('table')}
                      className={`h-8 w-8 inline-flex items-center justify-center rounded-lg ${viewMode === 'table' ? 'bg-white text-brand-700 shadow-sm' : 'text-stone-400 hover:text-stone-700'}`}
                      title="Table view — drag to scroll"
                      aria-label="Table view"
                    >
                      <Table2 size={15} />
                    </button>
                  </div>
                  {(query || library !== 'active') ? (
                    <button type="button" onClick={() => { setQuery(''); setLibrary('active'); }} className="text-[12px] font-semibold text-brand-700 hover:text-brand-800">
                      Reset
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div data-tour="assess-grid" className="p-4 sm:p-6">
              {tab === 'queue' ? (
                <EvaluationQueuePanel onGrade={openQueueGrade} canGrade={canGrade} searchQuery={query} embedded />
              ) : null}
              {tab === 'bank' && canEdit ? <QuestionBankPanel /> : null}
              {tab === 'settings' && canSettings ? <AssessmentSettingsPanel /> : null}
              {tab === 'library' ? (
                loadError ? (
                  <EmptyState
                    icon={AlertCircle}
                    tone="amber"
                    message="Unable to load assessments"
                    subMessage={loadError}
                    action={(
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <button type="button" onClick={load} className="btn-secondary">
                          <RefreshCw className="w-4 h-4" /> Retry
                        </button>
                        {canCreate ? (
                          <button type="button" onClick={openCreate} className="btn-primary">
                            <Plus className="w-4 h-4" /> Create assessment
                          </button>
                        ) : null}
                      </div>
                    )}
                  />
                ) : assessments.length === 0 ? (
                  <EmptyState
                    icon={ClipboardList}
                    tone="violet"
                    message="No assessments yet"
                    subMessage="Create an assessment, then invite candidates to complete it."
                    action={canCreate ? (
                      <button type="button" onClick={openCreate} className="btn-primary">
                        <Plus className="w-4 h-4" /> Create assessment
                      </button>
                    ) : null}
                  />
                ) : filtered.length === 0 ? (
                  <EmptyState
                    icon={Search}
                    tone="amber"
                    message="No assessments match these criteria"
                    subMessage="Adjust the search or restore the default filters."
                    action={(
                      <button type="button" className="btn-secondary" onClick={() => { setQuery(''); setLibrary('active'); }}>
                        Reset criteria
                      </button>
                    )}
                  />
                ) : viewMode === 'table' ? (
                  <AssessmentLibraryTable
                    rows={filtered}
                    tableScrollRef={tableScrollRef}
                    onTableDragScrollStart={onTableDragScrollStart}
                    onTableDragScrollMove={onTableDragScrollMove}
                    onTableDragScrollEnd={onTableDragScrollEnd}
                    onOpen={setActive}
                    onEdit={canEdit ? openEdit : null}
                    onDuplicate={canCreate ? duplicate : null}
                    onInvite={canInvite ? setActive : null}
                    onDelete={canDelete ? setDeleteTarget : null}
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch stagger-children">
                    {filtered.map((a) => (
                      <AssessmentListCard
                        key={a._id}
                        assessment={a}
                        onOpen={setActive}
                        onEdit={canEdit ? openEdit : null}
                        onDuplicate={canCreate ? duplicate : null}
                        onInvite={canInvite ? setActive : null}
                        onDelete={canDelete ? setDeleteTarget : null}
                      />
                    ))}
                  </div>
                )
              ) : null}
            </div>
            {tab === 'library' && filtered.length > 0 ? (
              <div className="px-3 py-2 border-t border-stone-200 bg-stone-50 flex items-center justify-between gap-2">
                <p className="text-[12px] text-stone-500">
                  {filtered.length.toLocaleString()} assessment{filtered.length === 1 ? '' : 's'}
                </p>
                {viewMode === 'table' ? (
                  <p className="text-[11px] text-stone-400">Drag the table sideways to scroll</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </>
      )}

      <BuilderModal
        open={showBuilder}
        initial={editing}
        onClose={() => { setShowBuilder(false); setEditing(null); }}
        onSave={handleSave}
        saving={saving}
        canProctor={canProctor}
      />
      <GradeModal
        invite={gradingInvite}
        open={!!gradingInvite}
        onClose={() => setGradingInvite(null)}
        onGraded={() => { setGradingInvite(null); load(); }}
      />
      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete assessment?"
        message={`Delete “${deleteTarget?.title}”? Outstanding invitations that have not been started will be revoked. Candidates who have already started or submitted retain their attempt.`}
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
