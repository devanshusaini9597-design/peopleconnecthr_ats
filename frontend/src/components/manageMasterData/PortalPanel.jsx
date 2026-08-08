import React, { useState } from 'react';
import { Copy } from 'lucide-react';
import Modal from '../ui/Modal';

export default function PortalPanel({ client, saving, onClose, onEnable, onDisable }) {
  const [copied, setCopied] = useState(false);
  const portalUrl = client.portal?.token ? `${window.location.origin}/client-portal/${client.portal.token}` : null;
  const copy = () => {
    if (!portalUrl) return;
    navigator.clipboard?.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Client portal — ${client.name}`}
      description="A read-only link so the client can follow hiring progress."
      size="sm"
      footer={(
        <button type="button" onClick={onClose} className="btn-secondary">Close</button>
      )}
    >
      {client.portal?.enabled && portalUrl ? (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-xl border border-stone-200 bg-stone-50 p-3">
            <code className="text-xs text-stone-800 break-all flex-1 leading-relaxed">{portalUrl}</code>
            <button type="button" onClick={copy} className="p-2 rounded-lg hover:bg-stone-200 flex-shrink-0" title="Copy">
              <Copy size={14} className="text-stone-600" />
            </button>
          </div>
          {copied && <p className="text-xs font-medium text-emerald-600">Copied</p>}
          <button type="button" disabled={saving} onClick={onDisable} className="w-full px-4 py-2.5 text-sm font-semibold text-red-600 border border-red-200 rounded-xl hover:bg-red-50 disabled:opacity-50">
            Disable portal
          </button>
        </div>
      ) : (
        <button type="button" disabled={saving} onClick={onEnable} className="btn-primary w-full disabled:opacity-50">
          {saving ? 'Generating…' : 'Enable portal link'}
        </button>
      )}
    </Modal>
  );
}
