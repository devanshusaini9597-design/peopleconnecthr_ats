import React, { useState } from 'react';
import { UserPlus, Loader2 } from 'lucide-react';
import Modal from './ui/Modal';
import { authenticatedFetch } from '../utils/fetchUtils';

const EMPTY = {
  name: '',
  email: '',
  phone: '',
  companyName: '',
  position: '',
  location: '',
  source: 'MIS Manual',
  marketingConsent: true,
};

/**
 * Simple Add Contact modal for MIS only (never writes to Candidates).
 */
export default function MisAddContactModal({ open, onClose, onCreated, toast }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const resetAndClose = () => {
    setForm(EMPTY);
    setErrors({});
    setSaving(false);
    onClose?.();
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = 'Required';
    const email = form.email.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) next.email = 'Valid email required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await authenticatedFetch('/api/mis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          companyName: form.companyName.trim(),
          position: form.position.trim(),
          location: form.location.trim(),
          source: form.source.trim() || 'MIS Manual',
          marketingConsent: Boolean(form.marketingConsent),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === 'DUPLICATE_EMAIL' || res.status === 409) {
          setErrors({ email: 'Already in MIS' });
        }
        throw new Error(data.message || 'Could not add contact');
      }
      toast?.success?.('Contact added to MIS');
      setForm(EMPTY);
      setErrors({});
      onCreated?.(data.data);
      onClose?.();
    } catch (err) {
      toast?.error?.(err.message || 'Could not add contact');
    } finally {
      setSaving(false);
    }
  };

  const fieldClass = (key) =>
    `w-full h-11 rounded-xl border px-3.5 text-sm font-medium outline-none transition-all ${
      errors[key]
        ? 'border-rose-300 bg-rose-50/40 focus:border-rose-400 focus:ring-2 focus:ring-rose-500/15'
        : 'border-stone-200 bg-stone-50/50 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15'
    }`;

  return (
    <Modal
      open={open}
      onClose={() => { if (!saving) resetAndClose(); }}
      title="Add MIS contact"
      description="Saves to marketing contacts only — not Candidates."
      size="md"
      icon={UserPlus}
      closeOnBackdrop={!saving}
      zClass="z-[130]"
      footer={
        <>
          <button type="button" className="btn-secondary" disabled={saving} onClick={resetAndClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" disabled={saving} onClick={submit}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
            Add to MIS
          </button>
        </>
      }
    >
      <form className="space-y-3.5" onSubmit={submit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block sm:col-span-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Full name *</span>
            <input
              className={`${fieldClass('name')} mt-1.5`}
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              autoFocus
              autoComplete="name"
            />
            {errors.name ? <span className="text-xs text-rose-600 mt-1 block">{errors.name}</span> : null}
          </label>
          <label className="block sm:col-span-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Email *</span>
            <input
              type="email"
              className={`${fieldClass('email')} mt-1.5`}
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
              autoComplete="email"
            />
            {errors.email ? <span className="text-xs text-rose-600 mt-1 block">{errors.email}</span> : null}
          </label>
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Phone</span>
            <input
              className={`${fieldClass('phone')} mt-1.5`}
              value={form.phone}
              onChange={(e) => setField('phone', e.target.value)}
              placeholder="10-digit mobile"
              autoComplete="tel"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Location</span>
            <input
              className={`${fieldClass('location')} mt-1.5`}
              value={form.location}
              onChange={(e) => setField('location', e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Company</span>
            <input
              className={`${fieldClass('companyName')} mt-1.5`}
              value={form.companyName}
              onChange={(e) => setField('companyName', e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Position</span>
            <input
              className={`${fieldClass('position')} mt-1.5`}
              value={form.position}
              onChange={(e) => setField('position', e.target.value)}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Source</span>
            <input
              className={`${fieldClass('source')} mt-1.5`}
              value={form.source}
              onChange={(e) => setField('source', e.target.value)}
            />
          </label>
        </div>
        <label className="flex items-center gap-2.5 rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-3 cursor-pointer">
          <input
            type="checkbox"
            className="rounded border-stone-300 text-brand-600 focus:ring-brand-500"
            checked={form.marketingConsent}
            onChange={(e) => setField('marketingConsent', e.target.checked)}
          />
          <span className="text-sm font-medium text-stone-700">Marketing consent</span>
        </label>
      </form>
    </Modal>
  );
}
