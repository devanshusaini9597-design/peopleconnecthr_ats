import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import usePageTour from '../../hooks/usePageTour';
import { BASE_API_URL } from '../../config';
import { authenticatedFetch } from '../../utils/fetchUtils';
import { useToast } from '../Toast';
import {
  saveResumeFile, openResumeFile, deleteResumeFiles, clearResumeFiles,
} from '../../utils/resumeFileStore';
import {
  QUEUE_STORAGE_KEY, PARSE_TOUR_KEY, PAGE_SIZE, EMPTY_BUFFER, PARSING_SESSION_KEY,
  stripForStorage, loadPersistedQueue, statusOf,
} from './resumeParsingConstants';

export function useResumeParseQueue() {
  const navigate = useNavigate();
  const toast = useToast();
  const [tourOpen, setTourOpen] = usePageTour(PARSE_TOUR_KEY);
  const fileInputRef = useRef(null);
  const tableScrollRef = useRef(null);
  const dragScrollRef = useRef({ active: false, moved: false, startX: 0, scrollLeft: 0 });
  const [dragOver, setDragOver] = useState(false);

  const [uploadedFiles, setUploadedFiles] = useState(() => loadPersistedQueue().uploadedFiles);
  const [parsing, setParsing] = useState(false);
  const [results, setResults] = useState(() => loadPersistedQueue().results);
  const [error, setError] = useState('');
  const [editingIdx, setEditingIdx] = useState(null);
  const [reviewIdx, setReviewIdx] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [editBuffer, setEditBuffer] = useState(EMPTY_BUFFER);
  const [addingAll, setAddingAll] = useState(false);
  const [confirmAddAllOpen, setConfirmAddAllOpen] = useState(false);
  const [addSuccessModal, setAddSuccessModal] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Persist review queue so refresh / leaving the page does not force re-upload
  useEffect(() => {
    try {
      if (results.length === 0) {
        localStorage.removeItem(QUEUE_STORAGE_KEY);
        sessionStorage.removeItem(PARSING_SESSION_KEY);
        return;
      }
      const payload = JSON.stringify({ results: stripForStorage(results), uploadedFiles });
      localStorage.setItem(QUEUE_STORAGE_KEY, payload);
      sessionStorage.setItem(PARSING_SESSION_KEY, payload);
    } catch (_) { /* quota / private mode */ }
  }, [results, uploadedFiles]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter]);

  const handleViewResume = async (result) => {
    if (!result?.id) return;
    const ok = await openResumeFile(result.id, { download: false });
    if (!ok) toast.info('File storage not available yet for this row. Re-upload, or use after storage integration.');
  };

  const handleDownloadResume = async (result) => {
    if (!result?.id) return;
    const ok = await openResumeFile(result.id, { download: true });
    if (!ok) toast.info('File storage not available yet for this row. Re-upload, or use after storage integration.');
  };

  const parseFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length) return;

    setParsing(true);
    setError('');
    setSelectedIds(new Set());
    setEditingIdx(null);
    setReviewIdx(null);

    try {
      const newResults = [];

      for (const file of files) {
        const rowId = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const formData = new FormData();
        formData.append('resume', file);

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 60000);

          const response = await authenticatedFetch(`${BASE_API_URL}/candidates/parse-logic`, {
            method: 'POST',
            body: formData,
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          let hasFile = false;
          try {
            await saveResumeFile(rowId, file);
            hasFile = true;
          } catch (_) { /* IDB unavailable */ }

          if (!response.ok) {
            let backendError = 'Failed to parse resume';
            try {
              const errorData = await response.json();
              backendError = errorData?.error || errorData?.message || backendError;
              if (errorData?.suggestion) {
                backendError = `${backendError} — ${errorData.suggestion}`;
              }
            } catch {
              /* ignore */
            }
            newResults.push({
              id: rowId,
              fileName: file.name,
              mimeType: file.type || '',
              hasFile,
              success: false,
              error: backendError,
              data: null,
              reviewStatus: 'failed',
            });
            continue;
          }

          const result = await response.json();
          newResults.push({
            id: rowId,
            fileName: file.name,
            mimeType: file.type || '',
            hasFile,
            success: true,
            error: null,
            reviewStatus: 'pending',
            data: {
              name: result.parsed?.name || result.name || '',
              email: result.parsed?.email || result.email || '',
              contact: result.parsed?.contact || result.contact || '',
              position: result.parsed?.position || result.position || '',
              company: result.parsed?.company || result.company || '',
              experience: result.parsed?.experience || result.experience || '',
              location: result.parsed?.location || result.location || '',
              skills: result.parsed?.skills || result.skills || '',
              education: result.parsed?.education || result.education || '',
            },
            confidence: result.parsed?.confidence || result.confidence || {},
            metadata: result.metadata || {},
          });
        } catch (err) {
          const errorMsg = err.name === 'AbortError'
            ? 'Timed out. Try a text-based PDF or DOCX (scanned images are harder to parse).'
            : (err.message || 'Parse failed');
          let hasFile = false;
          try {
            await saveResumeFile(rowId, file);
            hasFile = true;
          } catch (_) { /* ignore */ }
          newResults.push({
            id: rowId,
            fileName: file.name,
            mimeType: file.type || '',
            hasFile,
            success: false,
            error: errorMsg,
            data: null,
            reviewStatus: 'failed',
          });
        }

        if (files.length > 1) {
          await new Promise((r) => setTimeout(r, 1500));
        }
      }

      setUploadedFiles((prev) => [
        ...prev,
        ...files.map((f) => ({ name: f.name, size: f.size })),
      ]);
      setResults((prev) => [...prev, ...newResults]);
      setCurrentPage(1);

      const failed = newResults.filter((r) => !r.success).length;
      const ok = newResults.length - failed;
      if (ok > 0) toast.success(`${ok} in Pending review${failed ? ` · ${failed} failed` : ''}`);
      else if (failed > 0) toast.error(`Could not parse ${failed} file${failed === 1 ? '' : 's'}. Check format or try a text PDF.`);
    } catch (err) {
      const msg = 'Error processing files: ' + (err.message || 'Unknown error');
      setError(msg);
      toast.error(msg);
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [toast]);

  const handleFileSelect = (event) => {
    parseFiles(event.target.files);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (parsing) return;
    parseFiles(e.dataTransfer?.files);
  };

  const handleEdit = (idx) => {
    setEditingIdx(idx);
    setEditBuffer({
      name: results[idx].data?.name || '',
      email: results[idx].data?.email || '',
      contact: results[idx].data?.contact || '',
      position: results[idx].data?.position || '',
      company: results[idx].data?.company || '',
      experience: results[idx].data?.experience || '',
      location: results[idx].data?.location || '',
      skills: results[idx].data?.skills || '',
      education: results[idx].data?.education || '',
    });
  };

  const handleCancelEdit = () => {
    setEditingIdx(null);
    setEditBuffer(EMPTY_BUFFER);
  };

  const handleSaveEdit = (idx) => {
    setResults((prev) => prev.map((r, i) =>
      i === idx ? { ...r, data: { ...r.data, ...editBuffer } } : r
    ));
    setEditingIdx(null);
    setEditBuffer(EMPTY_BUFFER);
    toast.success('Fields updated');
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditBuffer((prev) => ({ ...prev, [name]: value }));
  };

  const addToCandidate = (resultData) => {
    localStorage.setItem('parsedResumeData', JSON.stringify(resultData));
    navigate('/ats');
  };

  const setRowStatus = (idx, reviewStatus) => {
    setResults((prev) => prev.map((r, i) => (
      i === idx && r.success ? { ...r, reviewStatus } : r
    )));
  };

  const setManyStatus = (indices, reviewStatus) => {
    const set = new Set(indices);
    setResults((prev) => prev.map((r, i) => (
      set.has(i) && r.success ? { ...r, reviewStatus } : r
    )));
  };

  const removeRows = (indices) => {
    const set = new Set(indices);
    const idsToDelete = results.filter((_, i) => set.has(i)).map((r) => r.id).filter(Boolean);
    if (idsToDelete.length) deleteResumeFiles(idsToDelete).catch(() => {});
    setResults((prev) => prev.filter((_, i) => !set.has(i)));
    setSelectedIds(new Set());
    if (reviewIdx != null && set.has(reviewIdx)) {
      setReviewIdx(null);
      handleCancelEdit();
    }
  };

  const approvedRows = results.filter((r) => statusOf(r) === 'approved' && r.data);
  const approvedDataList = approvedRows.map((r) => r.data);
  const pendingCount = results.filter((r) => statusOf(r) === 'pending').length;
  const approvedCount = results.filter((r) => statusOf(r) === 'approved').length;
  const rejectedCount = results.filter((r) => statusOf(r) === 'rejected').length;
  const failedCount = results.filter((r) => statusOf(r) === 'failed').length;

  const visibleResults = results
    .map((r, idx) => ({ r, idx }))
    .filter(({ r }) => statusFilter === 'all' || statusOf(r) === statusFilter);

  const totalPages = Math.max(1, Math.ceil(visibleResults.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pagedResults = visibleResults.slice(pageStart, pageStart + PAGE_SIZE);

  const openConfirmAddAll = () => {
    if (!approvedDataList.length) {
      toast.error('No approved resumes. Approve at least one Pending row first.');
      return;
    }
    setConfirmAddAllOpen(true);
  };

  const addAllAsCandidates = async () => {
    setConfirmAddAllOpen(false);
    const toAdd = approvedDataList;
    if (!toAdd.length) return;

    const candidates = toAdd.map((c) => ({
      name: c.name || '',
      email: c.email || '',
      contact: c.contact || '',
      position: c.position || '',
      company: c.company || c.companyName || '',
      experience: c.experience || '',
      location: c.location || '',
      skills: c.skills || '',
      education: c.education || '',
      ctc: c.ctc || 'Not disclosed',
    }));

    setAddingAll(true);
    try {
      const response = await authenticatedFetch(`${BASE_API_URL}/candidates/bulk-from-parsed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidates }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Failed to add candidates');

      const { created = 0, skipped = 0, errors: errCount = 0 } = data;
      // Remove successfully imported approved rows from queue (enterprise: leave queue clean)
      const approvedIds = results.filter((r) => statusOf(r) === 'approved').map((r) => r.id).filter(Boolean);
      if (approvedIds.length) deleteResumeFiles(approvedIds).catch(() => {});
      setResults((prev) => prev.filter((r) => statusOf(r) !== 'approved'));
      setSelectedIds(new Set());
      setAddSuccessModal({ created, skipped, errors: errCount });
    } catch (err) {
      toast.error(err.message || 'Failed to add candidates');
    } finally {
      setAddingAll(false);
    }
  };

  const clearSession = () => {
    clearResumeFiles().catch(() => {});
    setResults([]);
    setUploadedFiles([]);
    setSelectedIds(new Set());
    setEditingIdx(null);
    setReviewIdx(null);
    setStatusFilter('all');
    setCurrentPage(1);
    setError('');
    try {
      localStorage.removeItem(QUEUE_STORAGE_KEY);
      sessionStorage.removeItem(PARSING_SESSION_KEY);
    } catch (_) { /* ignore */ }
  };

  const openReview = (idx) => {
    setReviewIdx(idx);
    setEditingIdx(null);
  };

  const openEditInModal = (idx) => {
    setReviewIdx(idx);
    handleEdit(idx);
  };

  const toggleSelect = (idx) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const pageSelectable = pagedResults.filter(({ r }) => r.success);
  const allVisibleSelected = pageSelectable.length > 0
    && pageSelectable.every(({ idx }) => selectedIds.has(idx));

  const toggleSelectVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageSelectable.forEach(({ idx }) => next.delete(idx));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageSelectable.forEach(({ idx }) => next.add(idx));
        return next;
      });
    }
  };

  const reviewResult = reviewIdx != null ? results[reviewIdx] : null;
  const reviewStatus = reviewResult ? statusOf(reviewResult) : null;

  const isClickOnScrollbar = (el, e) => {
    const rect = el.getBoundingClientRect();
    const canScrollX = el.scrollWidth > el.clientWidth + 1;
    const canScrollY = el.scrollHeight > el.clientHeight + 1;
    const hBar = Math.max(el.offsetHeight - el.clientHeight, 0);
    const vBar = Math.max(el.offsetWidth - el.clientWidth, 0);
    if (canScrollX && e.clientY >= rect.bottom - Math.max(hBar, 16)) return true;
    if (canScrollY && e.clientX >= rect.right - Math.max(vBar, 16)) return true;
    return false;
  };

  const onTableDragScrollStart = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('button, a, input, select, textarea, label, [role="button"]')) return;
    if (!e.target.closest('td, th, .cand-table-drag')) return;
    const el = tableScrollRef.current;
    if (!el) return;
    if (isClickOnScrollbar(el, e)) return;
    dragScrollRef.current = { active: true, moved: false, startX: e.pageX, scrollLeft: el.scrollLeft };
    el.dataset.dragging = '1';
  };

  const onTableDragScrollMove = (e) => {
    const state = dragScrollRef.current;
    if (!state.active) return;
    const el = tableScrollRef.current;
    if (!el) return;
    e.preventDefault();
    const dx = e.pageX - state.startX;
    if (Math.abs(dx) > 3) state.moved = true;
    el.scrollLeft = state.scrollLeft - dx;
  };

  const onTableDragScrollEnd = () => {
    const state = dragScrollRef.current;
    if (!state.active) return;
    state.active = false;
    const el = tableScrollRef.current;
    if (el) delete el.dataset.dragging;
  };

  return {
    navigate, toast, tourOpen, setTourOpen,
    fileInputRef, tableScrollRef, dragScrollRef,
    dragOver, setDragOver,
    uploadedFiles, parsing, results, error,
    editingIdx, reviewIdx, setReviewIdx, statusFilter, setStatusFilter,
    selectedIds, setSelectedIds, editBuffer, addingAll,
    confirmAddAllOpen, setConfirmAddAllOpen,
    addSuccessModal, setAddSuccessModal,
    currentPage, setCurrentPage,
    handleViewResume, handleDownloadResume,
    parseFiles, handleFileSelect, handleDrop,
    handleEdit, handleCancelEdit, handleSaveEdit, handleEditChange,
    addToCandidate, setRowStatus, setManyStatus, removeRows,
    approvedRows, approvedDataList, pendingCount, approvedCount, rejectedCount, failedCount,
    visibleResults, totalPages, safePage, pageStart, pagedResults,
    openConfirmAddAll, addAllAsCandidates, clearSession,
    openReview, openEditInModal, toggleSelect, pageSelectable, allVisibleSelected, toggleSelectVisible,
    reviewResult, reviewStatus,
    isClickOnScrollbar, onTableDragScrollStart, onTableDragScrollMove, onTableDragScrollEnd,
  };
}
