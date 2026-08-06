import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';
import PremiumSelect from '../ui/PremiumSelect';
import RecipientPicker from './RecipientPicker';
import {
  emptyForm, REPORT_TYPES, FORMAT_OPTIONS, RANGE_OPTIONS, FREQ_OPTIONS,
} from './scheduledReportsConstants';

export default function ScheduleModal({ open, onClose, onSave, saving, members, membersLoading }) {
  const [form, setForm] = useState(emptyForm);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (open) setForm(emptyForm);
  }, [open]);

  const canSave = form.name.trim() && form.recipients.length > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Scheduled Report"
      description="Email a report to your team on a recurring cadence."
      size="lg"
      footer={
        <>
          <span className="hidden sm:inline text-xs font-medium text-stone-400 mr-auto self-center">
            {form.recipients.length} recipient{form.recipients.length !== 1 ? 's' : ''}
          </span>
          <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>Cancel</button>
          <button
            type="button"
            onClick={() => onSave({ ...form })}
            disabled={saving || !canSave}
            className="btn-primary"
          >
            {saving ? <><Loader2 size={16} className="animate-spin" /> Creating…</> : 'Create Schedule'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <section className="space-y-3">
          <h3 className="section-title-ats !mb-0">
            <CalendarClock className="w-4 h-4 text-brand-600" />
            Schedule details
          </h3>
          <div>
            <label className="label-ats">Schedule name *</label>
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Weekly recruiter summary"
              className="input-ats"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="label-ats">Report</label>
              <PremiumSelect
                value={form.reportType}
                onChange={(v) => set('reportType', v || 'recruitment-summary')}
                options={REPORT_TYPES.map((r) => ({
                  value: r.id,
                  label: r.label,
                  description: r.description,
                }))}
                placeholder="Select report"
                searchable
                variant="list"
              />
            </div>
            <div>
              <label className="label-ats">Format</label>
              <PremiumSelect
                value={form.format}
                onChange={(v) => set('format', v || 'xlsx')}
                options={FORMAT_OPTIONS}
                placeholder="Format"
                variant="list"
              />
            </div>
            <div>
              <label className="label-ats">Date range</label>
              <PremiumSelect
                value={form.dateRange}
                onChange={(v) => set('dateRange', v || 'month')}
                options={RANGE_OPTIONS}
                placeholder="Range"
                variant="list"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label-ats">Frequency</label>
              <PremiumSelect
                value={form.frequency}
                onChange={(v) => set('frequency', v || 'weekly')}
                options={FREQ_OPTIONS}
                placeholder="Frequency"
                variant="list"
              />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="section-title-ats !mb-0">
            <Users className="w-4 h-4 text-brand-600" />
            Recipients *
          </h3>
          <RecipientPicker
            members={members}
            membersLoading={membersLoading}
            value={form.recipients}
            onChange={(recipients) => set('recipients', recipients)}
          />
        </section>
      </div>
    </Modal>
  );
};
