import React, { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import Modal from '../ui/Modal';
import PremiumSelect from '../ui/PremiumSelect';
import { EMPTY_DESK_DEFAULTS, FLS_OPTIONS } from '../../utils/deskDefaults';

export default function MemberDeskDefaultsModal({
  open,
  member,
  onClose,
  onSave,
  saving,
}) {
  const [form, setForm] = useState({ ...EMPTY_DESK_DEFAULTS });

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
      description={`${member.name || member.email} — auto-filled when they add candidates. Lock a field to keep it fixed.`}
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
            options={FLS_OPTIONS}
            placeholder="Select"
            allowClear
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
            <input className="input-ats" value={form.client || ''} onChange={(e) => setField('client', e.target.value)} placeholder="Optional" />
            <label className="mt-2 flex items-center gap-2 text-xs text-stone-600">
              <input type="checkbox" checked={Boolean(form.locked?.client)} onChange={(e) => setLock('client', e.target.checked)} />
              Lock
            </label>
          </div>
          <div>
            <label className="label-ats">Source</label>
            <input className="input-ats" value={form.source || ''} onChange={(e) => setField('source', e.target.value)} placeholder="Optional" />
            <label className="mt-2 flex items-center gap-2 text-xs text-stone-600">
              <input type="checkbox" checked={Boolean(form.locked?.source)} onChange={(e) => setLock('source', e.target.checked)} />
              Lock
            </label>
          </div>
          <div>
            <label className="label-ats">Product / skill</label>
            <input className="input-ats" value={form.product || ''} onChange={(e) => setField('product', e.target.value)} placeholder="Optional" />
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
