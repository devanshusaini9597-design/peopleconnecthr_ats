import React, { useState, useEffect, useCallback } from 'react';
import { Webhook, KeyRound, Plus, Trash2, Copy, Loader2, Lock, RefreshCw, Power, ChevronDown, ChevronUp } from 'lucide-react';
import { authenticatedFetch, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import { useAuth } from '../context/AuthContext';
import { planHasFeature } from '../config/planFeatures';

const UpgradeBanner = ({ title, desc }) => (
  <div className="max-w-md text-center bg-white border border-gray-200 rounded-2xl p-10 shadow-sm mx-auto">
    <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
      <Lock className="w-7 h-7 text-amber-600" />
    </div>
    <h2 className="text-xl font-bold text-gray-900">{title}</h2>
    <p className="text-gray-500 mt-2 text-sm">{desc}</p>
    <a href="/billing" className="inline-block mt-6 px-5 py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors">View Plans</a>
  </div>
);

const SecretRevealModal = ({ label, value, onClose }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl p-6">
        <h3 className="text-lg font-bold text-gray-900">{label}</h3>
        <p className="text-sm text-gray-500 mt-1">Copy this now — it will never be shown again.</p>
        <div className="mt-4 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
          <code className="text-sm text-gray-800 break-all flex-1">{value}</code>
          <button onClick={copy} className="p-2 hover:bg-gray-200 rounded-lg shrink-0"><Copy className="w-4 h-4 text-gray-600" /></button>
        </div>
        {copied && <p className="text-xs text-green-600 mt-2">Copied to clipboard</p>}
        <button onClick={onClose} className="mt-5 w-full px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800">Done</button>
      </div>
    </div>
  );
};

const WebhookModal = ({ availableEvents, onClose, onSave, saving }) => {
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [events, setEvents] = useState([]);

  const toggle = (evt) => setEvents((e) => e.includes(evt) ? e.filter((x) => x !== evt) : [...e, evt]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-xl">
        <div className="p-5 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">New Webhook Endpoint</h3>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">
          <div>
            <label className="text-sm font-medium text-gray-700">Endpoint URL</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/webhooks/ats" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Events ({events.length} selected)</label>
            <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto border border-gray-100 rounded-lg p-3">
              {availableEvents.map((evt) => (
                <label key={evt} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={events.includes(evt)} onChange={() => toggle(evt)} className="rounded border-gray-300" />
                  {evt}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="p-5 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button
            onClick={() => onSave({ url, description, events })}
            disabled={saving || !url.trim() || events.length === 0}
            className="px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create Endpoint'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ApiKeyModal = ({ canWrite, onClose, onSave, saving }) => {
  const [name, setName] = useState('');
  const [write, setWrite] = useState(false);
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-6">
        <h3 className="text-lg font-bold text-gray-900">New API Key</h3>
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Key name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Zapier integration" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <label className={`flex items-center gap-2 text-sm ${canWrite ? 'text-gray-700 cursor-pointer' : 'text-gray-400'}`}>
            <input type="checkbox" checked={write} disabled={!canWrite} onChange={(e) => setWrite(e.target.checked)} className="rounded border-gray-300" />
            Write access {!canWrite && '(Enterprise only)'}
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button
            onClick={() => onSave({ name, scopes: write ? ['read', 'write'] : ['read'] })}
            disabled={saving || !name.trim()}
            className="px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create Key'}
          </button>
        </div>
      </div>
    </div>
  );
};

const DeliveryLog = ({ endpointId }) => {
  const [deliveries, setDeliveries] = useState(null);
  useEffect(() => {
    authenticatedFetch(`/api/webhooks/${endpointId}/deliveries`).then((r) => r.json()).then((d) => setDeliveries(d.data || []));
  }, [endpointId]);
  if (deliveries === null) return <div className="p-4 text-sm text-gray-400 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading deliveries…</div>;
  if (deliveries.length === 0) return <div className="p-4 text-sm text-gray-400">No deliveries yet.</div>;
  return (
    <div className="divide-y divide-gray-100 max-h-56 overflow-y-auto">
      {deliveries.map((d) => (
        <div key={d._id} className="p-3 flex items-center justify-between text-xs">
          <div>
            <span className={`inline-block w-2 h-2 rounded-full mr-2 ${d.success ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span className="font-mono text-gray-700">{d.eventType}</span>
          </div>
          <div className="text-gray-400">{d.responseStatus || d.errorMessage || '—'} · {new Date(d.createdAt).toLocaleString()}</div>
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
    if (!window.confirm('Rotate this endpoint\'s signing secret? The old secret will stop working immediately.')) return;
    const res = await authenticatedFetch(`/api/webhooks/${endpoint._id}/rotate-secret`, { method: 'POST' });
    const data = await res.json();
    if (data.success) setRevealSecret({ label: 'New Signing Secret', value: data.plaintextSecret });
    else toast?.error?.(data.message);
  };

  const deleteWebhook = async (endpoint) => {
    if (!window.confirm('Delete this webhook endpoint?')) return;
    const res = await authenticatedFetch(`/api/webhooks/${endpoint._id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) { toast?.success?.('Deleted'); load(); } else toast?.error?.(data.message);
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
    if (!window.confirm(`Revoke the "${key.name}" API key?`)) return;
    const res = await authenticatedFetch(`/api/api-keys/${key._id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) { toast?.success?.('Revoked'); load(); } else toast?.error?.(data.message);
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 text-gray-400 animate-spin" /></div>;

  if (upgradeRequired) {
    return <div className="min-h-[60vh] flex items-center justify-center p-6">
      <UpgradeBanner title="Webhooks & Public API is a Professional+ feature" desc="Upgrade to Professional for read-only webhooks/API access, or Enterprise for full read/write access." />
    </div>;
  }

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 pb-20">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Webhooks &amp; API</h1>
          <p className="text-gray-500 mt-1 text-sm">Deliver ATS events to your own systems, and pull/push data via the public REST API. Also how Zapier/Make integrations connect today.</p>
        </div>

        {/* ── Webhooks ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2"><Webhook className="w-4 h-4" /> Webhook Endpoints</h2>
            <button onClick={() => setShowWebhookModal(true)} className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> New Endpoint
            </button>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {endpoints.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No webhook endpoints configured yet.</div>
            ) : endpoints.map((ep) => (
              <div key={ep._id}>
                <div className="p-4 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{ep.url}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{ep.events.length} event(s) · {ep.description || 'No description'}</div>
                    {ep.lastDeliveryStatus && (
                      <div className={`text-xs mt-1 ${ep.lastDeliveryStatus === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                        Last delivery: {ep.lastDeliveryStatus} ({new Date(ep.lastDeliveryAt).toLocaleString()})
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full mr-2 ${ep.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{ep.isActive ? 'Active' : 'Disabled'}</span>
                    <button onClick={() => setExpandedEndpoint(expandedEndpoint === ep._id ? null : ep._id)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500" title="View deliveries">
                      {expandedEndpoint === ep._id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button onClick={() => toggleWebhook(ep)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500" title={ep.isActive ? 'Disable' : 'Enable'}><Power className="w-4 h-4" /></button>
                    <button onClick={() => rotateSecret(ep)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500" title="Rotate secret"><RefreshCw className="w-4 h-4" /></button>
                    <button onClick={() => deleteWebhook(ep)} className="p-2 hover:bg-red-50 rounded-lg text-red-500" title="Delete"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                {expandedEndpoint === ep._id && <div className="border-t border-gray-100 bg-gray-50/50"><DeliveryLog endpointId={ep._id} /></div>}
              </div>
            ))}
          </div>
        </section>

        {/* ── API Keys ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2"><KeyRound className="w-4 h-4" /> API Keys</h2>
            <button onClick={() => setShowKeyModal(true)} className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> New Key
            </button>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {apiKeys.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No API keys yet.</div>
            ) : apiKeys.map((key) => (
              <div key={key._id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">{key.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5 font-mono">{key.keyPrefix}••••••••</div>
                  <div className="text-xs text-gray-400 mt-0.5">Scopes: {key.scopes.join(', ')} {key.lastUsedAt && `· Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}</div>
                </div>
                <button onClick={() => revokeApiKey(key)} className="p-2 hover:bg-red-50 rounded-lg text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">Use as <code>Authorization: Bearer &lt;key&gt;</code> against <code>/api/v1/public/*</code>.</p>
        </section>
      </div>

      {showWebhookModal && <WebhookModal availableEvents={availableEvents} onClose={() => setShowWebhookModal(false)} onSave={createWebhook} saving={saving} />}
      {showKeyModal && <ApiKeyModal canWrite={canWrite} onClose={() => setShowKeyModal(false)} onSave={createApiKey} saving={saving} />}
      {revealSecret && <SecretRevealModal label={revealSecret.label} value={revealSecret.value} onClose={() => setRevealSecret(null)} />}
    </div>
  );
}
