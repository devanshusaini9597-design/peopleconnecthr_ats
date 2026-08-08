import React from 'react';
import { X } from 'lucide-react';
import { VARIABLE_OPTIONS } from './emailTemplatesConstants';

/** Enterprise field palette — list rows, not pill clouds */
export function FieldInsertPanel({ onInsert, onRemove, target, setTarget, usedKeys = [] }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50/80 overflow-hidden flex flex-col h-full min-h-[16rem]">
      <div className="px-3 py-2.5 border-b border-stone-200 bg-white">
        <p className="text-[11px] font-bold text-stone-800 tracking-tight">Insert field</p>
        <p className="text-[10px] text-stone-500 mt-0.5 leading-snug">
          Click to insert. Use Remove to take a field back out.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-1 p-0.5 rounded-md bg-stone-100 border border-stone-200/80">
          <button
            type="button"
            onClick={() => setTarget('subject')}
            className={`text-[11px] font-semibold py-1.5 rounded transition-colors ${
              target === 'subject' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            Subject
          </button>
          <button
            type="button"
            onClick={() => setTarget('body')}
            className={`text-[11px] font-semibold py-1.5 rounded transition-colors ${
              target === 'body' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            Body
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain divide-y divide-stone-100 max-h-72 lg:max-h-[28rem]">
        {VARIABLE_OPTIONS.map((v) => {
          const used = usedKeys.includes(v.key);
          return (
            <div
              key={v.key}
              className="flex items-start gap-2 px-3 py-2 hover:bg-brand-50/40 transition-colors"
            >
              <button
                type="button"
                onClick={() => onInsert(v.key, target)}
                className="min-w-0 flex-1 text-left group"
              >
                <span className="block text-[12px] font-semibold text-stone-800 group-hover:text-brand-800">{v.label}</span>
                <span className="block text-[10px] text-stone-400 mt-0.5 truncate">
                  <span className="font-semibold text-stone-500">Example:</span> {v.example}
                </span>
              </button>
              {used ? (
                <button
                  type="button"
                  onClick={() => onRemove(v.key)}
                  className="shrink-0 mt-0.5 text-[10px] font-bold uppercase tracking-wide text-stone-500 hover:text-red-600 hover:bg-red-50 border border-stone-200 hover:border-red-200 px-1.5 py-0.5 rounded transition-colors"
                  title={`Remove ${v.label} from subject and body`}
                >
                  Remove
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Removable chips for fields already in subject/body */
export function UsedFieldChips({ keys, onRemove }) {
  if (!keys.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {keys.map((key) => {
        const opt = VARIABLE_OPTIONS.find((o) => o.key === key);
        return (
          <span
            key={key}
            className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md border border-stone-200 bg-white text-[11px] font-semibold text-stone-700"
          >
            {opt?.label || key}
            <button
              type="button"
              onClick={() => onRemove(key)}
              className="p-0.5 rounded text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              aria-label={`Remove ${opt?.label || key}`}
              title="Remove"
            >
              <X size={12} />
            </button>
          </span>
        );
      })}
    </div>
  );
}
