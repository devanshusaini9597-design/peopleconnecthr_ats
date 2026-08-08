'use client';

import { useEffect, useState } from 'react';
import { Loader2, Key, Trash2, Save, AlertTriangle, CheckCircle2, Eye, EyeOff, ChevronDown } from 'lucide-react';

interface KeyRecord {
  id: string;
  provider: string;
  maskedKey: string;
  isActive: boolean;
  updatedAt: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  checkr: 'Checkr',
  smtp: 'SMTP',
  whatsapp: 'WhatsApp',
  docusign: 'DocuSign',
  judge0: 'Judge0 (code sandbox)',
  recall: 'Recall.ai (meeting bot)',
};

function providerLabel(p: string) {
  return PROVIDER_LABELS[p] || p;
}

export default function ApiKeyManager() {
  const [keys, setKeys] = useState<KeyRecord[]>([]);
  const [providers, setProviders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchKeys = async () => {
    const res = await fetch('/api/settings/api-keys', { credentials: 'include' });
    if (res.ok) {
      const json = await res.json();
      setKeys(json.keys);
      setProviders(json.providers);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleSave = async () => {
    setError('');
    setSuccess('');
    if (!selectedProvider) { setError('Select a provider'); return; }
    if (!apiKeyInput || apiKeyInput.length < 8) { setError('Key must be at least 8 chars'); return; }

    setSaving(true);
    const res = await fetch('/api/settings/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ provider: selectedProvider, apiKey: apiKeyInput }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setError(json.error || 'Failed to save'); }
    else {
      setSuccess(`Saved ${selectedProvider} key`);
      setApiKeyInput('');
      setSelectedProvider('');
      fetchKeys();
    }
  };

  const handleDelete = async (provider: string) => {
    if (!confirm(`Delete ${provider} key?`)) return;
    const res = await fetch('/api/settings/api-keys', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ provider }),
    });
    if (res.ok) fetchKeys();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
      </div>
    );
  }

  const usedProviders = new Set(keys.map((k) => k.provider));
  const availableProviders = providers.filter((p) => !usedProviders.has(p));

  return (
    <div className="space-y-6">
      {/* Existing keys */}
      {keys.length > 0 && (
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-[var(--shadow-card)]">
          <h3 className="text-sm font-bold text-stone-900 mb-4">Stored Keys</h3>
          <div className="space-y-3">
            {keys.map((k) => (
              <div key={k.id} className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-100">
                <div className="flex items-center gap-3">
                  <Key className="w-4 h-4 text-stone-400" />
                  <div>
                    <p className="text-sm font-semibold text-stone-800">{providerLabel(k.provider)}</p>
                    <p className="text-xs text-stone-500 font-mono">{k.maskedKey}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {k.isActive && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                  <button
                    onClick={() => handleDelete(k.provider)}
                    className="p-2 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add new key */}
      {availableProviders.length > 0 && (
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-[var(--shadow-card)]">
          <h3 className="text-sm font-bold text-stone-900 mb-4">Add API Key</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1.5">Provider</label>
              <div className="relative">
                <select
                  value={selectedProvider}
                  onChange={(e) => { setSelectedProvider(e.target.value); setError(''); }}
                  className="w-full appearance-none pl-4 pr-10 py-3 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 outline-none font-medium text-stone-900 text-sm cursor-pointer transition-all"
                >
                  <option value="">Select provider…</option>
                  {availableProviders.map((p) => (
                    <option key={p} value={p}>{providerLabel(p)}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1.5">API Key</label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={(e) => { setApiKeyInput(e.target.value); setError(''); }}
                  placeholder="sk-... or your key"
                  className="w-full px-4 py-3 pr-12 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:ring-2 focus:ring-brand-500/15 outline-none font-medium text-stone-900 text-sm placeholder:text-stone-400"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />{error}
              </p>
            )}
            {success && (
              <p className="text-xs text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />{success}
              </p>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-brand-600 to-teal-600 shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 transition-all disabled:opacity-70"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Save Key'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
