import React, { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import Modal from '../ui/Modal';
import PremiumSelect from '../ui/PremiumSelect';
import { EMPTY_DESK_DEFAULTS } from '../../utils/deskDefaults';
import useDeskDefaultOptions from '../../utils/useDeskDefaultOptions';

function withCurrent(options, current) {
  const list = Array.isArray(options) ? [...options] : [];
  const cur = String(current || '').trim().toUpperCase();
  if (cur && !list.some((o) => String(o.value).toUpperCase() === cur)) {
    list.unshift({ value: cur, label: cur });
  }
  return list;
}

export default function MemberDeskDefaultsModal({
  open,
  member,
  onClose,
  onSave,
  saving,
}) {
  const [form, setForm] = useState({ ...EMPTY_DESK_DEFAULTS });
  const {
    loading: optionsLoading,
    flsOptions,
    clientOptions,
    sourceOptions,
    productOptions,
  } = useDeskDefaultOptions();

  useEffect(() => {
    if (!open || !member) return;
    const d = member.deskDefaults || {};
    setForm({
      ...EMPTY_DESK_DEFAULTS,
      ...d,
      locked: { ...EMPTY_DESK_DEFAULTS.locked, ...(d.locked || {}) },
    });
  }, [open, member]);

  if (!member) return null;

  const setField = (key, value) => setForm((p) => ({ ...p, [key]: value }));
  const setLock = (key, value) => setForm((p) => ({
    ...p,
    locked: { ...p.locked, [key]: Boolean(value) },
  }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Desk defaults"
      description={`${member.name || member.email} — values pre-fill when they add candidates. Lock a field to keep it fixed.`}
      size="lg"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            type="button"
            disabled={saving}
            className="btn-primary"
            onClick={() => onSave?.(form)}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Saving…' : 'Save for teammate'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label-ats">FLS / Non-FLS</label>
          <PremiumSelect
            value={form.fls || ''}
            onChange={(v) => setField('fls', v || '')}
            options={flsOptions}
            placeholder={optionsLoading ? 'Loading…' : 'Select'}
            allowClear
            searchable
          />
          <label className="mt-2 flex items-center gap-2 text-xs text-stone-600">
            <input
              type="checkbox"
              checked={Boolean(form.locked?.fls)}
              onChange={(e) => setLock('fls', e.target.checked)}
            />
            Lock FLS (employee cannot change this default)
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label-ats">Client</label>
            <PremiumSelect
              variant="list"
              value={form.client || ''}
              onChange={(v) => setField('client', v || '')}
              options={withCurrent(clientOptions, form.client)}
              placeholder={optionsLoading ? 'Loading…' : 'Select client'}
              allowClear
              searchable
            />
            <label className="mt-2 flex items-center gap-2 text-xs text-stone-600">
              <input type="checkbox" checked={Boolean(form.locked?.client)} onChange={(e) => setLock('client', e.target.checked)} />
              Lock
            </label>
          </div>
          <div>
            <label className="label-ats">Source</label>
            <PremiumSelect
              variant="list"
              value={form.source || ''}
              onChange={(v) => setField('source', v || '')}
              options={withCurrent(sourceOptions, form.source)}
              placeholder={optionsLoading ? 'Loading…' : 'Select source'}
              allowClear
              searchable
            />
            <label className="mt-2 flex items-center gap-2 text-xs text-stone-600">
              <input type="checkbox" checked={Boolean(form.locked?.source)} onChange={(e) => setLock('source', e.target.checked)} />
              Lock
            </label>
          </div>
          <div>
            <label className="label-ats">Product / skill</label>
            <PremiumSelect
              variant="list"
              value={form.product || ''}
              onChange={(v) => setField('product', v || '')}
              options={withCurrent(productOptions, form.product)}
              placeholder={optionsLoading ? 'Loading…' : 'Select product'}
              allowClear
              searchable
            />
            <label className="mt-2 flex items-center gap-2 text-xs text-stone-600">
              <input type="checkbox" checked={Boolean(form.locked?.product)} onChange={(e) => setLock('product', e.target.checked)} />
              Lock
            </label>
          </div>
          <div>
            <label className="label-ats">Location</label>
            <input className="input-ats" value={form.location || ''} onChange={(e) => setField('location', e.target.value)} placeholder="Optional" />
            <label className="mt-2 flex items-center gap-2 text-xs text-stone-600">
              <input type="checkbox" checked={Boolean(form.locked?.location)} onChange={(e) => setLock('location', e.target.checked)} />
              Lock
            </label>
          </div>
        </div>
      </div>
    </Modal>
  );
}
