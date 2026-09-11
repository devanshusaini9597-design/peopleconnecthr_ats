import { useState } from 'react';
import BASE_API_URL from '../../../config';
import { authenticatedFetch, handleUnauthorized } from '../../../utils/fetchUtils';
import { sniffResumeKindFromBytes, mimeForResumeKind } from '../../../utils/resumeFileKind';

export function useResumePreview({ toast, viewMode } = {}) {
  const [previewResumeUrl, setPreviewResumeUrl] = useState(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState(null);
  const [previewBlob, setPreviewBlob] = useState(null);
  const [previewFileKind, setPreviewFileKind] = useState(null);
  const [previewResumeCandidate, setPreviewResumeCandidate] = useState(null);
  const [previewResumeError, setPreviewResumeError] = useState(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const getResumeEndpointUrl = (candidateId, forDownload = false) => {
    if (!candidateId) return '';
    const base = (BASE_API_URL || '').replace(/\/$/, '');
    const params = new URLSearchParams();
    if (forDownload) params.set('download', '1');
    if (viewMode) params.set('view', viewMode);
    const q = params.toString() ? `?${params.toString()}` : '';
    return `${base}/candidates/${candidateId}/resume${q}`;
  };

  const resetPreviewBlob = (blobUrl) => {
    if (blobUrl && typeof blobUrl === 'string' && blobUrl.startsWith('blob:')) {
      URL.revokeObjectURL(blobUrl);
    }
  };

  const applyPreviewBlob = async (blob, candidate, contentType = '', previousBlobUrl) => {
    const head = new Uint8Array(await blob.slice(0, 32).arrayBuffer());
    const kind = sniffResumeKindFromBytes(head, candidate?.resume, contentType);
    if (kind === 'html_error') {
      resetPreviewBlob(previousBlobUrl);
      setPreviewBlob(null);
      setPreviewBlobUrl(null);
      setPreviewFileKind(null);
      setPreviewResumeCandidate(candidate);
      setPreviewResumeError('load_failed');
      return;
    }
    const mime = mimeForResumeKind(kind, contentType);
    const typed = blob.type && blob.type.split(';')[0] === mime ? blob : new Blob([blob], { type: mime });
    const blobUrl = URL.createObjectURL(typed);
    resetPreviewBlob(previousBlobUrl);
    setPreviewBlob(typed);
    setPreviewBlobUrl(blobUrl);
    setPreviewFileKind(kind);
    setPreviewResumeCandidate(candidate);
    setPreviewResumeError(null);
  };

  const handleResumePreview = async (candidate) => {
    if (!candidate?.resume) {
      toast.error('No resume available for this candidate');
      return;
    }
    const candidateId = candidate._id;
    if (!candidateId) {
      toast.error('Cannot load resume');
      return;
    }
    const authUrl = getResumeEndpointUrl(candidateId);
    if (!authUrl) {
      console.error('[Resume] API base URL not set. Set VITE_API_URL or run backend on same origin.');
      toast.error('Cannot load resume (API URL not configured)');
      return;
    }
    setPreviewResumeUrl(authUrl);
    setPreviewBlob(null);
    setPreviewFileKind(null);
    setPreviewResumeError(null);
    setIsPreviewLoading(true);
    try {
      const res = await authenticatedFetch(authUrl);
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        console.error('[Resume] Auth endpoint failed:', 'status=', res.status, 'statusText=', res.statusText, 'url=', authUrl, 'candidateId=', candidateId, 'resumePath=', candidate.resume, 'body=', bodyText.slice(0, 200));
        const isFileNotFound = res.status === 404 && (bodyText.includes('Resume file not found') || bodyText.includes('not found'));
        setPreviewResumeCandidate(candidate);
        setPreviewResumeError(isFileNotFound ? 'file_not_found' : 'load_failed');
        setPreviewResumeUrl(authUrl);
        setPreviewBlobUrl((prev) => {
          resetPreviewBlob(prev);
          return null;
        });
        return;
      }
      const contentType = res.headers.get('content-type') || '';
      const blob = await res.blob();
      await applyPreviewBlob(blob, candidate, contentType, previewBlobUrl);
      setPreviewResumeUrl(authUrl);
    } catch (err) {
      console.error('[Resume] Error loading resume:', 'message=', err?.message, 'url=', authUrl, 'candidateId=', candidateId, 'resumePath=', candidate.resume, err);
      setPreviewResumeCandidate(candidate);
      setPreviewResumeError('load_failed');
      setPreviewBlobUrl((prev) => {
        resetPreviewBlob(prev);
        return null;
      });
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const closeResumePreview = () => {
    resetPreviewBlob(previewBlobUrl);
    setPreviewBlobUrl(null);
    setPreviewBlob(null);
    setPreviewFileKind(null);
    setPreviewResumeUrl(null);
    setPreviewResumeCandidate(null);
    setPreviewResumeError(null);
  };

  const handleResumeDownload = async (candidate) => {
    if (!candidate?.resume || !candidate?._id) {
      toast.error('No resume available for this candidate');
      return;
    }
    const url = getResumeEndpointUrl(candidate._id, true);
    try {
      const res = await authenticatedFetch(url);
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!res.ok) {
        toast.error('Failed to download resume');
        return;
      }
      const blob = await res.blob();
      const ext = (candidate.resume && candidate.resume.split('.').pop()) || 'pdf';
      const filename = `resume-${candidate.name || candidate._id}.${ext.replace(/\?.*$/, '')}`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success('Resume downloaded');
    } catch (err) {
      console.error('Error downloading resume:', err);
      toast.error('Failed to download resume');
    }
  };

  return {
    previewResumeUrl,
    previewBlobUrl,
    previewBlob,
    previewFileKind,
    previewResumeCandidate,
    previewResumeError,
    isPreviewLoading,
    getResumeEndpointUrl,
    handleResumePreview,
    closeResumePreview,
    handleResumeDownload,
  };
}
