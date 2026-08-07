import { useCallback } from 'react';
import BASE_API_URL from '../../config';
import { authenticatedFetch, handleUnauthorized } from '../../utils/fetchUtils';
import { MAX_BYTES } from './constants';

/**
 * Upload → map → validate actions for auto-import wizard.
 * State stays in useAutoImport; this only returns callbacks.
 */
export function useAutoImportUpload({
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
}) {
  const persistLastMapping = useCallback(async (headers, map) => {
    try {
      await authenticatedFetch('/api/organization/candidate-fields/last-mapping', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headers, map }),
      });
      setLastImportMapping({ headers, map, savedAt: new Date().toISOString() });
    } catch { /* non-blocking */ }
  }, [setLastImportMapping]);

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
  }, [
    toast, excelHeaders, persistLastMapping,
    setStep, setIsUploading, setUploadProgress, setUploadPercent, setImportResult,
    setReviewData, setStats, setSelected, setBucket, setPage, setActiveColumnMapping,
  ]);

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
  }, [
    toast, pendingFileRef,
    setFileName, setStep, setIsUploading, setUploadProgress, setUploadPercent,
    setImportResult, setReviewData, setActiveColumnMapping, setExcelHeaders,
    setCandidateFields, setLastImportMapping,
  ]);

  const onMapContinue = useCallback((map) => {
    const file = pendingFileRef.current;
    if (!file) {
      toast.error('File missing — please upload again');
      setStep('upload');
      return;
    }
    runValidate(file, map);
  }, [runValidate, toast, pendingFileRef, setStep]);

  const onMapSkipAuto = useCallback(() => {
    const file = pendingFileRef.current;
    if (!file) {
      toast.error('File missing — please upload again');
      setStep('upload');
      return;
    }
    runValidate(file, null);
  }, [runValidate, toast, pendingFileRef, setStep]);

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

  return { onMapContinue, onMapSkipAuto, onPickFile };
}
