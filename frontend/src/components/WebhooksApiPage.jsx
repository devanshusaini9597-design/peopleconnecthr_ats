import React, { useState, useEffect, useCallback } from 'react';
import { Webhook, KeyRound, Plus, Trash2, Copy, Loader2, Lock, RefreshCw, Power, ChevronDown, ChevronUp } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import Modal from './ui/Modal';
import ConfirmationModal from './ConfirmationModal';
import { authenticatedFetch, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import { useAuth } from '../context/AuthContext';
import { planHasFeature } from '../config/planFeatures';

const UpgradeBanner = ({ title, desc }) => (
  <div className="max-w-md w-full text-center card-ats-bordered border-amber-200/80 bg-amber-50/40 p-8 sm:p-10 mx-auto animate-slide-up">
    <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4 ring-4 ring-amber-100/60">
      <Lock className="w-7 h-7 text-amber-600" />
    </div>
    <h2 className="text-xl font-bold text-stone-900 tracking-tight">{title}</h2>
    <p className="text-stone-500 mt-2 text-sm leading-relaxed">{desc}</p>
    <a href="/billing" className="btn-primary inline-flex mt-6">View Plans</a>
  </div>
);

const SecretRevealModal = ({ open, label, value, onClose }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  useEffect(() => {
    if (open) setCopied(false);
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={label}
      description="Copy this now — it will never be shown again."
      size="md"
      footer={
        <button type="button" onClick={onClose} className="btn-primary w-full sm:w-auto">Done</button>
      }
    >
      <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-xl p-3">
        <code className="text-sm text-stone-800 break-all flex-1 font-mono">{value}</code>
        <button type="button" onClick={copy} className="p-2.5 hover:bg-stone-200 rounded-xl shrink-0 touch-target" title="Copy">
          <Copy className="w-4 h-4 text-stone-600" />
        </button>
      </div>
      {copied && <p className="text-xs text-emerald-600 mt-2 font-medium">Copied to clipboard</p>}
    </Modal>
  );
};

const WebhookModal = ({ open, availableEvents, onClose, onSave, saving }) => {
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (open) {
      setUrl('');
      setDescription('');
      setEvents([]);
    }
  }, [open]);

  const toggle = (evt) => setEvents((e) => e.includes(evt) ? e.filter((x) => x !== evt) : [...e, evt]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Webhook Endpoint"
      description="Receive ATS events at your own HTTPS endpoint."
      size="md"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            type="button"
            onClick={() => onSave({ url, description, events })}
            disabled={saving || !url.trim() || events.length === 0}
            className="btn-primary"
          >
            {saving ? <><Loader2 size={16} className="animate-spin" /> Creating…</> : 'Create Endpoint'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label-ats">Endpoint URL</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/webhooks/ats" className="input-ats" autoFocus />
        </div>
        <div>
          <label className="label-ats">Description</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" className="input-ats" />
        </div>
        <div>
          <label className="label-ats mb-2">Events ({events.length} selected)</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto border border-stone-100 rounded-xl p-3 bg-stone-50/50">
            {availableEvents.map((evt) => (
              <label key={evt} className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer py-1 min-h-[36px]">
                <input
                  type="checkbox"
                  checked={events.includes(evt)}
                  onChange={() => toggle(evt)}
                  className="rounded border-stone-300 text-brand-600 focus:ring-brand-500/30"
                />
                {evt}
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};

const ApiKeyModal = ({ open, canWrite, onClose, onSave, saving }) => {
  const [name, setName] = useState('');
  const [write, setWrite] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setWrite(false);
    }
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New API Key"
      description="Authenticate against the public REST API."
      size="sm"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            type="button"
            onClick={() => onSave({ name, scopes: write ? ['read', 'write'] : ['read'] })}
            disabled={saving || !name.trim()}
            className="btn-primary"
          >
            {saving ? <><Loader2 size={16} className="animate-spin" /> Creating…</> : 'Create Key'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label-ats">Key name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Zapier integration" className="input-ats" autoFocus />
        </div>
        <label className={`flex items-center gap-2.5 text-sm min-h-[44px] ${canWrite ? 'text-stone-700 cursor-pointer' : 'text-stone-400'}`}>
          <input
            type="checkbox"
            checked={write}
            disabled={!canWrite}
            onChange={(e) => setWrite(e.target.checked)}
            className="rounded border-stone-300 text-brand-600 focus:ring-brand-500/30"
          />
          Write access {!canWrite && <span className="badge-warning ml-1">Enterprise only</span>}
        </label>
      </div>
    </Modal>
  );
};

const DeliveryLog = ({ endpointId }) => {
  const [deliveries, setDeliveries] = useState(null);
  useEffect(() => {
    authenticatedFetch(`/api/webhooks/${endpointId}/deliveries`).then((r) => r.json()).then((d) => setDeliveries(d.data || []));
  }, [endpointId]);
  if (deliveries === null) {
    return (
      <div className="p-4 text-sm text-stone-400 flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600" /> Loading deliveries…
      </div>
    );
  }
  if (deliveries.length === 0) return <div className="p-4 text-sm text-stone-400">No deliveries yet.</div>;
  return (
    <div className="divide-y divide-stone-100 max-h-56 overflow-y-auto">
      {deliveries.map((d) => (
        <div key={d._id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${d.success ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span className="font-mono text-stone-700">{d.eventType}</span>
          </div>
          <div className="text-stone-400">{d.responseStatus || d.errorMessage || '—'} · {new Date(d.createdAt).toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
};

export default function WebhooksApiPage() {
  const toast = useToast();
  const { organization } = useAuth();
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
    } catch (err) {
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
    } catch (err) {
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
      message: "The old secret will stop working immediately.",
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
    } catch (err) {
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
      <div className="page-shell-ats">
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
          <p className="text-sm text-stone-500 font-medium">Loading webhooks &amp; API…</p>
        </div>
      </div>
    );
  }

  if (upgradeRequired) {
    return (
      <div className="page-shell-ats">
        <div className="min-h-[60vh] flex items-center justify-center px-4">
          <UpgradeBanner
            title="Webhooks & Public API is a Professional+ feature"
            desc="Upgrade to Professional for read-only webhooks/API access, or Enterprise for full read/write access."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell-ats max-w-4xl">
      <PageHeader
        icon={Webhook}
        title="Webhooks & API"
        subtitle="Deliver ATS events to your own systems, and pull/push data via the public REST API. Also how Zapier/Make integrations connect today."
        gradientTitle
      />

      <section>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold text-stone-900 uppercase tracking-wider flex items-center gap-2">
            <Webhook className="w-4 h-4 text-brand-600" /> Webhook Endpoints
          </h2>
          <button type="button" onClick={() => setShowWebhookModal(true)} className="btn-primary !px-3 !py-1.5 !text-sm w-full sm:w-auto">
            <Plus className="w-4 h-4" /> New Endpoint
          </button>
        </div>
        <div className="card-ats-bordered divide-y divide-stone-100 overflow-hidden">
          {endpoints.length === 0 ? (
            <EmptyState icon={Webhook} message="No webhook endpoints configured yet." subMessage="Create an endpoint to receive ATS events in your own systems." />
          ) : endpoints.map((ep) => (
            <div key={ep._id}>
              <div className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-stone-900 truncate">{ep.url}</div>
                  <div className="text-xs text-stone-400 mt-0.5">{ep.events.length} event(s) · {ep.description || 'No description'}</div>
                  {ep.lastDeliveryStatus && (
                    <div className={`text-xs mt-1 ${ep.lastDeliveryStatus === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                      Last delivery: {ep.lastDeliveryStatus} ({new Date(ep.lastDeliveryAt).toLocaleString()})
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className={`mr-2 ${ep.isActive ? 'badge-success' : 'badge-neutral'}`}>
                    {ep.isActive ? 'Active' : 'Disabled'}
                  </span>
                  <button type="button" onClick={() => setExpandedEndpoint(expandedEndpoint === ep._id ? null : ep._id)} className="p-2.5 hover:bg-stone-100 rounded-xl text-stone-500 touch-target" title="View deliveries">
                    {expandedEndpoint === ep._id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <button type="button" onClick={() => toggleWebhook(ep)} className="p-2.5 hover:bg-stone-100 rounded-xl text-stone-500 touch-target" title={ep.isActive ? 'Disable' : 'Enable'}>
                    <Power className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => rotateSecret(ep)} className="p-2.5 hover:bg-stone-100 rounded-xl text-stone-500 touch-target" title="Rotate secret">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => deleteWebhook(ep)} className="p-2.5 hover:bg-red-50 rounded-xl text-red-500 touch-target" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {expandedEndpoint === ep._id && (
                <div className="border-t border-stone-100 bg-stone-50/50">
                  <DeliveryLog endpointId={ep._id} />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold text-stone-900 uppercase tracking-wider flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-brand-600" /> API Keys
          </h2>
          <button type="button" onClick={() => setShowKeyModal(true)} className="btn-primary !px-3 !py-1.5 !text-sm w-full sm:w-auto">
            <Plus className="w-4 h-4" /> New Key
          </button>
        </div>
        <div className="card-ats-bordered divide-y divide-stone-100 overflow-hidden">
          {apiKeys.length === 0 ? (
            <EmptyState icon={KeyRound} message="No API keys yet." subMessage="Create a key to authenticate against the public REST API." />
          ) : apiKeys.map((key) => (
            <div key={key._id} className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-brand-50/20 transition-colors">
              <div className="min-w-0">
                <div className="font-semibold text-stone-900">{key.name}</div>
                <div className="text-xs text-stone-400 mt-0.5 font-mono">{key.keyPrefix}••••••••</div>
                <div className="text-xs text-stone-400 mt-0.5">
                  Scopes: {key.scopes.join(', ')}
                  {key.lastUsedAt && ` · Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                </div>
              </div>
              <button type="button" onClick={() => revokeApiKey(key)} className="p-2.5 hover:bg-red-50 rounded-xl text-red-500 touch-target self-start sm:self-auto">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <p className="text-xs text-stone-400 mt-2 leading-relaxed">
          Use as <code className="text-stone-500">Authorization: Bearer &lt;key&gt;</code> against <code className="text-stone-500">/api/v1/public/*</code>.
        </p>
      </section>

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
    </div>
  );
}
