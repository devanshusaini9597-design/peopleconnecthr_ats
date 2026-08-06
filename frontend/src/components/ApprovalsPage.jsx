import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ClipboardList, Plus, RefreshCw } from 'lucide-react';
import { authenticatedFetch, readApiJson } from '../utils/fetchUtils';
import { useToast } from './Toast';
import PageHeader from './ui/PageHeader';
import ConfirmationModal from './ConfirmationModal';
import FeatureGate from './FeatureGate';
import UpgradeFeatureFallback from './ui/UpgradeFeatureFallback';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';
import {
  APPR_TOUR_KEY,
  APPR_TOUR_STEPS,
  EMPTY_WORKFLOW_FORM,
} from './approvals/approvalsConstants';
import OfferTemplatesSection from './approvals/OfferTemplatesSection';
import { WorkflowsPanel, PendingApprovalsPanel } from './approvals/ApprovalsPanels';
import WorkflowCreateModal from './approvals/WorkflowCreateModal';

export default function ApprovalsPage() {
  const toast = useToast();
  const [tourOpen, setTourOpen] = usePageTour(APPR_TOUR_KEY);
  const [workflows, setWorkflows] = useState([]);
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wfModal, setWfModal] = useState(false);
  const [wfForm, setWfForm] = useState(() => ({
    ...EMPTY_WORKFLOW_FORM,
    steps: [{ order: 0, name: 'Manager approval', approverRole: 'admin' }],
  }));
  const [saving, setSaving] = useState(false);
  const [actionTarget, setActionTarget] = useState(null);
  const [acting, setActing] = useState(false);

  const pending = useMemo(
    () => instances.filter((i) => i.status === 'pending'),
    [instances]
  );

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

  const saveWorkflow = async (e) => {
    e?.preventDefault?.();
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
      setWfForm({ ...EMPTY_WORKFLOW_FORM, steps: [{ order: 0, name: 'Manager approval', approverRole: 'admin' }] });
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmAct = async () => {
    if (!actionTarget) return;
    setActing(true);
    try {
      const res = await authenticatedFetch(
        `/api/approvals/instances/${actionTarget.id}/${actionTarget.action}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comment: '' })
        }
      );
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      toast.success(actionTarget.action === 'approve' ? 'Approved' : 'Rejected');
      setActionTarget(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActing(false);
    }
  };

  return (
    <FeatureGate
      feature="workflows.approvals"
      fallback={
        <UpgradeFeatureFallback
          title="Approval workflows are an Enterprise feature"
          description="Upgrade to Enterprise to define multi-step approvals for job requisitions and offers."
        />
      }
    >
      <div className="page-shell-ats animate-page-enter">
        <PageHeader
          title="Approval workflows"
          subtitle="Define multi-step approvals for job requisitions and offers."
          icon={ClipboardList}
          gradientTitle
        >
          <button type="button" onClick={load} className="btn-secondary w-full sm:w-auto" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            data-tour="appr-create"
            type="button"
            onClick={() => setWfModal(true)}
            className="btn-primary w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" /> New workflow
          </button>
        </PageHeader>

        <div className="rounded-xl border border-brand-200/60 bg-gradient-to-r from-brand-50/70 via-white to-teal-50/40 px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed">
          Build approval chains, then approve or reject pending items from one place.
          Press <span className="font-semibold text-stone-800">?</span> bottom-right for a tour.
        </div>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-6 h-56 skeleton-ats rounded-2xl" />
            <div className="lg:col-span-6 h-56 skeleton-ats rounded-2xl" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            <WorkflowsPanel workflows={workflows} onCreate={() => setWfModal(true)} />
            <PendingApprovalsPanel pending={pending} onAction={setActionTarget} />
          </div>
        )}

        <FeatureGate
          feature="offers.templates"
          fallback={
            <UpgradeFeatureFallback
              title="Offer templates"
              description="Upgrade to create reusable offer letter and email templates with merge fields."
            />
          }
        >
          <OfferTemplatesSection />
        </FeatureGate>

        <WorkflowCreateModal
          open={wfModal}
          saving={saving}
          wfForm={wfForm}
          setWfForm={setWfForm}
          onClose={() => setWfModal(false)}
          onSubmit={saveWorkflow}
        />

        <ConfirmationModal
          isOpen={!!actionTarget}
          onClose={() => setActionTarget(null)}
          onConfirm={confirmAct}
          title={actionTarget?.action === 'approve' ? 'Approve this request?' : 'Reject this request?'}
          message={`${actionTarget?.action === 'approve' ? 'Approve' : 'Reject'} “${actionTarget?.label || 'this item'}”?`}
          confirmText={actionTarget?.action === 'approve' ? 'Approve' : 'Reject'}
          type={actionTarget?.action === 'approve' ? 'warning' : 'delete'}
          isLoading={acting}
        />

        <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of Approvals" />
        <ProductTour open={tourOpen} onClose={() => setTourOpen(false)} steps={APPR_TOUR_STEPS} storageKey={APPR_TOUR_KEY} />
      </div>
    </FeatureGate>
  );
}
