import { useState } from 'react';
import BASE_API_URL from '../../../config';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../../../utils/fetchUtils';

export function useResumePreview({ toast } = {}) {
  const [previewResumeUrl, setPreviewResumeUrl] = useState(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState(null);
  const [previewResumeCandidate, setPreviewResumeCandidate] = useState(null);
  const [previewResumeError, setPreviewResumeError] = useState(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const getResumeEndpointUrl = (candidateId, forDownload = false) => {
    if (!candidateId) return '';
    const base = (BASE_API_URL || '').replace(/\/$/, '');
    const q = forDownload ? '?download=1' : '';
    return `${base}/candidates/${candidateId}/resume${q}`;
  };

  // Fallback: direct file URL (must be absolute so iframe doesn't hit Vite dev server)
  const getResumeUrl = (resumePath) => {
    if (!resumePath || typeof resumePath !== 'string') return '';
    const p = resumePath.trim();
    if (p.startsWith('http')) return p;
    const base = (BASE_API_URL || '').replace(/\/$/, '');
    if (!base) return ''; // avoid relative URL when BASE_API_URL is missing
    const pathPart = p.startsWith('/') ? p : `/${p}`;
    const url = `${base}${pathPart}`;
    return url.startsWith('http') ? url : '';
  };

  // --- Resume Preview: fetch with auth so it works for all candidates (own + others) ---
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
    // Allow both absolute URLs (http/https) and relative URLs (same-origin via Vercel rewrites)
    if (!authUrl) {
      console.error('[Resume] API base URL not set. Set VITE_API_URL or run backend on same origin.');
      toast.error('Cannot load resume (API URL not configured)');
      return;
    }
    setPreviewResumeUrl(authUrl);
    setPreviewBlobUrl(null);
    setPreviewResumeError(null);
    setIsPreviewLoading(true);
    try {
      const res = await authenticatedFetch(authUrl);
      if (isUnauthorized(res)) {
        handleUnauthorized();
        return;
      }
      if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        console.error('[Resume] Auth endpoint failed:', 'status=', res.status, 'statusText=', res.statusText, 'url=', authUrl, 'candidateId=', candidateId, 'resumePath=', candidate.resume, 'body=', bodyText.slice(0, 200));
        const isFileNotFound = res.status === 404 && (bodyText.includes('Resume file not found') || bodyText.includes('not found'));
        if (isFileNotFound) {
          setPreviewResumeCandidate(candidate);
          setPreviewResumeError('file_not_found');
          setPreviewResumeUrl(authUrl);
        } else {
          const directUrl = getResumeUrl(candidate.resume);
          if (directUrl && directUrl.startsWith('http')) {
            setPreviewBlobUrl(directUrl);
            setPreviewResumeUrl(directUrl);
            setPreviewResumeCandidate(candidate);
          } else {
            toast.error(`Failed to load resume (${res.status}). Check console for details.`);
            setPreviewResumeUrl(null);
          }
        }
        return;
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      setPreviewBlobUrl(blobUrl);
      setPreviewResumeUrl(authUrl);
      setPreviewResumeCandidate(candidate);
    } catch (err) {
      console.error('[Resume] Error loading resume:', 'message=', err?.message, 'url=', authUrl, 'candidateId=', candidateId, 'resumePath=', candidate.resume, err);
      const directUrl = getResumeUrl(candidate.resume);
      if (directUrl && directUrl.startsWith('http')) {
        setPreviewBlobUrl(directUrl);
        setPreviewResumeUrl(directUrl);
        setPreviewResumeCandidate(candidate);
      } else {
        toast.error('Failed to load resume. Check console for details.');
        setPreviewResumeUrl(null);
      }
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const closeResumePreview = () => {
    if (previewBlobUrl && typeof previewBlobUrl === 'string' && previewBlobUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewBlobUrl);
    }
    setPreviewBlobUrl(null);
    setPreviewResumeUrl(null);
    setPreviewResumeCandidate(null);
    setPreviewResumeError(null);
  };

  // Download resume via authenticated endpoint (works for all candidates)
  const handleResumeDownload = async (candidate) => {
    if (!candidate?.resume || !candidate?._id) {
      toast.error('No resume available for this candidate');
      return;
    }
    const url = getResumeEndpointUrl(candidate._id, true);
    try {
      const res = await authenticatedFetch(url);
      if (isUnauthorized(res)) {
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
    previewResumeUrl, previewBlobUrl, previewResumeCandidate, previewResumeError, isPreviewLoading,
    getResumeEndpointUrl, getResumeUrl, handleResumePreview, closeResumePreview, handleResumeDownload,
  };
}
