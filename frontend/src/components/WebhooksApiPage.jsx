import React, { useState, useEffect, useCallback } from 'react';
import { Webhook, KeyRound, Plus, Trash2, Copy, Loader2, Lock, RefreshCw, Power, ChevronDown, ChevronUp, Check } from 'lucide-react';
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
        <code className="text-sm text-stone-800 break-all flex-1 font-mono leading-relaxed">{value}</code>
        <button type="button" onClick={copy} className="btn-secondary !px-3 shrink-0" title="Copy">
          {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      {copied && <p className="text-xs text-emerald-600 mt-2 font-semibold">Copied to clipboard</p>}
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

  const toggle = (evt) => setEvents((e) => (e.includes(evt) ? e.filter((x) => x !== evt) : [...e, evt]));
  const allOn = availableEvents.length > 0 && availableEvents.every((e) => events.includes(e));
  const toggleAll = () => {
    setEvents(allOn ? [] : [...availableEvents]);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Webhook Endpoint"
      description="Receive ATS events at your HTTPS endpoint."
      size="md"
      footer={
        <>
          <span className="hidden sm:inline text-xs font-medium text-stone-400 mr-auto self-center">
            {events.length} event{events.length !== 1 ? 's' : ''} selected
          </span>
          <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>Cancel</button>
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
      <div className="space-y-3">
        <div>
          <label className="label-ats">Endpoint URL *</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/webhooks/ats" className="input-ats" autoFocus />
        </div>
        <div>
          <label className="label-ats">Description</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" className="input-ats" />
        </div>
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <label className="label-ats !mb-0">Events</label>
            <button type="button" onClick={toggleAll} className="text-[11px] font-bold text-brand-600 hover:text-brand-700">
              {allOn ? 'Clear all' : 'Select all'}
            </button>
          </div>
          <div className="rounded-xl border border-stone-200 overflow-hidden divide-y divide-stone-100 max-h-52 overflow-y-auto overscroll-contain">
            {availableEvents.map((evt) => {
              const checked = events.includes(evt);
              return (
                <label
                  key={evt}
                  className={`flex items-center gap-2.5 text-[13px] cursor-pointer px-3 py-2 transition-colors ${
                    checked ? 'bg-brand-50/70 text-brand-800' : 'text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(evt)}
                    className="rounded border-stone-300 text-brand-600 focus:ring-brand-500/30 w-3.5 h-3.5"
                  />
                  <span className="font-mono font-medium truncate">{evt}</span>
                </label>
              );
            })}
            {availableEvents.length === 0 && (
              <p className="text-xs text-stone-400 p-3">No events available.</p>
            )}
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
          <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>Cancel</button>
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
      <div className="space-y-3">
        <div>
          <label className="label-ats">Key name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Zapier integration" className="input-ats" autoFocus />
        </div>
        <label className={`flex items-center gap-2.5 text-sm rounded-xl border px-3 py-2.5 ${
          canWrite ? 'cursor-pointer border-stone-200 bg-stone-50/50 hover:border-brand-200' : 'border-stone-100 text-stone-400'
        }`}>
          <input
            type="checkbox"
            checked={write}
            disabled={!canWrite}
            onChange={(e) => setWrite(e.target.checked)}
            className="rounded border-stone-300 text-brand-600 focus:ring-brand-500/30"
          />
          <span className="font-medium">Write access</span>
          {!canWrite && <span className="badge-warning ml-auto">Enterprise</span>}
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
  if (deliveries.length === 0) {
    return (
      <EmptyState
        icon={Webhook}
        tone="sky"
        compact
        message="No deliveries yet"
        subMessage="Events will appear here once this webhook fires."
      />
    );
  }
  return (
    <div className="divide-y divide-stone-100 max-h-48 overflow-y-auto overscroll-contain">
      {deliveries.map((d) => (
        <div key={d._id} className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${d.success ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span className="font-mono text-stone-700 truncate">{d.eventType}</span>
          </div>
          <div className="text-stone-400 truncate pl-4 sm:pl-0">
            {d.responseStatus || d.errorMessage || '—'} · {new Date(d.createdAt).toLocaleString()}
          </div>
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
      <div className="page-shell-ats animate-page-enter">
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
    <div className="page-shell-ats animate-page-enter">
      <PageHeader
        icon={Webhook}
        title="Webhooks & API"
        subtitle="Push ATS events to your systems and authenticate via the public REST API."
        gradientTitle
      />

      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="section-title-ats !mb-0 !pb-0 !border-0">
            <Webhook className="w-4 h-4 text-brand-600" /> Webhook endpoints
          </h2>
          <button type="button" onClick={() => setShowWebhookModal(true)} className="btn-primary !text-sm w-full sm:w-auto">
            <Plus className="w-4 h-4" /> New Endpoint
          </button>
        </div>

        {endpoints.length === 0 ? (
          <div className="card-ats-bordered">
            <EmptyState
              icon={Webhook}
              tone="violet"
              message="No webhook endpoints yet"
              subMessage="Create an endpoint to receive ATS events in your own systems."
              action={
                <button type="button" onClick={() => setShowWebhookModal(true)} className="btn-primary">
                  <Plus className="w-4 h-4" /> New Endpoint
                </button>
              }
            />
          </div>
        ) : (
          <div className="card-ats-bordered overflow-hidden divide-y divide-stone-100 relative">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
            {endpoints.map((ep) => (
              <div key={ep._id}>
                <div className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-brand-50/20 transition-colors">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      ep.isActive ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-stone-100 text-stone-400 border border-stone-200'
                    }`}>
                      <Webhook className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-stone-900 truncate text-sm">{ep.url}</div>
                      <div className="text-xs text-stone-400 mt-0.5">
                        {ep.events.length} event{ep.events.length !== 1 ? 's' : ''}
                        {ep.description ? ` · ${ep.description}` : ''}
                      </div>
                      {ep.lastDeliveryStatus && (
                        <div className={`text-xs mt-1 font-medium ${ep.lastDeliveryStatus === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                          Last: {ep.lastDeliveryStatus} · {new Date(ep.lastDeliveryAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 pl-12 sm:pl-0">
                    <span className={`mr-1 text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                      ep.isActive
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-stone-100 text-stone-500 border-stone-200'
                    }`}>
                      {ep.isActive ? 'Active' : 'Off'}
                    </span>
                    <button type="button" onClick={() => setExpandedEndpoint(expandedEndpoint === ep._id ? null : ep._id)} className="p-2 rounded-xl hover:bg-stone-100 text-stone-500" title="Deliveries">
                      {expandedEndpoint === ep._id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button type="button" onClick={() => toggleWebhook(ep)} className="p-2 rounded-xl hover:bg-stone-100 text-stone-500" title={ep.isActive ? 'Disable' : 'Enable'}>
                      <Power className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => rotateSecret(ep)} className="p-2 rounded-xl hover:bg-stone-100 text-stone-500" title="Rotate secret">
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => deleteWebhook(ep)} className="p-2 rounded-xl hover:bg-red-50 text-red-500" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {expandedEndpoint === ep._id && (
                  <div className="border-t border-stone-100 bg-stone-50/60">
                    <DeliveryLog endpointId={ep._id} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="section-title-ats !mb-0 !pb-0 !border-0">
            <KeyRound className="w-4 h-4 text-brand-600" /> API keys
          </h2>
          <button type="button" onClick={() => setShowKeyModal(true)} className="btn-primary !text-sm w-full sm:w-auto">
            <Plus className="w-4 h-4" /> New Key
          </button>
        </div>

        {apiKeys.length === 0 ? (
          <div className="card-ats-bordered">
            <EmptyState
              icon={KeyRound}
              tone="amber"
              message="No API keys yet"
              subMessage="Create a key to authenticate against the public REST API."
              action={
                <button type="button" onClick={() => setShowKeyModal(true)} className="btn-primary">
                  <Plus className="w-4 h-4" /> New Key
                </button>
              }
            />
          </div>
        ) : (
          <div className="card-ats-bordered overflow-hidden divide-y divide-stone-100">
            {apiKeys.map((key) => (
              <div key={key._id} className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-brand-50/20 transition-colors">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 border border-brand-100 flex items-center justify-center flex-shrink-0">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-stone-900 text-sm">{key.name}</div>
                    <div className="text-xs text-stone-400 mt-0.5 font-mono">{key.keyPrefix}••••••••</div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {key.scopes.map((s) => (
                        <span key={s} className="badge-neutral !text-[10px] capitalize">{s}</span>
                      ))}
                      {key.lastUsedAt && (
                        <span className="text-[10px] text-stone-400">Last used {new Date(key.lastUsedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                </div>
                <button type="button" onClick={() => revokeApiKey(key)} className="p-2 rounded-xl hover:bg-red-50 text-red-500 self-start sm:self-auto" title="Revoke">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-stone-400 leading-relaxed">
          Auth header: <code className="text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded-md font-mono">Authorization: Bearer &lt;key&gt;</code>
          {' '}→ <code className="text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded-md font-mono">/api/v1/public/*</code>
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
