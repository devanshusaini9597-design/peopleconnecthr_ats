import React, { useEffect, useState } from 'react';
import { Briefcase, Loader2, Save } from 'lucide-react';
import PremiumSelect from '../ui/PremiumSelect';
import { authenticatedFetch } from '../../utils/fetchUtils';
import { EMPTY_DESK_DEFAULTS } from '../../utils/deskDefaults';
import { MEMBER_ROLE_OPTIONS } from './constants';
import API_URL from '../../config';
import useDeskDefaultOptions from '../../utils/useDeskDefaultOptions';

const EDITABLE_ROLES = MEMBER_ROLE_OPTIONS
  .map((r) => r.value)
  .filter((v) => v !== 'freelancer');

function withCurrent(options, current) {
  const list = Array.isArray(options) ? [...options] : [];
  const cur = String(current || '').trim().toUpperCase();
  if (cur && !list.some((o) => String(o.value).toUpperCase() === cur)) {
    list.unshift({ value: cur, label: cur });
  }
  return list;
}

export default function RoleDeskDefaultsPanel({ toast, canEdit }) {
  const [map, setMap] = useState({});
  const [role, setRole] = useState('hr_recruiter');
  const [form, setForm] = useState({ ...EMPTY_DESK_DEFAULTS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const {
    loading: optionsLoading,
    flsOptions,
    clientOptions,
    sourceOptions,
    productOptions,
  } = useDeskDefaultOptions();

  useEffect(() => {
    if (!canEdit) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await authenticatedFetch(`${API_URL}/api/organization`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        const orgDoc = data?.data || data?.organization || data;
        const next = orgDoc?.atsSettings?.roleDeskDefaults || {};
        setMap(next && typeof next === 'object' ? next : {});
      } catch {
        if (!cancelled) toast?.error('Could not load role desk defaults');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [canEdit, toast]);

  useEffect(() => {
    const d = map[role] || {};
    setForm({
      ...EMPTY_DESK_DEFAULTS,
      ...d,
      locked: { ...EMPTY_DESK_DEFAULTS.locked, ...(d.locked || {}) },
    });
  }, [role, map]);

  if (!canEdit) return null;

  const setField = (key, value) => setForm((p) => ({ ...p, [key]: value }));
  const setLock = (key, value) => setForm((p) => ({
    ...p,
    locked: { ...p.locked, [key]: Boolean(value) },
  }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const nextMap = {
        ...map,
        [role]: {
          fls: form.fls || '',
          client: form.client || '',
          source: form.source || '',
          product: form.product || '',
          location: form.location || '',
          locked: { ...form.locked },
        },
      };
      const res = await authenticatedFetch(`${API_URL}/api/organization/role-desk-defaults`, {
        method: 'PUT',
        body: JSON.stringify({ roleDeskDefaults: nextMap }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.message || 'Failed to save role defaults');
      }
      const saved = data.data?.roleDeskDefaults || nextMap;
      setMap(saved);
      toast?.success(`Role defaults saved for ${role.replace(/_/g, ' ')}`);
    } catch (err) {
      toast?.error(err.message || 'Failed to save role defaults');
    } finally {
      setSaving(false);
    }
  };

  const roleOptions = EDITABLE_ROLES.map((value) => {
    const meta = MEMBER_ROLE_OPTIONS.find((r) => r.value === value);
    return { value, label: meta?.label || value };
  });

  return (
    <div className="card-ats-bordered overflow-hidden relative mb-5" data-tour="role-desk-defaults">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
      <div className="px-5 sm:px-6 py-4 border-b border-stone-100 flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Briefcase size={16} className="text-brand-600" />
            <h3 className="text-sm font-bold text-stone-900">Role desk defaults</h3>
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            Apply to everyone with this role when their personal Profile default is empty. Lock to force the value.
          </p>
        </div>
        <button type="button" onClick={handleSave} disabled={saving || loading} className="btn-primary">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? 'Saving…' : 'Save role defaults'}
        </button>
      </div>

      {loading ? (
        <div className="px-5 py-8 flex justify-center text-stone-400">
          <Loader2 className="animate-spin" size={20} />
        </div>
      ) : (
        <div className="px-5 sm:px-6 py-5 space-y-4">
          <div className="max-w-xs">
            <label className="label-ats">Role</label>
            <PremiumSelect
              value={role}
              onChange={(v) => setRole(v || 'hr_recruiter')}
              options={roleOptions}
              placeholder="Select role"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-ats">FLS / Non-FLS</label>
              <PremiumSelect
                value={form.fls || ''}
                onChange={(v) => setField('fls', v || '')}
                options={flsOptions}
                allowClear
                searchable
                placeholder={optionsLoading ? 'Loading…' : 'Not set'}
              />
              <label className="mt-2 flex items-center gap-2 text-xs text-stone-600">
                <input type="checkbox" checked={Boolean(form.locked?.fls)} onChange={(e) => setLock('fls', e.target.checked)} />
                Lock for this role
              </label>
            </div>
            <div>
              <label className="label-ats">Default client</label>
              <PremiumSelect
                variant="list"
                value={form.client || ''}
                onChange={(v) => setField('client', v || '')}
                options={withCurrent(clientOptions, form.client)}
                allowClear
                searchable
                placeholder={optionsLoading ? 'Loading…' : 'Select client'}
              />
              <label className="mt-2 flex items-center gap-2 text-xs text-stone-600">
                <input type="checkbox" checked={Boolean(form.locked?.client)} onChange={(e) => setLock('client', e.target.checked)} />
                Lock
              </label>
            </div>
            <div>
              <label className="label-ats">Default source</label>
              <PremiumSelect
                variant="list"
                value={form.source || ''}
                onChange={(v) => setField('source', v || '')}
                options={withCurrent(sourceOptions, form.source)}
                allowClear
                searchable
                placeholder={optionsLoading ? 'Loading…' : 'Select source'}
              />
              <label className="mt-2 flex items-center gap-2 text-xs text-stone-600">
                <input type="checkbox" checked={Boolean(form.locked?.source)} onChange={(e) => setLock('source', e.target.checked)} />
                Lock
              </label>
            </div>
            <div>
              <label className="label-ats">Product / location</label>
              <div className="grid grid-cols-1 gap-2">
                <PremiumSelect
                  variant="list"
                  value={form.product || ''}
                  onChange={(v) => setField('product', v || '')}
                  options={withCurrent(productOptions, form.product)}
                  allowClear
                  searchable
                  placeholder={optionsLoading ? 'Loading…' : 'Product / skill'}
                />
                <input className="input-ats" value={form.location || ''} onChange={(e) => setField('location', e.target.value)} placeholder="Location" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
