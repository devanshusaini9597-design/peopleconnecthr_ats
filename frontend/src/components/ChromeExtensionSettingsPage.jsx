import React, { useState, useEffect, useCallback } from 'react';
import { Chrome, RefreshCw, Trash2, Copy, Loader2, Download, CheckCircle2 } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import { authenticatedFetch, handleUnauthorized, BASE_API_URL } from '../utils/fetchUtils';
import { useToast } from './Toast';

const SecretRevealModal = ({ label, value, domain, onClose }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div className="fixed inset-0 bg-stone-900/55 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl sm:rounded-3xl w-full max-w-lg border border-stone-200/60 shadow-2xl modal-panel-ats overflow-hidden p-6">
        <h3 className="text-lg font-bold text-stone-900">{label}</h3>
        <p className="text-sm text-stone-500 mt-1">Copy this now — it will never be shown again.</p>
        <div className="mt-4 flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-xl p-3">
          <code className="text-sm text-stone-800 break-all flex-1">{value}</code>
          <button onClick={copy} className="p-2 hover:bg-stone-200 rounded-lg shrink-0"><Copy className="w-4 h-4 text-stone-600" /></button>
        </div>
        {copied && <p className="text-xs text-green-600 mt-2">Copied to clipboard</p>}
        <p className="text-sm text-stone-500 mt-4">
          Open the extension's popup, paste this token, and set the API domain to:
        </p>
        <div className="mt-2 flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-lg p-3">
          <code className="text-sm text-stone-800 break-all flex-1">{domain}</code>
        </div>
        <button onClick={onClose} className="mt-5 w-full btn-primary">Done</button>
      </div>
    </div>
  );
};

const ChromeExtensionSettingsPage = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [tokenInfo, setTokenInfo] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [revealed, setRevealed] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch('/api/chrome-extension/token');
      if (res.status === 401) return handleUnauthorized();
      const data = await res.json();
      if (data.success) setTokenInfo(data.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    if (tokenInfo && !window.confirm('This replaces any existing token — the extension will need the new one. Continue?')) return;
    setGenerating(true);
    try {
      const res = await authenticatedFetch('/api/chrome-extension/token', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Failed to generate token');
        return;
      }
      setRevealed(data.plaintextToken);
      load();
    } catch {
      toast?.error?.('Failed to generate token');
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async () => {
    if (!window.confirm('Revoke the Chrome extension token? The extension will stop working until you generate a new one.')) return;
    try {
      const res = await authenticatedFetch('/api/chrome-extension/token', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Failed to revoke token');
        return;
      }
      toast?.success?.('Token revoked');
      load();
    } catch {
      toast?.error?.('Failed to revoke token');
    }
  };

  if (loading) {
    return <div className="page-shell-ats"><div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 text-brand-600 animate-spin" /></div></div>;
  }

  return (
    <div className="page-shell-ats max-w-2xl">
        <PageHeader
          icon={Chrome}
          title="Chrome Extension"
          subtitle="One-click import candidates straight from LinkedIn profiles — available on every plan."
        />

        <div className="card-ats-bordered p-6 space-y-5">
          <div className="flex items-start gap-3 bg-brand-50 border border-brand-100 rounded-lg p-4">
            <Download className="w-5 h-5 text-brand-600 mt-0.5 shrink-0" />
            <div className="text-sm text-brand-800">
              <p className="font-medium">1. Install the extension</p>
              <p className="mt-1">
                Download the <code>chrome-extension/</code> folder from your installation files, then in Chrome go to
                <code className="mx-1">chrome://extensions</code>, enable Developer Mode, and click "Load unpacked".
              </p>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-stone-900 mb-2">2. Connect it to your organization</p>
            {tokenInfo ? (
              <div className="flex items-center justify-between bg-stone-50 border border-stone-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm text-stone-700">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  Token active — <code>{tokenInfo.tokenPrefix}…</code>
                  {tokenInfo.importCount > 0 && <span className="text-stone-400">· {tokenInfo.importCount} import{tokenInfo.importCount === 1 ? '' : 's'}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleGenerate} disabled={generating} className="p-2 hover:bg-stone-200 rounded-lg text-stone-500" title="Regenerate">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button onClick={handleRevoke} className="p-2 hover:bg-red-50 rounded-lg text-red-500" title="Revoke">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={handleGenerate} disabled={generating} className="btn-primary">
                {generating ? 'Generating…' : 'Generate Extension Token'}
              </button>
            )}
          </div>
        </div>

      {revealed && (
        <SecretRevealModal
          label="Chrome Extension Token"
          value={revealed}
          domain={BASE_API_URL}
          onClose={() => setRevealed(null)}
        />
      )}
    </div>
  );
};

export default ChromeExtensionSettingsPage;
