import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check, Copy, Download, Handshake, Loader2, Mail, MessageSquare, Pencil, Phone, Plus, Search, ShieldCheck, Trash2, X,
} from 'lucide-react';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import PipelineStageSummary from './ui/PipelineStageSummary';
import ConfirmationModal from './ConfirmationModal';
import Modal from './ui/Modal';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import { useAuth } from '../context/AuthContext';
import { guardTableCopy } from '../utils/tableCopyGuard';
import { useTableDragScroll } from './ats/hooks/useTableDragScroll';

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

function dash(value) {
  const t = String(value || '').trim();
  return t ? t : '—';
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

function statusBadgeClass(status) {
  const key = String(status || '');
  if (key === 'joined') return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (key === 'invited' || key === 'approved') return 'bg-teal-50 text-teal-800 border-teal-200';
  if (key === 'rejected') return 'bg-red-50 text-red-800 border-red-200';
  if (key === 'contacted') return 'bg-amber-50 text-amber-900 border-amber-200';
  return 'bg-sky-50 text-sky-800 border-sky-200';
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
  const { organization } = useAuth();
  const [status, setStatus] = useState('all');
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [acting, setActing] = useState('');
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [detail, setDetail] = useState(null);
  const [reviewRow, setReviewRow] = useState(null);
  const [review, setReview] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  const {
    tableScrollRef,
    onTableDragScrollStart,
    onTableDragScrollMove,
    onTableDragScrollEnd,
  } = useTableDragScroll();
  const slug = organization?.slug || '';
  const publicUrl = slug ? `${window.location.origin}/partners/${slug}` : '';

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await authenticatedFetch('/api/freelancer-applications?status=all');
      if (isUnauthorized(res)) return handleUnauthorized();
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not load applications');
      const payload = data.data || {};
      setRows(Array.isArray(payload.applications) ? payload.applications : []);
      setCounts(payload.counts || {});
    } catch (err) {
      toast.error(err.message || 'Could not load applications');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => { load(true); }, 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (status !== 'all' && row.status !== status) return false;
      if (!q) return true;
      return [
        row.referenceCode, row.name, row.email, row.phone, row.location, row.currentCompany,
        row.yearsExperience, row.specializations, row.rolesHired, row.availability,
        row.commercialNote, row.coverNote, row.status,
      ].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [rows, status, search]);

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
      if (!res.ok) throw new Error(data.message || 'Could not update');
      toast.success(nextStatus === 'invited'
        ? (data.data?.status === 'joined'
          ? 'This person has already joined the company.'
          : (data.data?.inviteEmailSent
            ? 'Company invitation sent. They now appear under Organization → Team → Invited.'
            : 'Invitation created. They now appear under Organization → Team → Invited. Share the link if email did not send.'))
        : nextStatus === 'contacted'
          ? 'Marked contacted. The applicant has been emailed.'
          : nextStatus === 'rejected'
            ? 'Application declined. The applicant has been emailed.'
            : `Status updated to ${statusLabel(nextStatus)}`);
      setRejectTarget(null);
      await load();
    } catch (err) {
      toast.error(err.message || 'Could not update this application');
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
      if (!res.ok) throw new Error(data.message || 'Could not save');
      toast.success(isNew ? 'Application added' : 'Application updated');
      setEditor(null);
      await load();
    } catch (err) {
      toast.error(err.message || 'Could not save');
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
      if (!res.ok) throw new Error(data.message || 'Could not delete');
      toast.success('Application deleted');
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(err.message || 'Could not delete');
    } finally {
      setActing('');
    }
  };

  const copyUrl = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success('Application page link copied');
    } catch {
      toast.error('Could not copy link');
    }
  };

  const downloadResume = async (row) => {
    try {
      const res = await authenticatedFetch(`/api/freelancer-applications/${row.id}/resume`);
      if (isUnauthorized(res)) return handleUnauthorized();
      if (!res.ok) throw new Error('Could not download resume');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = row.resumeOriginalName || 'resume.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.message || 'Could not download resume');
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

  const openReview = async (row) => {
    setReviewRow(row);
    setReview(null);
    setReviewLoading(true);
    try {
      const res = await authenticatedFetch(`/api/freelancer-applications/${row.id}/review-check`);
      if (isUnauthorized(res)) return handleUnauthorized();
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not check records');
      setReview(data.data || null);
    } catch (err) {
      toast.error(err.message || 'Could not check records');
      setReviewRow(null);
    } finally {
      setReviewLoading(false);
    }
  };

  const requestInvite = (row) => {
    if (row.identity?.blocked) {
      openReview(row);
      return;
    }
    act(row.id, 'invited', row.reviewNote);
  };

  return (
    <div className="page-shell-ats">
      <PageHeader
        icon={Handshake}
        title="Partner applications"
        subtitle="Review partnership applications. An invitation from this desk is the same company invite used in Organization → Team."
      >
        {publicUrl ? (
          <button type="button" className="btn-secondary" onClick={copyUrl}>
            <Copy className="w-4 h-4" /> Copy application page
          </button>
        ) : null}
        <button type="button" className="btn-primary" onClick={openNew}>
          <Plus className="w-4 h-4" /> Add application
        </button>
      </PageHeader>

      <div className="min-w-0">
        <PipelineStageSummary
          stages={TABS}
          counts={{ ...counts, all: rows.length }}
          stageFilter={status}
          setStageFilter={setStatus}
          total={rows.length}
          hint="Drag the stage cards sideways"
          countLabel="applications"
          tourAttr="partner-applications-pipeline"
        />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="text-sm text-stone-500">{filtered.length} shown</p>
        <div className="relative sm:ml-auto w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            className="input-ats pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, city…"
          />
        </div>
      </div>

      <section className="card-ats-bordered overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-stone-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            compact
            tone="brand"
            icon={Handshake}
            message={search ? 'No matching applications' : 'No applications yet'}
            subMessage="Share the public partnership page or add a record here."
          />
        ) : (
          <div
            ref={tableScrollRef}
            className="cand-table-scroll overflow-x-auto select-none"
            onCopy={guardTableCopy}
            onMouseDown={onTableDragScrollStart}
            onMouseMove={onTableDragScrollMove}
            onMouseUp={onTableDragScrollEnd}
            onMouseLeave={onTableDragScrollEnd}
          >
            <table className="cand-table-drag w-max min-w-full text-left border-collapse select-none border border-stone-200" style={{ tableLayout: 'auto' }}>
              <thead>
                <tr className="bg-stone-100">
                  <Th>Full name</Th>
                  <Th>Reference</Th>
                  <Th>Email</Th>
                  <Th>Mobile</Th>
                  <Th>City</Th>
                  <Th>Current organisation</Th>
                  <Th>Years in recruitment</Th>
                  <Th>Availability</Th>
                  <Th>Industry focus</Th>
                  <Th>Roles typically sourced</Th>
                  <Th>Commercial preference</Th>
                  <Th>Brief note</Th>
                  <Th>CV / profile</Th>
                  <Th>Already on file</Th>
                  <Th>Status</Th>
                  <Th>Applied</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, index) => (
                  <tr
                    key={row.id}
                    className={`transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-stone-50/40'} hover:bg-brand-50/40`}
                  >
                    <Td>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-teal-700 text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                          {initials(row.name)}
                        </div>
                        <button type="button" className="text-sm font-semibold text-stone-900 hover:text-brand-700 text-left" onClick={() => setDetail(row)}>
                          {dash(row.name)}
                        </button>
                      </div>
                    </Td>
                    <Td>
                      <span className="font-mono text-[12px] font-semibold text-stone-800">{row.referenceCode || '—'}</span>
                    </Td>
                    <Td>
                      {row.email ? <a href={`mailto:${row.email}`} className="text-brand-700 hover:underline">{row.email}</a> : <span className="text-stone-300">—</span>}
                    </Td>
                    <Td>
                      {row.phone ? <a href={`tel:${row.phone}`} className="hover:underline">{row.phone}</a> : <span className="text-stone-300">—</span>}
                    </Td>
                    <Td>{row.location || <span className="text-stone-300">—</span>}</Td>
                    <Td>{row.currentCompany || <span className="text-stone-300">—</span>}</Td>
                    <Td>{row.yearsExperience || <span className="text-stone-300">—</span>}</Td>
                    <Td>{row.availability || <span className="text-stone-300">—</span>}</Td>
                    <Td className="!whitespace-normal max-w-[14rem]">{row.specializations || <span className="text-stone-300">—</span>}</Td>
                    <Td className="!whitespace-normal max-w-[14rem]">{row.rolesHired || <span className="text-stone-300">—</span>}</Td>
                    <Td className="!whitespace-normal max-w-[12rem]">{row.commercialNote || <span className="text-stone-300">—</span>}</Td>
                    <Td className="!whitespace-normal max-w-[16rem]">{row.coverNote || <span className="text-stone-300">—</span>}</Td>
                    <Td>
                      {row.hasResume ? (
                        <button type="button" className="text-brand-700 font-semibold hover:underline" onClick={() => downloadResume(row)}>
                          {row.resumeOriginalName || 'Download'}
                        </button>
                      ) : <span className="text-stone-300">—</span>}
                    </Td>
                    <Td>
                      {row.identity?.blocked ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border border-amber-200 bg-amber-50 text-amber-900">
                          {row.identity.roleLabel}
                        </span>
                      ) : (
                        <span className="text-stone-300">Clear</span>
                      )}
                    </Td>
                    <Td>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border ${statusBadgeClass(row.status)}`}>
                        {statusLabel(row.status)}
                      </span>
                    </Td>
                    <Td>{formatDate(row.createdAt)}</Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <button type="button" title="Check records" className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-800" onClick={() => openReview(row)}>
                          <ShieldCheck size={15} />
                        </button>
                        <button type="button" title="Edit" className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500" onClick={() => openEdit(row)}>
                          <Pencil size={15} />
                        </button>
                        {row.status === 'pending' ? (
                          <button type="button" title="Mark contacted" className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-700" disabled={!!acting} onClick={() => act(row.id, 'contacted', row.reviewNote)}>
                            {acting === row.id ? <Loader2 size={15} className="animate-spin" /> : <MessageSquare size={15} />}
                          </button>
                        ) : null}
                        {row.status !== 'invited' && row.status !== 'joined' ? (
                          <button type="button" title={row.identity?.blocked ? 'Email already on file' : 'Invite to company'} className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-700" disabled={!!acting} onClick={() => requestInvite(row)}>
                            {acting === row.id ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                          </button>
                        ) : null}
                        {row.status !== 'rejected' && row.status !== 'joined' ? (
                          <button type="button" title="Decline" className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600" onClick={() => setRejectTarget(row)}>
                            <X size={15} />
                          </button>
                        ) : null}
                        {row.hasResume ? (
                          <button type="button" title="Download CV" className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500" onClick={() => downloadResume(row)}>
                            <Download size={15} />
                          </button>
                        ) : null}
                        <a title="Email" className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500" href={`mailto:${row.email}`}>
                          <Mail size={15} />
                        </a>
                        {row.phone ? (
                          <a title="Call" className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500" href={`tel:${row.phone}`}>
                            <Phone size={15} />
                          </a>
                        ) : null}
                        <button type="button" title="Delete" className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600" onClick={() => setDeleteTarget(row)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.name || 'Application'}
        description={detail?.referenceCode || 'Partnership application'}
        icon={Handshake}
        size="md"
      >
        {detail ? (
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            {[
              ['Email', detail.email],
              ['Phone', detail.phone],
              ['Location', detail.location],
              ['Organisation', detail.currentCompany],
              ['Experience', detail.yearsExperience],
              ['Availability', detail.availability],
              ['Industry', detail.specializations],
              ['Roles sourced', detail.rolesHired],
              ['Commercial', detail.commercialNote],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">{label}</p>
                <p className="mt-0.5 text-stone-800">{dash(value)}</p>
              </div>
            ))}
            {detail.coverNote ? (
              <div className="sm:col-span-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Note</p>
                <p className="mt-0.5 text-stone-800 whitespace-pre-wrap">{detail.coverNote}</p>
              </div>
            ) : null}
            {detail.identity?.blocked ? (
              <div className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-950">
                {detail.identity.message}
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!reviewRow}
        onClose={() => { setReviewRow(null); setReview(null); }}
        title="Record check"
        description="Checked after submission, against company accounts, candidates, and other partnership applications."
        icon={ShieldCheck}
        size="md"
        footer={(
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => { setReviewRow(null); setReview(null); }}>Close</button>
            {review?.clear && reviewRow && reviewRow.status !== 'invited' && reviewRow.status !== 'joined' ? (
              <button
                type="button"
                className="btn-primary"
                disabled={!!acting}
                onClick={() => {
                  const row = reviewRow;
                  setReviewRow(null);
                  setReview(null);
                  act(row.id, 'invited', row.reviewNote);
                }}
              >
                Invite to company
              </button>
            ) : null}
          </div>
        )}
      >
        {reviewLoading ? (
          <div className="flex items-center justify-center py-8 text-stone-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : review ? (
          <div className="space-y-4 text-sm">
            <div className={`rounded-xl border px-3 py-3 ${review.clear ? 'border-emerald-200 bg-emerald-50 text-emerald-950' : 'border-amber-200 bg-amber-50 text-amber-950'}`}>
              <p className="font-semibold">{review.clear ? 'Clear to invite' : `${review.matchCount} match${review.matchCount === 1 ? '' : 'es'} found`}</p>
              <p className="mt-1 leading-relaxed">{review.recommendation}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Teammate or candidate</p>
              {review.identity ? (
                <p className="mt-1 text-stone-800">{review.identity.message}</p>
              ) : (
                <p className="mt-1 text-stone-500">No teammate uses {review.email}.</p>
              )}
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Other applications</p>
              {review.otherApplications?.length ? (
                <ul className="mt-2 space-y-2">
                  {review.otherApplications.map((item) => (
                    <li key={item.id} className="rounded-xl border border-stone-200 px-3 py-2">
                      <p className="font-semibold text-stone-900">{item.name}</p>
                      <p className="text-stone-500">{item.referenceCode || 'No reference'} · matched on {item.matchedOn} · {statusLabel(item.status)}</p>
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
        title={editor === 'new' ? 'Add partner application' : 'Edit partner application'}
        description="Update the record held in the partner applications database."
        icon={Handshake}
        size="lg"
        footer={(
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setEditor(null)}>Cancel</button>
            <button type="button" className="btn-primary" disabled={saving} onClick={saveEditor}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {editor === 'new' ? 'Create' : 'Save changes'}
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
            ['specializations', 'Industry', false],
            ['rolesHired', 'Roles sourced', false],
            ['commercialNote', 'Commercial', false],
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
            <span className="label-ats">Note</span>
            <textarea className="textarea-ats" rows={3} value={form.coverNote} onChange={(e) => setForm((prev) => ({ ...prev, coverNote: e.target.value }))} />
          </label>
          <label className="block sm:col-span-2">
            <span className="label-ats">Internal review note</span>
            <textarea className="textarea-ats" rows={2} value={form.reviewNote} onChange={(e) => setForm((prev) => ({ ...prev, reviewNote: e.target.value }))} />
          </label>
        </div>
      </Modal>

      <ConfirmationModal
        isOpen={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        onConfirm={() => rejectTarget && act(rejectTarget.id, 'rejected', rejectTarget.reviewNote)}
        title="Decline this application?"
        message={`Decline “${rejectTarget?.name || ''}”? They will receive an email that the partnership is not proceeding.`}
        confirmText="Decline"
        type="delete"
        isLoading={!!acting}
      />
      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && removeRow(deleteTarget.id)}
        title="Delete this application?"
        message={`Permanently delete “${deleteTarget?.name || ''}”? This cannot be undone.`}
        confirmText="Delete"
        type="delete"
        isLoading={!!acting}
      />
    </div>
  );
}
