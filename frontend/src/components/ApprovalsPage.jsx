import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Plus, Check, X, Loader2, FileText, Lock } from 'lucide-react';
import { authenticatedFetch, readApiJson } from '../utils/fetchUtils';
import { useToast } from './Toast';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import Modal from './ui/Modal';
import FeatureGate from './FeatureGate';

const OfferTemplatesSection = () => {
  const toast = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', subject: '', body: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch('/api/offer-templates');
      const data = await readApiJson(res);
      if (data.success) setTemplates(data.data || []);
    } catch {
      toast.error('Failed to load offer templates');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await authenticatedFetch('/api/offer-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      toast.success('Template created');
      setModalOpen(false);
      setForm({ name: '', subject: '', body: '' });
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="section-title-ats !mb-0 !pb-0 !border-0">
          <FileText className="w-4 h-4 text-brand-600" />
          Offer templates
        </h2>
        <button type="button" onClick={() => setModalOpen(true)} className="btn-secondary text-sm w-full sm:w-auto">
          <Plus className="w-4 h-4" /> New template
        </button>
      </div>
      <p className="text-sm text-stone-500 mb-4 leading-relaxed">
        Use merge fields like {'{{candidate.name}}'}, {'{{job.title}}'}, {'{{offer.salary}}'}.
      </p>
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
        </div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={FileText}
          message="No offer templates yet"
          subMessage="Create a template for offer letters and emails."
          tone="brand"
          compact
        />
      ) : (
        <ul className="space-y-2">
          {templates.map((t) => (
            <li key={t._id} className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 hover:bg-brand-50/30 transition-colors">
              <p className="font-semibold text-stone-900">{t.name}</p>
              <p className="text-sm text-stone-500 truncate mt-0.5">{t.subject}</p>
            </li>
          ))}
        </ul>
      )}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New offer template"
        footer={
          <>
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="button" onClick={handleSave} disabled={saving || !form.name} className="btn-primary">
              {saving ? 'Saving…' : 'Create'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label-ats">Name</label>
            <input className="input-ats" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label-ats">Email subject</label>
            <input className="input-ats" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          </div>
          <div>
            <label className="label-ats">Body</label>
            <textarea className="textarea-ats min-h-[120px]" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </div>
        </div>
      </Modal>
    </div>
  );
};

const UpgradeFallback = () => (
  <div className="page-shell-ats animate-page-enter">
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center card-ats-bordered border-amber-200/80 bg-amber-50/40 p-8 sm:p-10 animate-slide-up relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600" />
        <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4 ring-4 ring-amber-100/60">
          <Lock className="w-7 h-7 text-amber-600" />
        </div>
        <h2 className="text-xl font-bold text-stone-900 tracking-tight">Approval workflows are an Enterprise feature</h2>
        <p className="text-stone-500 mt-2 text-sm leading-relaxed">
          Upgrade to Enterprise to define multi-step approvals for job requisitions and offers.
        </p>
        <a href="/billing" className="btn-primary inline-flex mt-6 w-full sm:w-auto">View Plans</a>
      </div>
    </div>
  </div>
);

export default function ApprovalsPage() {
  const toast = useToast();
  const [workflows, setWorkflows] = useState([]);
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wfModal, setWfModal] = useState(false);
  const [wfForm, setWfForm] = useState({ name: '', entityType: 'job_req', steps: [{ order: 0, name: 'Manager approval', approverRole: 'admin' }] });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [wfRes, instRes] = await Promise.all([
        authenticatedFetch('/api/approvals/workflows'),
        authenticatedFetch('/api/approvals/instances')
      ]);
      const wfData = await readApiJson(wfRes);
      const instData = await readApiJson(instRes);
      if (wfData.success) setWorkflows(wfData.data || []);
      if (instData.success) setInstances(instData.data || []);
    } catch {
      toast.error('Failed to load approvals');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const saveWorkflow = async () => {
    setSaving(true);
    try {
      const res = await authenticatedFetch('/api/approvals/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wfForm)
      });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      toast.success('Workflow created');
      setWfModal(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const actOnInstance = async (id, action) => {
    try {
      const res = await authenticatedFetch(`/api/approvals/instances/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: '' })
      });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      toast.success(action === 'approve' ? 'Approved' : 'Rejected');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <FeatureGate feature="workflows.approvals" fallback={<UpgradeFallback />}>
      <div className="page-shell-ats animate-page-enter pb-32 sm:pb-28">
        <PageHeader
          title="Approval workflows"
          subtitle="Define multi-step approvals for job requisitions and offers."
          icon={ClipboardList}
          gradientTitle
        >
          <button type="button" onClick={() => setWfModal(true)} className="btn-primary w-full sm:w-auto">
            <Plus className="w-4 h-4" /> New workflow
          </button>
        </PageHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
            <p className="text-sm text-stone-500">Loading approvals…</p>
          </div>
        ) : (
          <div className="space-y-8">
            <section className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
              <h2 className="section-title-ats">
                <ClipboardList className="w-4 h-4 text-brand-600" />
                Workflows
              </h2>
              {workflows.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  message="No workflows yet"
                  subMessage="Create a workflow for job reqs or offers."
                  tone="brand"
                  compact
                />
              ) : (
                <ul className="space-y-2">
                  {workflows.map((w) => (
                    <li
                      key={w._id}
                      className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-stone-900">{w.name}</p>
                        <p className="text-sm text-stone-500 mt-0.5">
                          {w.entityType} · {w.steps?.length || 0} steps
                        </p>
                      </div>
                      <span className={w.isActive ? 'badge-success self-start sm:self-auto' : 'badge-neutral self-start sm:self-auto'}>
                        {w.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
              <h2 className="section-title-ats">
                <Check className="w-4 h-4 text-brand-600" />
                Pending approvals
              </h2>
              {instances.filter((i) => i.status === 'pending').length === 0 ? (
                <EmptyState
                  icon={Check}
                  message="No pending approvals"
                  subMessage="You're all caught up — nothing needs your review."
                  tone="emerald"
                  compact
                />
              ) : (
                <ul className="space-y-3">
                  {instances.filter((i) => i.status === 'pending').map((inst) => (
                    <li key={inst._id} className="p-4 rounded-xl border border-stone-200 bg-stone-50/50">
                      <div className="flex flex-col gap-4">
                        <div className="min-w-0">
                          <p className="font-semibold text-stone-900">{inst.entityLabel || inst.entityType}</p>
                          <p className="text-sm text-stone-500 mt-0.5">
                            Step {(inst.currentStepIndex || 0) + 1} of {inst.steps?.length || 0}
                          </p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            type="button"
                            onClick={() => actOnInstance(inst._id, 'approve')}
                            className="btn-primary text-sm py-2.5 w-full sm:w-auto"
                          >
                            <Check className="w-4 h-4" /> Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => actOnInstance(inst._id, 'reject')}
                            className="btn-secondary text-sm py-2.5 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 w-full sm:w-auto"
                          >
                            <X className="w-4 h-4" /> Reject
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        <FeatureGate feature="offers.templates">
          <OfferTemplatesSection />
        </FeatureGate>

        <Modal
          open={wfModal}
          onClose={() => setWfModal(false)}
          title="New approval workflow"
          footer={
            <>
              <button type="button" onClick={() => setWfModal(false)} className="btn-secondary">Cancel</button>
              <button type="button" onClick={saveWorkflow} disabled={saving || !wfForm.name} className="btn-primary">
                {saving ? 'Saving…' : 'Create'}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="label-ats">Name</label>
              <input className="input-ats" value={wfForm.name} onChange={(e) => setWfForm({ ...wfForm, name: e.target.value })} />
            </div>
            <div>
              <label className="label-ats">Entity type</label>
              <select className="select-ats" value={wfForm.entityType} onChange={(e) => setWfForm({ ...wfForm, entityType: e.target.value })}>
                <option value="job_req">Job requisition</option>
                <option value="offer">Offer</option>
              </select>
            </div>
          </div>
        </Modal>
      </div>
    </FeatureGate>
  );
}
