import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import BASE_API_URL from '../../config';
import { planHasFeature } from '../../config/planFeatures';
import { useAuth } from '../../context/AuthContext';
import usePageTour from '../../hooks/usePageTour';
import useTableDragScroll from '../../hooks/useTableDragScroll';
import { authenticatedFetch, handleUnauthorized } from '../../utils/fetchUtils';
import { ctcRanges, expectedCtcOptions, noticePeriodOptions } from '../../utils/ctcRanges';
import { formatNameForInput } from '../../utils/textFormatter';
import { useToast } from '../Toast';
import {
  DRAFT_KEY, PAGE_SIZE, TOUR_KEY, MAX_BYTES, STEPS,
  TEMPLATE_HEADERS, TEMPLATE_SAMPLE, STATUS_OPTIONS, rowKey,
} from './constants';

export default function useAutoImport() {
  const navigate = useNavigate();
  const toast = useToast();
  const { organization, isLoading: authLoading } = useAuth();
  const canBulkImport = planHasFeature(organization?.plan, 'jobs.bulkImport');
  const [tourOpen, setTourOpen] = usePageTour(TOUR_KEY);
  const fileRef = useRef(null);
  const {
    tableScrollRef,
    onTableDragScrollStart,
    onTableDragScrollMove,
    onTableDragScrollEnd,
  } = useTableDragScroll();

  const [step, setStep] = useState('prepare');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadPercent, setUploadPercent] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const pendingFileRef = useRef(null);
  const [excelHeaders, setExcelHeaders] = useState([]);
  const [candidateFields, setCandidateFields] = useState([]);
  const [lastImportMapping, setLastImportMapping] = useState(null);
  const [activeColumnMapping, setActiveColumnMapping] = useState(null);

  const [reviewData, setReviewData] = useState(null);
  const [stats, setStats] = useState(null);
  const [bucket, setBucket] = useState('ready');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(() => new Set());

  const [editingRow, setEditingRow] = useState(null);
  const [editErrors, setEditErrors] = useState({});
  const [positions, setPositions] = useState([]);
  const [clients, setClients] = useState([]);
  const [sources, setSources] = useState([]);

  const [isImporting, setIsImporting] = useState(false);
  const [isSavingPending, setIsSavingPending] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false });

  /* draft */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d?.reviewData && d?.stats && d?.fileName) {
        setReviewData(d.reviewData);
        setStats(d.stats);
        setFileName(d.fileName);
        setStep('review');
        const readyKeys = (d.reviewData.ready || []).map((r) => `ready-${r.rowIndex}`);
        setSelected(new Set(readyKeys));
        toast.info('Restored your last import draft.');
      }
    } catch { /* ignore */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!reviewData || !stats || !fileName || step === 'done') return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        reviewData, stats, fileName, savedAt: Date.now(),
      }));
    } catch { /* ignore */ }
  }, [reviewData, stats, fileName, step]);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const [p, c, s] = await Promise.all([
          authenticatedFetch('/api/positions'),
          authenticatedFetch('/api/clients'),
          authenticatedFetch('/api/sources'),
        ]);
        if (dead) return;
        if (p.ok) setPositions(await p.json().catch(() => []));
        if (c.ok) setClients(await c.json().catch(() => []));
        if (s.ok) setSources(await s.json().catch(() => []));
      } catch { /* ignore */ }
    })();
    return () => { dead = true; };
  }, []);

  const busy = isUploading || isImporting;
  // Soft navigate guard only while upload/import is in flight — draft is auto-saved so reload should not nag
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    busy && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    const fn = (e) => {
      if (!busy) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', fn);
    return () => window.removeEventListener('beforeunload', fn);
  }, [busy]);

  const allRows = useMemo(() => {
    if (!reviewData) return [];
    return [
      ...(reviewData.ready || []).map((r) => ({ ...r, _category: 'ready' })),
      ...(reviewData.review || []).map((r) => ({ ...r, _category: 'review' })),
      ...(reviewData.blocked || []).map((r) => ({ ...r, _category: 'blocked' })),
    ];
  }, [reviewData]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = allRows;
    if (!q) {
      rows = allRows.filter((r) => r._category === bucket);
    } else {
      rows = allRows.filter((r) => {
        const f = r.fixed || {};
        return [f.name, f.email, f.contact, f.position, f.companyName, f.location]
          .filter(Boolean).join(' ').toLowerCase().includes(q);
      });
    }
    return rows;
  }, [allRows, bucket, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const readyCount = reviewData?.ready?.length || 0;
  const reviewCount = reviewData?.review?.length || 0;
  const blockedCount = reviewData?.blocked?.length || 0;
  const selectedList = useMemo(
    () => allRows.filter((r) => selected.has(rowKey(r))),
    [allRows, selected]
  );
  const selectedReady = selectedList.filter((r) => r._category === 'ready').length;
  const selectedUpdates = selectedList.filter((r) => r.isDbDuplicate).length;
  const selectedNew = Math.max(0, selectedReady - selectedUpdates);
  const dbDupCount = useMemo(
    () => allRows.filter((r) => r.isDbDuplicate).length,
    [allRows]
  );

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...TEMPLATE_SAMPLE]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Candidates');
    XLSX.writeFile(wb, 'skillnix-candidate-import-template.xlsx');
    toast.success('Template downloaded');
  };

  const resetAll = () => {
    setStep('prepare');
    setReviewData(null);
    setStats(null);
    setFileName('');
    setSelected(new Set());
    setBucket('ready');
    setQuery('');
    setPage(1);
    setImportResult(null);
    setEditingRow(null);
    pendingFileRef.current = null;
    setExcelHeaders([]);
    setActiveColumnMapping(null);
    localStorage.removeItem(DRAFT_KEY);
  };

  const persistLastMapping = useCallback(async (headers, map) => {
    try {
      await authenticatedFetch('/api/organization/candidate-fields/last-mapping', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headers, map }),
      });
      setLastImportMapping({ headers, map, savedAt: new Date().toISOString() });
    } catch { /* non-blocking */ }
  }, []);

  const runValidate = useCallback(async (file, columnMapping) => {
    setStep('upload');
    setIsUploading(true);
    setUploadProgress('Uploading…');
    setUploadPercent(0);
    setImportResult(null);

    try {
      const form = new FormData();
      form.append('file', file);
      if (columnMapping && Object.keys(columnMapping).length > 0) {
        form.append('columnMapping', JSON.stringify(columnMapping));
      }
      const orgId = localStorage.getItem('orgId');
      const text = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${BASE_API_URL}/candidates/bulk-upload-auto`);
        xhr.withCredentials = true;
        if (orgId) xhr.setRequestHeader('X-Organization-Id', orgId);
        xhr.timeout = 600000;
        xhr.upload.onprogress = (e) => {
          if (!e.lengthComputable) return;
          setUploadPercent(Math.round((e.loaded / e.total) * 30));
          setUploadProgress(`Uploading… ${Math.round((e.loaded / e.total) * 100)}%`);
        };
        xhr.onload = () => {
          if (xhr.status === 401) { handleUnauthorized(); reject(new Error('Unauthorized')); return; }
          if (xhr.status >= 400) {
            let msg = 'Upload failed';
            try { msg = JSON.parse(xhr.responseText)?.message || msg; } catch { /* */ }
            reject(new Error(msg));
            return;
          }
          resolve(xhr.responseText);
        };
        xhr.onerror = () => reject(new Error('Network error reaching server'));
        xhr.ontimeout = () => reject(new Error('Timed out — try a smaller file'));
        xhr.send(form);
      });

      setUploadProgress('Validating every row…');
      setUploadPercent(35);

      const lines = text.trim().split('\n').filter(Boolean);
      let payload = null;
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === 'progress') {
            const total = parsed.totalEstimate || 1;
            setUploadPercent(Math.min(95, 35 + Math.round(((parsed.processed || 0) / total) * 60)));
            setUploadProgress(parsed.message || 'Validating…');
          } else if (parsed.type === 'complete' || parsed.success) {
            payload = parsed;
          }
        } catch { /* skip */ }
      }
      if (!payload) {
        for (let i = lines.length - 1; i >= 0; i -= 1) {
          try { payload = JSON.parse(lines[i]); break; } catch { /* */ }
        }
      }
      if (!payload?.success || !payload.results) {
        throw new Error(payload?.message || 'Could not validate file');
      }

      const nextStats = payload.stats || {
        ready: payload.results.ready?.length || 0,
        review: payload.results.review?.length || 0,
        blocked: payload.results.blocked?.length || 0,
      };
      setReviewData(payload.results);
      setStats(nextStats);
      setSelected(new Set((payload.results.ready || []).map((r) => `ready-${r.rowIndex}`)));
      setBucket('ready');
      setPage(1);
      setActiveColumnMapping(columnMapping || null);
      setStep('review');
      if (columnMapping && excelHeaders.length) {
        persistLastMapping(excelHeaders, columnMapping);
      }
      const totalValidated = (nextStats.ready || 0) + (nextStats.review || 0) + (nextStats.blocked || 0);
      const dups = nextStats.dbDuplicates || 0;
      toast.success(
        dups > 0
          ? `Validated ${totalValidated} rows · ${dups} already in ATS (import will update those).`
          : `Validated ${totalValidated} rows — select what to import.`
      );
    } catch (err) {
      if (err.message !== 'Unauthorized') toast.error(err.message || 'Upload failed');
      setStep(columnMapping ? 'map' : 'upload');
    } finally {
      setIsUploading(false);
      setUploadProgress('');
      setUploadPercent(0);
    }
  }, [toast, excelHeaders, persistLastMapping]);

  const processFile = useCallback(async (file) => {
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!['.csv', '.xlsx', '.xls'].includes(ext)) {
      toast.error('Upload CSV, XLSX, or XLS only');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('File must be under 50 MB');
      return;
    }

    pendingFileRef.current = file;
    setFileName(file.name);
    setStep('upload');
    setIsUploading(true);
    setUploadProgress('Reading columns…');
    setUploadPercent(10);
    setImportResult(null);
    setReviewData(null);
    setActiveColumnMapping(null);

    try {
      const form = new FormData();
      form.append('file', file);
      const orgId = localStorage.getItem('orgId');

      const [headersRes, fieldsRes] = await Promise.all([
        new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `${BASE_API_URL}/candidates/extract-headers`);
          xhr.withCredentials = true;
          if (orgId) xhr.setRequestHeader('X-Organization-Id', orgId);
          xhr.onload = () => {
            if (xhr.status === 401) { handleUnauthorized(); reject(new Error('Unauthorized')); return; }
            try {
              const data = JSON.parse(xhr.responseText);
              if (xhr.status >= 400 || !data.success) reject(new Error(data.message || 'Could not read headers'));
              else resolve(data);
            } catch {
              reject(new Error('Could not read headers'));
            }
          };
          xhr.onerror = () => reject(new Error('Network error'));
          xhr.send(form);
        }),
        authenticatedFetch('/api/organization/candidate-fields').then(async (r) => {
          if (r.status === 401) { handleUnauthorized(); throw new Error('Unauthorized'); }
          return r.json();
        }).catch(() => ({ success: false, fields: [] })),
      ]);

      const headers = headersRes.headers || [];
      if (!headers.length) throw new Error('No columns found in file');
      setExcelHeaders(headers);
      if (fieldsRes?.success && (fieldsRes.fields || []).length) {
        setCandidateFields(fieldsRes.fields || []);
        setLastImportMapping(fieldsRes.lastImportMapping || null);
      } else {
        setCandidateFields([]);
        setLastImportMapping(null);
      }
      setStep('map');
      toast.success(`Found ${headers.length} columns — map them to fields.`);
    } catch (err) {
      if (err.message !== 'Unauthorized') toast.error(err.message || 'Could not read file');
      setStep('upload');
      pendingFileRef.current = null;
    } finally {
      setIsUploading(false);
      setUploadProgress('');
      setUploadPercent(0);
    }
  }, [toast]);

  const onMapContinue = useCallback((map) => {
    const file = pendingFileRef.current;
    if (!file) {
      toast.error('File missing — please upload again');
      setStep('upload');
      return;
    }
    runValidate(file, map);
  }, [runValidate, toast]);

  const onMapSkipAuto = useCallback(() => {
    const file = pendingFileRef.current;
    if (!file) {
      toast.error('File missing — please upload again');
      setStep('upload');
      return;
    }
    runValidate(file, null);
  }, [runValidate, toast]);

  const onPickFile = (file) => {
    if (!file) return;
    if (reviewData || excelHeaders.length) {
      setConfirmModal({
        isOpen: true,
        type: 'edit',
        title: 'Replace current file?',
        message: 'This clears your current mapping and review session.',
        confirmText: 'Replace',
        onConfirm: () => {
          setConfirmModal({ isOpen: false });
          setReviewData(null);
          setSelected(new Set());
          setExcelHeaders([]);
          processFile(file);
        },
      });
      return;
    }
    processFile(file);
  };

  const toggleRow = (row) => {
    if (row._category !== 'ready') {
      toast.info('Fix this row with Edit first — it must be Ready before import.');
      return;
    }
    const k = rowKey(row);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const selectPageReady = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      pageRows.forEach((r) => {
        if (r._category === 'ready') next.add(rowKey(r));
      });
      return next;
    });
  };

  const selectAllReady = () => {
    setSelected(new Set((reviewData?.ready || []).map((r) => `ready-${r.rowIndex}`)));
  };

  const skipExistingInAts = () => {
    setSelected(new Set(
      (reviewData?.ready || [])
        .filter((r) => !r.isDbDuplicate)
        .map((r) => `ready-${r.rowIndex}`)
    ));
    toast.info('Deselected rows already in Candidates — only new emails selected');
  };

  const clearSelection = () => setSelected(new Set());

  const runImport = async () => {
    const toImport = selectedList.filter((r) => r._category === 'ready');
    if (toImport.length === 0) {
      toast.warning('Select at least one Ready row to import');
      return;
    }
    setConfirmModal({ isOpen: false });
    setIsImporting(true);
    try {
      // Backend mapFieldsToDatabase prefers { fixed, original, validation }
      const readyRecords = toImport.map((r) => ({
        rowIndex: r.rowIndex,
        fixed: r.fixed || {},
        original: r.original || {},
        validation: r.validation || {},
        autoFixChanges: r.autoFixChanges || [],
      }));

      const res = await authenticatedFetch('/candidates/import-reviewed', {
        method: 'POST',
        body: JSON.stringify({ readyRecords, reviewRecords: [] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Import failed');

      const selectedIndexes = new Set(toImport.map((r) => `ready-${r.rowIndex}`));
      const remainingReview = reviewCount;
      const remainingBlocked = blockedCount;

      setReviewData((prev) => {
        if (!prev) return prev;
        return {
          ready: (prev.ready || []).filter((r) => !selectedIndexes.has(`ready-${r.rowIndex}`)),
          review: prev.review || [],
          blocked: prev.blocked || [],
        };
      });
      setSelected(new Set());
      setImportResult({
        imported: data.imported ?? toImport.length,
        upserted: data.upserted ?? 0,
        modified: data.modified ?? 0,
        fileName,
        remainingReview,
        remainingBlocked,
      });
      setStep('done');
      localStorage.removeItem(DRAFT_KEY);
      const up = data.upserted ?? 0;
      const mod = data.modified ?? 0;
      toast.success(
        mod > 0 || up > 0
          ? `Done — ${up} new, ${mod} updated`
          : `Imported ${data.imported ?? toImport.length} candidates`
      );
    } catch (err) {
      toast.error(err.message || 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const confirmImport = () => {
    if (!selectedList.length) {
      toast.warning('Select rows to import first');
      return;
    }
    const nonReady = selectedList.filter((r) => r._category !== 'ready');
    if (nonReady.length) {
      toast.warning('Only Ready rows can be imported. Fix others with Edit first.');
      return;
    }
    setConfirmModal({
      isOpen: true,
      type: 'success',
      eyebrow: 'Bulk import',
      title: 'Confirm import',
      message: 'These selected Ready rows will be written to Candidates.',
      stats: [
        { label: 'Selected', value: selectedList.length, hint: 'Ready to write', tone: 'brand' },
        { label: 'New', value: selectedNew, hint: 'Profiles created', tone: 'emerald' },
        { label: 'Updates', value: selectedUpdates, hint: 'Existing emails', tone: 'violet' },
      ],
      details: selectedUpdates > 0
        ? (
          <ul className="space-y-1.5 text-sm text-stone-600">
            <li className="flex gap-2"><span className="text-brand-600 font-bold">·</span><span>Matching emails <strong className="text-stone-800">update</strong> the existing candidate — no duplicates.</span></li>
            <li className="flex gap-2"><span className="text-brand-600 font-bold">·</span><span>Unchecked rows stay out of Candidates.</span></li>
          </ul>
        )
        : (
          <p>Unchecked rows stay out of Candidates until you import them later.</p>
        ),
      confirmText: `Import ${selectedList.length}`,
      onConfirm: runImport,
    });
  };

  const sendRestToPending = async () => {
    const pending = [
      ...(reviewData?.review || []).map((r) => ({ ...r, category: 'review' })),
      ...(reviewData?.blocked || []).map((r) => ({ ...r, category: 'blocked' })),
    ];
    if (!pending.length) {
      toast.info('No review/blocked rows left');
      return;
    }
    setIsSavingPending(true);
    try {
      const res = await authenticatedFetch('/candidates/pending/save', {
        method: 'POST',
        body: JSON.stringify({ records: pending, fileName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || 'Could not save pending');
      setReviewData((prev) => (prev ? { ...prev, review: [], blocked: [] } : prev));
      toast.success(`${data.count ?? pending.length} sent to Pending Review`);
    } catch (err) {
      toast.error(err.message || 'Failed');
    } finally {
      setIsSavingPending(false);
    }
  };

  /* edit helpers */
  const updateEdit = (field, value) => {
    const v = ['name', 'companyName', 'location', 'spoc', 'remark'].includes(field)
      ? formatNameForInput(value) : value;
    setEditingRow((prev) => ({ ...prev, fixed: { ...prev.fixed, [field]: v } }));
    setEditErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const saveEdited = async () => {
    if (!editingRow) return;
    const rec = { ...(editingRow.original || {}), ...(editingRow.fixed || {}) };
    const err = {};
    if (!(rec.name || '').trim()) err.name = 'Required';
    if (!(rec.email || '').trim()) err.email = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(rec.email).trim())) err.email = 'Invalid email';
    const phone = String(rec.contact || '').replace(/\D/g, '');
    if (phone.length < 10) err.contact = '10-digit mobile required';
    if (!(rec.companyName || '').trim()) err.companyName = 'Required';
    if (!(rec.ctc || '').trim()) err.ctc = 'Required';
    setEditErrors(err);
    if (Object.keys(err).length) {
      toast.warning('Fix required fields');
      return;
    }

    // Move edited row into Ready locally so it can be selected/imported
    const fixed = {
      name: String(rec.name || '').trim(),
      email: String(rec.email || '').trim().toLowerCase(),
      contact: String(rec.contact || '').trim(),
      position: rec.position || '',
      companyName: String(rec.companyName || '').trim(),
      location: String(rec.location || '').trim(),
      ctc: rec.ctc || '',
      expectedCtc: rec.expectedCtc || '',
      experience: rec.experience != null ? String(rec.experience) : '',
      noticePeriod: rec.noticePeriod || '',
      status: rec.status || 'Applied',
      source: rec.source || '',
      client: rec.client || '',
      spoc: String(rec.spoc || '').trim(),
      remark: String(rec.remark || '').trim(),
      date: rec.date || '',
    };

    setReviewData((prev) => {
      if (!prev) return prev;
      const idx = editingRow.rowIndex;
      const strip = (arr) => (arr || []).filter((r) => r.rowIndex !== idx);
      const upgraded = {
        rowIndex: idx,
        fixed,
        original: editingRow.original || {},
        validation: {
          ...(editingRow.validation || {}),
          confidence: Math.max(90, editingRow.validation?.confidence || 0),
          category: 'ready',
          errors: [],
          warnings: [],
        },
        autoFixChanges: editingRow.autoFixChanges || [],
      };
      return {
        ready: [...strip(prev.ready), upgraded],
        review: strip(prev.review),
        blocked: strip(prev.blocked),
      };
    });
    setSelected((prev) => {
      const next = new Set(prev);
      // drop old category keys for this rowIndex
      ['ready', 'review', 'blocked'].forEach((c) => next.delete(`${c}-${editingRow.rowIndex}`));
      next.add(`ready-${editingRow.rowIndex}`);
      return next;
    });
    setEditingRow(null);
    setBucket('ready');
    toast.success('Row fixed and moved to Ready — included in selection');
  };

  const positionOptions = useMemo(() => [
    { value: '', label: 'Select' },
    ...positions.filter((p) => p.isActive !== false).map((p) => ({ value: p.name, label: p.name })),
  ], [positions]);
  const clientOptions = useMemo(() => [
    { value: '', label: 'Select' },
    ...clients.filter((c) => c.isActive !== false).map((c) => ({ value: c.name, label: c.name })),
  ], [clients]);
  const sourceOptions = useMemo(() => [
    { value: '', label: 'Select' },
    ...sources.filter((s) => s.isActive !== false).map((s) => ({ value: s.name, label: s.name })),
  ], [sources]);
  const statusOptions = useMemo(() => [
    { value: '', label: 'Select' },
    ...STATUS_OPTIONS.map((s) => ({ value: s, label: s })),
  ], []);
  const ctcOptions = useMemo(() => [{ value: '', label: 'Select' }, ...ctcRanges.map((r) => ({ value: r, label: r }))], []);
  const ectcOptions = useMemo(() => [{ value: '', label: 'Select' }, ...expectedCtcOptions.map((r) => ({ value: r, label: r }))], []);
  const npOptions = useMemo(() => [{ value: '', label: 'Select' }, ...noticePeriodOptions.map((o) => ({ value: o, label: o }))], []);
  const expOptions = useMemo(() => [
    { value: '', label: 'Select' },
    { value: 'Fresher', label: 'Fresher' },
    ...[...Array(31).keys()].slice(1).map((n) => ({ value: String(n), label: `${n} yrs` })),
  ], []);

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return {
    navigate,
    authLoading,
    canBulkImport,
    tourOpen,
    setTourOpen,
    fileRef,
    tableScrollRef,
    onTableDragScrollStart,
    onTableDragScrollMove,
    onTableDragScrollEnd,
    step,
    setStep,
    isUploading,
    uploadProgress,
    uploadPercent,
    isDragging,
    setIsDragging,
    fileName,
    pendingFileRef,
    excelHeaders,
    setExcelHeaders,
    candidateFields,
    lastImportMapping,
    reviewData,
    stats,
    bucket,
    setBucket,
    query,
    setQuery,
    page,
    setPage,
    selected,
    editingRow,
    setEditingRow,
    editErrors,
    setEditErrors,
    isImporting,
    isSavingPending,
    importResult,
    confirmModal,
    setConfirmModal,
    busy,
    blocker,
    filtered,
    totalPages,
    pageRows,
    readyCount,
    reviewCount,
    blockedCount,
    selectedNew,
    selectedUpdates,
    dbDupCount,
    downloadTemplate,
    resetAll,
    onMapContinue,
    onMapSkipAuto,
    onPickFile,
    toggleRow,
    selectPageReady,
    selectAllReady,
    skipExistingInAts,
    clearSelection,
    confirmImport,
    sendRestToPending,
    updateEdit,
    saveEdited,
    positionOptions,
    clientOptions,
    sourceOptions,
    statusOptions,
    ctcOptions,
    ectcOptions,
    npOptions,
    expOptions,
    stepIndex,
  };
}
