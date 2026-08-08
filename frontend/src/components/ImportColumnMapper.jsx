import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Columns3, Loader2, Sparkles, SkipForward } from 'lucide-react';
import PremiumSelect from './ui/PremiumSelect';

/** Used when org candidate-fields API is unavailable (e.g. backend not redeployed). */
export const FALLBACK_CORE_FIELDS = [
  { key: 'name', label: 'Name', type: 'text', required: true, isCore: true, importAliases: ['name', 'candidate name', 'full name'], order: 10 },
  { key: 'email', label: 'Email', type: 'text', required: true, isCore: true, importAliases: ['email', 'e-mail', 'mail'], order: 20 },
  { key: 'contact', label: 'Contact', type: 'text', required: true, isCore: true, importAliases: ['contact', 'phone', 'mobile', 'cell'], order: 30 },
  { key: 'position', label: 'Position', type: 'text', required: false, isCore: true, importAliases: ['position', 'designation', 'role', 'job title'], order: 40 },
  { key: 'companyName', label: 'Company', type: 'text', required: true, isCore: true, importAliases: ['company', 'company name', 'employer'], order: 50 },
  { key: 'location', label: 'Location', type: 'text', required: false, isCore: true, importAliases: ['location', 'city', 'place'], order: 60 },
  { key: 'experience', label: 'Experience', type: 'text', required: false, isCore: true, importAliases: ['experience', 'exp', 'years'], order: 70 },
  { key: 'ctc', label: 'CTC', type: 'select', required: true, isCore: true, importAliases: ['ctc', 'current ctc', 'salary'], order: 80 },
  { key: 'expectedCtc', label: 'Expected CTC', type: 'select', required: false, isCore: true, importAliases: ['expected ctc', 'expected salary', 'ectc'], order: 90 },
  { key: 'noticePeriod', label: 'Notice Period', type: 'select', required: false, isCore: true, importAliases: ['notice', 'notice period', 'np'], order: 100 },
  { key: 'status', label: 'Status', type: 'select', required: false, isCore: true, importAliases: ['status'], order: 110 },
  { key: 'source', label: 'Source', type: 'text', required: false, isCore: true, importAliases: ['source', 'source of cv'], order: 120 },
  { key: 'client', label: 'Client', type: 'text', required: false, isCore: true, importAliases: ['client', 'client name'], order: 130 },
  { key: 'spoc', label: 'SPOC', type: 'text', required: false, isCore: true, importAliases: ['spoc', 'poc'], order: 140 },
  { key: 'remark', label: 'Remark', type: 'text', required: false, isCore: true, importAliases: ['remark', 'remarks', 'notes'], order: 150 },
  { key: 'date', label: 'Date', type: 'date', required: false, isCore: true, importAliases: ['date'], order: 160 },
  { key: 'fls', label: 'FLS', type: 'text', required: false, isCore: true, importAliases: ['fls'], order: 170 },
];

/**
 * Suggest a field key for an Excel header from field defs (core + custom).
 */
export function suggestFieldForHeader(header, fields) {
  const h = String(header || '').toLowerCase().trim();
  if (!h) return '';

  for (const f of fields) {
    const aliases = [
      f.label,
      f.key,
      ...(f.importAliases || []),
    ].map((a) => String(a || '').toLowerCase().trim()).filter(Boolean);
    if (aliases.some((a) => a === h)) return f.isCore ? f.key : `cf:${f.key}`;
  }
  for (const f of fields) {
    const aliases = [
      f.label,
      f.key,
      ...(f.importAliases || []),
    ].map((a) => String(a || '').toLowerCase().trim()).filter(Boolean);
    if (aliases.some((a) => h.includes(a) || a.includes(h))) {
      return f.isCore ? f.key : `cf:${f.key}`;
    }
  }
  return '';
}

/**
 * Enterprise Excel → field mapper.
 * mapping values: core key OR `cf:customKey` OR ''
 */
export default function ImportColumnMapper({
  headers = [],
  fields = [],
  initialMapping = null,
  lastMapping = null,
  onContinue,
  onSkipAuto,
  busy = false,
}) {
  const [mapping, setMapping] = useState({});

  const effectiveFields = useMemo(
    () => (fields?.length ? fields : FALLBACK_CORE_FIELDS),
    [fields]
  );

  const options = useMemo(() => {
    const core = effectiveFields.filter((f) => f.isCore).map((f) => ({
      value: f.key,
      label: `${f.label}${f.required ? ' *' : ''}`,
    }));
    const custom = effectiveFields.filter((f) => !f.isCore).map((f) => ({
      value: `cf:${f.key}`,
      label: f.label,
    }));
    return [...core, ...(custom.length ? custom : [])];
  }, [effectiveFields]);

  useEffect(() => {
    const next = {};
    headers.forEach((h, idx) => {
      next[idx] = suggestFieldForHeader(h, effectiveFields);
    });
    if (initialMapping && typeof initialMapping === 'object') {
      Object.entries(initialMapping).forEach(([k, v]) => {
        next[k] = v;
      });
    } else if (lastMapping?.map && Array.isArray(lastMapping.headers)) {
      const same = lastMapping.headers.length === headers.length
        && lastMapping.headers.every((h, i) => String(h) === String(headers[i]));
      if (same) {
        Object.entries(lastMapping.map).forEach(([k, v]) => {
          next[k] = v;
        });
      }
    }
    setMapping(next);
  }, [headers, effectiveFields, initialMapping, lastMapping]);

  const usedValues = useMemo(() => {
    const s = new Set();
    Object.values(mapping).forEach((v) => { if (v) s.add(v); });
    return s;
  }, [mapping]);

  const hasName = Object.values(mapping).includes('name');
  const hasEmail = Object.values(mapping).includes('email');
  const mappedCount = Object.values(mapping).filter(Boolean).length;

  const applyAuto = () => {
    const next = {};
    headers.forEach((h, idx) => {
      next[idx] = suggestFieldForHeader(h, effectiveFields);
    });
    setMapping(next);
  };

  const applyLast = () => {
    if (!lastMapping?.map) return;
    const next = { ...mapping };
    Object.entries(lastMapping.map).forEach(([k, v]) => {
      next[k] = v;
    });
    setMapping(next);
  };

  const handleContinue = () => {
    if (!hasName) return;
    const finalMap = {};
    Object.entries(mapping).forEach(([idx, field]) => {
      if (field) finalMap[idx] = field;
    });
    onContinue?.(finalMap);
  };

  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden max-w-4xl mx-auto">
      <div className="px-5 sm:px-6 py-5 border-b border-stone-100 bg-gradient-to-br from-brand-50/40 via-white to-white">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-brand-500 to-teal-700 text-white flex items-center justify-center shadow-lg shadow-brand-500/25 flex-shrink-0">
            <Columns3 size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-700">Bulk import</p>
            <h2 className="text-lg font-bold text-stone-900 tracking-tight mt-0.5">Map Excel columns</h2>
            <p className="text-sm text-stone-500 mt-1">
              Match each spreadsheet header to a candidate field. Clear a row to skip it.
              {!fields?.length && (
                <span className="block text-amber-700 mt-1 text-xs font-medium">
                  Using built-in fields — redeploy backend to load org custom fields.
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <button type="button" className="btn-secondary !h-9 !text-xs" onClick={applyAuto} disabled={busy}>
            <Sparkles size={14} /> Auto-suggest
          </button>
          {lastMapping?.map && (
            <button type="button" className="btn-secondary !h-9 !text-xs" onClick={applyLast} disabled={busy}>
              Use last mapping
            </button>
          )}
          {onSkipAuto && (
            <button type="button" className="btn-secondary !h-9 !text-xs" onClick={onSkipAuto} disabled={busy}>
              <SkipForward size={14} /> Skip — auto-detect
            </button>
          )}
        </div>
      </div>

      <div className="px-5 sm:px-6 py-3 border-b border-stone-100 flex flex-wrap gap-3 text-xs text-stone-500">
        <span><strong className="text-stone-800 tabular-nums">{mappedCount}</strong> / {headers.length} mapped</span>
        <span className={hasName ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
          {hasName ? 'Name mapped' : 'Name required'}
        </span>
        <span className={hasEmail ? 'text-emerald-700 font-semibold' : 'text-stone-400'}>
          {hasEmail ? 'Email mapped' : 'Email recommended'}
        </span>
      </div>

      <div className="max-h-[48vh] overflow-y-auto divide-y divide-stone-100">
        {headers.map((header, idx) => {
          const val = mapping[idx] || '';
          const opts = options.map((o) => {
            if (o.value === val) return o;
            if (usedValues.has(o.value)) return { ...o, label: `${o.label} (used)`, disabled: true };
            return o;
          }).filter((o) => !o.disabled || o.value === val);
          return (
            <div key={idx} className="px-5 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Column {idx + 1}</p>
                <p className="text-sm font-semibold text-stone-900 truncate" title={header}>{header || '(empty header)'}</p>
              </div>
              <ArrowRight size={16} className="text-stone-300 hidden sm:block flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <PremiumSelect
                  variant="list"
                  value={val}
                  onChange={(v) => setMapping((prev) => ({ ...prev, [idx]: v || '' }))}
                  options={opts}
                  searchable
                  allowClear
                  placeholder="Skip column"
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-5 sm:px-6 py-4 border-t border-stone-100 bg-stone-50/40 flex flex-col sm:flex-row gap-2 sm:justify-end">
        <button
          type="button"
          className="btn-primary !h-11"
          disabled={busy || !hasName}
          onClick={handleContinue}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : null}
          Continue to validate
        </button>
      </div>
    </div>
  );
}
