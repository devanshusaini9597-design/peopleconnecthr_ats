import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckSquare, Copy, Eye, FileDown, Handshake, Loader2, Mail, BadgeCheck, Plus, Search,
  ShieldCheck, Square, SquarePen, Trash2, UserPlus, UserRound, X,
} from 'lucide-react';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import PipelineStageSummary from './ui/PipelineStageSummary';
import ConfirmationModal from './ConfirmationModal';
import Modal from './ui/Modal';
import { ForbiddenPage } from './RouteErrorPage';
import { WhatsAppIcon } from './icons/BrandIcons';
import CandidateRemarkIndicator from './ats/CandidateRemarkIndicator';
import ResumePreviewModal from './ats/ResumePreviewModal';
import { detectResumeFileKind } from '../utils/resumeFileKind';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import { useAuth } from '../context/AuthContext';
import { guardTableCopy } from '../utils/tableCopyGuard';
import { useTableDragScroll } from './ats/hooks/useTableDragScroll';

const OWNER_ADMIN_ROLES = ['owner', 'admin'];
const PAGE_SIZE = 25;

const TABS = [
  { id: 'pending', label: 'Pending' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'invited', label: 'Invited' },
  { id: 'joined', label: 'Joined' },
  { id: 'rejected', label: 'Declined' },
];

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  location: '',
  currentCompany: '',
  yearsExperience: '',
  specializations: '',
  rolesHired: '',
  availability: '',
  commercialNote: '',
  coverNote: '',
  reviewNote: '',
};

const actionBtn =
  'h-8 w-8 inline-flex items-center justify-center rounded-lg border shadow-sm transition-all disabled:opacity-40 disabled:pointer-events-none';

function dash(value) {
  const t = String(value || '').trim();
  return t ? t : '—';
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

function statusPillClass(status) {
  const key = String(status || '');
  if (key === 'joined') return 'bg-emerald-50 text-emerald-700';
  if (key === 'invited' || key === 'approved') return 'bg-teal-50 text-teal-700';
  if (key === 'rejected') return 'bg-red-50 text-red-700';
  if (key === 'contacted') return 'bg-amber-50 text-amber-800';
  return 'bg-stone-100 text-stone-600';
}

function statusLabel(status) {
  if (status === 'rejected') return 'Declined';
  if (status === 'joined') return 'Joined';
  if (status === 'invited' || status === 'approved') return 'Invited';
  if (!status) return '—';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function initials(name) {
  return String(name || '?').charAt(0).toUpperCase();
}

function fromRow(row) {
  return {
    name: row.name || '',
    email: row.email || '',
    phone: row.phone || '',
    location: row.location || '',
    currentCompany: row.currentCompany || '',
    yearsExperience: row.yearsExperience || '',
    specializations: row.specializations || '',
    rolesHired: row.rolesHired || '',
    availability: row.availability || '',
    commercialNote: row.commercialNote || '',
    coverNote: row.coverNote || '',
    reviewNote: row.reviewNote || '',
  };
}

function Th({ children, className = '' }) {
  return (
    <th className={`px-3.5 py-3.5 text-[10px] font-bold text-stone-600 uppercase tracking-wider whitespace-nowrap border border-stone-200 bg-stone-100 ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, className = '' }) {
  return (
    <td className={`px-3.5 py-3 text-sm text-stone-700 font-medium border border-stone-200 align-middle whitespace-nowrap ${className}`}>
      {children}
    </td>
  );
}

export default function FreelancerApplicationsPage() {
  const toast = useToast();
  const { user, organization } = useAuth();
  const role = String(user?.role || '');
  const canManage = OWNER_ADMIN_ROLES.includes(role);

  const [status, setStatus] = useState('all');
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [acting, setActing] = useState('');
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [contactTarget, setContactTarget] = useState(null);
  const [inviteTarget, setInviteTarget] = useState(null);
  const [detail, setDetail] = useState(null);
  const [reviewRow, setReviewRow] = useState(null);
  const [review, setReview] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewIntent, setReviewIntent] = useState('inspect');
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkContactOpen, setBulkContactOpen] = useState(false);
  const [bulkInviteOpen, setBulkInviteOpen] = useState(false);
  const [bulkDeclineOpen, setBulkDeclineOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkActing, setBulkActing] = useState(false);
  const [previewResumeUrl, setPreviewResumeUrl] = useState(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState(null);
  const [previewBlob, setPreviewBlob] = useState(null);
  const [previewFileKind, setPreviewFileKind] = useState(null);
  const [previewResumeCandidate, setPreviewResumeCandidate] = useState(null);
  const [previewRowId, setPreviewRowId] = useState(null);
  const [previewResumeError, setPreviewResumeError] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const {
    tableScrollRef,
    onTableDragScrollStart,
    onTableDragScrollMove,
    onTableDragScrollEnd,
  } = useTableDragScroll();
  const slug = organization?.slug || '';
  const publicUrl = slug ? `${window.location.origin}/partners/${slug}` : '';

  const load = useCallback(async (silent = false) => {
    if (!canManage) return;
    if (!silent) setLoading(true);
    try {
      const res = await authenticatedFetch('/api/freelancer-applications?status=all');
      if (isUnauthorized(res)) return handleUnauthorized();
      const data = await res.json();
      if (res.status === 403) throw new Error(data.message || 'Access denied');
      if (!res.ok) throw new Error(data.message || 'Unable to load partner applications');
      const payload = data.data || {};
      setRows(Array.isArray(payload.applications) ? payload.applications : []);
      setCounts(payload.counts || {});
    } catch (err) {
      toast.error(err.message || 'Unable to load partner applications');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [toast, canManage]);

  useEffect(() => {
    if (canManage) load();
  }, [load, canManage]);

  useEffect(() => {
    if (!canManage) return undefined;
    const timer = window.setInterval(() => { load(true); }, 15000);
    return () => window.clearInterval(timer);
  }, [load, canManage]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds([]);
  }, [status, search]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (status !== 'all' && row.status !== status) return false;
      if (!q) return true;
      return [
        row.referenceCode, row.name, row.email, row.phone, row.location, row.currentCompany,
        row.yearsExperience, row.specializations, row.rolesHired, row.availability,
        row.commercialNote, row.coverNote, row.status, row.identity?.roleLabel,
      ].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [rows, status, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  const selectedSet = useMemo(() => new Set(selectedIds.map(String)), [selectedIds]);
  const pageIds = pageRows.map((row) => String(row.id));
  const isPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedSet.has(id));
  const isPagePartial = pageIds.some((id) => selectedSet.has(id)) && !isPageSelected;

  const act = async (id, nextStatus, reviewNote = '') => {
    setActing(id);
    try {
      const res = await authenticatedFetch(`/api/freelancer-applications/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, reviewNote }),
      });
      if (isUnauthorized(res)) return handleUnauthorized();
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to update application');
      toast.success(nextStatus === 'invited'
        ? (data.data?.status === 'joined'
          ? 'This person is already an active member of your organisation.'
          : (data.data?.inviteEmailSent
            ? 'Company invitation sent. They now appear under Organisation → Team → Invited.'
            : 'Invitation created. They appear under Organisation → Team → Invited. Share the link if email delivery failed.'))
        : nextStatus === 'contacted'
          ? 'Marked as contacted. The applicant was emailed that their application is moving forward and a team member will follow up. No company account was created.'
          : nextStatus === 'rejected'
            ? 'Application declined. The applicant has been notified by email.'
            : `Status updated to ${statusLabel(nextStatus)}`);
      setRejectTarget(null);
      setContactTarget(null);
      setInviteTarget(null);
      setReviewRow(null);
      setReview(null);
      await load();
    } catch (err) {
      toast.error(err.message || 'Unable to update this application');
    } finally {
      setActing('');
    }
  };

  const saveEditor = async () => {
    setSaving(true);
    try {
      const isNew = editor === 'new';
      const res = await authenticatedFetch(
        isNew ? '/api/freelancer-applications' : `/api/freelancer-applications/${editor.id}`,
        {
          method: isNew ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        },
      );
      if (isUnauthorized(res)) return handleUnauthorized();
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to save application');
      toast.success(isNew ? 'Partner application added' : 'Partner application updated');
      setEditor(null);
      await load();
    } catch (err) {
      toast.error(err.message || 'Unable to save application');
    } finally {
      setSaving(false);
    }
  };

  const removeRow = async (id) => {
    setActing(id);
    try {
      const res = await authenticatedFetch(`/api/freelancer-applications/${id}`, { method: 'DELETE' });
      if (isUnauthorized(res)) return handleUnauthorized();
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to delete application');
      toast.success('Partner application deleted');
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(err.message || 'Unable to delete application');
    } finally {
      setActing('');
    }
  };

  const copyUrl = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success('Public application link copied');
    } catch {
      toast.error('Unable to copy link');
    }
  };

  const downloadResume = async (row) => {
    try {
      const res = await authenticatedFetch(`/api/freelancer-applications/${row.id}/resume?download=1`);
      if (isUnauthorized(res)) return handleUnauthorized();
      if (!res.ok) throw new Error('Unable to download CV');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = row.resumeOriginalName || 'resume.pdf';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CV download started');
    } catch (err) {
      toast.error(err.message || 'Unable to download CV');
    }
  };

  const closeResumePreview = useCallback(() => {
    setPreviewBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPreviewResumeUrl(null);
    setPreviewBlob(null);
    setPreviewFileKind(null);
    setPreviewResumeCandidate(null);
    setPreviewRowId(null);
    setPreviewResumeError('');
    setIsPreviewLoading(false);
  }, []);

  const previewResume = async (row) => {
    if (!row?.hasResume) {
      toast.error('No CV on file');
      return;
    }
    setPreviewBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPreviewResumeUrl('loading');
    setPreviewResumeCandidate({ name: row.name, resumeOriginalName: row.resumeOriginalName });
    setPreviewRowId(row.id);
    setIsPreviewLoading(true);
    setPreviewResumeError('');
    setPreviewBlob(null);
    setPreviewFileKind(null);
    try {
      const res = await authenticatedFetch(`/api/freelancer-applications/${row.id}/resume`);
      if (isUnauthorized(res)) return handleUnauthorized();
      if (!res.ok) throw new Error('Unable to preview CV');
      const contentType = res.headers.get('content-type') || '';
      const blob = await res.blob();
      if (contentType.includes('application/json') || blob.type.includes('json')) {
        throw new Error('Unable to preview CV — file may be missing from storage');
      }
      const kind = detectResumeFileKind(row.resumeOriginalName || 'resume.pdf', contentType || blob.type);
      const url = URL.createObjectURL(blob);
      setPreviewBlob(blob);
      setPreviewBlobUrl(url);
      setPreviewFileKind(kind);
      setPreviewResumeUrl(url);
    } catch (err) {
      setPreviewResumeError(err.message || 'Unable to preview CV');
      toast.error(err.message || 'Unable to preview CV');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const openNew = () => {
    setForm(EMPTY_FORM);
    setEditor('new');
  };

  const openEdit = (row) => {
    setForm(fromRow(row));
    setEditor(row);
  };

  const openReview = async (row, intent = 'inspect') => {
    setReviewIntent(intent);
    setReviewRow(row);
    setReview(null);
    setReviewLoading(true);
    try {
      const res = await authenticatedFetch(`/api/freelancer-applications/${row.id}/review-check`);
      if (isUnauthorized(res)) return handleUnauthorized();
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to verify organisation records');
      const payload = data.data || null;
      setReview(payload);
      if (intent === 'invite' && payload?.clear) {
        toast.success('Record check clear. Confirm to send the company invitation.');
      } else if (intent === 'invite' && payload && !payload.clear) {
        toast.warning('Matching records found. Invitation blocked until resolved.');
      }
    } catch (err) {
      toast.error(err.message || 'Unable to verify organisation records');
      setReviewRow(null);
      setReviewIntent('inspect');
    } finally {
      setReviewLoading(false);
    }
  };

  const requestInvite = (row) => {
    openReview(row, 'invite');
  };

  const toggleSelection = (id) => {
    const key = String(id);
    setSelectedIds((prev) => (prev.map(String).includes(key) ? prev.filter((x) => String(x) !== key) : [...prev, key]));
  };

  const togglePageSelection = () => {
    if (isPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(String(id))));
      return;
    }
    setSelectedIds((prev) => [...new Set([...prev.map(String), ...pageIds])]);
  };

  const openWhatsApp = (phone) => {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) {
      toast.error('No mobile number on file');
      return;
    }
    window.open(`https://wa.me/${digits.length === 10 ? `91${digits}` : digits}`, '_blank', 'noopener,noreferrer');
  };

  const selectedRows = useMemo(
    () => rows.filter((row) => selectedSet.has(String(row.id))),
    [rows, selectedSet],
  );

  const bulkEmailSelected = () => {
    const emails = selectedRows.map((r) => r.email).filter(Boolean);
    if (!emails.length) {
      toast.error('No email addresses on the selected applications');
      return;
    }
    window.location.href = `mailto:${emails.join(',')}`;
    toast.success(`Opening mail for ${emails.length} recipient${emails.length === 1 ? '' : 's'}`);
  };

  const bulkWhatsAppSelected = () => {
    const withPhone = selectedRows.filter((r) => r.phone);
    if (!withPhone.length) {
      toast.error('No mobile numbers on the selected applications');
      return;
    }
    if (withPhone.length === 1) {
      openWhatsApp(withPhone[0].phone);
      return;
    }
    toast.success(`Opening WhatsApp for the first of ${withPhone.length} selected. Use Contact for each row to message others.`);
    openWhatsApp(withPhone[0].phone);
  };

  const runBulkStatus = async (nextStatus) => {
    const targets = selectedRows.filter((row) => {
      if (nextStatus === 'contacted') return row.status === 'pending';
      if (nextStatus === 'invited') return row.status !== 'invited' && row.status !== 'joined' && row.status !== 'rejected';
      if (nextStatus === 'rejected') return row.status !== 'rejected' && row.status !== 'joined';
      return true;
    });
    if (!targets.length) {
      toast.warning('No selected applications are eligible for this action');
      setBulkContactOpen(false);
      setBulkInviteOpen(false);
      setBulkDeclineOpen(false);
      return;
    }
    setBulkActing(true);
    let ok = 0;
    let failed = 0;
    try {
      for (const row of targets) {
        if (nextStatus === 'invited') {
          const check = await authenticatedFetch(`/api/freelancer-applications/${row.id}/review-check`);
          if (isUnauthorized(check)) return handleUnauthorized();
          const checkData = await check.json();
          if (!check.ok || !checkData.data?.clear) {
            failed += 1;
            continue;
          }
        }
        const res = await authenticatedFetch(`/api/freelancer-applications/${row.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus, reviewNote: row.reviewNote || '' }),
        });
        if (isUnauthorized(res)) return handleUnauthorized();
        if (res.ok) ok += 1;
        else failed += 1;
      }
      if (ok) {
        toast.success(
          nextStatus === 'contacted'
            ? `${ok} application${ok === 1 ? '' : 's'} marked contacted. Eligible applicants were emailed.`
            : nextStatus === 'invited'
              ? `${ok} invitation${ok === 1 ? '' : 's'} sent.`
              : `${ok} application${ok === 1 ? '' : 's'} declined.`,
        );
      }
      if (failed) toast.warning(`${failed} could not be updated (records conflict or ineligible stage).`);
      setSelectedIds([]);
      setBulkContactOpen(false);
      setBulkInviteOpen(false);
      setBulkDeclineOpen(false);
      await load();
    } catch (err) {
      toast.error(err.message || 'Bulk update failed');
    } finally {
      setBulkActing(false);
    }
  };

  const runBulkDelete = async () => {
    if (!selectedRows.length) return;
    setBulkActing(true);
    let ok = 0;
    try {
      for (const row of selectedRows) {
        const res = await authenticatedFetch(`/api/freelancer-applications/${row.id}`, { method: 'DELETE' });
        if (isUnauthorized(res)) return handleUnauthorized();
        if (res.ok) ok += 1;
      }
      toast.success(`${ok} application${ok === 1 ? '' : 's'} deleted`);
      setSelectedIds([]);
      setBulkDeleteOpen(false);
      await load();
    } catch (err) {
      toast.error(err.message || 'Bulk delete failed');
    } finally {
      setBulkActing(false);
    }
  };

  if (!canManage) {
    return <ForbiddenPage />;
  }

  const from = pageRows.length ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const to = pageRows.length ? from + pageRows.length - 1 : 0;

  return (
    <div className="page-shell-ats">
      <PageHeader
        icon={Handshake}
        title="Partner applications"
        subtitle="Review partnership applications, shortlist strong prospects, and invite recruiters who are a fit for your organisation."
      >
        <div className="flex flex-col xs:flex-row flex-wrap gap-2 w-full md:justify-end">
          {publicUrl ? (
            <button type="button" className="btn-secondary w-full sm:w-auto justify-center" onClick={copyUrl}>
              <Copy className="w-4 h-4" /> Copy application page
            </button>
          ) : null}
          <button type="button" className="btn-primary w-full sm:w-auto justify-center" onClick={openNew}>
            <Plus className="w-4 h-4" /> Add application
          </button>
        </div>
      </PageHeader>

      <div className="min-w-0">
        <PipelineStageSummary
          stages={TABS}
          counts={{ ...counts, all: rows.length }}
          stageFilter={status}
          setStageFilter={setStatus}
          total={rows.length}
          hint="Swipe stage cards on smaller screens"
          countLabel="applications"
          tourAttr="partner-applications-pipeline"
        />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="text-sm text-stone-500 font-medium">
          <span className="text-stone-800 font-semibold tabular-nums">{filtered.length}</span>
          {' '}application{filtered.length === 1 ? '' : 's'}
          {status !== 'all' ? (
            <span className="text-stone-400"> · {statusLabel(status)}</span>
          ) : null}
          {selectedIds.length > 0 ? (
            <span className="text-brand-700"> · {selectedIds.length} selected</span>
          ) : null}
        </p>
        <div className="relative sm:ml-auto w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none z-[1]" aria-hidden="true" />
          <input
            className="input-ats input-ats-icon w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, mobile, city, reference…"
            aria-label="Search partner applications"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            name="partner-applications-q"
            type="search"
            style={{ paddingLeft: '2.75rem' }}
          />
        </div>
      </div>

      {selectedIds.length > 0 ? (
        <div className="sticky top-0 z-30 animate-fade-in">
          <div className="rounded-2xl border border-brand-200/70 bg-gradient-to-r from-brand-50/90 via-white to-white shadow-[var(--shadow-elevated)] overflow-hidden">
            <div className="px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-brand-500 to-teal-700 text-white flex items-center justify-center text-sm font-bold tabular-nums shadow-lg shadow-brand-500/25 ring-1 ring-white/20 flex-shrink-0">
                  {selectedIds.length}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-700">Bulk actions</p>
                  <p className="text-sm font-semibold text-stone-900 mt-0.5 truncate">
                    {selectedIds.length === 1 ? '1 application selected' : `${selectedIds.length} applications selected`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="h-10 w-10 rounded-xl border border-stone-200/80 bg-white text-stone-500 inline-flex items-center justify-center hover:bg-stone-50 hover:text-stone-800 hover:border-stone-300 transition-all shadow-sm flex-shrink-0"
                  title="Clear selection"
                  aria-label="Clear selection"
                >
                  <X size={16} strokeWidth={2} />
                </button>
              </div>
              <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                <div className="inline-flex items-center gap-2 p-1 rounded-xl bg-stone-50/80 border border-stone-100">
                  <button
                    type="button"
                    onClick={bulkEmailSelected}
                    className="h-10 w-10 rounded-lg bg-white border border-stone-200/80 text-stone-600 inline-flex items-center justify-center shadow-sm hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50 transition-all"
                    title="Email selected"
                    aria-label="Email selected"
                  >
                    <Mail size={17} strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    onClick={bulkWhatsAppSelected}
                    className="h-10 w-10 rounded-lg bg-white border border-stone-200/80 text-stone-600 inline-flex items-center justify-center shadow-sm hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 transition-all"
                    title="WhatsApp selected"
                    aria-label="WhatsApp selected"
                  >
                    <WhatsAppIcon size={17} />
                  </button>
                </div>
                <div className="inline-flex items-center gap-2 p-1 rounded-xl bg-stone-50/80 border border-stone-100">
                  <button
                    type="button"
                    onClick={() => setBulkContactOpen(true)}
                    className="h-10 px-3 rounded-lg bg-white border border-stone-200/80 text-stone-700 inline-flex items-center justify-center gap-1.5 shadow-sm hover:border-amber-300 hover:text-amber-800 hover:bg-amber-50 transition-all text-xs font-bold"
                    title="Mark selected as contacted"
                  >
                    <BadgeCheck size={15} strokeWidth={1.75} />
                    Contacted
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkInviteOpen(true)}
                    className="h-10 px-3 rounded-lg bg-white border border-stone-200/80 text-stone-700 inline-flex items-center justify-center gap-1.5 shadow-sm hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 transition-all text-xs font-bold"
                    title="Invite selected"
                  >
                    <UserPlus size={15} strokeWidth={1.75} />
                    Invite
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkDeclineOpen(true)}
                    className="h-10 px-3 rounded-lg bg-white border border-stone-200/80 text-stone-700 inline-flex items-center justify-center gap-1.5 shadow-sm hover:border-rose-300 hover:text-rose-700 hover:bg-rose-50 transition-all text-xs font-bold"
                    title="Decline selected"
                  >
                    <X size={15} strokeWidth={1.75} />
                    Decline
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setBulkDeleteOpen(true)}
                  className="h-10 w-10 rounded-xl bg-white border border-red-200/90 text-red-600 inline-flex items-center justify-center shadow-sm hover:bg-red-50 hover:border-red-300 transition-all"
                  title="Delete selected"
                  aria-label="Delete selected"
                >
                  <Trash2 size={17} strokeWidth={1.75} />
                </button>
              </div>
            </div>
            {filtered.length > selectedIds.length ? (
              <div className="px-4 sm:px-5 py-2.5 border-t border-brand-100/80 bg-brand-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <p className="text-xs sm:text-sm text-stone-600">
                  {selectedIds.length} selected.
                  {' '}
                  <span className="text-stone-500">{filtered.length.toLocaleString()} match your current search/filters.</span>
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedIds(filtered.map((r) => String(r.id)))}
                  className="text-sm font-bold text-brand-700 hover:text-brand-800 underline underline-offset-2 decoration-brand-300 hover:decoration-brand-500 transition-colors text-left sm:text-right"
                >
                  Select all {filtered.length.toLocaleString()} matching results
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <section className="card-ats-bordered overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-stone-400" role="status" aria-live="polite">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="sr-only">Loading applications</span>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            compact
            tone="brand"
            icon={Handshake}
            message={search || status !== 'all' ? 'No applications match your filters' : 'No partner applications yet'}
            subMessage={
              search || status !== 'all'
                ? 'Try a different keyword or clear the stage filter.'
                : 'Share the public partnership page or add a record manually.'
            }
          />
        ) : (
          <>
            <div
              ref={tableScrollRef}
              className="cand-table-scroll overflow-x-auto select-none"
              onCopy={guardTableCopy}
              onMouseDown={onTableDragScrollStart}
              onMouseMove={onTableDragScrollMove}
              onMouseUp={onTableDragScrollEnd}
              onMouseLeave={onTableDragScrollEnd}
            >
              <table
                className="cand-table-drag w-max min-w-full text-left border-collapse select-none border border-stone-200"
                style={{ tableLayout: 'auto' }}
                role="table"
                aria-label="Partner applications"
              >
                <thead>
                  <tr className="bg-stone-100">
                    <th scope="col" className="px-3.5 py-3.5 w-[52px] text-center border border-stone-200 bg-stone-100">
                      <button
                        type="button"
                        title={isPageSelected ? 'Deselect this page' : 'Select this page'}
                        aria-label={isPageSelected ? 'Deselect this page' : 'Select this page'}
                        onClick={togglePageSelection}
                        className="cursor-pointer flex justify-center mx-auto p-1 rounded hover:bg-stone-200/80"
                      >
                        {isPageSelected ? (
                          <CheckSquare size={18} className="text-brand-600" aria-hidden="true" />
                        ) : isPagePartial ? (
                          <CheckSquare size={18} className="text-brand-500 opacity-70" aria-hidden="true" />
                        ) : (
                          <Square size={18} className="text-stone-400" aria-hidden="true" />
                        )}
                      </button>
                    </th>
                    <Th>Actions</Th>
                    <Th className="text-center">Sr No.</Th>
                    <Th>Contact</Th>
                    <Th>Name</Th>
                    <Th>Phone</Th>
                    <Th>Email</Th>
                    <Th>Reference</Th>
                    <Th>Location</Th>
                    <Th>Organisation</Th>
                    <Th>Experience</Th>
                    <Th>Availability</Th>
                    <Th>Industry focus</Th>
                    <Th>Roles sourced</Th>
                    <Th>Terms</Th>
                    <Th>Note</Th>
                    <Th>Stage</Th>
                    <Th>Workflow</Th>
                    <Th>CV</Th>
                    <Th>Applied</Th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row, index) => {
                    const serial = (safePage - 1) * PAGE_SIZE + index + 1;
                    const busy = acting === row.id;
                    const selected = selectedSet.has(String(row.id));
                    const canContact = row.status === 'pending';
                    const canInvite = row.status !== 'invited' && row.status !== 'joined' && row.status !== 'rejected';
                    const canDecline = row.status !== 'rejected' && row.status !== 'joined';
                    return (
                      <tr
                        key={row.id}
                        className={`transition-colors ${
                          selected ? 'bg-brand-50/80' : index % 2 === 0 ? 'bg-white' : 'bg-stone-50/40'
                        } hover:bg-brand-50/50`}
                      >
                        <td className="px-3.5 py-3 text-center w-[52px] border border-stone-200">
                          <button
                            type="button"
                            aria-label={selected ? `Deselect ${row.name || 'applicant'}` : `Select ${row.name || 'applicant'}`}
                            onClick={() => toggleSelection(row.id)}
                            className="cursor-pointer flex justify-center mx-auto p-1 rounded hover:bg-stone-100"
                          >
                            {selected
                              ? <CheckSquare className="text-brand-600" size={17} aria-hidden="true" />
                              : <Square className="text-stone-300 hover:text-stone-400" size={17} aria-hidden="true" />}
                          </button>
                        </td>

                        <Td>
                          <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
                            <button
                              type="button"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => { e.stopPropagation(); openEdit(row); }}
                              className={`${actionBtn} border-brand-100 bg-brand-50/80 text-brand-700 hover:bg-brand-100 hover:border-brand-200`}
                              title="Edit application"
                            >
                              <SquarePen size={15} strokeWidth={2} />
                            </button>
                            <button
                              type="button"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => { e.stopPropagation(); setDeleteTarget(row); }}
                              className={`${actionBtn} border-red-100 bg-red-50/70 text-red-600 hover:bg-red-100 hover:border-red-200`}
                              title="Delete application"
                            >
                              <Trash2 size={15} strokeWidth={2} />
                            </button>
                          </div>
                        </Td>

                        <Td className="text-center">
                          <span className="text-sm font-mono text-stone-500 tabular-nums">{serial}</span>
                        </Td>

                        <Td>
                          <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
                            {row.email ? (
                              <a
                                href={`mailto:${row.email}`}
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                                className={`${actionBtn} border-brand-100 bg-brand-50/80 text-brand-700 hover:bg-brand-100 hover:border-brand-200`}
                                title="Send email"
                              >
                                <Mail size={15} strokeWidth={2} />
                              </a>
                            ) : (
                              <span className={`${actionBtn} border-stone-200 bg-stone-50 text-stone-300 opacity-50 cursor-not-allowed`} title="No email on file">
                                <Mail size={15} strokeWidth={2} />
                              </span>
                            )}
                            {row.phone ? (
                              <button
                                type="button"
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); openWhatsApp(row.phone); }}
                                className={`${actionBtn} border-emerald-200 bg-[#25D366]/12 text-[#128C7E] hover:bg-[#25D366]/20 hover:border-emerald-300`}
                                title="Open WhatsApp chat"
                              >
                                <WhatsAppIcon size={15} />
                              </button>
                            ) : (
                              <span className={`${actionBtn} border-stone-200 bg-stone-50 text-stone-300 opacity-50 cursor-not-allowed`} title="No mobile on file">
                                <WhatsAppIcon size={15} />
                              </span>
                            )}
                          </div>
                        </Td>

                        <Td>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-teal-700 text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0 shadow-sm shadow-brand-500/20">
                              {initials(row.name)}
                            </div>
                            <div className="min-w-0">
                              <button
                                type="button"
                                className="text-sm font-semibold text-stone-900 hover:text-brand-700 text-left whitespace-nowrap"
                                onClick={() => setDetail(row)}
                                title="View profile"
                              >
                                {dash(row.name)}
                              </button>
                              {row.referenceCode ? (
                                <p className="mt-0.5 font-mono text-[10px] font-semibold tabular-nums tracking-wide text-stone-400 whitespace-nowrap">
                                  {row.referenceCode}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </Td>

                        <Td><span className="text-sm font-mono text-stone-600 whitespace-nowrap">{row.phone || '—'}</span></Td>
                        <Td><span className="text-sm text-stone-600 whitespace-nowrap">{row.email || '—'}</span></Td>
                        <Td><span className="font-mono text-[12px] font-semibold text-stone-800">{row.referenceCode || '—'}</span></Td>
                        <Td><span className="text-sm text-stone-700 whitespace-nowrap">{row.location || '—'}</span></Td>
                        <Td><span className="text-sm text-stone-700 whitespace-nowrap">{row.currentCompany || '—'}</span></Td>
                        <Td><span className="text-sm whitespace-nowrap">{row.yearsExperience || '—'}</span></Td>
                        <Td><span className="text-sm whitespace-nowrap">{row.availability || '—'}</span></Td>
                        <Td className="!whitespace-normal max-w-[14rem]"><span className="text-sm text-stone-700">{row.specializations || '—'}</span></Td>
                        <Td className="!whitespace-normal max-w-[14rem]"><span className="text-sm text-stone-700">{row.rolesHired || '—'}</span></Td>

                        <Td>
                          {String(row.commercialNote || '').trim() ? (
                            <CandidateRemarkIndicator
                              remark={row.commercialNote}
                              candidateName={row.name}
                              title="Commercial preference"
                              subtitle="Preferred engagement terms from the application"
                              emptyText="No commercial preference shared"
                              ariaLabel="View commercial preference"
                            />
                          ) : (
                            <span className="text-stone-300">—</span>
                          )}
                        </Td>

                        <Td>
                          {String(row.coverNote || '').trim() ? (
                            <CandidateRemarkIndicator
                              remark={row.coverNote}
                              candidateName={row.name}
                              title="Applicant note"
                              subtitle="Message submitted with the partnership application"
                              emptyText="No note provided"
                              ariaLabel="View applicant note"
                            />
                          ) : (
                            <span className="text-stone-300">—</span>
                          )}
                        </Td>

                        <Td>
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <span className={`text-sm px-2.5 py-0.5 rounded-full whitespace-nowrap font-semibold ${statusPillClass(row.status)}`}>
                              {statusLabel(row.status).toUpperCase()}
                            </span>
                          </div>
                        </Td>

                        <Td>
                          <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
                            {canContact ? (
                              <button
                                type="button"
                                title="Mark contacted — shortlists this applicant and emails them that you will follow up"
                                disabled={busy}
                                className={`${actionBtn} border-amber-100 bg-amber-50/80 text-amber-800 hover:bg-amber-100 hover:border-amber-200`}
                                onClick={() => setContactTarget(row)}
                              >
                                {busy ? <Loader2 size={15} className="animate-spin" /> : <BadgeCheck size={15} strokeWidth={2} />}
                              </button>
                            ) : null}
                            {canInvite ? (
                              <button
                                type="button"
                                title="Invite to company — verifies organisation records first"
                                disabled={busy}
                                className={`${actionBtn} border-emerald-100 bg-emerald-50/80 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-200`}
                                onClick={() => requestInvite(row)}
                              >
                                {busy ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} strokeWidth={2} />}
                              </button>
                            ) : null}
                            {canDecline ? (
                              <button
                                type="button"
                                title="Decline application"
                                className={`${actionBtn} border-red-100 bg-red-50/70 text-red-600 hover:bg-red-100 hover:border-red-200`}
                                onClick={() => setRejectTarget(row)}
                              >
                                <X size={15} strokeWidth={2} />
                              </button>
                            ) : null}
                            {!canContact && !canInvite && !canDecline ? (
                              <span className="text-stone-300">—</span>
                            ) : null}
                          </div>
                        </Td>

                        <Td>
                          {row.hasResume ? (
                            <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => previewResume(row)}
                                title="Preview resume"
                                className={`${actionBtn} border-sky-100 bg-sky-50/80 text-sky-700 hover:bg-sky-100 hover:border-sky-200`}
                              >
                                <Eye size={15} strokeWidth={2} />
                              </button>
                              <button
                                type="button"
                                onClick={() => downloadResume(row)}
                                title="Download resume"
                                className={`${actionBtn} border-emerald-100 bg-emerald-50/80 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-200`}
                              >
                                <FileDown size={15} strokeWidth={2} />
                              </button>
                            </div>
                          ) : (
                            <span className="text-stone-300">—</span>
                          )}
                        </Td>

                        <Td>
                          <span className="text-sm text-stone-600 whitespace-nowrap tabular-nums">{formatDate(row.createdAt)}</span>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="border-t border-stone-100/90 bg-gradient-to-b from-stone-50/80 to-white px-3 sm:px-5 py-3 sm:py-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <p className="text-xs sm:text-sm text-stone-500 font-medium">
                  Showing{' '}
                  <span className="text-stone-800 font-semibold tabular-nums">{from.toLocaleString()}–{to.toLocaleString()}</span>
                  {' '}of{' '}
                  <span className="text-stone-800 font-semibold tabular-nums">{filtered.length.toLocaleString()}</span>
                  <span className="text-stone-400"> applications</span>
                </p>
                <div className="inline-flex items-center gap-1.5 self-end sm:self-auto">
                  <button
                    type="button"
                    className="btn-secondary !px-3 !py-2 text-xs"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  <span className="text-xs font-semibold text-stone-600 tabular-nums px-2">
                    {safePage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    className="btn-secondary !px-3 !py-2 text-xs"
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        closeOnBackdrop={false}
        title={detail?.name || 'Applicant profile'}
        description={detail?.referenceCode ? `Reference ${detail.referenceCode}` : 'Partnership application details'}
        icon={UserRound}
        size="md"
        footer={(
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setDetail(null)}>Close</button>
            {detail ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setDetail(null);
                  openEdit(detail);
                }}
              >
                <SquarePen className="w-4 h-4" /> Edit
              </button>
            ) : null}
          </div>
        )}
      >
        {detail ? (
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            {[
              ['Email', detail.email],
              ['Mobile', detail.phone],
              ['Location', detail.location],
              ['Organisation', detail.currentCompany],
              ['Experience', detail.yearsExperience],
              ['Availability', detail.availability],
              ['Industry', detail.specializations],
              ['Roles sourced', detail.rolesHired],
              ['Commercial preference', detail.commercialNote],
              ['Stage', statusLabel(detail.status)],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">{label}</p>
                <p className="mt-0.5 text-stone-800">{dash(value)}</p>
              </div>
            ))}
            {detail.coverNote ? (
              <div className="sm:col-span-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Applicant note</p>
                <p className="mt-0.5 text-stone-800 whitespace-pre-wrap">{detail.coverNote}</p>
              </div>
            ) : null}
            {detail.identity?.blocked ? (
              <div className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-950 space-y-2">
                <p className="font-semibold text-sm">Existing organisation record</p>
                <p className="text-sm leading-relaxed">{detail.identity.message}</p>
                {detail.identity.profileHref ? (
                  <Link
                    to={detail.identity.profileHref}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-900 hover:underline"
                  >
                    <Eye size={14} />
                    {detail.identity.profileLabel || 'View profile'}
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!reviewRow}
        onClose={() => { setReviewRow(null); setReview(null); setReviewIntent('inspect'); }}
        closeOnBackdrop={false}
        title={reviewIntent === 'invite' ? 'Invite — record verification' : 'Organisation record check'}
        description="Applications are open to anyone. Before a company invitation is issued, we verify employees, freelancers, candidates, and prior partnership applications."
        icon={ShieldCheck}
        size="md"
        footer={(
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => { setReviewRow(null); setReview(null); setReviewIntent('inspect'); }}
            >
              Close
            </button>
            {review?.clear && reviewRow && reviewRow.status !== 'invited' && reviewRow.status !== 'joined' ? (
              <button
                type="button"
                className="btn-primary"
                disabled={!!acting || reviewLoading}
                onClick={() => setInviteTarget(reviewRow)}
              >
                Continue to invite
              </button>
            ) : null}
          </div>
        )}
      >
        {reviewLoading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-stone-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <p className="text-sm font-medium text-stone-500">Checking organisation records…</p>
          </div>
        ) : review ? (
          <div className="space-y-4 text-sm">
            <div className={`rounded-xl border px-3 py-3 ${review.clear ? 'border-emerald-200 bg-emerald-50 text-emerald-950' : 'border-amber-200 bg-amber-50 text-amber-950'}`}>
              <p className="font-semibold">
                {review.clear
                  ? 'No matching records found'
                  : `${review.matchCount} matching record${review.matchCount === 1 ? '' : 's'} found`}
              </p>
              <p className="mt-1 leading-relaxed">{review.recommendation}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Employee / freelancer / candidate</p>
              {review.identity ? (
                <div className="mt-2 rounded-xl border border-stone-200 px-3 py-2.5 space-y-2">
                  <p className="font-semibold text-stone-900">{review.identity.name || review.email}</p>
                  <p className="text-stone-600 leading-relaxed">{review.identity.message}</p>
                  <p className="text-xs text-stone-500">
                    Matched on {review.identity.matchedOn || 'email'}
                    {review.identity.roleLabel ? ` · ${review.identity.roleLabel}` : ''}
                  </p>
                  {review.identity.profileHref ? (
                    <Link
                      to={review.identity.profileHref}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
                      onClick={() => { setReviewRow(null); setReview(null); }}
                    >
                      <Eye size={14} />
                      {review.identity.profileLabel || 'View profile'}
                    </Link>
                  ) : null}
                </div>
              ) : (
                <p className="mt-1 text-stone-500">
                  No teammate or candidate uses {review.email}
                  {review.phone ? ` or ${review.phone}` : ''}.
                </p>
              )}
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Other partnership applications</p>
              {review.otherApplications?.length ? (
                <ul className="mt-2 space-y-2">
                  {review.otherApplications.map((item) => (
                    <li key={item.id} className="rounded-xl border border-stone-200 px-3 py-2">
                      <p className="font-semibold text-stone-900">{item.name}</p>
                      <p className="text-stone-500">
                        {item.referenceCode || 'No reference'} · matched on {item.matchedOn} · {statusLabel(item.status)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-stone-500">No other partnership application uses this email or mobile number.</p>
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!editor}
        onClose={() => setEditor(null)}
        closeOnBackdrop={false}
        title={editor === 'new' ? 'Add partner application' : 'Edit partner application'}
        description="Maintain the partnership application record held for this organisation."
        icon={Handshake}
        size="lg"
        footer={(
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setEditor(null)}>Cancel</button>
            <button type="button" className="btn-primary" disabled={saving} onClick={saveEditor}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {editor === 'new' ? 'Create application' : 'Save changes'}
            </button>
          </div>
        )}
      >
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            ['name', 'Full name', true],
            ['email', 'Email', true],
            ['phone', 'Mobile', true],
            ['location', 'Location', false],
            ['currentCompany', 'Organisation', false],
            ['yearsExperience', 'Experience', false],
            ['availability', 'Availability', false],
            ['specializations', 'Industry focus', false],
            ['rolesHired', 'Roles typically sourced', false],
            ['commercialNote', 'Commercial preference (engagement terms)', false],
          ].map(([key, label, required]) => (
            <label key={key} className="block">
              <span className="label-ats">{label}{required ? ' *' : ''}</span>
              <input
                className="input-ats"
                value={form[key]}
                onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
              />
            </label>
          ))}
          <label className="block sm:col-span-2">
            <span className="label-ats">Applicant note</span>
            <textarea className="textarea-ats" rows={3} value={form.coverNote} onChange={(e) => setForm((prev) => ({ ...prev, coverNote: e.target.value }))} />
          </label>
          <label className="block sm:col-span-2">
            <span className="label-ats">Internal review note</span>
            <textarea className="textarea-ats" rows={2} value={form.reviewNote} onChange={(e) => setForm((prev) => ({ ...prev, reviewNote: e.target.value }))} />
          </label>
        </div>
      </Modal>

      <ConfirmationModal
        isOpen={!!contactTarget}
        onClose={() => setContactTarget(null)}
        onConfirm={() => contactTarget && act(contactTarget.id, 'contacted', contactTarget.reviewNote)}
        title="Mark as contacted?"
        message={`Move “${contactTarget?.name || ''}” to Contacted? This shortlists the application and emails them that a team member will follow up. It does not create a login or send a company invitation.`}
        confirmText="Mark contacted"
        type="info"
        isLoading={!!acting}
      />
      <ConfirmationModal
        isOpen={!!inviteTarget}
        onClose={() => setInviteTarget(null)}
        onConfirm={() => {
          if (!inviteTarget) return;
          const row = inviteTarget;
          setInviteTarget(null);
          setReviewRow(null);
          setReview(null);
          act(row.id, 'invited', row.reviewNote);
        }}
        title="Send company invitation?"
        message={`Invite “${inviteTarget?.name || ''}” as a freelance recruiter? Organisation records were verified. This creates the same Team invite used under Organisation → Team and emails them a join link.`}
        confirmText="Send invitation"
        type="success"
        isLoading={!!acting}
      />
      <ConfirmationModal
        isOpen={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        onConfirm={() => rejectTarget && act(rejectTarget.id, 'rejected', rejectTarget.reviewNote)}
        title="Decline this application?"
        message={`Decline “${rejectTarget?.name || ''}”? They will receive an email that the partnership is not proceeding at this time.`}
        confirmText="Decline"
        type="delete"
        isLoading={!!acting}
      />
      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && removeRow(deleteTarget.id)}
        title="Delete this application?"
        message={`Permanently delete “${deleteTarget?.name || ''}”? This action cannot be undone.`}
        confirmText="Delete"
        type="delete"
        isLoading={!!acting}
      />

      <ConfirmationModal
        isOpen={bulkContactOpen}
        onClose={() => !bulkActing && setBulkContactOpen(false)}
        onConfirm={() => runBulkStatus('contacted')}
        title={`Mark ${selectedIds.length} as contacted?`}
        message={`Move ${selectedIds.length} selected application${selectedIds.length === 1 ? '' : 's'} to Contacted? Eligible applicants will be emailed that a team member will follow up. This does not create logins or send company invitations.`}
        confirmText="Mark contacted"
        type="info"
        isLoading={bulkActing}
      />
      <ConfirmationModal
        isOpen={bulkInviteOpen}
        onClose={() => !bulkActing && setBulkInviteOpen(false)}
        onConfirm={() => runBulkStatus('invited')}
        title={`Invite ${selectedIds.length} applicant${selectedIds.length === 1 ? '' : 's'}?`}
        message={`Send company invitations to ${selectedIds.length} selected applicant${selectedIds.length === 1 ? '' : 's'}? Records are verified first; anyone already on the team, in candidates, or with a conflicting application is skipped.`}
        confirmText="Send invitations"
        type="success"
        isLoading={bulkActing}
      />
      <ConfirmationModal
        isOpen={bulkDeclineOpen}
        onClose={() => !bulkActing && setBulkDeclineOpen(false)}
        onConfirm={() => runBulkStatus('rejected')}
        title={`Decline ${selectedIds.length} application${selectedIds.length === 1 ? '' : 's'}?`}
        message={`Decline ${selectedIds.length} selected application${selectedIds.length === 1 ? '' : 's'}? They will receive an email that the partnership is not proceeding at this time.`}
        confirmText="Decline"
        type="delete"
        isLoading={bulkActing}
      />
      <ConfirmationModal
        isOpen={bulkDeleteOpen}
        onClose={() => !bulkActing && setBulkDeleteOpen(false)}
        onConfirm={runBulkDelete}
        title={`Delete ${selectedIds.length} application${selectedIds.length === 1 ? '' : 's'}?`}
        message={`Permanently delete ${selectedIds.length} selected application${selectedIds.length === 1 ? '' : 's'}? This cannot be undone.`}
        confirmText="Delete"
        type="delete"
        isLoading={bulkActing}
      />

      <ResumePreviewModal
        previewResumeUrl={previewResumeUrl}
        previewBlobUrl={previewBlobUrl}
        previewBlob={previewBlob}
        previewFileKind={previewFileKind}
        previewResumeCandidate={previewResumeCandidate}
        previewResumeError={previewResumeError}
        isPreviewLoading={isPreviewLoading}
        closeResumePreview={closeResumePreview}
        handleResumeDownload={() => {
          const match = rows.find((r) => r.id === previewRowId);
          if (match) downloadResume(match);
        }}
      />
    </div>
  );
}
