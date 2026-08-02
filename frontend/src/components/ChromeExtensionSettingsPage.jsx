import React, { useState, useEffect, useCallback } from 'react';
import { Chrome, RefreshCw, Trash2, Copy, Loader2, Download, CheckCircle2, Check, Link2, KeyRound } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import Modal from './ui/Modal';
import ConfirmationModal from './ConfirmationModal';
import { authenticatedFetch, handleUnauthorized, BASE_API_URL } from '../utils/fetchUtils';
import { useToast } from './Toast';

const SecretRevealModal = ({ open, label, value, domain, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);

  const copy = (text, which = 'token') => {
    navigator.clipboard?.writeText(text);
    if (which === 'domain') {
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 1500);
    } else {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  useEffect(() => {
    if (open) {
      setCopied(false);
      setCopiedDomain(false);
    }
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
      <div className="space-y-3">
        <div>
          <label className="label-ats">Extension token</label>
          <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-xl p-3">
            <code className="text-sm text-stone-800 break-all flex-1 font-mono leading-relaxed">{value}</code>
            <button type="button" onClick={() => copy(value)} className="btn-secondary !px-3 shrink-0" title="Copy">
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="label-ats">API domain</label>
          <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-xl p-3">
            <code className="text-sm text-stone-800 break-all flex-1 font-mono">{domain}</code>
            <button type="button" onClick={() => copy(domain, 'domain')} className="btn-secondary !px-3 shrink-0" title="Copy domain">
              {copiedDomain ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-stone-400 mt-1.5">Paste both into the extension popup to connect.</p>
        </div>
      </div>
    </Modal>
  );
};

const ChromeExtensionSettingsPage = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [tokenInfo, setTokenInfo] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [revealed, setRevealed] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);

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

  const doGenerate = async () => {
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

  const handleGenerate = () => {
    if (tokenInfo) {
      setConfirmAction({
        type: 'warning',
        title: 'Replace existing token?',
        message: 'This replaces any existing token — the extension will need the new one.',
        confirmText: 'Replace Token',
        run: doGenerate
      });
      return;
    }
    doGenerate();
  };

  const handleRevoke = () => {
    setConfirmAction({
      type: 'delete',
      title: 'Revoke extension token?',
      message: 'The extension will stop working until you generate a new one.',
      confirmText: 'Revoke Token',
      run: async () => {
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

  const copyDomain = () => {
    navigator.clipboard?.writeText(BASE_API_URL);
    setCopiedDomain(true);
    setTimeout(() => setCopiedDomain(false), 1500);
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
        <div className="card-ats-bordered p-6 space-y-4 mt-2">
          <div className="h-20 skeleton-ats rounded-xl" />
          <div className="h-14 skeleton-ats rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell-ats animate-page-enter max-w-3xl">
      <PageHeader
        icon={Chrome}
        title="Chrome Extension"
        subtitle="One-click import candidates from LinkedIn — available on every plan."
        gradientTitle
      />

      <div className="card-ats-bordered p-5 sm:p-6 space-y-5 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />

        <div>
          <h3 className="section-title-ats !mb-3">
            <Download className="w-4 h-4 text-brand-600" />
            1. Install the extension
          </h3>
          <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-4 text-sm text-brand-900 leading-relaxed">
            Download the <code className="font-mono text-brand-700 bg-white/70 px-1.5 py-0.5 rounded-md">chrome-extension/</code> folder,
            then open <code className="font-mono text-brand-700 bg-white/70 px-1.5 py-0.5 rounded-md mx-0.5">chrome://extensions</code>,
            enable Developer Mode, and click <strong>Load unpacked</strong>.
          </div>
        </div>

        <div>
          <h3 className="section-title-ats !mb-3">
            <KeyRound className="w-4 h-4 text-brand-600" />
            2. Connect to your organization
          </h3>

          {tokenInfo ? (
            <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-stone-900">Token active</p>
                  <p className="text-xs text-stone-500 mt-0.5 font-mono truncate">{tokenInfo.tokenPrefix}…</p>
                  {tokenInfo.importCount > 0 && (
                    <p className="text-xs text-stone-400 mt-1">
                      {tokenInfo.importCount} import{tokenInfo.importCount === 1 ? '' : 's'} via extension
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="btn-secondary !text-sm !px-3"
                  title="Regenerate"
                >
                  <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                  Replace
                </button>
                <button
                  type="button"
                  onClick={handleRevoke}
                  className="btn-ghost !text-red-600 hover:!bg-red-50 !text-sm !px-3"
                  title="Revoke"
                >
                  <Trash2 className="w-4 h-4" />
                  Revoke
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={handleGenerate} disabled={generating} className="btn-primary w-full sm:w-auto">
              {generating ? <><Loader2 size={16} className="animate-spin" /> Generating…</> : 'Generate Extension Token'}
            </button>
          )}
        </div>

        <div>
          <h3 className="section-title-ats !mb-3">
            <Link2 className="w-4 h-4 text-brand-600" />
            3. API domain
          </h3>
          <div className="flex items-center gap-2">
            <input readOnly value={BASE_API_URL} className="input-ats font-mono !text-xs flex-1 min-w-0" />
            <button type="button" onClick={copyDomain} className="btn-secondary !px-3 shrink-0" title="Copy domain">
              {copiedDomain ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-stone-400 mt-1.5">Paste this as the API domain in the extension settings.</p>
        </div>
      </div>

      <SecretRevealModal
        open={!!revealed}
        label="Chrome Extension Token"
        value={revealed}
        domain={BASE_API_URL}
        onClose={() => setRevealed(null)}
      />
      <ConfirmationModal
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirm}
        title={confirmAction?.title}
        message={confirmAction?.message}
        confirmText={confirmAction?.confirmText}
        type={confirmAction?.type || 'warning'}
        isLoading={confirmLoading || generating}
      />
    </div>
  );
};

export default ChromeExtensionSettingsPage;
