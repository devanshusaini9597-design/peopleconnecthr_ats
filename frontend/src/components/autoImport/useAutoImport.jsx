import { useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { planHasFeature } from '../../config/planFeatures';
import { useAuth } from '../../context/AuthContext';
import usePageTour from '../../hooks/usePageTour';
import useTableDragScroll from '../../hooks/useTableDragScroll';
import { authenticatedFetch } from '../../utils/fetchUtils';
import { ctcRanges, expectedCtcOptions, noticePeriodOptions } from '../../utils/ctcRanges';
import { useToast } from '../Toast';
import {
  DRAFT_KEY, PAGE_SIZE, TOUR_KEY, STEPS,
  TEMPLATE_HEADERS, TEMPLATE_SAMPLE, STATUS_OPTIONS, rowKey,
} from './constants';
import { useAutoImportUpload } from './useAutoImportUpload';
import { useAutoImportReviewActions } from './useAutoImportReviewActions';

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
  const [, setActiveColumnMapping] = useState(null);

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
  const selectedUpdates = selectedList.filter((r) => r.isDbDuplicate).length;
  const selectedNew = Math.max(0, selectedList.filter((r) => r._category === 'ready').length - selectedUpdates);
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

  const { onMapContinue, onMapSkipAuto, onPickFile } = useAutoImportUpload({
    toast,
    excelHeaders,
    pendingFileRef,
    reviewData,
    setStep,
    setIsUploading,
    setUploadProgress,
    setUploadPercent,
    setImportResult,
    setReviewData,
    setStats,
    setSelected,
    setBucket,
    setPage,
    setActiveColumnMapping,
    setFileName,
    setExcelHeaders,
    setCandidateFields,
    setLastImportMapping,
    setConfirmModal,
  });

  const {
    toggleRow,
    selectPageReady,
    selectAllReady,
    skipExistingInAts,
    clearSelection,
    confirmImport,
    sendRestToPending,
    updateEdit,
    saveEdited,
  } = useAutoImportReviewActions({
    toast,
    reviewData,
    fileName,
    pageRows,
    selectedList,
    selectedNew,
    selectedUpdates,
    reviewCount,
    blockedCount,
    editingRow,
    setSelected,
    setConfirmModal,
    setIsImporting,
    setReviewData,
    setImportResult,
    setStep,
    setIsSavingPending,
    setEditingRow,
    setEditErrors,
    setBucket,
  });

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
