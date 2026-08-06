import React from 'react';
import { Plus, Loader2, Trash2, Mail } from 'lucide-react';
import Modal from '../ui/Modal';
import PremiumSelect from '../ui/PremiumSelect';
import {
  CHANNEL_OPTIONS,
  TRIGGER_OPTIONS,
  MERGE_TAGS,
  emptyStep,
  insertAtCursor,
} from './sequencesConstants';

function MergeTagPicker({ onInsert }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-400 mr-0.5">
        Insert
      </span>
      {MERGE_TAGS.map((tag) => (
        <button
          key={tag.token}
          type="button"
          onClick={() => onInsert(tag.token)}
          title={`Inserts ${tag.token} → becomes “${tag.example}” when sent`}
          className="inline-flex items-center gap-1 rounded-lg border border-brand-200/80 bg-brand-50/70 px-2 py-1 text-[11px] font-semibold text-brand-800 hover:bg-brand-100/80 hover:border-brand-300 transition-colors"
        >
          {tag.label}
        </button>
      ))}
    </div>
  );
}

export default function SequenceCreateModal({
  open,
  onClose,
  form,
  setForm,
  updateStep,
  onSubmit,
  saving,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New sequence"
      description="Define steps with channel, delay, and personalized copy."
      size="lg"
      closeOnBackdrop={!saving}
      footer={(
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="submit"
            form="seq-create-form"
            disabled={saving || !form.name.trim()}
            className="btn-primary"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create sequence
          </button>
        </>
      )}
    >
      <form id="seq-create-form" onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="label-ats" htmlFor="seq-name">Name *</label>
            <input
              id="seq-name"
              className="input-ats"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Post-application nurture"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label-ats" htmlFor="seq-desc">Description</label>
            <input
              id="seq-desc"
              className="input-ats"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional short summary"
            />
          </div>
          <div className="sm:col-span-2 max-w-sm">
            <label className="label-ats">Trigger</label>
            <PremiumSelect
              compact
              value={form.triggerType}
              onChange={(v) => setForm({ ...form, triggerType: v || 'manual' })}
              options={TRIGGER_OPTIONS}
              placeholder="Trigger"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h4 className="font-semibold text-stone-800 text-sm">Steps</h4>
              <p className="text-[11px] text-stone-400 mt-0.5">{form.steps.length} step{form.steps.length === 1 ? '' : 's'}</p>
            </div>
            <button
              type="button"
              className="btn-secondary !py-1.5 !text-xs"
              onClick={() => setForm({ ...form, steps: [...form.steps, emptyStep()] })}
            >
              <Plus className="w-3.5 h-3.5" /> Add step
            </button>
          </div>

          {form.steps.map((step, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-stone-200/80 bg-stone-50/60 p-3 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-700">Step {idx + 1}</span>
                {form.steps.length > 1 && (
                  <button
                    type="button"
                    className="p-1.5 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    onClick={() => setForm({ ...form, steps: form.steps.filter((_, i) => i !== idx) })}
                    aria-label={`Remove step ${idx + 1}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="label-ats">Channel</label>
                  <PremiumSelect
                    compact
                    icon={Mail}
                    value={step.channel}
                    onChange={(v) => updateStep(idx, { channel: v || 'email' })}
                    options={CHANNEL_OPTIONS}
                    placeholder="Channel"
                  />
                </div>
                <div>
                  <label className="label-ats">Delay (days)</label>
                  <input
                    type="number"
                    min="0"
                    className="input-ats"
                    value={step.delayDays}
                    onChange={(e) => updateStep(idx, { delayDays: Number(e.target.value) || 0 })}
                  />
                </div>
              </div>
              {step.channel === 'email' && (
                <div className="space-y-1.5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                    <label className="label-ats !mb-0">Subject</label>
                    <MergeTagPicker
                      onInsert={(token) => {
                        const el = document.getElementById(`seq-step-${idx}-subject`);
                        updateStep(idx, { subject: insertAtCursor(el, step.subject, token) });
                      }}
                    />
                  </div>
                  <input
                    id={`seq-step-${idx}-subject`}
                    className="input-ats"
                    value={step.subject}
                    onChange={(e) => updateStep(idx, { subject: e.target.value })}
                    placeholder="Subject line"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                  <label className="label-ats !mb-0">Body</label>
                  <MergeTagPicker
                    onInsert={(token) => {
                      const el = document.getElementById(`seq-step-${idx}-body`);
                      updateStep(idx, { body: insertAtCursor(el, step.body, token) });
                    }}
                  />
                </div>
                <textarea
                  id={`seq-step-${idx}-body`}
                  className="input-ats resize-none min-h-[5.5rem]"
                  rows={3}
                  value={step.body}
                  onChange={(e) => updateStep(idx, { body: e.target.value })}
                  placeholder="Click a tag above to personalize — e.g. Candidate name"
                  required
                />
                <p className="text-[11px] text-stone-400 leading-snug">
                  Click a tag to insert it. When the message sends, tags become that candidate’s real details.
                </p>
              </div>
            </div>
          ))}
        </div>
      </form>
    </Modal>
  );
}
