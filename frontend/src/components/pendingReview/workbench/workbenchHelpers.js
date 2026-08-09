import { isImportReady } from '../pendingReviewHelpers';

export function getRowIssues(row) {
  const raw = row?.validationErrors || [];
  return raw.map((e) => (typeof e === 'object' ? (e.message || e.field || JSON.stringify(e)) : String(e))).filter(Boolean);
}

export function getRowFixes(row) {
  const raw = row?.autoFixChanges || [];
  return raw.map((e) => (typeof e === 'object' ? (e.message || e.field || JSON.stringify(e)) : String(e))).filter(Boolean);
}

export function getReadiness(row) {
  if (isImportReady(row)) {
    return { id: 'ready', label: 'Ready to release', tone: 'ready' };
  }
  if (row?.category === 'blocked') {
    return { id: 'blocked', label: 'Blocked', tone: 'blocked' };
  }
  return { id: 'review', label: 'Needs review', tone: 'review' };
}

export function formatIssueLine(text) {
  return String(text || '').trim();
}

export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
