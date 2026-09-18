import React, { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import Modal from './ui/Modal';
import PremiumSelect from './ui/PremiumSelect';

const FIELDS = [
  { key: 'source', label: 'Source', freeText: true },
  { key: 'client', label: 'Client', freeText: true },
  { key: 'position', label: 'Position', freeText: true },
  { key: 'companyName', label: 'Company', freeText: true },
  { key: 'location', label: 'Location', freeText: true },
  { key: 'product', label: 'Product / Skill', freeText: true },
  { key: 'fls', label: 'FLS / Non-FLS', options: [{ value: 'FLS', label: 'FLS' }, { value: 'NON-FLS', label: 'NON-FLS' }] },
  { key: 'remark', label: 'Remark', freeText: true, textarea: true },
  {
    key: 'marketingConsent',
    label: 'Marketing consent',
    options: [
      { value: 'true', label: 'Yes — consented' },
      { value: 'false', label: 'No — no consent' },
    ],
  },
];

/**
 * Bulk edit selected MIS contacts — tick fields to apply.
 */
export default function MisBulkEditModal({
  open,
  onClose,
  selectedCount = 0,
  onSubmit,
  isLoading = false,
}) {
  const [enabled, setEnabled] = useState({});
  const [values, setValues] = useState({});

  useEffect(() => {
    if (!open) return;
    setEnabled({});
    setValues({});
  }, [open]);

  const toggle = (key) => {
    setEnabled((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setVal = (key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setEnabled((prev) => ({ ...prev, [key]: true }));
  };

  const activeCount = FIELDS.filter((f) => enabled[f.key]).length;

  const handleSave = () => {
    const updates = {};
    for (const f of FIELDS) {
      if (!enabled[f.key]) continue;
      const v = values[f.key];
      if (v == null || String(v).trim() === '') continue;
      if (f.key === 'marketingConsent') {
        updates.marketingConsent = String(v) === 'true';
      } else {
        updates[f.key] = String(v).trim();
      }
    }
    if (!Object.keys(updates).length) return;
    onSubmit?.(updates);
  };

  return (
    <Modal
      open={open}
      onClose={isLoading ? undefined : onClose}
      title="Bulk edit MIS contacts"
      description={`Update fields on ${selectedCount} selected contact${selectedCount === 1 ? '' : 's'}. Unticked fields stay unchanged.`}
      size="md"
      icon={Pencil}
      closeOnBackdrop={!isLoading}
      zClass="z-[140]"
      footer={(
        <>
          <button type="button" className="btn-secondary" disabled={isLoading} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={isLoading || activeCount === 0}
            onClick={handleSave}
          >
            Apply {activeCount ? `(${activeCount})` : ''}
          </button>
        </>
      )}
    >
      <div className="space-y-3 max-h-[min(60vh,420px)] overflow-y-auto pr-1">
        {FIELDS.map((f) => (
          <div
            key={f.key}
            className={`rounded-xl border px-3.5 py-3 ${enabled[f.key] ? 'border-brand-200 bg-brand-50/40' : 'border-stone-200 bg-white'}`}
          >
            <label className="flex items-center gap-2.5 cursor-pointer mb-2">
              <input
                type="checkbox"
                className="rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                checked={Boolean(enabled[f.key])}
                onChange={() => toggle(f.key)}
              />
              <span className="text-sm font-semibold text-stone-800">{f.label}</span>
            </label>
            {f.options ? (
              <PremiumSelect
                variant="list"
                value={values[f.key] || ''}
                onChange={(v) => setVal(f.key, v)}
                options={f.options}
                placeholder={`Select ${f.label.toLowerCase()}`}
                allowClear
              />
            ) : f.textarea ? (
              <textarea
                rows={2}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
                value={values[f.key] || ''}
                onChange={(e) => setVal(f.key, e.target.value)}
                placeholder={f.label}
              />
            ) : (
              <input
                type="text"
                className="w-full h-10 rounded-lg border border-stone-200 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 uppercase"
                value={values[f.key] || ''}
                onChange={(e) => setVal(f.key, e.target.value)}
                placeholder={f.label}
              />
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}
