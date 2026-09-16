import React, { useEffect, useState } from 'react';
import { Briefcase, Lock, Save, Loader2 } from 'lucide-react';
import PremiumSelect from '../ui/PremiumSelect';
import { authenticatedFetch } from '../../utils/fetchUtils';
import { EMPTY_DESK_DEFAULTS } from '../../utils/deskDefaults';
import useDeskDefaultOptions from '../../utils/useDeskDefaultOptions';
import { BASE } from './profileConstants';

export default function DeskDefaultsSection({
  deskDefaults,
  onSaved,
  toast,
  updateUser,
  isFreelancer,
}) {
  const [form, setForm] = useState(() => ({ ...EMPTY_DESK_DEFAULTS, ...(deskDefaults || {}) }));
  const [saving, setSaving] = useState(false);
  const {
    loading: optionsLoading,
    flsOptions,
    clientOptions,
    sourceOptions,
    productOptions,
  } = useDeskDefaultOptions();

  useEffect(() => {
    setForm({
      ...EMPTY_DESK_DEFAULTS,
      ...(deskDefaults || {}),
      locked: { ...EMPTY_DESK_DEFAULTS.locked, ...(deskDefaults?.locked || {}) },
    });
  }, [deskDefaults]);

  if (isFreelancer) return null;

  const locked = form.locked || {};

  const setField = (key, value) => {
    if (locked[key]) return;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const withCurrent = (options, current) => {
    const list = Array.isArray(options) ? [...options] : [];
    const cur = String(current || '').trim().toUpperCase();
    if (cur && !list.some((o) => String(o.value).toUpperCase() === cur)) {
      list.unshift({ value: cur, label: cur });
    }
    return list;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await authenticatedFetch(`${BASE}/api/profile/desk-defaults`, {
        method: 'PUT',
        body: JSON.stringify({
          fls: form.fls || '',
          client: form.client || '',
          source: form.source || '',
          product: form.product || '',
          location: form.location || '',
        }),
      });
      const data = await res.json();
      if (!data.success) {
        toast?.error(data.message || 'Could not save desk defaults');
        return;
      }
      const next = data.deskDefaults || form;
      onSaved?.(next);
      updateUser?.({ deskDefaults: next });
      toast?.success('Desk defaults saved. New candidates will use these values.');
    } catch {
      toast?.error('Could not save desk defaults');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div id="desk-defaults" className="card-ats-bordered overflow-hidden relative scroll-mt-24" data-tour="desk-defaults">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
      <div className="px-5 sm:px-6 py-4 border-b border-stone-100 flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Briefcase size={16} className="text-brand-600" />
            <h3 className="text-sm font-bold text-stone-900">Desk defaults</h3>
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            Pre-fill candidate fields when you add someone. Lists stay in sync with your org catalogs.
            Locked fields are controlled by an admin.
          </p>
        </div>
        <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? 'Saving…' : 'Save defaults'}
        </button>
      </div>

      <div className="px-5 sm:px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label-ats flex items-center gap-1.5">
            FLS / Non-FLS
            {locked.fls ? <Lock size={12} className="text-stone-400" /> : null}
          </label>
          {locked.fls ? (
            <div className="input-ats bg-stone-50 text-stone-700 flex items-center">{form.fls || '—'}</div>
          ) : (
            <PremiumSelect
              value={form.fls || ''}
              onChange={(v) => setField('fls', v || '')}
              options={flsOptions}
              placeholder={optionsLoading ? 'Loading…' : 'Select'}
              allowClear
              searchable
            />
          )}
        </div>
        <div>
          <label className="label-ats flex items-center gap-1.5">
            Default client
            {locked.client ? <Lock size={12} className="text-stone-400" /> : null}
          </label>
          {locked.client ? (
            <div className="input-ats bg-stone-50 text-stone-700 flex items-center">{form.client || '—'}</div>
          ) : (
            <PremiumSelect
              variant="list"
              value={form.client || ''}
              onChange={(v) => setField('client', v || '')}
              options={withCurrent(clientOptions, form.client)}
              placeholder={optionsLoading ? 'Loading…' : 'Select client'}
              allowClear
              searchable
              searchPlaceholder="Search clients…"
            />
          )}
        </div>
        <div>
          <label className="label-ats flex items-center gap-1.5">
            Default source
            {locked.source ? <Lock size={12} className="text-stone-400" /> : null}
          </label>
          {locked.source ? (
            <div className="input-ats bg-stone-50 text-stone-700 flex items-center">{form.source || '—'}</div>
          ) : (
            <PremiumSelect
              variant="list"
              value={form.source || ''}
              onChange={(v) => setField('source', v || '')}
              options={withCurrent(sourceOptions, form.source)}
              placeholder={optionsLoading ? 'Loading…' : 'Select source'}
              allowClear
              searchable
              searchPlaceholder="Search sources…"
            />
          )}
        </div>
        <div>
          <label className="label-ats flex items-center gap-1.5">
            Default product / skill
            {locked.product ? <Lock size={12} className="text-stone-400" /> : null}
          </label>
          {locked.product ? (
            <div className="input-ats bg-stone-50 text-stone-700 flex items-center">{form.product || '—'}</div>
          ) : (
            <PremiumSelect
              variant="list"
              value={form.product || ''}
              onChange={(v) => setField('product', v || '')}
              options={withCurrent(productOptions, form.product)}
              placeholder={optionsLoading ? 'Loading…' : 'Select product'}
              allowClear
              searchable
              searchPlaceholder="Search products…"
            />
          )}
        </div>
        <div className="sm:col-span-2">
          <label className="label-ats flex items-center gap-1.5">
            Default location
            {locked.location ? <Lock size={12} className="text-stone-400" /> : null}
          </label>
          <input
            className={`input-ats ${locked.location ? 'bg-stone-50' : ''}`}
            value={form.location || ''}
            disabled={locked.location}
            onChange={(e) => setField('location', e.target.value)}
            placeholder="City / region (optional)"
          />
        </div>
      </div>
    </div>
  );
}
