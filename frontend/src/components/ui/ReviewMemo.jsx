import React, { useEffect, useState } from 'react';
import { MessageSquareText, Pencil, Check, X, Loader2 } from 'lucide-react';

function relativeTime(value) {
  if (!value) return '';
  const mins = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Read-only feedback shown to freelancers / viewers. */
export function ReviewMemo({
  text,
  label = 'Reviewer notes',
  at,
  emptyLabel = 'No notes yet',
  compact = false,
}) {
  const body = String(text || '').trim();
  if (!body) {
    return (
      <div className={`rounded-xl border border-stone-200 bg-white ${compact ? 'p-3' : 'p-4'}`}>
        <p className="text-[13px] font-medium text-stone-600 inline-flex items-center gap-2">
          <MessageSquareText size={15} strokeWidth={2} className="text-stone-400" />
          {label}
        </p>
        <p className="text-[13px] text-stone-400 mt-2">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-stone-200 bg-white ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[13px] font-medium text-stone-700 inline-flex items-center gap-2">
          <MessageSquareText size={15} strokeWidth={2} className="text-brand-600" />
          {label}
        </p>
        {at ? (
          <span className="text-[11px] text-stone-400 tabular-nums">{relativeTime(at)}</span>
        ) : null}
      </div>
      <p className={`text-stone-800 leading-relaxed whitespace-pre-wrap ${compact ? 'text-[13px] line-clamp-3' : 'text-[14px]'}`}>
        {body}
      </p>
    </div>
  );
}

/**
 * Enterprise feedback composer — header and field are separate so borders never cut text.
 */
export function ReviewComposer({
  value,
  savedValue,
  saving,
  onChange,
  onSave,
  label = 'Reviewer notes',
  helper = 'Shared with the freelance recruiter on their pipeline',
  placeholder = 'Document decision rationale for the freelance recruiter…',
  saveLabel = 'Save notes',
  addLabel = '+ Add notes',
  startCollapsed = false,
}) {
  const saved = String(savedValue || '').trim();
  const draft = value ?? '';
  const [editing, setEditing] = useState(!saved && !startCollapsed);

  useEffect(() => {
    if (!saved && !startCollapsed) setEditing(true);
    if (saved) setEditing(false);
  }, [saved, startCollapsed]);

  if (!editing && saved) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-stone-800 inline-flex items-center gap-2">
              <MessageSquareText size={15} strokeWidth={2} className="text-brand-600" />
              {label}
            </p>
            <p className="text-[12px] text-stone-500 mt-1 leading-snug">{helper}</p>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="h-8 px-2.5 rounded-lg text-[12px] font-medium text-stone-600 border border-stone-200 bg-white hover:bg-stone-50 inline-flex items-center gap-1.5 shrink-0"
          >
            <Pencil size={13} strokeWidth={2} /> Edit
          </button>
        </div>
        <div className="mt-3 rounded-lg bg-stone-50 border border-stone-100 px-3.5 py-3">
          <p className="text-[14px] text-stone-800 leading-relaxed whitespace-pre-wrap">{saved}</p>
        </div>
      </div>
    );
  }

  if (!editing && !saved) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="w-full rounded-xl border border-dashed border-stone-300 bg-white px-3 py-2.5 text-left hover:border-brand-300 hover:bg-brand-50/20 transition-colors"
      >
        <p className="text-[12px] font-semibold text-stone-800 inline-flex items-center gap-1.5">
          <MessageSquareText size={14} strokeWidth={2} className="text-brand-600" />
          {label}
        </p>
        <p className="text-[11px] text-stone-500 mt-0.5 leading-snug">{helper}</p>
        <p className="text-[12px] text-brand-700 font-medium mt-1.5">{addLabel}</p>
      </button>
    );
  }

  const dirty = draft.trim() !== saved;
  const count = draft.length;

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-stone-800 inline-flex items-center gap-1.5">
            <MessageSquareText size={14} strokeWidth={2} className="text-brand-600" />
            {label}
          </p>
          <p className="text-[11px] text-stone-500 mt-0.5 leading-snug">{helper}</p>
        </div>
        <span className="text-[10px] text-stone-400 tabular-nums shrink-0 pt-0.5">{count}/4000</span>
      </div>

      <textarea
        value={draft}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        maxLength={4000}
        placeholder={placeholder}
        className="textarea-ats !min-h-[72px] !bg-white"
      />

      <div className="flex items-center justify-end gap-2 pt-1">
        {(saved || startCollapsed) ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              onChange(saved);
              setEditing(false);
            }}
            className="h-9 px-3 rounded-lg text-[12px] font-medium text-stone-600 border border-stone-200 bg-white hover:bg-stone-50 inline-flex items-center gap-1.5"
          >
            <X size={14} strokeWidth={2} /> Cancel
          </button>
        ) : null}
        <button
          type="button"
          disabled={saving || !dirty || !draft.trim()}
          onClick={async () => {
            const ok = await onSave(draft);
            if (ok !== false) setEditing(false);
          }}
          className="h-9 px-4 rounded-lg text-[12px] font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-40 inline-flex items-center gap-1.5 shadow-sm"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} strokeWidth={2.5} />}
          {saveLabel}
        </button>
      </div>
    </div>
  );
}

export default ReviewMemo;
