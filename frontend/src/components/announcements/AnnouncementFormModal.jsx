import React from 'react';
import { Pencil, Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';
import { SEVERITIES, AUDIENCES, severityMeta } from './announcementsConstants';

function AudiencePicker({ value, onChange }) {
  return (
    <div className="space-y-2">
      {AUDIENCES.map((a) => {
        const active = value === a.value;
        const Icon = a.icon;
        return (
          <button
            key={a.value}
            type="button"
            onClick={() => onChange(a.value)}
            className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all ${
              active
                ? 'border-brand-400 bg-brand-50/70 shadow-sm'
                : 'border-stone-200 bg-white hover:border-brand-300 hover:bg-brand-50/40'
            }`}
          >
            <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${active ? 'text-brand-600' : 'text-stone-400'}`} />
            <span className="min-w-0">
              <span className={`block text-xs font-bold ${active ? 'text-brand-800' : 'text-stone-700'}`}>{a.label}</span>
              <span className="block text-[11px] text-stone-500 mt-0.5">{a.hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SeverityPicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {SEVERITIES.map((s) => {
        const active = value === s.value;
        const Icon = s.icon;
        return (
          <button
            key={s.value}
            type="button"
            onClick={() => onChange(s.value)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left text-xs font-bold transition-all ${
              active
                ? 'border-brand-400 bg-brand-50/70 text-brand-800 shadow-sm'
                : 'border-stone-200 bg-white text-stone-600 hover:border-brand-300 hover:bg-brand-50/40'
            }`}
          >
            <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${active ? 'text-brand-600' : 'text-stone-400'}`} />
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

export function AnnouncementFields({ form, setForm, idPrefix = 'ann' }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="label-ats" htmlFor={`${idPrefix}-title`}>Title *</label>
        <input
          id={`${idPrefix}-title`}
          className="input-ats"
          placeholder="e.g. Hiring freeze lifted"
          required
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />
      </div>
      <div>
        <label className="label-ats" htmlFor={`${idPrefix}-body`}>Message *</label>
        <textarea
          id={`${idPrefix}-body`}
          className="input-ats resize-none min-h-[7.5rem]"
          rows={5}
          placeholder="What should people know?"
          required
          value={form.body}
          onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
        />
      </div>
      <div>
        <label className="label-ats">Show where *</label>
        <AudiencePicker value={form.audience} onChange={(audience) => setForm((f) => ({ ...f, audience }))} />
      </div>
      <div>
        <label className="label-ats">Severity</label>
        <SeverityPicker value={form.severity} onChange={(severity) => setForm((f) => ({ ...f, severity }))} />
      </div>
    </div>
  );
}

export default function AnnouncementFormModal({
  open,
  onClose,
  form,
  setForm,
  onSubmit,
  saving,
}) {
  const editSeverity = severityMeta(form.severity);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit announcement"
      description="Changes apply immediately to the live banner for the selected audience."
      size="lg"
      closeOnBackdrop={!saving}
      footer={(
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="edit-announcement-form" className="btn-primary" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
            Save changes
          </button>
        </>
      )}
    >
      <form id="edit-announcement-form" onSubmit={onSubmit} className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-stone-500">Update title, message, audience, or severity.</p>
          <span className={`${editSeverity.badge} text-[10px] capitalize flex-shrink-0`}>
            {form.severity}
          </span>
        </div>
        <AnnouncementFields form={form} setForm={setForm} idPrefix="edit" />
      </form>
    </Modal>
  );
}
