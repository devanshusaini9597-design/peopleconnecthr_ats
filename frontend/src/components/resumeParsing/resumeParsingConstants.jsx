import React from 'react';

export const PARSING_SESSION_KEY = 'resumeParsingSession'; // legacy (navigate-away handoff)
export const QUEUE_STORAGE_KEY = 'skillnix_resume_parse_queue';
export const PARSE_TOUR_KEY = 'skillnix_tour_resume_parsing_v3';
export const PAGE_SIZE = 25;

export const stripForStorage = (rows) => (rows || []).map((row) => {
  if (!row || typeof row !== 'object') return row;
  const rest = { ...row };
  delete rest.fileData;
  delete rest.fileDataUrl;
  delete rest.buffer;
  return rest;
});

export const loadPersistedQueue = () => {
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY) || sessionStorage.getItem(PARSING_SESSION_KEY);
    if (!raw) return { results: [], uploadedFiles: [] };
    const { results: r, uploadedFiles: f } = JSON.parse(raw);
    if (!Array.isArray(r) || r.length === 0) return { results: [], uploadedFiles: [] };
    return {
      results: r.map((row) => ({
        ...row,
        reviewStatus: row.success ? (row.reviewStatus || 'pending') : (row.reviewStatus || 'failed'),
      })),
      uploadedFiles: Array.isArray(f) ? f : [],
    };
  } catch {
    return { results: [], uploadedFiles: [] };
  }
};
export const PARSE_TOUR_STEPS = [
  {
    title: 'Resume Parsing',
    body: 'Enterprise import queue: upload → extract → Pending review → Approve or Reject → add only Approved to Candidates.',
  },
  {
    target: '[data-tour="parse-tip"]',
    title: 'Statuses',
    body: 'Pending needs review. Approved can import. Rejected is discarded from this batch (restore anytime). Failed means parse error.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="parse-upload"]',
    title: 'Upload batch',
    body: 'Drop PDF or Word files. New rows land in Pending — nothing auto-imports.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="parse-results"]',
    title: 'Review queue',
    body: 'Use Manage to edit fields. Bulk-add only Approved rows. Rejected rows stay out of Candidates.',
    placement: 'top',
  },
];

/** pending | approved | rejected | failed */
export const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'failed', label: 'Failed' },
];

export const statusOf = (row) => {
  if (!row?.success) return 'failed';
  return row.reviewStatus || 'pending';
};

export const StatusBadge = ({ status }) => {
  if (status === 'approved') return <span className="badge-success">Approved</span>;
  if (status === 'rejected') return <span className="badge-danger">Rejected</span>;
  if (status === 'failed') return <span className="badge-danger">Failed</span>;
  return <span className="badge-warning">Pending</span>;
};

export const EMPTY_BUFFER = {
  name: '', email: '', contact: '', position: '', company: '',
  experience: '', location: '', skills: '', education: '',
};

export const FIELD_DEFS = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'contact', label: 'Contact', type: 'tel' },
  { key: 'position', label: 'Position', type: 'text' },
  { key: 'company', label: 'Company', type: 'text' },
  { key: 'experience', label: 'Experience', type: 'text' },
  { key: 'location', label: 'Location', type: 'text' },
  { key: 'education', label: 'Education', type: 'text' },
  { key: 'skills', label: 'Skills', type: 'text' },
];
