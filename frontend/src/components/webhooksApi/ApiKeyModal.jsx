import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';

export default function ApiKeyModal({ open, canWrite, onClose, onSave, saving }) {
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
}
