import React, { useMemo, useState } from 'react';
import { Eye, Loader2, Paperclip, Pin, Pencil, Save, Send, X } from 'lucide-react';
import Modal from '../ui/Modal';
import EmailBodyEditor from '../ui/EmailBodyEditor';
import {
  AUDIENCES, BODY_MAX, SEVERITIES, TITLE_MAX, plainText, severityMeta,
} from './announcementsConstants';
import { noticePreviewText } from './NoticeBody';

function ChoiceList({ options, selected, onToggle, empty }) {
  if (!options?.length) {
    return <p className="text-[11px] text-stone-400 leading-relaxed">{empty}</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const value = option.value ?? option;
        const label = option.label ?? option;
        const on = selected.includes(value);
        return (
          <button
            key={value}
            type="button"
            onClick={() => onToggle(value)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
              on
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-stone-600 border-stone-200 hover:border-brand-300'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function AudiencePicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {AUDIENCES.map((item) => {
        const active = value === item.value;
        const Icon = item.icon;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all ${
              active
                ? 'border-brand-400 bg-brand-50/70 shadow-sm'
                : 'border-stone-200 bg-white hover:border-brand-300'
            }`}
          >
            <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${active ? 'text-brand-600' : 'text-stone-400'}`} />
            <span className="min-w-0">
              <span className={`block text-xs font-bold ${active ? 'text-brand-800' : 'text-stone-700'}`}>{item.label}</span>
              <span className="block text-[11px] text-stone-500 mt-0.5">{item.hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function BannerPreview({ form }) {
  const meta = severityMeta(form.severity);
  const Icon = meta.icon;
  const text = noticePreviewText(form.body) || 'Your message will show here.';
  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      <div className={`h-1 bg-gradient-to-r ${meta.bar}`} />
      <div className="px-3 py-2.5 flex items-start gap-2.5">
        <div className="w-7 h-7 rounded-md bg-stone-100 text-stone-600 flex items-center justify-center flex-shrink-0">
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-stone-900 truncate">{form.title || 'Notice title'}</p>
          <p className="text-xs text-stone-500 mt-0.5 line-clamp-3">{text}</p>
        </div>
      </div>
    </div>
  );
}

function toggleValue(list, value) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export default function AnnouncementFormModal({
  open,
  mode = 'create',
  onClose,
  form,
  setForm,
  onSubmit,
  saving,
  targetOptions,
  files,
  setFiles,
  existingAttachments = [],
  onRemoveAttachment,
  editorKey = 'ann',
}) {
  const [showPreview, setShowPreview] = useState(false);
  const editing = mode === 'edit';
  const bodyLen = plainText(form.body || '').length;
  const staffAudience = form.audience !== 'public' && form.audience !== 'freelancers';
  const canTarget = form.audience !== 'public';
  const teams = useMemo(() => (targetOptions?.teams || []).map((team) => ({
    value: team.id,
    label: `${team.name} (${team.reportCount})`,
  })), [targetOptions]);

  const set = (patch) => setForm((current) => ({ ...current, ...patch }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit announcement' : 'New announcement'}
      description={editing
        ? 'Save a correction quietly, or notify the audience again so it shows as unread.'
        : 'Drafts stay off the banner. Publish sends it to the audience you pick.'}
      size="xl"
      closeOnBackdrop={!saving}
      footer={(
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setShowPreview((value) => !value)}
          >
            <Eye className="w-4 h-4" />
            {showPreview ? 'Hide preview' : 'Preview banner'}
          </button>
          {!editing ? (
            <button type="button" className="btn-secondary" disabled={saving} onClick={() => onSubmit('draft')}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save draft
            </button>
          ) : null}
          <button type="button" className="btn-primary" disabled={saving} onClick={() => onSubmit(editing ? 'save' : 'publish')}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? <Pencil className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            {editing ? 'Save changes' : 'Publish'}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        {showPreview ? <BannerPreview form={form} /> : null}

        <div>
          <div className="flex items-center justify-between">
            <label className="label-ats" htmlFor="ann-title">Title *</label>
            <span className={`text-[11px] ${form.title.length > TITLE_MAX ? 'text-red-600' : 'text-stone-400'}`}>
              {form.title.length}/{TITLE_MAX}
            </span>
          </div>
          <input
            id="ann-title"
            className="input-ats"
            maxLength={TITLE_MAX}
            placeholder="e.g. Hiring freeze lifted"
            value={form.title}
            onChange={(e) => set({ title: e.target.value })}
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="label-ats">Message *</label>
            <span className={`text-[11px] ${bodyLen > BODY_MAX ? 'text-red-600' : 'text-stone-400'}`}>
              {bodyLen}/{BODY_MAX}
            </span>
          </div>
          <EmailBodyEditor
            key={editorKey}
            value={form.body}
            onChange={(html) => set({ body: html })}
            placeholder="What should people know?"
          />
        </div>

        <div>
          <label className="label-ats">Show where *</label>
          <AudiencePicker value={form.audience} onChange={(audience) => set({ audience })} />
        </div>

        <div>
          <label className="label-ats">Severity</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SEVERITIES.map((item) => {
              const active = form.severity === item.value;
              const Icon = item.icon;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => set({ severity: item.value })}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold ${
                    active ? 'border-brand-400 bg-brand-50 text-brand-800' : 'border-stone-200 bg-white text-stone-600'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label-ats" htmlFor="ann-start">Starts</label>
            <input
              id="ann-start"
              type="datetime-local"
              className="input-ats"
              value={form.startsAt || ''}
              onChange={(e) => set({ startsAt: e.target.value })}
            />
            <p className="text-[11px] text-stone-400 mt-1">Leave blank to start immediately.</p>
          </div>
          <div>
            <label className="label-ats" htmlFor="ann-end">Ends</label>
            <input
              id="ann-end"
              type="datetime-local"
              className="input-ats"
              value={form.endsAt || ''}
              onChange={(e) => set({ endsAt: e.target.value })}
            />
            <p className="text-[11px] text-stone-400 mt-1">Leave blank to keep it until you deactivate it.</p>
          </div>
        </div>

        {canTarget ? (
          <div className="rounded-xl border border-stone-200 p-3 space-y-3">
            <p className="text-xs font-bold text-stone-800">Narrow the audience</p>
            <p className="text-[11px] text-stone-500 leading-relaxed">
              Optional. Every filter you turn on must match. Department and office come from the team directory (same work email). Location is the person’s desk location. Team is a manager plus their direct reports.
            </p>
            <div>
              <p className="text-[11px] font-semibold text-stone-500 mb-1">Department</p>
              <ChoiceList
                options={targetOptions?.departments || []}
                selected={form.departments || []}
                onToggle={(value) => set({ departments: toggleValue(form.departments || [], value) })}
                empty="No departments on the team directory yet."
              />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-stone-500 mb-1">Location</p>
              <ChoiceList
                options={targetOptions?.locations || []}
                selected={form.locations || []}
                onToggle={(value) => set({ locations: toggleValue(form.locations || [], value) })}
                empty="No desk locations yet. People set these on their profile desk defaults."
              />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-stone-500 mb-1">Office</p>
              <ChoiceList
                options={targetOptions?.offices || []}
                selected={form.offices || []}
                onToggle={(value) => set({ offices: toggleValue(form.offices || [], value) })}
                empty="No offices yet. Add an office on a team directory profile."
              />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-stone-500 mb-1">Team</p>
              <ChoiceList
                options={teams}
                selected={form.teams || []}
                onToggle={(value) => set({ teams: toggleValue(form.teams || [], value) })}
                empty="No manager with direct reports yet."
              />
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <label className="flex items-start gap-3 rounded-xl border border-stone-200 px-3 py-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={Boolean(form.pinned)}
              onChange={(e) => set({ pinned: e.target.checked })}
            />
            <span>
              <span className="flex items-center gap-1 text-xs font-bold text-stone-800"><Pin className="w-3.5 h-3.5" /> Pin to the top</span>
              <span className="block text-[11px] text-stone-500 mt-0.5">Pinned notices stay above newer ones on the banner and the board.</span>
            </span>
          </label>
          {form.audience !== 'public' ? (
            <label className="flex items-start gap-3 rounded-xl border border-stone-200 px-3 py-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={Boolean(form.requiresAck)}
                onChange={(e) => set({ requiresAck: e.target.checked })}
              />
              <span>
                <span className="block text-xs font-bold text-stone-800">Require acknowledgment</span>
                <span className="block text-[11px] text-stone-500 mt-0.5">People must confirm they read it before the banner can be dismissed.</span>
              </span>
            </label>
          ) : null}
          {staffAudience && !editing ? (
            <label className="flex items-start gap-3 rounded-xl border border-stone-200 px-3 py-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={form.notifyEmail !== false}
                onChange={(e) => set({ notifyEmail: e.target.checked })}
              />
              <span>
                <span className="block text-xs font-bold text-stone-800">Email employees</span>
                <span className="block text-[11px] text-stone-500 mt-0.5">Also send this notice to work email. Freelancer notices never email.</span>
              </span>
            </label>
          ) : null}
          {editing && form.audience !== 'public' ? (
            <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={form.notifyAgain !== false}
                onChange={(e) => set({ notifyAgain: e.target.checked })}
              />
              <span>
                <span className="block text-xs font-bold text-stone-800">Notify the audience again</span>
                <span className="block text-[11px] text-stone-500 mt-0.5">Marks the notice unread, brings the banner back, and sends a new alert. Leave off for a quiet typo fix.</span>
              </span>
            </label>
          ) : null}
        </div>

        <div>
          <label className="label-ats">Attachments</label>
          <label className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-stone-200 text-xs font-semibold text-stone-700 cursor-pointer hover:border-brand-300">
            <Paperclip className="w-3.5 h-3.5" />
            Add files
            <input
              type="file"
              className="hidden"
              multiple
              accept=".pdf,.doc,.docx,.xlsx,.xls,.csv,.txt,.jpg,.jpeg,.png,.gif,.webp"
              onChange={(e) => {
                const picked = Array.from(e.target.files || []);
                setFiles((current) => [...current, ...picked].slice(0, 3));
                e.target.value = '';
              }}
            />
          </label>
          <p className="text-[11px] text-stone-400 mt-1">Up to 3 files, 5 MB each. PDF, Office, text, or images.</p>
          <ul className="mt-2 space-y-1">
            {existingAttachments.map((file) => (
              <li key={file._id} className="flex items-center justify-between gap-2 text-xs text-stone-600">
                <span className="truncate">{file.name}</span>
                <button type="button" className="text-stone-400 hover:text-red-600" onClick={() => onRemoveAttachment?.(file)} aria-label="Remove attachment">
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
            {(files || []).map((file, index) => (
              <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 text-xs text-stone-600">
                <span className="truncate">{file.name}</span>
                <button
                  type="button"
                  className="text-stone-400 hover:text-red-600"
                  onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                  aria-label="Remove file"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
