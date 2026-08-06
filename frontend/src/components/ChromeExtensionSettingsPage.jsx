import React, { useState, useEffect, useCallback } from 'react';
import {
  Chrome, RefreshCw, Trash2, Copy, Loader2, Download, CheckCircle2, Check, Link2, KeyRound
} from 'lucide-react';
import PageHeader from './ui/PageHeader';
import Modal from './ui/Modal';
import ConfirmationModal from './ConfirmationModal';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';
import { authenticatedFetch, handleUnauthorized, BASE_API_URL } from '../utils/fetchUtils';
import { useToast } from './Toast';

const EXT_TOUR_KEY = 'skillnix_tour_chrome_extension_v1';
const EXT_TOUR_STEPS = [
  {
    title: 'Chrome Extension',
    body: 'Import candidates from LinkedIn into your ATS with a one-click browser extension.',
  },
  {
    target: '[data-tour="ext-install"]',
    title: 'Install',
    body: 'Load the unpacked chrome-extension folder in Chrome Developer Mode.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="ext-token"]',
    title: 'Generate a token',
    body: 'Create an org token, copy it once, and paste it into the extension popup with the API domain.',
    placement: 'top',
  },
  {
    target: '[data-tour="ext-domain"]',
    title: 'API domain',
    body: 'This is your backend URL — the extension needs it to talk to your ATS.',
    placement: 'top',
  },
];

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
      footer={(
        <button type="button" onClick={onClose} className="btn-primary w-full sm:w-auto">Done</button>
      )}
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

export default function ChromeExtensionSettingsPage() {
  const toast = useToast();
  const [tourOpen, setTourOpen] = usePageTour(EXT_TOUR_KEY);
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
          setTokenInfo(null);
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
        <div className="h-7 w-56 skeleton-ats rounded-lg" />
        <div className="h-64 skeleton-ats rounded-2xl mt-4" />
      </div>
    );
  }

  return (
    <div className="page-shell-ats animate-page-enter">
      <PageHeader
        icon={Chrome}
        title="Chrome Extension"
        subtitle="One-click import candidates from LinkedIn — available on every plan."
        gradientTitle
      >
        <button type="button" onClick={load} className="btn-secondary w-full sm:w-auto">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </PageHeader>

      <div className="rounded-xl border border-brand-200/60 bg-gradient-to-r from-brand-50/70 via-white to-teal-50/40 px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed">
        Install the extension, generate a token, and paste the API domain — no coding required.
        Press <span className="font-semibold text-stone-800">?</span> bottom-right for a tour.
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-8 space-y-4 min-w-0">
          <section
            data-tour="ext-install"
            className="card-ats-bordered relative overflow-hidden p-4 sm:p-5 flex flex-col gap-3"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
            <h2 className="relative flex items-center gap-2 text-[15px] font-bold text-stone-900 tracking-tight">
              <Download className="w-4 h-4 text-brand-600 shrink-0" /> 1. Install the extension
            </h2>
            <div className="relative rounded-2xl border border-brand-100 bg-brand-50/50 p-4 text-sm text-stone-700 leading-relaxed space-y-2">
              <p>
                Use the <code className="font-mono text-brand-800 bg-white/80 px-1.5 py-0.5 rounded-md text-xs">chrome-extension/</code> folder from your project.
              </p>
              <ol className="list-decimal list-inside space-y-1 text-[13px] text-stone-600">
                <li>Open <code className="font-mono text-xs bg-white/80 px-1 rounded">chrome://extensions</code></li>
                <li>Turn on <span className="font-semibold">Developer mode</span></li>
                <li>Click <span className="font-semibold">Load unpacked</span> and select that folder</li>
              </ol>
            </div>
          </section>

          <section
            data-tour="ext-token"
            className="card-ats-bordered relative overflow-hidden p-4 sm:p-5 flex flex-col gap-3"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
            <h2 className="relative flex items-center gap-2 text-[15px] font-bold text-stone-900 tracking-tight">
              <KeyRound className="w-4 h-4 text-brand-600 shrink-0" /> 2. Connect with a token
            </h2>

            {tokenInfo ? (
              <div className="relative rounded-2xl border border-stone-200/80 bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-stone-900">Token active</p>
                    <p className="text-xs text-stone-500 mt-0.5 font-mono truncate">{tokenInfo.tokenPrefix}…</p>
                    {tokenInfo.importCount > 0 && (
                      <p className="text-[11px] text-stone-400 mt-1">
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
                  >
                    <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={handleRevoke}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-[12px] font-semibold text-stone-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Revoke
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative">
                <button type="button" onClick={handleGenerate} disabled={generating} className="btn-primary w-full sm:w-auto">
                  {generating ? <Loader2 size={16} className="animate-spin" /> : <KeyRound className="w-4 h-4" />}
                  Generate extension token
                </button>
              </div>
            )}
          </section>

          <section
            data-tour="ext-domain"
            className="card-ats-bordered relative overflow-hidden p-4 sm:p-5 flex flex-col gap-3"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
            <h2 className="relative flex items-center gap-2 text-[15px] font-bold text-stone-900 tracking-tight">
              <Link2 className="w-4 h-4 text-brand-600 shrink-0" /> 3. API domain
            </h2>
            <div className="relative flex items-center gap-2">
              <input readOnly value={BASE_API_URL} className="input-ats font-mono !text-xs flex-1 min-w-0" />
              <button type="button" onClick={copyDomain} className="btn-secondary !px-3 shrink-0" title="Copy domain">
                {copiedDomain ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="relative text-[11px] text-stone-400">Paste this as the API domain in the extension settings.</p>
          </section>
        </div>

        <aside className="lg:col-span-4 min-w-0 lg:sticky lg:top-4">
          <div className="card-ats-bordered relative overflow-hidden p-4 sm:p-5 space-y-3 min-h-[16rem]">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
            <h2 className="relative text-[15px] font-bold text-stone-900 tracking-tight">How it works</h2>
            <ol className="relative space-y-3 text-sm text-stone-600">
              <li className="rounded-xl border border-stone-100 bg-stone-50/80 px-3 py-2.5">
                <span className="font-semibold text-stone-900">Install</span>
                <p className="text-[11px] text-stone-500 mt-0.5">Load the extension in Chrome once.</p>
              </li>
              <li className="rounded-xl border border-stone-100 bg-stone-50/80 px-3 py-2.5">
                <span className="font-semibold text-stone-900">Connect</span>
                <p className="text-[11px] text-stone-500 mt-0.5">Paste token + API domain in the popup.</p>
              </li>
              <li className="rounded-xl border border-stone-100 bg-stone-50/80 px-3 py-2.5">
                <span className="font-semibold text-stone-900">Import</span>
                <p className="text-[11px] text-stone-500 mt-0.5">On LinkedIn profiles, import into your ATS.</p>
              </li>
            </ol>
          </div>
        </aside>
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

      <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of Chrome Extension" />
      <ProductTour open={tourOpen} onClose={() => setTourOpen(false)} steps={EXT_TOUR_STEPS} storageKey={EXT_TOUR_KEY} />
    </div>
  );
}
