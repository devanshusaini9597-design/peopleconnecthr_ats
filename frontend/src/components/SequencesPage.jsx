import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MailPlus, Plus, Loader2, Play, Trash2, Users,
  RefreshCw, Layers, Clock
} from 'lucide-react';
import { authenticatedFetch, readApiJson } from '../utils/fetchUtils';
import { useToast } from './Toast';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import FeatureGate from './FeatureGate';
import UpgradeFeatureFallback from './ui/UpgradeFeatureFallback';
import ConfirmationModal from './ConfirmationModal';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';
import {
  SEQ_TOUR_KEY,
  SEQ_TOUR_STEPS,
  EMPTY_FORM,
  channelIcon,
} from './sequences/sequencesConstants';
import SequenceCreateModal from './sequences/SequenceCreateModal';
import SequenceEnrollModal from './sequences/SequenceEnrollModal';

export default function SequencesPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [tourOpen, setTourOpen] = usePageTour(SEQ_TOUR_KEY);
  const [sequences, setSequences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [enrollOpen, setEnrollOpen] = useState(null);
  const [candidateQuery, setCandidateQuery] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidates, setSelectedCandidates] = useState(new Set());
  const [enrolling, setEnrolling] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const enrollSequence = useMemo(
    () => sequences.find((s) => s._id === enrollOpen),
    [sequences, enrollOpen]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch('/api/sequences');
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      setSequences(data.data || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load sequences');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const closeCreate = () => {
    if (saving) return;
    setShowCreate(false);
    setForm(EMPTY_FORM);
  };

  const createSequence = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await authenticatedFetch('/api/sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      toast.success('Sequence created');
      closeCreate();
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget?._id) return;
    setDeleting(true);
    try {
      const res = await authenticatedFetch(`/api/sequences/${deleteTarget._id}`, { method: 'DELETE' });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      toast.success('Sequence deleted');
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const processDue = async () => {
    setProcessing(true);
    try {
      const res = await authenticatedFetch('/api/sequences/process', { method: 'POST' });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      toast.success(`Processed ${data.processed} step(s)${data.errors ? `, ${data.errors} error(s)` : ''}`);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const searchCandidates = async (q) => {
    setCandidateQuery(q);
    if (!q.trim()) {
      setCandidates([]);
      return;
    }
    try {
      const res = await authenticatedFetch(`/candidates?search=${encodeURIComponent(q.trim())}&limit=20`);
      const data = await readApiJson(res);
      const list = data.data || data.candidates || data || [];
      setCandidates(Array.isArray(list) ? list : []);
    } catch {
      setCandidates([]);
    }
  };

  const closeEnroll = () => {
    if (enrolling) return;
    setEnrollOpen(null);
    setSelectedCandidates(new Set());
    setCandidates([]);
    setCandidateQuery('');
  };

  const enroll = async () => {
    if (!enrollOpen || selectedCandidates.size === 0) return;
    setEnrolling(true);
    try {
      const res = await authenticatedFetch(`/api/sequences/${enrollOpen}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateIds: [...selectedCandidates] })
      });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      toast.success(`Enrolled ${data.enrolled} candidate(s)`);
      closeEnroll();
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEnrolling(false);
    }
  };

  const updateStep = (idx, patch) => {
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.map((s, i) => (i === idx ? { ...s, ...patch } : s))
    }));
  };

  const catalogMeta = loading
    ? 'Loading…'
    : sequences.length === 0
      ? 'Nothing here yet'
      : `${sequences.length} sequence${sequences.length === 1 ? '' : 's'}`;

  return (
    <FeatureGate
      feature="messaging.sequences"
      fallback={
        <UpgradeFeatureFallback
          title="Sequences are a Professional feature"
          description="Upgrade to run multi-step email, SMS, and WhatsApp outreach with delays."
        />
      }
    >
      <div className="page-shell-ats animate-page-enter">
        <PageHeader
          icon={MailPlus}
          title={t('pages.sequences.title')}
          subtitle="Multi-step outreach with delays across email, SMS, and WhatsApp."
          gradientTitle
        >
          <button type="button" onClick={load} className="btn-secondary w-full sm:w-auto" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            data-tour="seq-run"
            type="button"
            onClick={processDue}
            disabled={processing}
            className="btn-secondary w-full sm:w-auto"
          >
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Run due steps
          </button>
          <button
            data-tour="seq-create"
            type="button"
            onClick={() => setShowCreate(true)}
            className="btn-primary w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            New sequence
          </button>
        </PageHeader>

        <div className="rounded-xl border border-brand-200/60 bg-gradient-to-r from-brand-50/70 via-white to-teal-50/40 px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed">
          Personalize messages by clicking tags like <span className="font-semibold text-stone-800">Candidate name</span> while writing — no coding needed.
          Enroll candidates, then run due steps when messages are ready. Press{' '}
          <span className="font-semibold text-stone-800">?</span> bottom-right for a tour.
        </div>

        <div data-tour="seq-catalog" className="card-ats-bordered relative overflow-hidden min-h-[32rem] flex flex-col">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <div className="relative px-4 sm:px-5 pt-4 pb-3 border-b border-stone-100 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[15px] font-bold text-stone-900 tracking-tight">Sequence library</h2>
              <p className="text-[11px] text-stone-400 mt-0.5">{catalogMeta}</p>
            </div>
            <span className="badge-neutral text-[10px] flex-shrink-0 inline-flex items-center gap-1">
              <Layers className="w-3 h-3" /> Catalog
            </span>
          </div>

          <div className="relative flex-1 p-3.5 sm:p-5 bg-[linear-gradient(180deg,#fafaf9_0%,#ffffff_40%)]">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-52 skeleton-ats rounded-2xl" />
                ))}
              </div>
            ) : sequences.length === 0 ? (
              <div className="h-full min-h-[20rem] flex items-center justify-center">
                <EmptyState
                  icon={MailPlus}
                  tone="brand"
                  message="No sequences yet"
                  subMessage="Create a drip sequence to nurture candidates automatically."
                  action={(
                    <button type="button" onClick={() => setShowCreate(true)} className="btn-primary">
                      <Plus className="w-4 h-4" /> Create sequence
                    </button>
                  )}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {sequences.map((seq) => (
                  <article
                    key={seq._id}
                    className="rounded-2xl border border-stone-200/80 bg-white p-4 flex flex-col shadow-[0_1px_0_rgba(28,25,23,0.03)] hover:border-stone-300/90 transition-colors min-w-0"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-stone-900 tracking-tight truncate">{seq.name}</h3>
                        <p className="text-[11px] text-stone-500 mt-1 line-clamp-2 leading-relaxed">
                          {seq.description || 'No description'}
                        </p>
                      </div>
                      <span className={`flex-shrink-0 ${seq.isActive ? 'badge-success' : 'badge-neutral'}`}>
                        {seq.isActive ? 'Active' : 'Paused'}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
                      <span className="badge-brand">{seq.steps?.length || 0} steps</span>
                      <span className="badge-neutral capitalize">
                        {(seq.triggerType || 'manual').replace(/_/g, ' ')}
                      </span>
                      <span className="badge-neutral">{seq.activeCount || 0} active</span>
                      <span className="badge-neutral">{seq.enrollmentCount || 0} enrolled</span>
                    </div>

                    <div className="mt-3 space-y-1.5 flex-1">
                      {(seq.steps || []).slice(0, 3).map((step, i) => {
                        const Icon = channelIcon(step.channel);
                        return (
                          <div
                            key={i}
                            className="rounded-xl bg-stone-50/90 border border-stone-100 px-2.5 py-2 flex items-center gap-2 text-[11px] text-stone-600 min-w-0"
                          >
                            <span className="w-6 h-6 rounded-lg bg-white border border-stone-200 flex items-center justify-center flex-shrink-0 text-stone-500">
                              <Icon className="w-3 h-3" />
                            </span>
                            <span className="inline-flex items-center gap-1 text-stone-500 flex-shrink-0">
                              <Clock className="w-3 h-3" /> Day {step.delayDays ?? 0}
                            </span>
                            <span className="truncate text-stone-700 font-medium">
                              {step.subject || step.body?.slice(0, 42) || 'Message'}
                            </span>
                          </div>
                        );
                      })}
                      {(seq.steps?.length || 0) > 3 && (
                        <p className="text-[10px] text-stone-400 px-1">
                          +{seq.steps.length - 3} more step{seq.steps.length - 3 === 1 ? '' : 's'}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-stone-100 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEnrollOpen(seq._id);
                          setSelectedCandidates(new Set());
                          setCandidates([]);
                          setCandidateQuery('');
                        }}
                        className="btn-primary flex-1 !py-2 !text-xs"
                      >
                        <Users className="w-3.5 h-3.5" />
                        Enroll
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(seq)}
                        className="inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-stone-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors"
                        aria-label="Delete sequence"
                        title="Delete sequence"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>

        <SequenceCreateModal
          open={showCreate}
          onClose={closeCreate}
          form={form}
          setForm={setForm}
          updateStep={updateStep}
          onSubmit={createSequence}
          saving={saving}
        />

        <SequenceEnrollModal
          open={!!enrollOpen}
          onClose={closeEnroll}
          sequenceName={enrollSequence?.name}
          candidateQuery={candidateQuery}
          candidates={candidates}
          selectedCandidates={selectedCandidates}
          setSelectedCandidates={setSelectedCandidates}
          onSearch={searchCandidates}
          onEnroll={enroll}
          enrolling={enrolling}
        />

        <ConfirmationModal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
          title="Delete sequence?"
          message={`Delete “${deleteTarget?.name || 'this sequence'}”? Active enrollments for this sequence will stop.`}
          confirmText="Delete sequence"
          type="delete"
          isLoading={deleting}
        />

        <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of Sequences" />
        <ProductTour
          open={tourOpen}
          onClose={() => setTourOpen(false)}
          steps={SEQ_TOUR_STEPS}
          storageKey={SEQ_TOUR_KEY}
        />
      </div>
    </FeatureGate>
  );
}
