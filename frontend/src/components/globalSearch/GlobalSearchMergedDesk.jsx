import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { CheckSquare, Square, MinusSquare, Search, Mail, Trash2, X, Users, Megaphone } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authenticatedFetch } from '../../utils/fetchUtils';
import { useToast } from '../Toast';
import EmptyState from '../ui/EmptyState';
import CandidatesPagination from '../ats/CandidatesPagination';
import CandidateEmailModal from '../ats/CandidateEmailModal';
import EmailCampaignResultModal from '../ats/EmailCampaignResultModal';
import VerifiedEmailModal from '../ats/VerifiedEmailModal';
import ConfirmationModal from '../ConfirmationModal';
import { useCandidateEmail } from '../ats/hooks/useCandidateEmail';
import { useTableDragScroll } from '../ats/hooks/useTableDragScroll';
import { guardTableCopy } from '../../utils/tableCopyGuard';
import { WhatsAppIcon } from '../icons/BrandIcons';
import { buildAtsHref } from '../../utils/atsLinks';
import BASE_API_URL from '../../config';
import { PAGE_SIZE } from '../ats/atsConstants';
import DateSortHeader from './DateSortHeader';
import { selectAllMatching, resolveMatchingPeople } from './selectAllMatching';

const iconBtn =
  'h-8 w-8 inline-flex items-center justify-center rounded-lg border shadow-sm transition-all';
const CANDIDATES_API = `${BASE_API_URL}/candidates`;

function dash(v) {
  const text = String(v || '').trim();
  return text ? <span className="text-sm text-stone-700 whitespace-nowrap">{text}</span> : <span className="text-stone-300">—</span>;
}

function formatDate(raw) {
  const d = raw ? new Date(raw) : null;
  const valid = d && !Number.isNaN(d.getTime());
  return valid
    ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
}

function kindsOf(row) {
  return Array.isArray(row?._kinds) ? row._kinds : [];
}

function isCandidateRow(row) {
  return Boolean(row?.candidateId) || kindsOf(row).includes('candidates');
}

function isMisRow(row) {
  return Boolean(row?.misId) || kindsOf(row).includes('mis');
}

function sourceLabel(row) {
  const cand = isCandidateRow(row);
  const mis = isMisRow(row);
  if (cand && mis) return 'Candidate + MIS';
  if (mis) return 'MIS';
  return 'Candidate';
}

function sourceClass(label) {
  if (label === 'Candidate + MIS') return 'bg-violet-50 text-violet-800 border-violet-200';
  if (label === 'MIS') return 'bg-amber-50 text-amber-800 border-amber-200';
  return 'bg-teal-50 text-teal-800 border-teal-200';
}

function rowId(row) {
  return String(row?._id || '');
}

function candidateIdOf(row) {
  return String(row?.candidateId || (isCandidateRow(row) ? row._id : '') || '');
}

function misIdOf(row) {
  return String(row?.misId || (!isCandidateRow(row) && isMisRow(row) ? row._id : '') || '');
}

function lookupQuery(row) {
  return String(row?.email || row?.candidateCode || row?.name || '').trim();
}

function phoneOf(row) {
  return String(row?.contact || row?.phone || '').replace(/\D/g, '');
}

function stop(e) {
  e?.stopPropagation?.();
  e?.preventDefault?.();
}

export default function GlobalSearchMergedDesk({
  rows = [],
  jobs = [],
  page,
  setPage,
  totalCount = 0,
  countPending = false,
  countPlus = false,
  hasMore = false,
  loading,
  navigate,
  onReload,
  fetchMatching,
  audienceQuery = null,
  dateSort = 'latest',
  onDateSort,
}) {
  const toast = useToast();
  const { user } = useAuth();
  const isFreelancer = user?.role === 'freelancer';
  const { tableScrollRef, onTableDragScrollStart, onTableDragScrollMove, onTableDragScrollEnd } = useTableDragScroll();

  const list = useMemo(() => (rows || []).map((r) => ({ ...r, _id: String(r._id) })), [rows]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [matchPool, setMatchPool] = useState([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [whatsAppOpen, setWhatsAppOpen] = useState(false);
  const [whatsAppTargets, setWhatsAppTargets] = useState([]);
  const [deleteTargets, setDeleteTargets] = useState([]);
  const [allMatching, setAllMatching] = useState(false);
  const matchPoolRef = useRef([]);
  const audienceRef = useRef({ allMatching: false, count: 0, query: null, entity: 'all' });

  useEffect(() => {
    if (!selectedIds.length) {
      setMatchPool([]);
      matchPoolRef.current = [];
      setAllMatching(false);
    }
  }, [selectedIds.length]);

  const rememberPool = useCallback((rows) => {
    const next = Array.isArray(rows) ? rows : [];
    matchPoolRef.current = next;
    setMatchPool(next.length > 200 ? next.slice(0, 200) : next);
  }, []);

  const pool = matchPool.length ? matchPool : list;
  const selectedRows = useMemo(
    () => pool.filter((r) => selectedIds.includes(rowId(r))),
    [pool, selectedIds],
  );

  const emailPool = selectedRows.length ? selectedRows : list;
  const email = useCandidateEmail({
    toast,
    candidates: emailPool,
    selectedIds,
    setSelectedIds,
    navigate,
    getBulkAudience: () => {
      const snap = audienceRef.current;
      if (!snap.allMatching || !snap.query) return null;
      return {
        active: true,
        count: snap.count,
        query: { ...snap.query, entity: snap.entity || 'all' },
      };
    },
    resolveSelectedPeople: () => resolveMatchingPeople({
      fetchMatching,
      entity: 'all',
      matchPool: matchPoolRef.current.length ? matchPoolRef.current : matchPool,
      selectedIds,
      allMatching,
      pageRows: list,
      expectedCount: totalCount,
      onHydrated: (loaded) => {
        if (loaded?.rows?.length) matchPoolRef.current = loaded.rows;
      },
    }),
  });

  const pageIds = list.map(rowId);
  const isPageSelected = allMatching || (pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id)));
  const isPagePartial = !isPageSelected && pageIds.some((id) => selectedIds.includes(id));
  const isAllFilteredSelected =
    allMatching || (totalCount > 0 && selectedIds.length > 0 && selectedIds.length >= totalCount);
  const displayedCount = isAllFilteredSelected && totalCount > selectedIds.length ? totalCount : selectedIds.length;
  audienceRef.current = {
    allMatching,
    count: displayedCount,
    query: audienceQuery,
    entity: 'all',
  };
  const totalPages = (countPending || countPlus)
    ? Math.max(1, page + (hasMore ? 1 : 0))
    : Math.max(1, Math.ceil((totalCount || 0) / PAGE_SIZE));
  const showOverlay = Boolean(loading);
  const single = selectedRows.length === 1 ? selectedRows[0] : null;
  const selectedHasCandidate = selectedRows.some(isCandidateRow);
  const selectedHasMis = selectedRows.some(isMisRow);

  const toggleOne = (id) => {
    const key = String(id);
    setAllMatching(false);
    setSelectedIds((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
  };
  const togglePage = () => {
    if (allMatching || isPageSelected) {
      setAllMatching(false);
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
      return;
    }
    setSelectedIds((prev) => [...new Set([...prev, ...pageIds])]);
  };

  const handleSelectAllFiltered = () => {
    selectAllMatching({
      pageIds,
      pageRows: list,
      setSelectedIds,
      setMatchPool: rememberPool,
      setAllMatching,
      mapRows: (rows) => (rows || []).map((row) => ({ ...row, _id: String(row._id) })),
      toast,
      expectedCount: totalCount,
      emptyWarning: 'No matching people to select.',
      successPrefix: 'Selected',
    });
  };

  const openCandidate = (row) => {
    if (!row || !isCandidateRow(row)) {
      toast.warning('This person is not on Candidates.');
      return;
    }
    const q = lookupQuery(row);
    navigate(q ? buildAtsHref({ q }) : '/ats');
  };

  const openMis = (row) => {
    if (!row || !isMisRow(row)) {
      toast.warning('This person is not on MIS.');
      return;
    }
    const q = lookupQuery(row);
    navigate(q ? `/mis?q=${encodeURIComponent(q)}` : '/mis');
  };

  const startWhatsApp = async (targets) => {
    let listTargets = targets;
    if (!listTargets || allMatching || (selectedIds.length > (listTargets?.length || 0))) {
      try {
        listTargets = await resolveMatchingPeople({
          fetchMatching,
          entity: 'all',
          matchPool: matchPoolRef.current.length ? matchPoolRef.current : matchPool,
          selectedIds,
          allMatching,
          pageRows: list,
          expectedCount: totalCount,
          onHydrated: (loaded) => {
            if (loaded?.rows?.length) matchPoolRef.current = loaded.rows;
          },
        });
        if (Array.isArray(listTargets) && listTargets.length) {
          matchPoolRef.current = listTargets;
          setMatchPool(listTargets.length > 200 ? listTargets.slice(0, 200) : listTargets);
        }
        // Keep selectedIds page-sized when allMatching — avoid freezing the UI.
      } catch (err) {
        toast.error(err?.message || 'Could not load matching people.');
        return;
      }
    }
    listTargets = (listTargets || []).filter((r) => phoneOf(r).length >= 8);
    if (!listTargets.length) {
      toast.warning('No valid phone number on the selected row(s).');
      return;
    }
    setWhatsAppTargets(listTargets);
    setWhatsAppOpen(true);
  };

  const requestDelete = (targets) => {
    const next = (targets || []).filter(Boolean);
    if (!next.length) {
      toast.warning('Select people to delete.');
      return;
    }
    setDeleteTargets(next);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    const candIds = [...new Set(deleteTargets.filter(isCandidateRow).map(candidateIdOf).filter(Boolean))];
    const misIds = [...new Set(deleteTargets.filter(isMisRow).map(misIdOf).filter(Boolean))];
    if (!candIds.length && !misIds.length) {
      toast.warning('Nothing to delete.');
      setDeleteOpen(false);
      return;
    }
    setDeleting(true);
    const notes = [];
    try {
      if (candIds.length) {
        const res = await authenticatedFetch(`${CANDIDATES_API}/bulk-delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: candIds }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Could not delete candidates');
        notes.push(`${data.deletedCount ?? data.deleted ?? candIds.length} candidate${candIds.length === 1 ? '' : 's'}`);
      }
      if (misIds.length) {
        const res = await authenticatedFetch('/api/mis/bulk-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: misIds }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Could not delete MIS contacts');
        notes.push(`${data.deleted ?? misIds.length} MIS contact${misIds.length === 1 ? '' : 's'}`);
      }
      toast.success(`Removed ${notes.join(' and ')}`);
      setDeleteOpen(false);
      setDeleteTargets([]);
      setSelectedIds([]);
      await onReload?.();
    } catch (err) {
      toast.error(err.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const deleteCopy = useMemo(() => {
    const n = deleteTargets.length;
    const cand = deleteTargets.filter(isCandidateRow).length;
    const mis = deleteTargets.filter(isMisRow).length;
    const both = deleteTargets.filter((r) => isCandidateRow(r) && isMisRow(r)).length;
    let message = 'This removes the selected people from this workspace.';
    if (both) message = 'These records exist in both Candidates and MIS and will be removed from both.';
    else if (cand && mis) message = 'Selected candidate records and MIS contacts will be removed from their respective lists.';
    else if (cand) message = 'This removes them from Candidates. MIS is not affected.';
    else if (mis) message = 'This removes them from MIS. Candidates are not affected.';
    return {
      title: `Delete ${n} ${n === 1 ? 'person' : 'people'}?`,
      message,
    };
  }, [deleteTargets]);

  const columns = useMemo(() => [
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="inline-flex items-center gap-1.5 whitespace-nowrap" onMouseDown={stop}>
          <button
            type="button"
            onClick={(e) => { stop(e); email.handleSendEmail(row); }}
            className={`${iconBtn} border-brand-100 bg-brand-50/80 text-brand-700 hover:bg-brand-100`}
            title="Email"
          >
            <Mail size={15} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={(e) => { stop(e); startWhatsApp([row]); }}
            className={`${iconBtn} border-emerald-200 bg-[#25D366]/12 text-[#128C7E] hover:bg-[#25D366]/20`}
            title="WhatsApp"
          >
            <WhatsAppIcon size={15} />
          </button>
          {isCandidateRow(row) ? (
            <button
              type="button"
              onClick={(e) => { stop(e); openCandidate(row); }}
              className={`${iconBtn} border-teal-100 bg-teal-50/80 text-teal-800 hover:bg-teal-100`}
              title="Open in Candidates"
            >
              <Users size={15} strokeWidth={2} />
            </button>
          ) : null}
          {isMisRow(row) ? (
            <button
              type="button"
              onClick={(e) => { stop(e); openMis(row); }}
              className={`${iconBtn} border-amber-100 bg-amber-50/80 text-amber-800 hover:bg-amber-100`}
              title="Open in MIS"
            >
              <Megaphone size={15} strokeWidth={2} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={(e) => { stop(e); requestDelete([row]); }}
            className={`${iconBtn} border-red-100 bg-red-50/70 text-red-600 hover:bg-red-100`}
            title="Delete"
          >
            <Trash2 size={15} strokeWidth={2} />
          </button>
        </div>
      ),
    },
    {
      key: 'recordSource',
      label: 'Record',
      render: (row) => {
        const label = sourceLabel(row);
        return (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold border whitespace-nowrap ${sourceClass(label)}`}>
            {label}
          </span>
        );
      },
    },
    { key: 'srNo', label: 'Sr No.', render: (_, index) => <span className="text-sm font-mono text-stone-500 tabular-nums">{(page - 1) * PAGE_SIZE + index + 1}</span> },
    { key: 'candidateCode', label: 'Candidate ID', render: (row) => dash(row.candidateCode) },
    {
      key: 'name',
      label: 'Name',
      render: (row) => (
        <div className="flex items-center gap-2.5 whitespace-nowrap">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-teal-700 text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0">
            {(row.name || '?').charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-semibold text-stone-900">{row.name || '—'}</span>
        </div>
      ),
    },
    { key: 'contact', label: 'Phone', render: (row) => <span className="text-sm font-mono text-stone-600">{row.contact || row.phone || '—'}</span> },
    { key: 'email', label: 'Email', render: (row) => dash(row.email) },
    { key: 'location', label: 'Location', render: (row) => dash(row.location) },
    { key: 'state', label: 'State', render: (row) => dash(row.state) },
    { key: 'position', label: 'Position', render: (row) => (row.position ? <span className="text-sm font-semibold text-brand-700">{row.position}</span> : dash('')) },
    { key: 'companyName', label: 'Company', render: (row) => dash(row.companyName) },
    { key: 'experience', label: 'Experience', render: (row) => dash(row.experience) },
    { key: 'ctc', label: 'CTC', render: (row) => dash(row.ctc) },
    { key: 'expectedCtc', label: 'Expected CTC', render: (row) => dash(row.expectedCtc) },
    { key: 'noticePeriod', label: 'Notice Period', render: (row) => dash(row.noticePeriod) },
    { key: 'status', label: 'Status', render: (row) => dash(row.status) },
    { key: 'skills', label: 'Skills', render: (row) => dash(row.skills) },
    { key: 'product', label: 'Product / Skill', render: (row) => dash(row.product) },
    { key: 'client', label: 'Client', render: (row) => dash(row.client) },
    { key: 'spoc', label: 'SPOC', render: (row) => dash(row.spoc) },
    { key: 'source', label: 'Source', render: (row) => dash(row.source) },
    { key: 'fls', label: 'FLS', render: (row) => dash(row.fls) },
    { key: 'pan', label: 'PAN', render: (row) => dash(row.pan) },
    { key: 'remark', label: 'Remark', render: (row) => dash(row.remark) },
    {
      key: 'consent',
      label: 'Marketing consent',
      render: (row) => {
        if (!isMisRow(row)) return <span className="text-stone-300">—</span>;
        const ok = row.marketingConsent && !row.unsubscribedAt;
        return (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border ${
            ok ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-stone-50 text-stone-500 border-stone-200'
          }`}>
            {ok ? 'Consented' : row.unsubscribedAt ? 'Unsubscribed' : 'No consent'}
          </span>
        );
      },
    },
    { key: 'uploadedBy', label: 'Uploaded by', render: (row) => dash(row.createdBy?.name || row.createdBy?.email) },
    { key: 'date', label: <DateSortHeader value={dateSort} onChange={onDateSort} />, render: (row) => <span className="text-sm text-stone-600 tabular-nums">{formatDate(row.recordDate || row.appliedAt || row.date || row.createdAt)}</span> },
  ], [page, dateSort, onDateSort, email.handleSendEmail]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!loading && list.length === 0) {
    return (
      <div className="p-6">
        <EmptyState icon={Search} tone="amber" message="No matching people" subMessage="No combined results. Open Candidates or MIS, or widen the filters." />
      </div>
    );
  }

  return (
    <>
      {selectedIds.length ? (
        <div className="px-4 sm:px-5 pt-3">
          <div className="sticky top-0 z-30 animate-fade-in">
            <div className="rounded-2xl border border-brand-200/70 bg-gradient-to-r from-brand-50/90 via-white to-white shadow-[var(--shadow-elevated)] overflow-hidden">
              <div className="px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-brand-500 to-teal-700 text-white flex items-center justify-center text-sm font-bold tabular-nums shadow-lg shadow-brand-500/25 ring-1 ring-white/20 flex-shrink-0">
                    {displayedCount.toLocaleString()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-700">Workspace actions</p>
                    <p className="text-sm font-semibold text-stone-900 mt-0.5 truncate">
                      {displayedCount === 1 ? '1 person selected' : `${displayedCount.toLocaleString()} people selected`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setAllMatching(false); setSelectedIds([]); }}
                    className="h-10 w-10 rounded-xl border border-stone-200/80 bg-white text-stone-500 inline-flex items-center justify-center hover:bg-stone-50 hover:text-stone-800 hover:border-stone-300 transition-all shadow-sm flex-shrink-0"
                    title="Clear selection"
                  >
                    <X size={16} strokeWidth={2} />
                  </button>
                </div>
                <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                  <div className="inline-flex items-center gap-2 p-1 rounded-xl bg-stone-50/80 border border-stone-100">
                    {!isFreelancer ? (
                      <button
                        type="button"
                        onClick={email.startBulkEmailFlow}
                        className="h-10 w-10 rounded-lg bg-white border border-stone-200/80 text-stone-600 inline-flex items-center justify-center shadow-sm hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50 transition-all"
                        title="Email selected"
                      >
                        <Mail size={17} strokeWidth={1.75} />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => startWhatsApp(allMatching ? null : selectedRows)}
                      className="h-10 w-10 rounded-lg bg-white border border-stone-200/80 text-stone-600 inline-flex items-center justify-center shadow-sm hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 transition-all"
                      title="WhatsApp selected"
                    >
                      <WhatsAppIcon size={17} />
                    </button>
                  </div>
                  <div className="inline-flex items-center gap-2 p-1 rounded-xl bg-stone-50/80 border border-stone-100">
                    {single && selectedHasCandidate ? (
                      <button
                        type="button"
                        onClick={() => openCandidate(single)}
                        className="h-10 px-3 rounded-lg bg-white border border-stone-200/80 text-stone-700 text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm hover:border-teal-300 hover:text-teal-800 hover:bg-teal-50 transition-all"
                      >
                        <Users size={14} /> Candidates
                      </button>
                    ) : null}
                    {single && selectedHasMis ? (
                      <button
                        type="button"
                        onClick={() => openMis(single)}
                        className="h-10 px-3 rounded-lg bg-white border border-stone-200/80 text-stone-700 text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm hover:border-amber-300 hover:text-amber-800 hover:bg-amber-50 transition-all"
                      >
                        <Megaphone size={14} /> MIS
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => requestDelete(selectedRows)}
                      className="h-10 w-10 rounded-lg bg-white border border-red-100 text-red-600 inline-flex items-center justify-center shadow-sm hover:bg-red-50 transition-all"
                      title="Delete selected"
                    >
                      <Trash2 size={16} strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              </div>
              {isAllFilteredSelected ? (
                <div className="px-4 sm:px-5 py-2 border-t border-brand-100/80 bg-white/70 text-xs text-stone-600">
                  All {totalCount.toLocaleString()} matching people are selected.
                </div>
              ) : totalCount > selectedIds.length ? (
                <div className="px-4 sm:px-5 py-2 border-t border-brand-100/80 bg-white/70 text-xs text-stone-600">
                  <button type="button" className="font-semibold text-brand-800 hover:underline" onClick={handleSelectAllFiltered}>
                    Select all {totalCount.toLocaleString()} matching people
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="relative min-h-[280px]">
        <div
          ref={tableScrollRef}
          className={`cand-table-scroll overflow-x-auto select-none ${showOverlay ? 'pointer-events-none opacity-45 blur-[2.5px]' : ''}`}
          onMouseDown={showOverlay ? undefined : onTableDragScrollStart}
          onMouseMove={showOverlay ? undefined : onTableDragScrollMove}
          onMouseUp={showOverlay ? undefined : onTableDragScrollEnd}
          onMouseLeave={showOverlay ? undefined : onTableDragScrollEnd}
          onCopy={guardTableCopy}
        >
          <table className="cand-table-drag w-max min-w-full text-left border-collapse select-none border border-stone-200" style={{ tableLayout: 'auto' }}>
            <thead>
              <tr className="bg-stone-100">
                <th className="px-3.5 py-3.5 w-[52px] text-center border border-stone-200 bg-stone-100">
                  <button type="button" onClick={togglePage} className="cursor-pointer flex justify-center mx-auto p-1 rounded hover:bg-stone-200/80" aria-label="Select this page">
                    {isPageSelected ? <CheckSquare size={18} className="text-brand-600" /> : isPagePartial ? <MinusSquare size={18} className="text-brand-500" /> : <Square size={18} className="text-stone-400" />}
                  </button>
                </th>
                {columns.map((column) => (
                  <th key={column.key} className="px-3.5 py-3.5 text-[10px] font-bold text-stone-600 uppercase tracking-wider whitespace-nowrap border border-stone-200 bg-stone-100">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((row, index) => {
                const id = rowId(row);
                const isSelected = allMatching || selectedIds.includes(id);
                return (
                  <tr key={id} className={`${isSelected ? 'bg-brand-50/80' : index % 2 === 0 ? 'bg-white' : 'bg-stone-50/40'} hover:bg-brand-50/50`}>
                    <td className="px-3.5 py-3 text-center w-[52px] border border-stone-200">
                      <button type="button" onClick={() => toggleOne(id)} className="cursor-pointer flex justify-center mx-auto p-1 rounded hover:bg-stone-100">
                        {isSelected ? <CheckSquare className="text-brand-600" size={17} /> : <Square className="text-stone-300" size={17} />}
                      </button>
                    </td>
                    {columns.map((column) => (
                      <td
                        key={`${id}-${column.key}`}
                        className="px-3.5 py-3 text-sm text-stone-700 font-medium border border-stone-200 align-middle whitespace-nowrap"
                      >
                        {column.render(row, index)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <CandidatesPagination
          visibleCandidates={list}
          currentPage={page}
          setCurrentPage={setPage}
          filteredCandidates={list}
          totalFilteredPages={totalPages}
          totalCount={totalCount}
          countPending={countPending}
          countPlus={countPlus}
        />
      </div>

      <CandidateEmailModal
        showEmailModal={email.showEmailModal}
        emailRecipient={email.emailRecipient}
        setShowEmailModal={email.setShowEmailModal}
        bulkEmailRecipients={email.bulkEmailRecipients}
        setBulkEmailRecipients={email.setBulkEmailRecipients}
        bulkAudience={email.bulkAudience}
        setBulkAudience={email.setBulkAudience}
        setSelectedIds={setSelectedIds}
        emailChannel={email.emailChannel}
        setEmailChannel={email.setEmailChannel}
        channelsAvailable={email.channelsAvailable}
        emailSenderInfo={email.emailSenderInfo}
        emailMode={email.emailMode}
        setEmailMode={email.setEmailMode}
        emailCC={email.emailCC}
        setEmailCC={email.setEmailCC}
        emailBCC={email.emailBCC}
        setEmailBCC={email.setEmailBCC}
        teamMembers={[]}
        ccInput={email.ccInput}
        setCcInput={email.setCcInput}
        bccInput={email.bccInput}
        setBccInput={email.setBccInput}
        showCCPicker={email.showCCPicker}
        setShowCCPicker={email.setShowCCPicker}
        showBCCPicker={email.showBCCPicker}
        setShowBCCPicker={email.setShowBCCPicker}
        emailTemplates={email.emailTemplates}
        emailTemplatesLoading={email.emailTemplatesLoading}
        selectedTemplate={email.selectedTemplate}
        selectEmailTemplate={email.selectEmailTemplate}
        setSelectedTemplate={email.setSelectedTemplate}
        templateVars={email.templateVars}
        setTemplateVars={email.setTemplateVars}
        templateDraftSubject={email.templateDraftSubject}
        setTemplateDraftSubject={email.setTemplateDraftSubject}
        templateDraftBody={email.templateDraftBody}
        setTemplateDraftBody={email.setTemplateDraftBody}
        templateDraftDirty={email.templateDraftDirty}
        setTemplateDraftDirty={email.setTemplateDraftDirty}
        emailType={email.emailType}
        setEmailType={email.setEmailType}
        quickName={email.quickName}
        setQuickName={email.setQuickName}
        quickPosition={email.quickPosition}
        setQuickPosition={email.setQuickPosition}
        quickDepartment={email.quickDepartment}
        setQuickDepartment={email.setQuickDepartment}
        quickJoiningDate={email.quickJoiningDate}
        setQuickJoiningDate={email.setQuickJoiningDate}
        customMessage={email.customMessage}
        setCustomMessage={email.setCustomMessage}
        quickSubject={email.quickSubject}
        setQuickSubject={email.setQuickSubject}
        showQuickPreview={email.showQuickPreview}
        setShowQuickPreview={email.setShowQuickPreview}
        quickPreviewHtml={email.quickPreviewHtml}
        setQuickPreviewHtml={email.setQuickPreviewHtml}
        quickPreviewSubject={email.quickPreviewSubject}
        setQuickPreviewSubject={email.setQuickPreviewSubject}
        loadingPreview={email.loadingPreview}
        setLoadingPreview={email.setLoadingPreview}
        isSendingEmail={email.isSendingEmail}
        sendTemplateEmail={email.sendTemplateEmail}
        sendSingleEmail={email.sendSingleEmail}
        jobs={jobs}
        campaignJobId={email.campaignJobId}
        setCampaignJobId={email.setCampaignJobId}
        campaignJobMeta={email.campaignJobMeta}
        setCampaignJobMeta={email.setCampaignJobMeta}
        toast={toast}
      />
      <EmailCampaignResultModal
        open={Boolean(email.showEmailCampaignResult)}
        result={email.emailCampaignResult}
        onClose={() => {
          email.setShowEmailCampaignResult?.(false);
          email.setEmailCampaignResult?.(null);
        }}
        onViewReports={() => {
          email.setShowEmailCampaignResult?.(false);
          email.setEmailCampaignResult?.(null);
          navigate('/email-reports');
        }}
      />
      <VerifiedEmailModal
        open={email.showVerifiedEmailRequiredModal}
        message={email.verifiedEmailRequiredMessage}
        onClose={() => {
          email.setShowVerifiedEmailRequiredModal(false);
          email.setVerifiedEmailRequiredMessage('');
        }}
      />
      <ConfirmationModal
        isOpen={deleteOpen}
        onClose={() => { if (!deleting) { setDeleteOpen(false); setDeleteTargets([]); } }}
        onConfirm={confirmDelete}
        type="delete"
        title={deleteCopy.title}
        message={deleteCopy.message}
        confirmText="Delete"
        isLoading={deleting}
      />
      <ConfirmationModal
        isOpen={whatsAppOpen}
        onClose={() => { setWhatsAppOpen(false); setWhatsAppTargets([]); }}
        onConfirm={() => {
          setWhatsAppOpen(false);
          whatsAppTargets.forEach((c, i) => {
            setTimeout(() => {
              window.open(`https://wa.me/${phoneOf(c)}`, '_blank');
            }, i * 500);
          });
        }}
        type="info"
        title="Open WhatsApp"
        message={`Open WhatsApp for ${whatsAppTargets.length} contact(s)? Each will open in a new tab.`}
        confirmText="Open WhatsApp"
      />
    </>
  );
}
