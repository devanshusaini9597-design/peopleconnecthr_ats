import React, { useState, useEffect, useCallback } from 'react';
import { Chrome, RefreshCw, Trash2, Copy, Loader2, Download, CheckCircle2 } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import Modal from './ui/Modal';
import ConfirmationModal from './ConfirmationModal';
import { authenticatedFetch, handleUnauthorized, BASE_API_URL } from '../utils/fetchUtils';
import { useToast } from './Toast';

const SecretRevealModal = ({ open, label, value, domain, onClose }) => {
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
      <div className="space-y-4">
        <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-xl p-3">
          <code className="text-sm text-stone-800 break-all flex-1 font-mono">{value}</code>
          <button type="button" onClick={copy} className="p-2.5 hover:bg-stone-200 rounded-xl shrink-0 touch-target" title="Copy">
            <Copy className="w-4 h-4 text-stone-600" />
          </button>
        </div>
        {copied && <p className="text-xs text-emerald-600 font-medium">Copied to clipboard</p>}
        <div>
          <p className="text-sm text-stone-500 leading-relaxed">
            Open the extension&apos;s popup, paste this token, and set the API domain to:
          </p>
          <div className="mt-2 flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-xl p-3">
            <code className="text-sm text-stone-800 break-all flex-1 font-mono">{domain}</code>
          </div>
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

  if (loading) {
    return (
      <div className="page-shell-ats">
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
          <p className="text-sm text-stone-500 font-medium">Loading extension settings…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell-ats max-w-2xl">
      <PageHeader
        icon={Chrome}
        title="Chrome Extension"
        subtitle="One-click import candidates straight from LinkedIn profiles — available on every plan."
        gradientTitle
      />

      <div className="card-ats-bordered p-5 sm:p-6 space-y-5">
        <div className="flex items-start gap-3 bg-brand-50 border border-brand-100 rounded-xl p-4">
          <Download className="w-5 h-5 text-brand-600 mt-0.5 shrink-0" />
          <div className="text-sm text-brand-800">
            <p className="font-semibold">1. Install the extension</p>
            <p className="mt-1 leading-relaxed">
              Download the <code className="text-brand-700">chrome-extension/</code> folder from your installation files, then in Chrome go to
              <code className="mx-1 text-brand-700">chrome://extensions</code>, enable Developer Mode, and click &quot;Load unpacked&quot;.
            </p>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-stone-900 mb-2">2. Connect it to your organization</p>
          {tokenInfo ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50 border border-stone-200 rounded-xl p-3 sm:p-4">
              <div className="flex items-center gap-2 text-sm text-stone-700 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Token active — <code className="font-mono">{tokenInfo.tokenPrefix}…</code>
                  {tokenInfo.importCount > 0 && (
                    <span className="text-stone-400"> · {tokenInfo.importCount} import{tokenInfo.importCount === 1 ? '' : 's'}</span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="p-2.5 hover:bg-stone-200 rounded-xl text-stone-500 transition-colors touch-target"
                  title="Regenerate"
                >
                  <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={handleRevoke}
                  className="p-2.5 hover:bg-red-50 rounded-xl text-red-500 transition-colors touch-target"
                  title="Revoke"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={handleGenerate} disabled={generating} className="btn-primary">
              {generating ? <><Loader2 size={16} className="animate-spin" /> Generating…</> : 'Generate Extension Token'}
            </button>
          )}
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
