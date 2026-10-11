import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ClipboardList, Plus, Trash2, Lock, Loader2, Search, AlertCircle, RefreshCw,
  Clock, Filter, Info, Shield, Pencil, Copy, Send, FileEdit, Flag, CheckCircle2,
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
import { EvaluationQueuePanel, QuestionBankPanel, AssessmentSettingsPanel, LIBRARY_TABS } from './assessments/AssessmentOpsPanels';
import { GradeModal } from './assessments/GradeModal';

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
      toast?.success?.('Copy created as a draft. You can edit it fully, including after invites on the original.');
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
      toast?.success?.(isEdit ? 'Assessment updated' : 'Assessment created. Invite a candidate next.');
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
              Upgrade to Professional to build skills tests and invite candidates to complete them.
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
              <Plus className="w-4 h-4" /> New Assessment
            </button>
            ) : null}
          </PageHeader>

          {(() => {
            const totals = assessments.reduce((acc, row) => {
              acc.assigned += row.inviteStats?.total || 0;
              acc.open += (row.inviteStats?.pending || 0) + (row.inviteStats?.in_progress || 0);
              acc.review += row.inviteStats?.pendingReview || 0;
              acc.flagged += row.inviteStats?.flagged || 0;
              acc.graded += row.inviteStats?.graded || 0;
              return acc;
            }, { assigned: 0, open: 0, review: 0, flagged: 0, graded: 0 });
            const cards = [
              { label: 'Assigned', value: totals.assigned, icon: Send, tab: 'library' },
              { label: 'Open / in progress', value: totals.open, icon: Clock, tab: 'library' },
              { label: 'Need evaluation', value: totals.review, icon: FileEdit, tab: 'queue' },
              { label: 'Integrity flags', value: totals.flagged, icon: Flag, tab: 'library' },
              { label: 'Graded', value: totals.graded, icon: CheckCircle2, tab: 'library' },
            ];
            return (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {cards.map((card) => (
                  <button
                    key={card.label}
                    type="button"
                    onClick={() => setTab(card.tab)}
                    className={`card-ats p-3.5 text-left relative hover:border-brand-200/80 ${tab === card.tab && card.tab === 'queue' ? 'border-brand-200' : ''}`}
                  >
                    <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 opacity-70 pointer-events-none" />
                    <div className="flex items-center gap-2.5 pt-0.5">
                      <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-50 to-teal-50 text-brand-700 ring-1 ring-brand-200/60 flex items-center justify-center flex-shrink-0">
                        <card.icon className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 leading-tight">{card.label}</p>
                        <p className="text-lg font-bold tabular-nums text-stone-900">{card.value}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            );
          })()}

          <div
            data-tour="assess-tip"
            className="rounded-xl border border-stone-200 bg-white px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-[13px] text-stone-600 leading-relaxed flex flex-wrap items-center gap-x-3 gap-y-1.5"
          >
            <span className="inline-flex items-center gap-1.5 text-brand-700 font-semibold">
              <Info size={14} /> Tip
            </span>
            <span>
              Sending an invite never locks the test. You can still edit, duplicate, invite more people, or delete. Candidates who already started keep their frozen version.
              Press <span className="font-semibold text-stone-800">?</span> for a tour.
            </span>
          </div>

          <section
            data-tour="assess-filters"
            className="rounded-xl border border-stone-200/90 bg-white shadow-sm relative"
          >
            <div className="absolute inset-x-0 top-0 h-1 rounded-t-xl bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 pointer-events-none" />
            <div className="p-3 sm:p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Filter size={15} className="text-brand-600 flex-shrink-0" />
                <p className="text-sm font-bold text-stone-900 tracking-tight">
                  {tab === 'library' ? 'Find assessments' : tab === 'queue' ? 'Evaluation queue' : tab === 'bank' ? 'Question bank' : 'Company policies'}
                </p>
              </div>
              <div className="flex overflow-x-auto scrollbar-hide gap-1 -mx-1 px-1">
                {LIBRARY_TABS.filter((item) => {
                  if (item.id === 'bank') return canEdit;
                  if (item.id === 'settings') return canSettings;
                  if (item.id === 'queue') return true;
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
              {tab === 'library' ? (
                <div className="flex flex-col lg:flex-row lg:items-end gap-3">
                  <div className="flex-1 min-w-0">
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
                  <div className="flex rounded-xl bg-stone-50 p-1 gap-0.5">
                    {[
                      ['active', 'Live'],
                      ['archived', 'Archived'],
                      ['all', 'All'],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setLibrary(key)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold ${library === key ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200/70' : 'text-stone-500 hover:text-stone-700'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="w-full sm:w-52">
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
              ) : null}
            </div>
          </section>

          {tab === 'queue' ? (
            <EvaluationQueuePanel onGrade={openQueueGrade} canGrade={canGrade} />
          ) : null}
          {tab === 'bank' && canEdit ? <QuestionBankPanel /> : null}
          {tab === 'settings' && canSettings ? <AssessmentSettingsPanel /> : null}

          {tab === 'library' ? (
          <>

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
                    {canCreate ? (
                    <button type="button" onClick={openCreate} className="btn-primary">
                      <Plus className="w-4 h-4" /> New Assessment
                    </button>
                    ) : null}
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
                action={canCreate ? (
                  <button type="button" onClick={openCreate} className="btn-primary">
                    <Plus className="w-4 h-4" /> New Assessment
                  </button>
                ) : null}
              />
            </div>
          ) : (
            <div className="space-y-4">
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
                      className="card-ats p-5 flex flex-col hover:border-brand-200/80 relative group"
                    >
                      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 opacity-80 pointer-events-none" />
                      <button
                        type="button"
                        onClick={() => setActive(a)}
                        className="text-left min-w-0 flex-1"
                      >
                        <div className="flex items-start justify-between gap-2 pt-1">
                          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-100 to-teal-100 text-brand-700 flex items-center justify-center ring-1 ring-brand-200/60 flex-shrink-0">
                            {a.proctoring?.enabled
                              ? <Shield className="w-5 h-5" />
                              : <ClipboardList className="w-5 h-5" />}
                          </div>
                          <span className="badge-neutral flex-shrink-0">
                            {a.isActive === false || a.status === 'archived' ? 'archived' : (a.status || 'draft')}
                          </span>
                        </div>
                        <h3 className="font-bold text-stone-900 mt-3.5 tracking-tight line-clamp-2 break-words">{a.title}</h3>
                        {a.description && (
                          <p className="text-sm text-stone-500 mt-1 line-clamp-2 leading-relaxed">{a.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 mt-4 text-xs font-semibold text-stone-500">
                          <span className="inline-flex items-center gap-1"><ClipboardList className="w-3.5 h-3.5" /> {a.questions?.length || 0} questions</span>
                          <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {a.durationMinutes} min</span>
                        </div>
                        <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
                          {[
                            ['Sent', a.inviteStats?.total || 0],
                            ['Open', (a.inviteStats?.pending || 0) + (a.inviteStats?.in_progress || 0)],
                            ['Done', a.inviteStats?.submitted || 0],
                            ['Graded', a.inviteStats?.graded || 0],
                          ].map(([label, value]) => (
                            <div key={label} className="rounded-xl bg-stone-50/80 border border-stone-100 px-1 py-1.5">
                              <p className="text-[10px] uppercase tracking-wide text-stone-400">{label}</p>
                              <p className="text-sm font-bold text-stone-800 tabular-nums">{value}</p>
                            </div>
                          ))}
                        </div>
                      </button>
                      <div className="mt-4 pt-3 border-t border-stone-100 flex flex-wrap items-center gap-1.5">
                        {canEdit ? (
                          <button type="button" onClick={() => openEdit(a)} className={`${actionBtn} text-stone-500 hover:text-brand-600 hover:border-brand-300`} title="Edit" aria-label="Edit">
                            <Pencil size={14} />
                          </button>
                        ) : null}
                        {canCreate ? (
                          <button type="button" onClick={() => duplicate(a)} className={`${actionBtn} text-stone-500 hover:text-brand-600 hover:border-brand-300`} title="Duplicate" aria-label="Duplicate">
                            <Copy size={14} />
                          </button>
                        ) : null}
                        {canInvite ? (
                          <button type="button" onClick={() => setActive(a)} className={`${actionBtn} text-stone-500 hover:text-brand-600 hover:border-brand-300`} title="Open & invite" aria-label="Invite">
                            <Send size={14} />
                          </button>
                        ) : null}
                        {canDelete ? (
                          <button type="button" onClick={() => setDeleteTarget(a)} className={`${actionBtn} ml-auto text-stone-400 hover:text-red-600 hover:border-red-200`} title="Delete" aria-label="Delete">
                            <Trash2 size={14} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          </>
          ) : null}
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
        message={`Delete “${deleteTarget?.title}”? Unstarted invite links will be revoked. Candidates who already started or submitted keep their attempt.`}
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
