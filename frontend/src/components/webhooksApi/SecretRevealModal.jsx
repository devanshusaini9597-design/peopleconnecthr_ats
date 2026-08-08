import React, { useState, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
import Modal from '../ui/Modal';

export default function SecretRevealModal({ open, label, value, onClose }) {
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
}
