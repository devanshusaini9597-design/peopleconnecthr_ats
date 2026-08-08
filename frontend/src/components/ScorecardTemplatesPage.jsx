import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Award, Plus, RefreshCw } from 'lucide-react';
import { authenticatedFetch, readApiJson } from '../utils/fetchUtils';
import { useToast } from './Toast';
import PageHeader from './ui/PageHeader';
import FeatureGate from './FeatureGate';
import UpgradeFeatureFallback from './ui/UpgradeFeatureFallback';
import ConfirmationModal from './ConfirmationModal';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';
import { SC_TOUR_KEY, SC_TOUR_STEPS, emptyForm } from './scorecardTemplates/scorecardConstants';
import { ScorecardCatalog, ScorecardFormModal } from './scorecardTemplates/ScorecardPanels';

export default function ScorecardTemplatesPage() {
  const toast = useToast();
  const [tourOpen, setTourOpen] = usePageTour(SC_TOUR_KEY);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [criterionDeleteIdx, setCriterionDeleteIdx] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch('/api/scorecard-templates');
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      setRows(data.data || []);
    } catch (e) {
      toast.error(e.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const catalogMeta = useMemo(() => {
    if (loading) return 'Loading…';
    if (rows.length === 0) return 'Nothing here yet';
    return `${rows.length} template${rows.length === 1 ? '' : 's'}`;
  }, [loading, rows.length]);

  const openCreate = () => {
  const { t } = useTranslation();
    setEditId(null);
    setForm(emptyForm());
    setOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setOpen(false);
    setEditId(null);
    setForm(emptyForm());
    setCriterionDeleteIdx(null);
  };

  const openEdit = (row) => {
    setEditId(row._id);
    setForm({
      name: row.name || '',
      description: row.description || '',
      criteria: (row.criteria?.length ? row.criteria : emptyForm().criteria).map((c) => ({
        name: c.name || '',
        weight: c.weight ?? 1,
        description: c.description || '',
        suggestedQuestions: c.suggestedQuestions || []
      }))
    });
    setOpen(true);
  };

  const save = async (e) => {
    e?.preventDefault?.();
    if (!form.name.trim()) {
      toast.error('Template name is required');
      return;
    }
    if (!form.criteria.every((c) => c.name.trim())) {
      toast.error('Every criterion needs a name');
      return;
    }
    setSaving(true);
    try {
      const res = await authenticatedFetch(
        editId ? `/api/scorecard-templates/${editId}` : '/api/scorecard-templates',
        {
          method: editId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form)
        }
      );
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      toast.success(editId ? 'Template updated' : 'Template created');
      closeModal();
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await authenticatedFetch(`/api/scorecard-templates/${deleteTarget._id}`, { method: 'DELETE' });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      toast.success('Template deleted');
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const updateCriterion = (idx, patch) => {
    setForm((prev) => ({
      ...prev,
      criteria: prev.criteria.map((c, i) => (i === idx ? { ...c, ...patch } : c))
    }));
  };

  const confirmRemoveCriterion = () => {
    if (criterionDeleteIdx == null) return;
    setForm((prev) => ({
      ...prev,
      criteria: prev.criteria.filter((_, i) => i !== criterionDeleteIdx)
    }));
    setCriterionDeleteIdx(null);
  };

  return (
    <FeatureGate
      feature="scorecards.templates"
      fallback={
        <UpgradeFeatureFallback
          title="Scorecard templates are a Professional feature"
          description="Upgrade to create reusable weighted interview criteria for consistent hiring."
        />
      }
    >
      <div className="page-shell-ats animate-page-enter">
        <PageHeader
          icon={Award}
          title={t('pages.scorecardTemplates.title')}
          subtitle={t('pages.scorecardTemplates.subtitle')}
          gradientTitle
        >
          <button type="button" onClick={load} className="btn-secondary w-full sm:w-auto" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            data-tour="sc-create"
            type="button"
            className="btn-primary w-full sm:w-auto"
            onClick={openCreate}
          >
            <Plus className="w-4 h-4" /> New template
          </button>
        </PageHeader>

        <div className="rounded-xl border border-brand-200/60 bg-gradient-to-r from-brand-50/70 via-white to-teal-50/40 px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed">
          Weight criteria so important skills count more in interview scoring.
          Press <span className="font-semibold text-stone-800">?</span> bottom-right for a tour.
        </div>

        <ScorecardCatalog
          loading={loading}
          catalogMeta={catalogMeta}
          rows={rows}
          openCreate={openCreate}
          openEdit={openEdit}
          setDeleteTarget={setDeleteTarget}
        />

        <ScorecardFormModal
          open={open}
          closeModal={closeModal}
          editId={editId}
          saving={saving}
          form={form}
          setForm={setForm}
          save={save}
          updateCriterion={updateCriterion}
          setCriterionDeleteIdx={setCriterionDeleteIdx}
        />

        <ConfirmationModal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={remove}
          title="Delete template?"
          message={`Delete “${deleteTarget?.name || 'this template'}”? This cannot be undone.`}
          confirmText="Delete template"
          type="delete"
          isLoading={deleting}
        />

        <ConfirmationModal
          isOpen={criterionDeleteIdx != null}
          onClose={() => setCriterionDeleteIdx(null)}
          onConfirm={confirmRemoveCriterion}
          title="Remove criterion?"
          message={`Remove “${form.criteria[criterionDeleteIdx]?.name || 'this criterion'}” from the template?`}
          confirmText="Remove"
          type="delete"
        />

        <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of Scorecard Templates" />
        <ProductTour
          open={tourOpen}
          onClose={() => setTourOpen(false)}
          steps={SC_TOUR_STEPS}
          storageKey={SC_TOUR_KEY}
        />
      </div>
    </FeatureGate>
  );
}
