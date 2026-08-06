import React, { useState, useEffect, useCallback } from 'react';
import { Webhook, RefreshCw, Shield } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import ConfirmationModal from './ConfirmationModal';
import UpgradeFeatureFallback from './ui/UpgradeFeatureFallback';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';
import { authenticatedFetch, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import { useAuth } from '../context/AuthContext';
import { planHasFeature } from '../config/planFeatures';
import { WH_TOUR_KEY, WH_TOUR_STEPS } from './webhooksApi/webhooksApiConstants';
import SecretRevealModal from './webhooksApi/SecretRevealModal';
import WebhookModal from './webhooksApi/WebhookModal';
import ApiKeyModal from './webhooksApi/ApiKeyModal';
import WebhookEndpointsPanel from './webhooksApi/WebhookEndpointsPanel';
import ApiKeysPanel from './webhooksApi/ApiKeysPanel';

export default function WebhooksApiPage() {
  const toast = useToast();
  const { organization } = useAuth();
  const [tourOpen, setTourOpen] = usePageTour(WH_TOUR_KEY);
  const canWrite = planHasFeature(organization?.plan, 'integrations.webhooksFull');
  const [loading, setLoading] = useState(true);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [endpoints, setEndpoints] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [availableEvents, setAvailableEvents] = useState([]);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [revealSecret, setRevealSecret] = useState(null);
  const [expandedEndpoint, setExpandedEndpoint] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [webhooksRes, keysRes, eventsRes] = await Promise.all([
        authenticatedFetch('/api/webhooks'),
        authenticatedFetch('/api/api-keys'),
        authenticatedFetch('/api/webhooks/available-events')
      ]);
      if (webhooksRes.status === 401) return handleUnauthorized();

      const webhooksData = await webhooksRes.json();
      if (webhooksRes.status === 403 && webhooksData.code === 'UPGRADE_REQUIRED') {
        setUpgradeRequired(true);
        return;
      }
      if (webhooksData.success) setEndpoints(webhooksData.data || []);

      const keysData = await keysRes.json();
      if (keysData.success) setApiKeys(keysData.data || []);

      const eventsData = await eventsRes.json();
      if (eventsData.success) setAvailableEvents(eventsData.data || []);
    } catch {
      toast?.error?.('Failed to load webhooks/API settings');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const createWebhook = async (form) => {
    setSaving(true);
    try {
      const res = await authenticatedFetch('/api/webhooks', { method: 'POST', body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Failed to create webhook');
        return;
      }
      setShowWebhookModal(false);
      toast?.success?.('Webhook endpoint created');
      setRevealSecret({ label: 'Webhook Signing Secret', value: data.plaintextSecret });
      load();
    } catch {
      toast?.error?.('Failed to create webhook');
    } finally {
      setSaving(false);
    }
  };

  const toggleWebhook = async (endpoint) => {
    const res = await authenticatedFetch(`/api/webhooks/${endpoint._id}`, { method: 'PUT', body: JSON.stringify({ isActive: !endpoint.isActive }) });
    const data = await res.json();
    if (data.success) load(); else toast?.error?.(data.message);
  };

  const rotateSecret = async (endpoint) => {
    setConfirmAction({
      type: 'warning',
      title: 'Rotate signing secret?',
      message: 'The old secret will stop working immediately.',
      confirmText: 'Rotate Secret',
      run: async () => {
        const res = await authenticatedFetch(`/api/webhooks/${endpoint._id}/rotate-secret`, { method: 'POST' });
        const data = await res.json();
        if (data.success) setRevealSecret({ label: 'New Signing Secret', value: data.plaintextSecret });
        else toast?.error?.(data.message);
      }
    });
  };

  const deleteWebhook = async (endpoint) => {
    setConfirmAction({
      type: 'delete',
      title: 'Delete webhook endpoint?',
      message: 'This endpoint will stop receiving events immediately.',
      confirmText: 'Delete Endpoint',
      run: async () => {
        const res = await authenticatedFetch(`/api/webhooks/${endpoint._id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) { toast?.success?.('Deleted'); load(); } else toast?.error?.(data.message);
      }
    });
  };

  const createApiKey = async (form) => {
    setSaving(true);
    try {
      const res = await authenticatedFetch('/api/api-keys', { method: 'POST', body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Failed to create API key');
        return;
      }
      setShowKeyModal(false);
      toast?.success?.('API key created');
      setRevealSecret({ label: 'API Key', value: data.plaintextKey });
      load();
    } catch {
      toast?.error?.('Failed to create API key');
    } finally {
      setSaving(false);
    }
  };

  const revokeApiKey = async (key) => {
    setConfirmAction({
      type: 'delete',
      title: 'Revoke API key?',
      message: `Revoke the "${key.name}" API key? It will stop working immediately.`,
      confirmText: 'Revoke Key',
      run: async () => {
        const res = await authenticatedFetch(`/api/api-keys/${key._id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) { toast?.success?.('Revoked'); load(); } else toast?.error?.(data.message);
      }
    });
  };

  const handleConfirm = async () => {
    if (!confirmAction?.run) return;
    setConfirmLoading(true);
    try {
      await confirmAction.run();
      setConfirmAction(null);
    } finally {
      setConfirmLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-shell-ats animate-page-enter">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl skeleton-ats flex-shrink-0" />
          <div className="space-y-2 flex-1 pt-1">
            <div className="h-7 w-48 skeleton-ats rounded-lg" />
            <div className="h-4 w-72 max-w-full skeleton-ats rounded-lg" />
          </div>
        </div>
        <div className="card-ats-bordered p-5 space-y-3 mt-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-14 skeleton-ats rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (upgradeRequired) {
    return (
      <UpgradeFeatureFallback
        title="Webhooks & Public API is a Professional+ feature"
        description="Upgrade to Professional for read-only webhooks/API access, or Enterprise for full read/write access."
      />
    );
  }

  return (
    <div className="page-shell-ats animate-page-enter">
      <PageHeader
        icon={Webhook}
        title="Webhooks & API"
        subtitle="Connect SkillNix to other tools — usually set up once by IT or an integration partner."
        gradientTitle
      >
        <button type="button" onClick={load} className="btn-secondary w-full sm:w-auto">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </PageHeader>

      <div className="rounded-xl border border-brand-200/60 bg-gradient-to-r from-brand-50/70 via-white to-teal-50/40 px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed">
        <span className="font-semibold text-stone-800">Who is this for?</span>{' '}
        IT teams, Zapier/Make setups, or vendors who sync data with your ATS.
        You can create endpoints and keys here without writing code — the other system does the technical work.
        Press <span className="font-semibold text-stone-800">?</span> for a tour.
      </div>

      <WebhookEndpointsPanel
        endpoints={endpoints}
        expandedEndpoint={expandedEndpoint}
        setExpandedEndpoint={setExpandedEndpoint}
        onNew={() => setShowWebhookModal(true)}
        onToggle={toggleWebhook}
        onRotateSecret={rotateSecret}
        onDelete={deleteWebhook}
      />

      <ApiKeysPanel
        apiKeys={apiKeys}
        onNew={() => setShowKeyModal(true)}
        onRevoke={revokeApiKey}
      />

      <div
        data-tour="wh-auth"
        className="rounded-xl border border-stone-200/80 bg-white px-4 py-3 flex flex-col sm:flex-row sm:items-start gap-2.5 text-[13px] text-stone-600"
      >
        <Shield className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed space-y-1 min-w-0">
          <p>
            <span className="font-semibold text-stone-800">Hand this to your developer / Zapier setup:</span>{' '}
            they use the API key as a password to read or write ATS data.
          </p>
          <p className="text-[12px] text-stone-400">
            Technical note:{' '}
            <code className="bg-stone-100 px-1.5 py-0.5 rounded-md font-mono text-[11px] text-stone-600">Authorization: Bearer your-key</code>
            {' '}on{' '}
            <code className="bg-stone-100 px-1.5 py-0.5 rounded-md font-mono text-[11px] text-stone-600">/api/v1/public/*</code>
          </p>
        </div>
      </div>

      <WebhookModal
        open={showWebhookModal}
        availableEvents={availableEvents}
        onClose={() => setShowWebhookModal(false)}
        onSave={createWebhook}
        saving={saving}
      />
      <ApiKeyModal
        open={showKeyModal}
        canWrite={canWrite}
        onClose={() => setShowKeyModal(false)}
        onSave={createApiKey}
        saving={saving}
      />
      <SecretRevealModal
        open={!!revealSecret}
        label={revealSecret?.label}
        value={revealSecret?.value}
        onClose={() => setRevealSecret(null)}
      />
      <ConfirmationModal
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirm}
        title={confirmAction?.title}
        message={confirmAction?.message}
        confirmText={confirmAction?.confirmText}
        type={confirmAction?.type || 'warning'}
        isLoading={confirmLoading}
      />

      <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of Webhooks & API" />
      <ProductTour
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        steps={WH_TOUR_STEPS}
        storageKey={WH_TOUR_KEY}
      />
    </div>
  );
}
