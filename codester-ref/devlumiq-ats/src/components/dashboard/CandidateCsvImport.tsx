'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Upload, FileSpreadsheet, Download, CheckCircle2, AlertTriangle,
  Loader2, ArrowRight, SkipForward, X,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import {
  CANDIDATE_IMPORT_FIELDS,
  parseCsvText,
  autoMapHeaders,
  type ColumnMapping,
  type CandidateImportFieldKey,
} from '@/lib/csv-import';

type Step = 'upload' | 'map' | 'preview' | 'done';

interface JobOption {
  id: string;
  title: string;
}

interface PreviewResult {
  headers: string[];
  suggestedMapping: ColumnMapping;
  mapping: ColumnMapping;
  totalRows: number;
  validCount: number;
  errorCount: number;
  duplicateCount: number;
  createCount: number;
  errors: Array<{ rowNumber: number; email?: string; field?: string; message: string }>;
  duplicates: Array<{ rowNumber: number; email: string; existingId: string; existingName: string }>;
  sample: Array<{ name: string; email: string; phone?: string; currentTitle?: string }>;
}

interface ImportResult {
  created: number;
  skippedDuplicates: number;
  failed: number;
  errors: Array<{ rowNumber: number; email?: string; message: string }>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export function CandidateCsvImport({ open, onClose, onImported }: Props) {
  const toast = useToast();
  const [step, setStep] = useState<Step>('upload');
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [jobId, setJobId] = useState<string>('');
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const reset = useCallback(() => {
    setStep('upload');
    setCsvText('');
    setFileName('');
    setHeaders([]);
    setMapping({});
    setJobId('');
    setSkipDuplicates(true);
    setBusy(false);
    setPreview(null);
    setResult(null);
  }, []);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    fetch('/api/jobs', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const list = data?.jobs ?? data ?? [];
        setJobs(
          (Array.isArray(list) ? list : [])
            .filter((j: { status?: string }) => j.status !== 'Closed')
            .map((j: { id: string; title: string }) => ({
              id: j.id,
              title: j.title,
            })),
        );
      })
      .catch(() => setJobs([]));
  }, [open, reset]);

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.(csv|txt)$/i) && file.type !== 'text/csv' && file.type !== 'text/plain') {
      toast.error('Invalid file', 'Please upload a .csv file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large', 'Maximum size is 5MB');
      return;
    }
    const text = await file.text();
    const parsed = parseCsvText(text);
    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      toast.error('Empty CSV', 'No headers or data rows found');
      return;
    }
    setCsvText(text);
    setFileName(file.name);
    setHeaders(parsed.headers);
    setMapping(autoMapHeaders(parsed.headers));
    setStep('map');
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const mappingComplete = Boolean(mapping.name && mapping.email);

  const runPreview = async () => {
    if (!mappingComplete) {
      toast.error('Mapping required', 'Map at least Name and Email columns');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/candidates/bulk-import', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'preview',
          csvText,
          mapping,
          jobId: jobId || null,
          skipDuplicates,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error('Preview failed', data.error ?? 'Could not validate CSV');
        return;
      }
      setPreview(data as PreviewResult);
      setStep('preview');
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/candidates/bulk-import', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'import',
          csvText,
          mapping,
          jobId: jobId || null,
          skipDuplicates,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error('Import failed', data.error ?? 'Could not import candidates');
        return;
      }
      setResult({
        created: data.created ?? 0,
        skippedDuplicates: data.skippedDuplicates ?? 0,
        failed: data.failed ?? 0,
        errors: data.errors ?? [],
      });
      setStep('done');
      if ((data.created ?? 0) > 0) {
        toast.success('Import complete', `Created ${data.created} candidate(s)`);
        onImported();
      } else {
        toast.error('Nothing imported', 'No new candidates were created');
      }
    } finally {
      setBusy(false);
    }
  };

  const unmappedHeaders = useMemo(
    () => headers.filter((h) => !Object.values(mapping).includes(h)),
    [headers, mapping],
  );

  const downloadErrors = () => {
    const rows = result?.errors ?? preview?.errors ?? [];
    if (!rows.length) return;
    const csv = [
      'rowNumber,email,message',
      ...rows.map((e) => `${e.rowNumber},"${(e.email ?? '').replace(/"/g, '""')}","${e.message.replace(/"/g, '""')}"`),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import-errors.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      open={open}
      onClose={() => { if (!busy) onClose(); }}
      title="Import candidates from CSV"
      description="Upload a CSV, map columns, preview duplicates, then import."
      size="xl"
    >
      <div className="space-y-5">
        {/* Steps */}
        <ol className="flex flex-wrap items-center gap-2 text-xs font-semibold text-stone-500">
          {(['upload', 'map', 'preview', 'done'] as Step[]).map((s, i) => (
            <li
              key={s}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${
                step === s ? 'bg-brand-50 text-brand-700' : 'bg-stone-50'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-white border border-stone-200 flex items-center justify-center text-[10px]">
                {i + 1}
              </span>
              {s === 'upload' ? 'Upload' : s === 'map' ? 'Map columns' : s === 'preview' ? 'Preview' : 'Done'}
            </li>
          ))}
        </ol>

        {step === 'upload' && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              className="border-2 border-dashed border-stone-200 rounded-2xl p-10 text-center bg-stone-50/60 hover:border-brand-300 hover:bg-brand-50/30 transition-colors"
            >
              <Upload className="w-10 h-10 text-stone-400 mx-auto mb-3" />
              <p className="text-sm font-semibold text-stone-800">Drop a CSV file here</p>
              <p className="text-xs text-stone-500 mt-1">or click to browse · max 5MB · up to 2,000 rows</p>
              <label className="inline-flex mt-4 cursor-pointer">
                <span className="px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700">
                  Choose file
                </span>
                <input
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFile(f);
                  }}
                />
              </label>
            </div>
            <a
              href="/api/candidates/bulk-import"
              className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-800"
            >
              <Download className="w-4 h-4" />
              Download sample CSV template
            </a>
          </div>
        )}

        {step === 'map' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-stone-600">
              <FileSpreadsheet className="w-4 h-4 text-brand-600" />
              <span className="font-medium text-stone-900">{fileName}</span>
              <button type="button" className="text-xs text-stone-500 underline ml-auto" onClick={reset}>
                Change file
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[320px] overflow-y-auto pr-1">
              {CANDIDATE_IMPORT_FIELDS.map((field) => (
                <label key={field.key} className="block text-sm">
                  <span className="text-stone-600 font-medium">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-0.5">*</span>}
                  </span>
                  <select
                    value={mapping[field.key as CandidateImportFieldKey] ?? ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setMapping((prev) => {
                        const next = { ...prev };
                        if (!value) {
                          delete next[field.key as CandidateImportFieldKey];
                        } else {
                          // Ensure one header maps to one field
                          (Object.keys(next) as CandidateImportFieldKey[]).forEach((k) => {
                            if (next[k] === value) delete next[k];
                          });
                          next[field.key as CandidateImportFieldKey] = value;
                        }
                        return next;
                      });
                    }}
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
                  >
                    <option value="">— skip —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            {unmappedHeaders.length > 0 && (
              <p className="text-xs text-stone-500">
                Unmapped columns (ignored): {unmappedHeaders.join(', ')}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-stone-600 font-medium">Apply all to job (optional)</span>
                <select
                  value={jobId}
                  onChange={(e) => setJobId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
                >
                  <option value="">No application / use row job title</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>{j.title}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-start gap-2 mt-6 text-sm text-stone-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                  className="mt-0.5 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                />
                <span>
                  Skip duplicates (match by email in your org)
                  <span className="block text-xs text-stone-500 mt-0.5">Recommended — existing candidates are not modified</span>
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm font-semibold text-stone-700 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!mappingComplete || busy}
                onClick={() => void runPreview()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                Preview import
              </button>
            </div>
          </div>
        )}

        {step === 'preview' && preview && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Rows" value={preview.totalRows} />
              <Stat label="Ready to create" value={preview.createCount} tone="good" />
              <Stat label="Duplicates" value={preview.duplicateCount} tone="warn" />
              <Stat label="Validation errors" value={preview.errorCount} tone="bad" />
            </div>

            {preview.sample.length > 0 && (
              <div className="rounded-xl border border-stone-200 overflow-hidden">
                <div className="px-3 py-2 bg-stone-50 text-xs font-semibold text-stone-600">Sample (first 5)</div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-stone-500 border-b border-stone-100">
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Title</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sample.map((r) => (
                      <tr key={r.email} className="border-b border-stone-50">
                        <td className="px-3 py-2 font-medium text-stone-800">{r.name}</td>
                        <td className="px-3 py-2 text-stone-600">{r.email}</td>
                        <td className="px-3 py-2 text-stone-500">{r.currentTitle || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {(preview.errors.length > 0 || preview.duplicates.length > 0) && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 max-h-40 overflow-y-auto text-xs space-y-1">
                {preview.errors.slice(0, 20).map((e, i) => (
                  <p key={`e-${i}`} className="text-amber-900">
                    Row {e.rowNumber}: {e.message}{e.email ? ` (${e.email})` : ''}
                  </p>
                ))}
                {preview.duplicates.slice(0, 10).map((d, i) => (
                  <p key={`d-${i}`} className="text-stone-700">
                    Row {d.rowNumber}: duplicate of {d.existingName} ({d.email})
                  </p>
                ))}
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setStep('map')}
                className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm font-semibold text-stone-700 hover:bg-stone-50"
              >
                Back
              </button>
              <button
                type="button"
                disabled={busy || preview.createCount === 0}
                onClick={() => void runImport()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Import {preview.createCount} candidate{preview.createCount === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        )}

        {step === 'done' && result && (
          <div className="space-y-4 text-center py-2">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <p className="text-lg font-semibold text-stone-900">
                {result.created} candidate{result.created === 1 ? '' : 's'} imported
              </p>
              <p className="text-sm text-stone-500 mt-1">
                {result.skippedDuplicates > 0 && (
                  <span className="inline-flex items-center gap-1 mr-3">
                    <SkipForward className="w-3.5 h-3.5" />
                    {result.skippedDuplicates} skipped (duplicates)
                  </span>
                )}
                {result.failed > 0 && (
                  <span className="inline-flex items-center gap-1 text-amber-700">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {result.failed} failed
                  </span>
                )}
              </p>
            </div>
            {result.errors.length > 0 && (
              <button
                type="button"
                onClick={downloadErrors}
                className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:underline"
              >
                <Download className="w-4 h-4" />
                Download error report
              </button>
            )}
            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={reset}
                className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm font-semibold text-stone-700"
              >
                Import another file
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold"
              >
                <X className="w-4 h-4" />
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'good' | 'warn' | 'bad';
}) {
  const toneClass =
    tone === 'good'
      ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
      : tone === 'warn'
        ? 'text-amber-700 bg-amber-50 border-amber-100'
        : tone === 'bad'
          ? 'text-red-700 bg-red-50 border-red-100'
          : 'text-stone-700 bg-stone-50 border-stone-100';
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-xl font-bold mt-0.5">{value}</p>
    </div>
  );
}
