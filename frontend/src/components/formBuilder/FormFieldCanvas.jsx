import React from 'react';
import { Link } from 'react-router-dom';
import { FormInput, Plus, Trash2, GripVertical, Layers, ArrowRight } from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import PremiumSelect from '../ui/PremiumSelect';
import { FIELD_TYPES, emptyField, fieldKey } from './formBuilderConstants';

export default function FormFieldCanvas({
  jobId,
  loading,
  fields,
  setFields,
  updateField,
  onRequestDeleteField,
}) {
  return (
    <div data-tour="form-builder" className="lg:col-span-5 min-w-0 flex">
      <div className="card-ats-bordered relative overflow-hidden min-h-[28rem] flex flex-col w-full">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="relative px-4 sm:px-5 pt-4 pb-3 border-b border-stone-100 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold text-stone-900 tracking-tight">Field builder</h2>
            <p className="text-[11px] text-stone-400 mt-0.5">
              {loading ? 'Loading…' : `${fields.length} field${fields.length === 1 ? '' : 's'}`}
            </p>
          </div>
          <span className="badge-neutral text-[10px] flex-shrink-0 inline-flex items-center gap-1">
            <Layers className="w-3 h-3" /> Builder
          </span>
        </div>

        <div className="relative flex-1 p-3.5 sm:p-4 space-y-2.5 bg-[linear-gradient(180deg,#fafaf9_0%,#ffffff_48%)]">
          {loading ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map((i) => <div key={i} className="h-32 skeleton-ats rounded-2xl" />)}
            </div>
          ) : !jobId ? (
            <div className="h-full min-h-[18rem] flex items-center justify-center">
              <EmptyState
                icon={FormInput}
                tone="brand"
                compact
                message="Create a job first"
                subMessage="Forms are attached to individual job postings."
                action={(
                  <Link to="/jobs" className="btn-primary">
                    Go to Jobs <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
              />
            </div>
          ) : (
            <>
              {fields.map((field, idx) => {
                const dependOptions = [
                  { value: '', label: 'Always visible' },
                  ...fields
                    .map((f, i) => {
                      if (i === idx || !f.label?.trim()) return null;
                      return { value: fieldKey(f, i), label: f.label };
                    })
                    .filter(Boolean)
                ];
                const parent = fields.find((f, i) => {
                  if (i === idx || !f.label?.trim()) return false;
                  return fieldKey(f, i) === (field.showWhen?.fieldKey || '');
                });
                const equalsOpts = parent?.type === 'yes_no'
                  ? [
                    { value: 'Yes', label: 'Yes' },
                    { value: 'No', label: 'No' }
                  ]
                  : (['select', 'radio', 'multiselect'].includes(parent?.type)
                    ? (parent.options || []).map((opt) => ({ value: opt, label: opt }))
                    : null);

                return (
                  <div
                    key={idx}
                    className="group rounded-2xl border border-stone-200/70 bg-white p-3 sm:p-3.5 shadow-[0_1px_0_rgba(28,25,23,0.03)] hover:border-stone-300/90 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <div className="hidden sm:flex flex-col items-center gap-1 pt-2.5 w-6 flex-shrink-0 text-stone-300">
                        <GripVertical className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold text-stone-400 tabular-nums">{idx + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="label-ats">Label *</label>
                            <input
                              className="input-ats"
                              value={field.label}
                              onChange={(e) => updateField(idx, { label: e.target.value })}
                              placeholder="Field label"
                            />
                          </div>
                          <div>
                            <label className="label-ats">Type</label>
                            <PremiumSelect
                              compact
                              value={field.type}
                              onChange={(v) => updateField(idx, { type: v || 'text' })}
                              options={FIELD_TYPES}
                              placeholder="Field type"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
                          <div>
                            <label className="label-ats">Placeholder</label>
                            <input
                              className="input-ats"
                              value={field.placeholder || ''}
                              onChange={(e) => updateField(idx, { placeholder: e.target.value })}
                              placeholder="Hint text"
                            />
                          </div>
                          <label className="inline-flex items-center gap-2 h-10 px-3 rounded-xl border border-stone-200 bg-stone-50/80 text-sm text-stone-700 cursor-pointer select-none whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={!!field.required}
                              onChange={(e) => updateField(idx, { required: e.target.checked })}
                              className="rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                            />
                            Required
                          </label>
                        </div>
                        {['select', 'radio', 'multiselect'].includes(field.type) && (
                          <div>
                            <label className="label-ats">Options (comma-separated)</label>
                            <input
                              className="input-ats"
                              value={(field.options || []).join(', ')}
                              onChange={(e) => updateField(idx, {
                                options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                              })}
                              placeholder="Option 1, Option 2"
                            />
                          </div>
                        )}
                        <div className="rounded-xl bg-stone-50/90 border border-stone-100/90 px-2.5 py-2 space-y-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                            Show only when
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="label-ats">Depends on</label>
                              <PremiumSelect
                                compact
                                value={field.showWhen?.fieldKey || ''}
                                onChange={(v) => updateField(idx, {
                                  showWhen: { fieldKey: v || '', equals: '' }
                                })}
                                options={dependOptions}
                                placeholder="Always visible"
                                allowClear
                              />
                            </div>
                            <div>
                              <label className="label-ats">Equals</label>
                              {equalsOpts?.length ? (
                                <PremiumSelect
                                  compact
                                  value={field.showWhen?.equals || ''}
                                  onChange={(v) => updateField(idx, {
                                    showWhen: {
                                      ...(field.showWhen || {}),
                                      fieldKey: field.showWhen?.fieldKey || '',
                                      equals: v || ''
                                    }
                                  })}
                                  options={equalsOpts}
                                  placeholder="Select value…"
                                  disabled={!field.showWhen?.fieldKey}
                                  allowClear
                                />
                              ) : (
                                <input
                                  className="input-ats"
                                  placeholder="Equals value…"
                                  disabled={!field.showWhen?.fieldKey}
                                  value={field.showWhen?.equals || ''}
                                  onChange={(e) => updateField(idx, {
                                    showWhen: {
                                      ...(field.showWhen || {}),
                                      fieldKey: field.showWhen?.fieldKey || '',
                                      equals: e.target.value
                                    }
                                  })}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="p-2 rounded-xl text-stone-300 hover:text-red-500 hover:bg-red-50 flex-shrink-0 transition-colors opacity-70 group-hover:opacity-100"
                        onClick={() => {
                          if (fields.length <= 1) return;
                          onRequestDeleteField(idx);
                        }}
                        disabled={fields.length <= 1}
                        aria-label="Remove field"
                        title="Remove field"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
              <button
                type="button"
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-dashed border-stone-300 bg-white/70 px-3 py-3 text-sm font-semibold text-stone-600 hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50/40 transition-colors"
                onClick={() => setFields((prev) => [...prev, emptyField()])}
              >
                <Plus className="w-4 h-4" /> Add field
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
