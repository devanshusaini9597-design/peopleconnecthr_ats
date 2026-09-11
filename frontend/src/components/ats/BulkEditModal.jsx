import React, { useEffect, useMemo, useState } from 'react';
import { Pencil } from 'lucide-react';
import Modal from '../ui/Modal';
import PremiumSelect from '../ui/PremiumSelect';
import { canEditCandidateSpoc } from '../../utils/spocIdentity';
import { useAuth } from '../../context/AuthContext';

const FIELDS = [
  { key: 'status', label: 'Status' },
  { key: 'source', label: 'Source of CV' },
  { key: 'client', label: 'Client' },
  { key: 'position', label: 'Position' },
  { key: 'spoc', label: 'SPOC' },
  { key: 'companyName', label: 'Company', freeText: true },
  { key: 'location', label: 'Location', freeText: true },
  { key: 'remark', label: 'Remark', freeText: true, textarea: true },
];

/**
 * Bulk edit selected candidates — tick fields to apply, leave others unchanged.
 */
export default function BulkEditModal({
  open,
  onClose,
  selectedCount = 0,
  onSubmit,
  isLoading = false,
  statusOptions = [],
  sourceOptions = [],
  clientOptions = [],
  positionOptions = [],
  spocOptions = [],
}) {
  const { user } = useAuth();
  const canEditSpoc = canEditCandidateSpoc(user?.role);

  const [enabled, setEnabled] = useState({});
  const [values, setValues] = useState({});

  useEffect(() => {
    if (!open) return;
    setEnabled({});
    setValues({});
  }, [open]);

  const visibleFields = useMemo(
    () => FIELDS.filter((f) => (f.key === 'spoc' ? canEditSpoc : true)),
    [canEditSpoc]
  );

  const optionsFor = (key) => {
    if (key === 'status') return statusOptions;
    if (key === 'source') return sourceOptions;
    if (key === 'client') return clientOptions;
    if (key === 'position') return positionOptions;
    if (key === 'spoc') return spocOptions;
    return [];
  };

  const toggle = (key) => {
    setEnabled((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      return next;
    });
  };

  const setVal = (key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setEnabled((prev) => ({ ...prev, [key]: true }));
  };

  const activeCount = visibleFields.filter((f) => enabled[f.key]).length;

  const handleSave = () => {
    const updates = {};
    for (const f of visibleFields) {
      if (!enabled[f.key]) continue;
      const v = values[f.key];
      if (v == null || String(v).trim() === '') continue;
      updates[f.key] = String(v).trim();
    }
    if (Object.keys(updates).length === 0) return;
    onSubmit?.(updates);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      icon={Pencil}
      title="Bulk edit"
      description={`Apply the same field values to ${selectedCount} selected candidate${selectedCount === 1 ? '' : 's'}. Unticked fields stay unchanged.`}
      footer={(
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSave}
            disabled={isLoading || activeCount === 0}
          >
            {isLoading ? 'Updating…' : `Update ${selectedCount} candidate${selectedCount === 1 ? '' : 's'}`}
          </button>
        </>
      )}
    >
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        {visibleFields.map((f) => {
          const on = !!enabled[f.key];
          const opts = optionsFor(f.key);
          return (
            <div
              key={f.key}
              className={`rounded-xl border px-3.5 py-3 transition-colors ${
                on ? 'border-brand-200 bg-brand-50/40' : 'border-stone-200 bg-white'
              }`}
            >
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(f.key)}
                  className="h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-sm font-semibold text-stone-800">{f.label}</span>
              </label>
              <div className={`mt-2.5 ${on ? '' : 'opacity-50 pointer-events-none'}`}>
                {f.freeText ? (
                  f.textarea ? (
                    <textarea
                      className="input-ats !min-h-[72px] !py-2 text-sm"
                      placeholder={`New ${f.label.toLowerCase()}…`}
                      value={values[f.key] || ''}
                      onChange={(e) => setVal(f.key, e.target.value)}
                      disabled={!on}
                    />
                  ) : (
                    <input
                      className="input-ats !h-10 text-sm"
                      placeholder={`New ${f.label.toLowerCase()}…`}
                      value={values[f.key] || ''}
                      onChange={(e) => setVal(f.key, e.target.value)}
                      disabled={!on}
                    />
                  )
                ) : (
                  <PremiumSelect
                    variant="list"
                    value={values[f.key] || ''}
                    onChange={(v) => setVal(f.key, v)}
                    options={[{ value: '', label: `Select ${f.label.toLowerCase()}` }, ...opts]}
                    placeholder={`Select ${f.label.toLowerCase()}`}
                    searchable
                    searchPlaceholder="Type to filter…"
                    disabled={!on}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      {activeCount === 0 && (
        <p className="text-xs text-amber-700 mt-3">Tick at least one field and choose a value.</p>
      )}
    </Modal>
  );
}
