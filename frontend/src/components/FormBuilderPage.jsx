import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FormInput, Loader2, Save, RefreshCw } from 'lucide-react';
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
  FORM_TOUR_KEY,
  FORM_TOUR_STEPS,
  emptyField,
  DEFAULT_FIELDS,
} from './formBuilder/formBuilderConstants';
import FormSettingsPanel from './formBuilder/FormSettingsPanel';
import FormFieldCanvas from './formBuilder/FormFieldCanvas';
import FormPreviewPanel from './formBuilder/FormPreviewPanel';

export default function FormBuilderPage() {
  const toast = useToast();
  const [tourOpen, setTourOpen] = usePageTour(FORM_TOUR_KEY);
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobId, setJobId] = useState('');
  const [title, setTitle] = useState('Application Form');
  const [fields, setFields] = useState([emptyField()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removeFormOpen, setRemoveFormOpen] = useState(false);
  const [removingForm, setRemovingForm] = useState(false);
  const [fieldDeleteIdx, setFieldDeleteIdx] = useState(null);

  const jobOptions = useMemo(
    () => jobs.map((j) => ({
      value: j._id,
      label: j.title || 'Untitled job',
      description: j.status ? String(j.status) : 'Job posting'
    })),
    [jobs]
  );

  const selectedJob = useMemo(() => jobs.find((j) => j._id === jobId), [jobs, jobId]);

  const loadJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      const res = await authenticatedFetch('/jobs');
      const data = await readApiJson(res);
      const list = data.data || data.jobs || data || [];
      const arr = Array.isArray(list) ? list : [];
      setJobs(arr);
      setJobId((prev) => prev || arr[0]?._id || '');
    } catch {
      toast.error('Failed to load jobs');
    } finally {
      setJobsLoading(false);
    }
  }, [toast]);

  const loadForm = useCallback(async () => {
    if (!jobId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await authenticatedFetch(`/api/forms/job/${jobId}`);
      const data = await readApiJson(res);
      if (data.success && data.data) {
        setTitle(data.data.title || 'Application Form');
        setFields(data.data.fields?.length ? data.data.fields : [emptyField()]);
      } else {
        setTitle('Application Form');
        setFields(DEFAULT_FIELDS.map((f) => ({ ...f, showWhen: { fieldKey: '', equals: '' } })));
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load form');
    } finally {
      setLoading(false);
    }
  }, [jobId, toast]);

  useEffect(() => { loadJobs(); }, [loadJobs]);
  useEffect(() => { loadForm(); }, [loadForm]);

  const updateField = (idx, patch) => {
    setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const save = async () => {
    if (!jobId) return;
    if (!fields.every((f) => f.label.trim())) {
      toast.error('Every field needs a label');
      return;
    }
    setSaving(true);
    try {
      const res = await authenticatedFetch(`/api/forms/job/${jobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, fields, isActive: true })
      });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      toast.success('Application form saved');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmRemoveForm = async () => {
    if (!jobId) return;
    setRemovingForm(true);
    try {
      const res = await authenticatedFetch(`/api/forms/job/${jobId}`, { method: 'DELETE' });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      toast.success('Custom form removed — using default apply form');
      setRemoveFormOpen(false);
      await loadForm();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRemovingForm(false);
    }
  };

  const confirmRemoveField = () => {
    if (fieldDeleteIdx == null) return;
    setFields((prev) => prev.filter((_, i) => i !== fieldDeleteIdx));
    setFieldDeleteIdx(null);
  };

  return (
    <FeatureGate
      feature="careers.formBuilder"
      fallback={
        <UpgradeFeatureFallback
          title="Form builder is a Professional feature"
          description="Upgrade to create custom application forms per job on your careers page."
        />
      }
    >
      <div className="page-shell-ats animate-page-enter">
        <PageHeader
          icon={FormInput}
          title="Application Forms"
          subtitle="Build custom careers apply forms per job."
          gradientTitle
        >
          <button type="button" onClick={loadForm} className="btn-secondary w-full sm:w-auto" disabled={loading || !jobId}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            data-tour="form-save"
            type="button"
            onClick={save}
            disabled={saving || !jobId || loading}
            className="btn-primary w-full sm:w-auto"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save form
          </button>
        </PageHeader>

        <div className="rounded-xl border border-brand-200/60 bg-gradient-to-r from-brand-50/70 via-white to-teal-50/40 px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed">
          Forms attach to a <span className="font-semibold text-stone-900">job</span> and appear on the public careers apply page.
          Use show-when for conditional questions. Press <span className="font-semibold text-stone-800">?</span> bottom-right for a tour.
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          <FormSettingsPanel
            jobId={jobId}
            setJobId={setJobId}
            title={title}
            setTitle={setTitle}
            jobOptions={jobOptions}
            jobsLoading={jobsLoading}
            jobs={jobs}
            selectedJob={selectedJob}
            onRemoveForm={() => setRemoveFormOpen(true)}
          />
          <FormFieldCanvas
            jobId={jobId}
            loading={loading}
            fields={fields}
            setFields={setFields}
            updateField={updateField}
            onRequestDeleteField={setFieldDeleteIdx}
          />
          <FormPreviewPanel
            jobId={jobId}
            loading={loading}
            title={title}
            fields={fields}
            jobTitle={selectedJob?.title}
          />
        </div>

        <ConfirmationModal
          isOpen={removeFormOpen}
          onClose={() => setRemoveFormOpen(false)}
          onConfirm={confirmRemoveForm}
          title="Remove custom form?"
          message="This job will fall back to the default careers apply form. You can build a new custom form anytime."
          confirmText="Remove form"
          type="delete"
          isLoading={removingForm}
        />

        <ConfirmationModal
          isOpen={fieldDeleteIdx != null}
          onClose={() => setFieldDeleteIdx(null)}
          onConfirm={confirmRemoveField}
          title="Remove field?"
          message={`Remove “${fields[fieldDeleteIdx]?.label || 'this field'}” from the form?`}
          confirmText="Remove field"
          type="delete"
        />

        <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of Form Builder" />
        <ProductTour open={tourOpen} onClose={() => setTourOpen(false)} steps={FORM_TOUR_STEPS} storageKey={FORM_TOUR_KEY} />
      </div>
    </FeatureGate>
  );
}
