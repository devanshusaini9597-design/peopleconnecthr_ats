import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Megaphone, Search, Upload, RefreshCw, Trash2, Loader2, Info,
  CheckSquare, Square, MinusSquare, Plus, Users, X, Filter, RotateCcw, Download, Briefcase, Sparkles,
  Layers, ChevronDown, Building2, UserRound, Inbox, CalendarPlus,
} from 'lucide-react';
import { authenticatedFetch, authenticatedUpload, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import Modal from './ui/Modal';
import ConfirmationModal from './ConfirmationModal';
import MisAddContactModal from './MisAddContactModal';
import MisAdvancedFilters from './MisAdvancedFilters';
import MisBulkToolbar from './MisBulkToolbar';
import MisBulkEditModal from './MisBulkEditModal';
import CandidateEmailModal from './ats/CandidateEmailModal';
import EmailCampaignResultModal from './ats/EmailCampaignResultModal';
import { useCandidateEmail } from './ats/hooks/useCandidateEmail';
import { useAuth } from '../context/AuthContext';
import { useTableDragScroll } from './ats/hooks/useTableDragScroll';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import BASE_API_URL from '../config';
import { fetchPicklist, PICKLIST_DROPDOWN_LIMIT } from '../utils/orgListFetch';
import { DEFAULT_CTC_BANDS } from '../utils/ctcRanges';
import { dedupeByName } from '../utils/dedupeMasterData';
import { guardTableCopy } from '../utils/tableCopyGuard';
import { canAccessMis, canSeeMisAllDesk, normalizeMisDesk, misPageSubtitle, misTipCaption, misDeskHint } from '../utils/misAccess';
import { MIS_TOUR_KEY, MIS_TOUR_STEPS } from './mis/misConstants';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';
import { useTranslation } from 'react-i18next';
import TalentMatchDesk from './talentMatch/TalentMatchDesk';
import { StatCard } from './dashboard/DashboardWidgets';

const PAGE_SIZE = 50;

const EMPTY_MIS_FILTERS = {
  consent: 'all',
  unsubscribed: 'all',
  status: '',
  location: '',
  position: '',
  companyName: '',
  source: '',
  client: '',
  product: '',
  skills: '',
  expMin: '',
  expMax: '',
  ctcMin: '',
  ctcMax: '',
  expectedCtcMin: '',
  expectedCtcMax: '',
  datePeriod: '',
  dateFrom: '',
  dateTo: '',
};

const TEXT_FILTER_KEYS = [
  'location', 'position', 'companyName', 'source', 'client', 'product', 'skills',
  'expMin', 'expMax', 'ctcMin', 'ctcMax', 'expectedCtcMin', 'expectedCtcMax',
];

function formatMisStatusLabel(status) {
  const raw = String(status || '').trim();
  if (!raw) return '—';
  if (raw === raw.toUpperCase() && raw.includes(' ')) {
    return raw.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
  if (raw === raw.toUpperCase()) {
    return raw.charAt(0) + raw.slice(1).toLowerCase();
  }
  return raw;
}

function misStatusBadgeClass(status) {
  const key = String(status || '').toUpperCase();
  if (key.includes('CONVERT') || key.includes('QUALIF')) return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (key.includes('NOT INTEREST') || key.includes('CLOSED') || key.includes('DEAD')) return 'bg-red-50 text-red-800 border-red-200';
  if (key.includes('FOLLOW') || key.includes('CONTACT')) return 'bg-amber-50 text-amber-900 border-amber-200';
  if (key.includes('INTEREST')) return 'bg-violet-50 text-violet-800 border-violet-200';
  return 'bg-sky-50 text-sky-800 border-sky-200';
}
function pageButtonClass(active) {
  return active
    ? 'bg-gradient-to-br from-brand-600 to-teal-600 text-white shadow-md shadow-brand-500/25'
    : 'text-stone-600 hover:bg-white border border-transparent hover:border-stone-200 bg-white/60';
}

function dash(v) {
  return v ? <span className="text-sm text-stone-700 whitespace-nowrap">{v}</span> : <span className="text-stone-300">—</span>;
}

function MisActionsMenu({
  isOwner, uploading, loading, filteredCount, onImport, onExport, onMatch,
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const [pos, setPos] = useState(null);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) {
      setPos(null);
      return undefined;
    }
    const place = () => {
      const el = btnRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const width = Math.min(300, window.innerWidth - 16);
      const left = Math.min(Math.max(8, r.right - width), window.innerWidth - width - 8);
      const spaceBelow = window.innerHeight - r.bottom - 12;
      const maxH = Math.min(360, Math.max(200, spaceBelow > 200 ? spaceBelow : r.top - 12));
      const openUp = spaceBelow < 220 && r.top > spaceBelow;
      setPos({
        left,
        width,
        maxH,
        top: openUp ? undefined : r.bottom + 8,
        bottom: openUp ? window.innerHeight - r.top + 8 : undefined,
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        disabled={uploading}
        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white px-2.5 sm:px-3 text-sm font-semibold text-stone-700 shadow-sm hover:bg-stone-50 disabled:opacity-50"
      >
        <Layers size={15} className="shrink-0 text-stone-500" />
        Actions
        <ChevronDown size={14} className={`opacity-60 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && pos ? (
        <>
          <div className="fixed inset-0 z-40" onClick={close} aria-hidden />
          <div
            className="fixed z-50 rounded-xl border border-stone-200 bg-white shadow-xl shadow-stone-900/10 animate-fade-in flex flex-col overflow-hidden"
            style={{
              left: pos.left,
              width: pos.width,
              top: pos.top,
              bottom: pos.bottom,
              maxHeight: pos.maxH,
            }}
          >
            <div className="px-3 py-2 border-b border-stone-100 bg-stone-50/90 shrink-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Workspace</p>
              <p className="text-[11px] text-stone-400">Import, export, and talent matching</p>
            </div>
            <div
              className="p-1.5 overflow-y-auto overscroll-contain min-h-0 flex-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              style={{ maxHeight: pos.maxH - 52 }}
            >
              <button
                type="button"
                onClick={() => { close(); onImport?.(); }}
                disabled={uploading}
                className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-stone-50 transition-colors disabled:opacity-50"
              >
                <span className="h-8 w-8 rounded-lg border border-stone-200 bg-white inline-flex items-center justify-center text-stone-600 flex-shrink-0">
                  {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} strokeWidth={1.75} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-stone-800 truncate">Import spreadsheet</span>
                  <span className="block text-[11px] text-stone-500 truncate">Excel or CSV · Name and Email required</span>
                </span>
              </button>
              {isOwner ? (
                <button
                  type="button"
                  onClick={() => { close(); onExport?.(); }}
                  disabled={uploading || loading || filteredCount === 0}
                  className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-stone-50 transition-colors disabled:opacity-50"
                >
                  <span className="h-8 w-8 rounded-lg border border-stone-200 bg-white inline-flex items-center justify-center text-stone-600 flex-shrink-0">
                    <Download size={15} strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-stone-800 truncate">Export directory</span>
                    <span className="block text-[11px] text-stone-500 truncate">Download current view as Excel</span>
                  </span>
                </button>
              ) : null}
              <div className="my-1 mx-2 border-t border-stone-100" />
              <button
                type="button"
                onClick={() => { close(); onMatch?.(); }}
                className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-stone-50 transition-colors"
              >
                <span className="h-8 w-8 rounded-lg border border-brand-200 bg-brand-50 inline-flex items-center justify-center text-brand-700 flex-shrink-0">
                  <Sparkles size={15} strokeWidth={1.75} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-stone-800 truncate">Match to job</span>
                  <span className="block text-[11px] text-stone-500 truncate">Rank contacts against an open role</span>
                </span>
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function formatDate(raw) {
  const d = raw ? new Date(raw) : null;
  const valid = d && !Number.isNaN(d.getTime());
  return valid
    ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
}

function appendMisFilters(params, filters = {}) {
  if (filters.consent === 'yes' || filters.consent === 'no') params.set('consent', filters.consent);
  if (filters.unsubscribed === '1' || filters.unsubscribed === '0') {
    params.set('unsubscribed', filters.unsubscribed);
  }
  if (String(filters.status || '').trim()) params.set('status', String(filters.status).trim().toUpperCase());
  TEXT_FILTER_KEYS.forEach((key) => {
    if (String(filters[key] || '').trim()) params.set(key, String(filters[key]).trim());
  });
  if (String(filters.datePeriod || '').trim()) {
    params.set('dateRange', String(filters.datePeriod).trim());
  }
  if (String(filters.dateFrom || '').trim()) params.set('from', String(filters.dateFrom).trim());
  if (String(filters.dateTo || '').trim()) params.set('to', String(filters.dateTo).trim());
}

function countActiveMisFilters(filters = {}) {
  let n = 0;
  if (filters.consent === 'yes' || filters.consent === 'no') n += 1;
  if (filters.unsubscribed === '1' || filters.unsubscribed === '0') n += 1;
  if (String(filters.status || '').trim()) n += 1;
  TEXT_FILTER_KEYS.forEach((key) => {
    if (String(filters[key] || '').trim()) n += 1;
  });
  if (String(filters.datePeriod || '').trim()) n += 1;
  return n;
}

export default function MisPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const isOwner = user?.role === 'owner';
  const canSeeAllDesk = canSeeMisAllDesk(user);
  const [tourOpen, setTourOpen] = usePageTour(MIS_TOUR_KEY);
  const fileInputRef = useRef(null);
  const {
    tableScrollRef,
    onTableDragScrollStart,
    onTableDragScrollMove,
    onTableDragScrollEnd,
  } = useTableDragScroll();

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, pages: 1 });
  const [scope, setScope] = useState('owner');
  const [page, setPage] = useState(1);
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQ = String(searchParams.get('q') || '').trim();
  const deskFromUrl = String(searchParams.get('desk') || '').toLowerCase();
  const deskView = normalizeMisDesk(deskFromUrl, user);
  const [q, setQ] = useState(urlQ);
  const [draft, setDraft] = useState(urlQ);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [masterMisStatuses, setMasterMisStatuses] = useState([]);
  const [deskSwitchLabel, setDeskSwitchLabel] = useState('');
  const announceLoadRef = useRef(false);

  useEffect(() => {
    setQ(urlQ);
    setDraft(urlQ);
  }, [urlQ]);

  // Keep URL desk in sync with role rules (employees never stay on All).
  useEffect(() => {
    if (!user) return;
    const normalized = normalizeMisDesk(deskFromUrl, user);
    const urlDesk = deskFromUrl === 'mine' || deskFromUrl === 'company' || deskFromUrl === 'all'
      ? deskFromUrl
      : '';
    // No desk param → write role default (owner: all, others: mine)
    if (!urlDesk) {
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        p.set('desk', normalized);
        return p;
      }, { replace: true });
      return;
    }
    // Non-admin/owner trying to use All → force My records
    if (urlDesk === 'all' && !canSeeMisAllDesk(user)) {
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        p.set('desk', 'mine');
        return p;
      }, { replace: true });
      return;
    }
    if (urlDesk !== normalized) {
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        p.set('desk', normalized);
        return p;
      }, { replace: true });
    }
  }, [user, deskFromUrl, setSearchParams]);

  const setDeskView = useCallback((next) => {
    const value = normalizeMisDesk(next, user);
    const labels = { all: 'All contacts', mine: 'My records', company: 'Organisation' };
    const currentNorm = normalizeMisDesk(deskFromUrl, user);
    if (currentNorm === value) return;
    setDeskSwitchLabel(labels[value] || 'contacts');
    announceLoadRef.current = false;
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('desk', value);
      return p;
    }, { replace: true });
    setPage(1);
  }, [setSearchParams, user, deskFromUrl]);  const [showFilters, setShowFilters] = useState(false);
  const [draftFilters, setDraftFilters] = useState(() => ({ ...EMPTY_MIS_FILTERS }));
  const [appliedFilters, setAppliedFilters] = useState(() => ({ ...EMPTY_MIS_FILTERS }));
  const [loading, setLoading] = useState(true);
  const [listRefreshing, setListRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const LIST_REFRESH_MS = 60 * 60 * 1000; // hourly auto-refresh
  const [uploading, setUploading] = useState(false);
  const [uploadUi, setUploadUi] = useState(null);
  // uploadUi: { phase, percent, fileName, result? }
  const [pendingUploadFiles, setPendingUploadFiles] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [rankOpen, setRankOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [moveConfirmOpen, setMoveConfirmOpen] = useState(false);
  const [moveIds, setMoveIds] = useState([]);
  const [moving, setMoving] = useState(false);
  const [moveResult, setMoveResult] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [consentMenuOpen, setConsentMenuOpen] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditing, setBulkEditing] = useState(false);
  const [whatsAppConfirmOpen, setWhatsAppConfirmOpen] = useState(false);
  const [whatsAppTargets, setWhatsAppTargets] = useState([]);
  const [consentBulk, setConsentBulk] = useState(null); // true | false | null
  const [consentBulkConfirmOpen, setConsentBulkConfirmOpen] = useState(false);
  const [consentBulkSaving, setConsentBulkSaving] = useState(false);
  const [campaignStarting, setCampaignStarting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [masterPositions, setMasterPositions] = useState([]);
  const [masterCtcBands, setMasterCtcBands] = useState([]);
  const [masterClients, setMasterClients] = useState([]);
  const [masterSources, setMasterSources] = useState([]);
  const [masterProducts, setMasterProducts] = useState([]);

  const activeFilterCount = useMemo(() => countActiveMisFilters(appliedFilters), [appliedFilters]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [positions, ctc, clients, sources, product, misStatus] = await Promise.all([
          fetchPicklist('/api/positions', { limit: PICKLIST_DROPDOWN_LIMIT }).catch(() => []),
          fetchPicklist('/api/org-lists/ctc').catch(() => []),
          fetchPicklist('/api/clients', { limit: PICKLIST_DROPDOWN_LIMIT }).catch(() => []),
          fetchPicklist('/api/sources', { limit: PICKLIST_DROPDOWN_LIMIT }).catch(() => []),
          fetchPicklist('/api/org-lists/product', { limit: PICKLIST_DROPDOWN_LIMIT }).catch(() => []),
          fetchPicklist('/api/org-lists/misStatus', { limit: PICKLIST_DROPDOWN_LIMIT }).catch(() => []),
        ]);
        if (cancelled) return;
        setMasterPositions(dedupeByName(positions));
        setMasterCtcBands(dedupeByName(ctc));
        setMasterClients(dedupeByName(clients));
        setMasterSources(dedupeByName(sources));
        setMasterProducts(dedupeByName(product));
        setMasterMisStatuses(dedupeByName(misStatus));
      } catch { /* keep empty */ }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = String(e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) return;
      e.preventDefault();
      setTourOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setTourOpen]);

  const expOptions = useMemo(
    () => [
      { value: '', label: 'Any' },
      ...[...Array(31).keys()].map((num) => ({
        value: String(num),
        label: `${num} ${num === 1 ? 'year' : 'years'}`,
      })),
    ],
    []
  );
  const ctcFilterOptions = useMemo(() => {
    const bands = masterCtcBands.length
      ? masterCtcBands.map((x) => x.name).filter(Boolean)
      : DEFAULT_CTC_BANDS;
    return [{ value: '', label: 'Any' }, ...bands.map((range) => ({ value: range, label: range }))];
  }, [masterCtcBands]);
  const positionFilterOptions = useMemo(
    () => [
      { value: '', label: 'All Positions', icon: Briefcase },
      ...masterPositions.map((pos) => ({ value: pos.name, label: pos.name, icon: Briefcase })),
    ],
    [masterPositions]
  );
  const clientFilterOptions = useMemo(
    () => [
      { value: '', label: 'All clients' },
      ...masterClients.map((c) => ({ value: c.name, label: c.name })),
    ],
    [masterClients]
  );
  const sourceFilterOptions = useMemo(
    () => [
      { value: '', label: 'All sources' },
      ...masterSources.map((s) => ({ value: s.name, label: s.name })),
    ],
    [masterSources]
  );
  const productFilterOptions = useMemo(
    () => [
      { value: '', label: 'All products' },
      ...masterProducts.map((p) => ({ value: p.name, label: p.name })),
    ],
    [masterProducts]
  );
  const statusFilterOptions = useMemo(() => {
    const defaults = ['NEW', 'CONTACTED', 'INTERESTED', 'FOLLOW UP', 'NOT INTERESTED', 'QUALIFIED', 'CONVERTED'];
    const fromApi = masterMisStatuses.map((s) => String(s.name || '').toUpperCase()).filter(Boolean);
    // Prefer live org list — do not re-merge starters (that undoes rename/delete in Manage).
    const names = fromApi.length ? fromApi : defaults;
    const seen = new Set();
    const unique = [];
    for (const name of names) {
      if (!name || seen.has(name)) continue;
      seen.add(name);
      unique.push(name);
    }
    return [
      { value: '', label: 'All statuses' },
      ...unique.map((name) => ({ value: name, label: formatMisStatusLabel(name) })),
    ];
  }, [masterMisStatuses]);

  const load = useCallback(async (pageOverride, opts = {}) => {
    const pageNum = pageOverride != null ? pageOverride : page;
    const silent = Boolean(opts.silent);
    const announce = Boolean(opts.announce);
    if (silent) setListRefreshing(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(pageNum),
        limit: String(PAGE_SIZE),
      });
      if (q) params.set('q', q);
      // Always send desk so backend role defaults stay accurate
      if (deskView) params.set('desk', deskView);
      appendMisFilters(params, appliedFilters);
      const res = await authenticatedFetch(`/api/mis?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to load MIS');
      const nextPagination = data.pagination || { page: 1, limit: PAGE_SIZE, total: 0, pages: 1 };
      setRows(data.rows || []);
      setPagination(nextPagination);
      setScope(data.scope || 'owner');
      setLastSyncedAt(new Date());
      // Keep overview cards aligned with the live list total for the active desk
      const listTotal = Number(nextPagination.total);
      if (Number.isFinite(listTotal) && listTotal >= 0) {
        const hasFilters = Boolean(q || Object.values(appliedFilters || {}).some((v) => v && v !== 'all' && v !== ''));
        if (!hasFilters) {
          setStats((prev) => {
            if (!prev) {
              return {
                total: deskView === 'all' ? listTotal : 0,
                company: deskView === 'company' ? listTotal : 0,
                mine: deskView === 'mine' ? listTotal : 0,
                newThisMonth: 0,
              };
            }
            if (deskView === 'all') return { ...prev, total: listTotal };
            if (deskView === 'company') return { ...prev, company: listTotal };
            if (deskView === 'mine') return { ...prev, mine: listTotal };
            return prev;
          });
        }
      }
      const maxPage = Math.max(1, Number(nextPagination.pages) || 1);
      if (pageNum > maxPage) {
        setPage(maxPage);
      }
      if (announce) {
        const n = Number(nextPagination.total) || 0;
        const deskLabel = deskView === 'mine' ? 'My records' : deskView === 'company' ? 'Organisation' : 'All contacts';
        toast.info(
          n === 0
            ? `${deskLabel} · no contacts found`
            : `${deskLabel} · ${n.toLocaleString()} contact${n === 1 ? '' : 's'}`,
          2000,
          { key: 'mis-desk' }
        );
      }
    } catch (err) {
      if (!silent) toast.error(err.message || 'Failed to load contacts');
      if (!silent) setRows([]);
    } finally {
      if (silent) setListRefreshing(false);
      else setLoading(false);
      setDeskSwitchLabel('');
    }
  }, [page, q, appliedFilters, deskView, toast]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await authenticatedFetch(`/api/mis/stats?_=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to load MIS stats');
      setStats({
        total: Number(data.total) || 0,
        mine: Number(data.mine) || 0,
        company: Number(data.company) || 0,
        newThisMonth: Number(data.newThisMonth) || 0,
        scope: data.scope,
        generatedAt: data.generatedAt,
      });
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadRef = useRef(load);
  loadRef.current = load;
  const loadStatsRef = useRef(loadStats);
  loadStatsRef.current = loadStats;
  const lastSyncedRef = useRef(lastSyncedAt);
  lastSyncedRef.current = lastSyncedAt;

  // Clear selection when filters/search/desk change (not on page flip — keeps "select all matching")
  useEffect(() => {
    setSelected(new Set());
    setConsentMenuOpen(false);
  }, [q, appliedFilters, deskView]);

  useEffect(() => {
    const announce = announceLoadRef.current;
    announceLoadRef.current = false;
    load(undefined, { announce });
  }, [load]);
  useEffect(() => { loadStats(); }, [loadStats]);

  useEffect(() => {
    const shouldAutoRefresh = () => {
      if (document.visibilityState !== 'visible') return false;
      const last = lastSyncedRef.current;
      if (!last) return true;
      return (Date.now() - new Date(last).getTime()) >= LIST_REFRESH_MS;
    };
    const tick = () => {
      if (!shouldAutoRefresh()) return;
      loadRef.current(undefined, { silent: true }).catch(() => {});
      loadStatsRef.current().catch(() => {});
    };
    const id = window.setInterval(tick, LIST_REFRESH_MS);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  const pageIds = rows.map((r) => String(r._id));
  const selectedOnPage = pageIds.filter((id) => selected.has(id));
  const isPageSelected = pageIds.length > 0 && selectedOnPage.length === pageIds.length;
  const isPagePartial = selectedOnPage.length > 0 && !isPageSelected;
  const selectedIds = useMemo(() => [...selected], [selected]);
  const setSelectedIds = useCallback((next) => {
    if (typeof next === 'function') {
      setSelected((prev) => {
        const asArr = [...prev];
        const result = next(asArr);
        return new Set((result || []).map(String));
      });
      return;
    }
    setSelected(new Set((next || []).map(String)));
  }, []);

  const email = useCandidateEmail({
    toast,
    candidates: rows,
    selectedIds,
    setSelectedIds,
  });

  const headerTotal = useMemo(() => {
    const hasFilters = Boolean(q || Object.values(appliedFilters || {}).some((v) => v && v !== 'all' && v !== ''));
    if (!hasFilters && stats) {
      if (deskView === 'all' && Number.isFinite(Number(stats.total))) return Number(stats.total);
      if (deskView === 'mine' && Number.isFinite(Number(stats.mine))) return Number(stats.mine);
      if (deskView === 'company' && Number.isFinite(Number(stats.company))) return Number(stats.company);
    }
    return pagination.total || rows.length || 0;
  }, [q, appliedFilters, deskView, stats, pagination.total, rows.length]);
  const totalLabel = headerTotal.toLocaleString();
  const filteredCount = pagination.total > 0 ? pagination.total : (rows.length || 0);
  const totalPages = Math.max(1, Number(pagination.pages) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const isAllFilteredSelected =
    filteredCount > 0
    && selectedIds.length > 0
    && selectedIds.length >= filteredCount;

  const buildListParams = useCallback((extra = {}) => {
    const params = new URLSearchParams({
      page: String(extra.page ?? page),
      limit: String(extra.limit ?? PAGE_SIZE),
    });
    if (q) params.set('q', q);
    if (deskView && deskView !== 'all') params.set('desk', deskView);
    appendMisFilters(params, appliedFilters);
    if (extra.idsOnly) params.set('idsOnly', '1');
    if (extra.idSkip) params.set('idSkip', String(extra.idSkip));
    if (extra.idLimit) params.set('idLimit', String(extra.idLimit));
    return params;
  }, [page, q, appliedFilters, deskView]);

  const loadMatchingContacts = useCallback(async () => {
    const ids = [];
    const contacts = [];
    let skip = 0;
    let total = 0;
    const batch = 2000;
    for (let guard = 0; guard < 100; guard += 1) {
      const params = buildListParams({ page: 1, limit: 1, idsOnly: true, idSkip: skip, idLimit: batch });
      const res = await authenticatedFetch(`/api/mis?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Could not load matching contacts');
      const chunk = (data.contacts || []).map((row) => ({ ...row, _id: String(row._id) }));
      contacts.push(...chunk);
      ids.push(...(data.ids || chunk.map((row) => row._id)).map(String));
      total = Number(data.total) || ids.length;
      if (!data.hasMore && !data.pagination?.hasMore) break;
      if (!chunk.length) break;
      skip += chunk.length;
    }
    return { ids, contacts, total };
  }, [buildListParams]);

  const handleSelectAllFiltered = useCallback(async () => {
    try {
      const data = await loadMatchingContacts();
      const ids = data.ids;
      if (!ids.length) {
        toast.warning('No matching contacts to select.');
        return;
      }
      setSelected(new Set(ids));
      toast.success(`Selected all ${ids.length.toLocaleString()} matching contacts.`);
    } catch (err) {
      toast.error(err?.message || 'Could not select all matching contacts.');
    }
  }, [loadMatchingContacts, toast]);

  const handleBulkWhatsApp = useCallback(async () => {
    if (!selectedIds.length) {
      toast.warning('Please select at least one contact.');
      return;
    }
    let pool = rows.filter((r) => selected.has(String(r._id)));
    if (selectedIds.length > pool.length) {
      try {
        const data = await loadMatchingContacts();
        const idSet = new Set(selectedIds);
        pool = (data.contacts || []).filter((c) => idSet.has(String(c._id)));
      } catch (err) {
        toast.error(err.message || 'Could not load phone numbers');
        return;
      }
    }
    const withPhone = pool.filter((c) => {
      const phone = String(c.phone || c.contact || '').replace(/\D/g, '');
      return phone.length >= 7;
    });
    if (withPhone.length === 0) {
      toast.warning('No valid phone numbers found in selected contacts.');
      return;
    }
    setWhatsAppTargets(withPhone);
    setWhatsAppConfirmOpen(true);
  }, [selectedIds, rows, selected, toast, loadMatchingContacts]);

  const openWhatsAppTabs = useCallback(() => {
    setWhatsAppConfirmOpen(false);
    whatsAppTargets.forEach((c, i) => {
      const phone = String(c.phone || c.contact || '').replace(/\D/g, '');
      setTimeout(() => {
        window.open(`https://wa.me/${phone}`, '_blank');
      }, i * 500);
    });
    setWhatsAppTargets([]);
  }, [whatsAppTargets]);

  const requestBulkConsent = useCallback((value) => {
    setConsentMenuOpen(false);
    if (!selectedIds.length) {
      toast.warning('Select contacts first');
      return;
    }
    setConsentBulk(Boolean(value));
    setConsentBulkConfirmOpen(true);
  }, [selectedIds, toast]);

  const confirmBulkConsent = async () => {
    if (!selectedIds.length || consentBulk == null) return;
    setConsentBulkSaving(true);
    try {
      const res = await authenticatedFetch('/api/mis/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: selectedIds,
          updates: { marketingConsent: consentBulk },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Consent update failed');
      toast.success(
        consentBulk
          ? `Consent enabled for ${data.modified ?? selectedIds.length} contact(s)`
          : `Consent removed for ${data.modified ?? selectedIds.length} contact(s)`,
      );
      setConsentBulkConfirmOpen(false);
      setConsentBulk(null);
      await load();
    } catch (err) {
      toast.error(err.message || 'Consent update failed');
    } finally {
      setConsentBulkSaving(false);
    }
  };

  const submitBulkEdit = async (updates) => {
    if (!selectedIds.length || !updates || !Object.keys(updates).length) return;
    setBulkEditing(true);
    try {
      const res = await authenticatedFetch('/api/mis/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, updates }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Bulk edit failed');
      toast.success(`Updated ${data.modified ?? selectedIds.length} contact${(data.modified ?? selectedIds.length) === 1 ? '' : 's'}`);
      setBulkEditOpen(false);
      await load();
    } catch (err) {
      toast.error(err.message || 'Bulk edit failed');
    } finally {
      setBulkEditing(false);
    }
  };

  const togglePageSelection = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (isPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleConsent = useCallback(async (row) => {
    try {
      const next = !row.marketingConsent;
      const res = await authenticatedFetch(`/api/mis/${row._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketingConsent: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Update failed');
      setRows((prev) => prev.map((r) => (
        r._id === row._id
          ? { ...r, ...(data.data || {}), marketingConsent: next, unsubscribedAt: next ? null : r.unsubscribedAt }
          : r
      )));
      toast.success(next ? 'Consent enabled' : 'Consent removed');
    } catch (err) {
      toast.error(err.message || 'Could not update consent');
    }
  }, [toast]);

  const requestMove = useCallback((ids) => {
    const list = (ids || []).map(String).filter(Boolean);
    if (!list.length) {
      toast.warning('Select contacts first');
      return;
    }
    setMoveIds(list);
    setMoveResult(null);
    setMoveConfirmOpen(true);
  }, [toast]);

  const columns = useMemo(() => [
    {
      key: 'srNo',
      label: 'Sr No.',
      className: 'w-auto text-center',
      render: (_, index) => (
        <span className="text-sm font-mono text-stone-500 tabular-nums">
          {(safePage - 1) * PAGE_SIZE + index + 1}
        </span>
      ),
    },
    {
      key: 'name',
      label: 'Name',
      className: 'w-auto',
      render: (row) => (
        <div className="flex items-center gap-2.5 whitespace-nowrap">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-teal-700 text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0 shadow-sm shadow-brand-500/20">
            {(row.name || '?').charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-semibold text-stone-900 whitespace-nowrap">{row.name || '—'}</span>
        </div>
      ),
    },
    {
      key: 'contact',
      label: 'Phone',
      className: 'w-auto',
      render: (row) => (
        <span className="text-sm font-mono text-stone-600 whitespace-nowrap">
          {row.contact || row.phone || '—'}
        </span>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      className: 'w-auto',
      render: (row) => <span className="text-sm text-stone-600 whitespace-nowrap">{row.email || '—'}</span>,
    },
    { key: 'location', label: 'Location', className: 'w-auto', render: (row) => dash(row.location) },
    { key: 'state', label: 'State', className: 'w-auto', render: (row) => dash(row.state) },
    {
      key: 'position',
      label: 'Position',
      className: 'w-auto',
      render: (row) => (row.position
        ? <span className="text-sm font-semibold text-brand-700 whitespace-nowrap">{row.position}</span>
        : <span className="text-stone-300">—</span>),
    },
    {
      key: 'fls',
      label: 'FLS',
      className: 'w-auto',
      render: (row) => (row.fls ? (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap ${row.fls === 'FLS' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100' : 'bg-stone-100 text-stone-600 ring-1 ring-stone-200/80'}`}>
          {row.fls}
        </span>
      ) : <span className="text-stone-300">—</span>),
    },
    { key: 'companyName', label: 'Company', className: 'w-auto', render: (row) => dash(row.companyName) },
    {
      key: 'experience',
      label: 'Experience',
      className: 'w-auto',
      render: (row) => (row.experience ? <span className="text-sm whitespace-nowrap">{row.experience}</span> : <span className="text-stone-300">—</span>),
    },
    {
      key: 'ctc',
      label: 'CTC',
      className: 'w-auto',
      render: (row) => (row.ctc ? <span className="text-sm whitespace-nowrap">{row.ctc}</span> : <span className="text-stone-300">—</span>),
    },
    {
      key: 'expectedCtc',
      label: 'Expected CTC',
      className: 'w-auto',
      render: (row) => (row.expectedCtc ? <span className="text-sm whitespace-nowrap">{row.expectedCtc}</span> : <span className="text-stone-300">—</span>),
    },
    {
      key: 'noticePeriod',
      label: 'Notice Period',
      className: 'w-auto',
      render: (row) => (row.noticePeriod ? <span className="text-sm whitespace-nowrap">{row.noticePeriod}</span> : <span className="text-stone-300">—</span>),
    },
    {
      key: 'status',
      label: 'Status',
      className: 'w-auto min-w-[120px]',
      render: (row) => {
        const label = formatMisStatusLabel(row.status || 'NEW');
        return (
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold border whitespace-nowrap ${misStatusBadgeClass(row.status)}`}
            title="MIS contact status"
          >
            {label}
          </span>
        );
      },
    },
    {
      key: 'consent',
      label: 'Marketing consent',
      className: 'w-auto min-w-[130px]',
      render: (row) => {
        const ok = row.marketingConsent && !row.unsubscribedAt;
        return (
          <button
            type="button"
            onClick={() => toggleConsent(row)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold border whitespace-nowrap ${
              ok
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-stone-50 text-stone-500 border-stone-200'
            }`}
            title="Toggle marketing consent"
          >
            {ok ? 'Consented' : row.unsubscribedAt ? 'Unsubscribed' : 'No consent'}
          </button>
        );
      },
    },
    { key: 'client', label: 'Client', className: 'w-auto', render: (row) => dash(row.client) },
    { key: 'product', label: 'Product / Skill', className: 'w-auto', render: (row) => dash(row.product) },
    {
      key: 'source',
      label: 'Source',
      className: 'w-auto',
      render: (row) => (row.source
        ? <span className="text-sm px-2.5 py-0.5 bg-stone-100 text-stone-600 rounded-full whitespace-nowrap">{row.source}</span>
        : <span className="text-stone-300">—</span>),
    },
    {
      key: 'uploadedBy',
      label: 'Uploaded by',
      className: 'w-auto',
      render: (row) => (
        <span className="text-sm text-stone-700 whitespace-nowrap">
          {row.createdBy?.name || row.createdBy?.email || '—'}
        </span>
      ),
    },
    {
      key: 'date',
      label: 'Date',
      className: 'w-auto',
      render: (row) => (
        <span className="text-sm text-stone-600 whitespace-nowrap tabular-nums" title={row.recordDate ? 'Tracker date' : 'Import date'}>
          {formatDate(row.recordDate || row.createdAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      className: 'w-auto',
      render: (row) => (
        <button
          type="button"
          onClick={() => requestMove([row._id])}
          className="h-8 px-2.5 rounded-lg border border-stone-200 bg-white text-xs font-semibold text-stone-700 inline-flex items-center gap-1.5 hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50 transition-all whitespace-nowrap"
          title="Move to Candidates"
        >
          <Users size={13} />
          To Candidates
        </button>
      ),
    },
  ], [safePage, toggleConsent, requestMove]);

  const onUploadMany = async (files) => {
    const list = (Array.isArray(files) ? files : [files]).filter(Boolean);
    if (!list.length) return;
    setPendingUploadFiles([]);
    setUploading(true);

    const totals = {
      created: 0,
      duplicates: 0,
      duplicatesInFile: 0,
      skipped: 0,
      datesBackfilled: 0,
      filesOk: 0,
      filesFailed: 0,
    };

    try {
      for (let fi = 0; fi < list.length; fi += 1) {
        const file = list[fi];
        setUploadUi({
          phase: 'upload',
          percent: 0,
          fileName: file.name,
          fileIndex: fi + 1,
          fileTotal: list.length,
          result: null,
          processed: 0,
          totalRows: 0,
          created: 0,
          duplicates: 0,
          duplicatesInFile: 0,
          skipped: 0,
        });

        try {
          const fd = new FormData();
          fd.append('file', file);
          const { response, data } = await authenticatedUpload('/api/mis/bulk-upload', fd, {
            onProgress: ({ percent, phase }) => {
              setUploadUi((prev) => ({
                ...(prev || {}),
                percent: phase === 'upload' ? percent : (prev?.percent || 99),
                phase: phase === 'done' || phase === 'processing' ? 'processing' : phase,
                fileName: file.name,
                fileIndex: fi + 1,
                fileTotal: list.length,
              }));
            },
          });

          if (!response.ok && !data?.jobId && data?.created == null && data?.duplicates == null) {
            const msg = data.message
              || (response.status === 502 || response.status === 504
                ? 'Server timed out while reading the file. Please retry — large files now import in the background.'
                : `Upload failed (${response.status})`);
            throw new Error(msg);
          }

          let finalResult = data;
          if (data?.jobId || data?.async) {
            const jobId = data.jobId;
            setUploadUi((prev) => ({
              ...(prev || {}),
              phase: 'processing',
              percent: data.percent || 0,
              fileName: file.name,
              fileIndex: fi + 1,
              fileTotal: list.length,
              jobId,
              totalRows: data.totalRows || 0,
              processed: data.processed || 0,
              created: data.created || 0,
              duplicates: data.duplicates || 0,
              duplicatesInFile: data.duplicatesInFile || 0,
              skipped: data.skipped || 0,
              blank: data.blank || 0,
            }));

            const started = Date.now();
            const maxMs = 30 * 60 * 1000;
            // eslint-disable-next-line no-constant-condition
            while (true) {
              if (Date.now() - started > maxMs) {
                throw new Error('Import is taking too long. Refresh MIS to see what was saved.');
              }
              await new Promise((r) => setTimeout(r, 450));
              const res = await authenticatedFetch(`/api/mis/bulk-upload/jobs/${encodeURIComponent(jobId)}`);
              const job = await res.json().catch(() => ({}));
              if (!res.ok && !job.processed && job.created == null) {
                throw new Error(job.message || 'Could not read import progress');
              }
              setUploadUi((prev) => ({
                ...(prev || {}),
                phase: job.status === 'done' ? 'done' : job.status === 'error' ? 'error' : 'processing',
                percent: job.percent ?? prev?.percent ?? 0,
                fileName: file.name,
                fileIndex: fi + 1,
                fileTotal: list.length,
                jobId,
                totalRows: job.totalRows || 0,
                processed: job.processed || 0,
                created: job.created || 0,
                duplicates: job.duplicates || 0,
                duplicatesInFile: job.duplicatesInFile || 0,
                skipped: job.skipped || 0,
                blank: job.blank || 0,
                datesBackfilled: job.datesBackfilled || 0,
                message: job.message || prev?.message,
                result: job.status === 'done' || job.status === 'error' ? job : prev?.result,
                error: job.status === 'error' ? (job.error || job.message) : null,
              }));
              if (job.status === 'done' || job.status === 'error') {
                finalResult = job;
                break;
              }
            }
          }

          const created = finalResult.created ?? 0;
          const duplicates = finalResult.duplicates ?? 0;
          const duplicatesInFile = finalResult.duplicatesInFile ?? 0;
          const skipped = finalResult.skipped ?? 0;
          const datesBackfilled = finalResult.datesBackfilled ?? 0;

          if (finalResult.status === 'error' && created === 0 && duplicates === 0) {
            totals.filesFailed += 1;
          } else {
            totals.filesOk += 1;
            totals.created += created;
            totals.duplicates += duplicates;
            totals.duplicatesInFile += duplicatesInFile;
            totals.skipped += skipped;
            totals.datesBackfilled += datesBackfilled;
          }
        } catch (fileErr) {
          totals.filesFailed += 1;
          toast.error(`${file.name}: ${fileErr.message || 'Upload failed'}`);
        }
      }

      const summary = `${totals.created} added · ${totals.duplicates} duplicates · ${totals.duplicatesInFile} in-file repeats · ${totals.skipped} failed/invalid`
        + (totals.datesBackfilled ? ` · ${totals.datesBackfilled} dates filled` : '');

      setUploadUi({
        phase: totals.filesFailed && !totals.filesOk ? 'error' : 'done',
        percent: 100,
        fileName: list.length === 1 ? list[0].name : `${list.length} files`,
        fileIndex: list.length,
        fileTotal: list.length,
        result: {
          ...totals,
          message: list.length > 1
            ? `${totals.filesOk}/${list.length} files imported — ${summary}`
            : summary,
        },
        created: totals.created,
        duplicates: totals.duplicates,
        duplicatesInFile: totals.duplicatesInFile,
        skipped: totals.skipped,
        datesBackfilled: totals.datesBackfilled,
        error: totals.filesFailed && !totals.filesOk ? 'All files failed to import' : null,
      });

      if (totals.created > 0 || totals.datesBackfilled > 0) {
        toast.success(list.length > 1 ? `${totals.filesOk} file(s) — ${summary}` : `Import complete — ${summary}`);
      } else if (totals.duplicates > 0 || totals.duplicatesInFile > 0) {
        toast.info(`No new rows — ${summary}`);
      } else if (totals.filesFailed) {
        toast.error(`${totals.filesFailed} file(s) failed`);
      } else {
        toast.success(summary);
      }
      setPage(1);
      await load(1);
      await loadStats();
    } catch (err) {
      setUploadUi((prev) => ({
        ...(prev || { fileName: '', percent: 0 }),
        phase: 'error',
        error: err.message || 'Upload failed',
      }));
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const requestUpload = (files) => {
    const list = Array.from(files || []).filter(Boolean);
    if (!list.length) return;
    setPendingUploadFiles(list);
  };

  const deleteSelected = async () => {
    if (!selectedIds.length) return;
    setDeleting(true);
    try {
      const res = await authenticatedFetch('/api/mis/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Delete failed');
      toast.success(`Deleted ${data.deleted || 0}`);
      setDeleteConfirmOpen(false);
      await load();
      await loadStats();
    } catch (err) {
      toast.error(err.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const confirmMoveToCandidates = async () => {
    if (!moveIds.length) return;
    setMoving(true);
    try {
      const res = await authenticatedFetch('/api/mis/move-to-candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: moveIds, removeFromMis: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Move failed');
      setMoveResult(data);
      toast.success(data.message || `Moved ${data.moved || 0}`);
      setSelected(new Set());
      await load();
      await loadStats();
    } catch (err) {
      toast.error(err.message || 'Move failed');
      setMoveConfirmOpen(false);
    } finally {
      setMoving(false);
    }
  };

  const startMisCampaign = useCallback(async () => {
    if (!selectedIds.length) {
      toast.warning('Please select at least one contact.');
      return;
    }
    setCampaignStarting(true);
    try {
      let pool = rows.filter((r) => selected.has(String(r._id)));
      if (selectedIds.length > pool.length) {
        const data = await loadMatchingContacts();
        const idSet = new Set(selectedIds);
        pool = data.contacts.filter((c) => idSet.has(String(c._id)));
      }

      const eligible = pool.filter((c) => {
        const em = String(c.email || '').trim().toLowerCase();
        if (!em || !em.includes('@')) return false;
        if (c.marketingConsent === false) return false;
        if (c.unsubscribedAt) return false;
        return true;
      }).map((c) => ({
        _id: String(c._id),
        email: String(c.email).trim(),
        name: c.name || '',
        position: c.position || '',
        location: c.location || '',
        client: c.client || '',
        companyName: c.companyName || '',
      }));

      if (!eligible.length) {
        toast.warning('No eligible contacts — need a valid email, marketing consent, and not unsubscribed.');
        return;
      }

      if (eligible.length < selectedIds.length) {
        toast.info(
          `${eligible.length.toLocaleString()} of ${selectedIds.length.toLocaleString()} selected are eligible for campaign (consent + email).`,
        );
      }

      try {
        const statusRes = await authenticatedFetch(`${BASE_API_URL}/api/email/sender-status`);
        const statusData = await statusRes.json();
        if (statusData.success) {
          email.setEmailSenderInfo({
            fromEmail: statusData.fromEmail || statusData.agentFrom || '',
            replyTo: statusData.replyTo || '',
            displayName: statusData.displayName || '',
            verifiedDomain: statusData.verifiedDomain || '',
            sendAsUser: Boolean(statusData.sendAsUser),
            agentFrom: statusData.agentFrom || '',
            hint: statusData.hint || '',
          });
        }
      } catch (_) { /* keep previous */ }

      try {
        const chRes = await authenticatedFetch(`${BASE_API_URL}/api/email/channels`);
        const chData = await chRes.json();
        if (chData.success && chData.channels) {
          email.setChannelsAvailable({
            transactional: false,
            marketing: chData.channels.marketing?.available ?? false,
          });
        }
      } catch (_) {
        email.setChannelsAvailable({ transactional: false, marketing: false });
      }

      try {
        const res = await authenticatedFetch(`${BASE_API_URL}/api/email-templates`);
        if (isUnauthorized(res)) {
          handleUnauthorized();
          return;
        }
        const data = await res.json();
        if (data.success && data.templates?.length) {
          email.setEmailTemplates(data.templates);
        }
      } catch (_) { /* ignore */ }

      email.setBulkEmailRecipients(eligible);
      email.setEmailRecipient(eligible[0]);
      email.setEmailChannel('marketing');
      email.setEmailMode('template');
      email.setSelectedTemplate(null);
      email.setShowEmailModal(true);
    } catch (err) {
      toast.error(err.message || 'Could not start campaign');
    } finally {
      setCampaignStarting(false);
    }
  }, [
    selectedIds, rows, selected, toast, loadMatchingContacts,
    email.setEmailSenderInfo, email.setChannelsAvailable, email.setEmailTemplates,
    email.setBulkEmailRecipients, email.setEmailRecipient, email.setEmailChannel,
    email.setEmailMode, email.setSelectedTemplate, email.setShowEmailModal,
  ]);

  const handleExport = useCallback(async () => {
    if (!isOwner) {
      toast.error('Only the company owner can export the directory');
      return;
    }
    setExporting(true);
    try {
      const body = selectedIds.length
        ? { ids: selectedIds, selected: true }
        : {
          selected: false,
          filters: {
            q,
            ...appliedFilters,
          },
        };

      const startRes = await authenticatedFetch('/api/mis/export', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const startData = await startRes.json().catch(() => ({}));
      if (!startRes.ok) {
        throw new Error(startData.message || 'Export failed');
      }

      const jobId = startData.jobId;
      if (!jobId) throw new Error('Export job did not start');

      let downloadUrl = startData.downloadUrl || null;
      let count = Number(startData.count || 0);
      let capped = Boolean(startData.capped);

      for (let i = 0; i < 180; i += 1) {
        await new Promise((r) => setTimeout(r, i === 0 ? 400 : 900));
        const stRes = await authenticatedFetch(`/api/mis/export/jobs/${jobId}`);
        const st = await stRes.json().catch(() => ({}));
        if (!stRes.ok) throw new Error(st.message || 'Export status check failed');
        if (st.status === 'error') throw new Error(st.error || 'Export failed');
        if (st.status === 'done') {
          downloadUrl = st.downloadUrl || downloadUrl;
          count = Number(st.count || 0);
          capped = Boolean(st.capped);
          break;
        }
        if (i === 179) throw new Error('Export timed out — try fewer rows or filters');
      }

      if (!downloadUrl) throw new Error('Export download link missing');

      // Prefer absolute Railway URL so large files skip the Vercel proxy size limit.
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();

      toast.success(
        capped
          ? `Exported first ${count.toLocaleString()} contacts (cap reached)`
          : `Exported ${count.toLocaleString() || selectedIds.length || filteredCount} contact(s)`
      );
      setExportOpen(false);
    } catch (err) {
      const msg = err?.message === 'Failed to fetch'
        ? 'Could not reach the server to export. Try again, or export a smaller selection.'
        : (err.message || 'Export failed');
      toast.error(msg);
    } finally {
      setExporting(false);
    }
  }, [isOwner, selectedIds, q, appliedFilters, filteredCount, toast]);

  const runSearch = () => {
    announceLoadRef.current = false;
    setQ(draft.trim());
    setAppliedFilters({ ...draftFilters });
    setPage(1);
  };

  const applyFilters = () => {
    if (draftFilters.datePeriod === 'custom' && (!draftFilters.dateFrom || !draftFilters.dateTo)) {
      toast.warning('Select a start and end date, then apply filters.', 3500, { key: 'mis-filters' });
      return;
    }
    announceLoadRef.current = false;
    setAppliedFilters({ ...draftFilters });
    setPage(1);
    setShowFilters(true);
  };

  const clearFilters = () => {
    setDraft('');
    setQ('');
    setDraftFilters({ ...EMPTY_MIS_FILTERS });
    setAppliedFilters({ ...EMPTY_MIS_FILTERS });
    setPage(1);
  };

  const clearOneFilter = (key) => {
    const next = { ...appliedFilters };
    if (key === 'consent' || key === 'unsubscribed') next[key] = 'all';
    else if (key === 'datePeriod') {
      next.datePeriod = '';
      next.dateFrom = '';
      next.dateTo = '';
    } else {
      next[key] = '';
    }
    setDraftFilters(next);
    setAppliedFilters(next);
    setPage(1);
  };

  const patchDraftFilter = (key, value) => {
    setDraftFilters((prev) => ({ ...prev, [key]: value }));
  };

  const goToPage = (nextPage) => {
    const next = Math.min(totalPages, Math.max(1, nextPage));
    if (next !== page) setPage(next);
  };

  const windowPages = useMemo(() => {
    const maxButtons = 5;
    const count = Math.min(maxButtons, totalPages);
    return Array.from({ length: count }, (_, i) => {
      if (totalPages <= maxButtons) return i + 1;
      if (safePage <= 3) return i + 1;
      if (safePage >= totalPages - 2) return totalPages - 4 + i;
      return safePage - 2 + i;
    });
  }, [safePage, totalPages]);

  const rangeFrom = rows.length > 0 ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const rangeTo = Math.min(safePage * PAGE_SIZE, filteredCount);

  const activeChips = useMemo(() => {
    const chips = [];
    if (appliedFilters.consent === 'yes') chips.push({ key: 'consent', label: 'Consent', value: 'Consented' });
    if (appliedFilters.consent === 'no') chips.push({ key: 'consent', label: 'Consent', value: 'No consent' });
    if (appliedFilters.unsubscribed === '0') chips.push({ key: 'unsubscribed', label: 'Subscription', value: 'Active' });
    if (appliedFilters.unsubscribed === '1') chips.push({ key: 'unsubscribed', label: 'Subscription', value: 'Unsubscribed' });
    if (String(appliedFilters.status || '').trim()) {
      chips.push({
        key: 'status',
        label: 'Status',
        value: formatMisStatusLabel(appliedFilters.status),
      });
    }
    if (appliedFilters.datePeriod) {
      const periodLabel = ({
        today: 'Today',
        yesterday: 'Yesterday',
        week: 'Last 7 days',
        month: 'This month',
        quarter: 'This quarter',
        year: 'This year',
        custom: `${appliedFilters.dateFrom || '…'} → ${appliedFilters.dateTo || '…'}`,
      })[appliedFilters.datePeriod] || appliedFilters.datePeriod;
      chips.push({
        key: 'datePeriod',
        label: 'Date range',
        value: periodLabel,
      });
    }
    [
      ['location', 'Location'],
      ['position', 'Position'],
      ['companyName', 'Company'],
      ['source', 'Source'],
      ['client', 'Client'],
      ['product', 'Product'],
      ['skills', 'Skill'],
      ['expMin', 'Exp ≥'],
      ['expMax', 'Exp ≤'],
      ['ctcMin', 'CTC ≥'],
      ['ctcMax', 'CTC ≤'],
      ['expectedCtcMin', 'Exp. CTC ≥'],
      ['expectedCtcMax', 'Exp. CTC ≤'],
    ].forEach(([key, label]) => {
      const value = String(appliedFilters[key] || '').trim();
      if (value) chips.push({ key, label, value });
    });
    return chips;
  }, [appliedFilters]);
  const showOverlay = loading;
  const overlayTitle = deskSwitchLabel
    ? `Updating ${deskSwitchLabel}`
    : (q || activeFilterCount > 0 ? 'Updating results' : 'Loading directory');
  const hasActiveFilters = Boolean(q || activeFilterCount > 0);
  const filtersDirty = useMemo(
    () => JSON.stringify(draftFilters) !== JSON.stringify(appliedFilters),
    [draftFilters, appliedFilters]
  );

  if (user && !canAccessMis(user)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="page-shell-ats font-sans text-stone-900" role="main" aria-label="MIS">
      <PageHeader
        icon={Megaphone}
        title="MIS"
        subtitle={misPageSubtitle(user, headerTotal, totalLabel)}
        gradientTitle
      >
        <div
          className="flex w-full items-center gap-1.5 sm:gap-2 justify-start md:justify-end flex-nowrap min-w-0"
          data-tour="mis-actions"
        >
          <button
            type="button"
            onClick={() => load(undefined, { silent: true })}
            disabled={loading || listRefreshing || uploading}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600 shadow-sm hover:bg-stone-50 hover:text-stone-800 disabled:opacity-50"
            aria-label="Refresh directory"
            title={
              lastSyncedAt
                ? `Refresh directory · auto every 1 hour · last ${new Date(lastSyncedAt).toLocaleTimeString()}`
                : 'Refresh directory · auto every 1 hour'
            }
          >
            <RefreshCw size={16} strokeWidth={2.25} className={(loading || listRefreshing) ? 'animate-spin' : ''} />
          </button>
          <MisActionsMenu
            isOwner={isOwner}
            uploading={uploading}
            loading={loading}
            filteredCount={filteredCount}
            onImport={() => fileInputRef.current?.click()}
            onExport={() => setExportOpen(true)}
            onMatch={() => setRankOpen(true)}
          />
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            disabled={uploading}
            className="inline-flex h-10 min-w-0 flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-brand-600 to-teal-600 px-3 sm:px-3.5 text-sm font-semibold text-white shadow-md shadow-brand-500/20 hover:opacity-95 disabled:opacity-50"
          >
            <Plus size={16} className="shrink-0" />
            <span className="truncate">Add contact</span>
          </button>
        </div>
      </PageHeader>

      {/* Overview cards — top of page so KPIs stay above the directory */}
      <section className="min-w-0" aria-label="Directory overview" data-tour="mis-tip">
        <div className={`grid grid-cols-1 min-[420px]:grid-cols-2 ${canSeeAllDesk ? 'xl:grid-cols-4' : 'xl:grid-cols-3'} gap-3`}>
          {canSeeAllDesk ? (
            <StatCard
              icon={Inbox}
              label="All contacts"
              value={stats?.total ?? 0}
              caption="Shared directory and your records"
              gradient="from-sky-500 to-brand-400"
              loading={statsLoading}
              aligned
              onClick={() => setDeskView('all')}
            />
          ) : null}
          <StatCard
            icon={Building2}
            label="Organisation"
            value={stats?.company ?? 0}
            caption="Shared company directory"
            gradient="from-indigo-500 to-blue-400"
            loading={statsLoading}
            aligned
            onClick={() => setDeskView('company')}
          />
          <StatCard
            icon={UserRound}
            label="My records"
            value={stats?.mine ?? 0}
            caption="Contacts you added"
            gradient="from-brand-500 to-teal-500"
            loading={statsLoading}
            aligned
            onClick={() => setDeskView('mine')}
          />
          <StatCard
            icon={CalendarPlus}
            label="Added this month"
            value={stats?.newThisMonth ?? 0}
            caption="New on your desk this month"
            gradient="from-emerald-500 to-lime-400"
            loading={statsLoading}
            aligned
            onClick={() => {
              setDeskView('mine');
              setAppliedFilters((prev) => ({ ...prev, datePeriod: 'month', dateFrom: '', dateTo: '' }));
              setDraftFilters((prev) => ({ ...prev, datePeriod: 'month', dateFrom: '', dateTo: '' }));
              setPage(1);
            }}
          />
        </div>
        <p className="mt-2.5 text-[12px] text-stone-500 leading-snug flex items-start gap-1.5 min-w-0">
          <Info size={13} className="shrink-0 text-brand-600 mt-0.5" />
          <span className="min-w-0" title={misTipCaption(user)}>{misTipCaption(user)}</span>
        </p>
      </section>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.csv"
        multiple
        className="hidden"
        aria-hidden
        onChange={(e) => {
          const list = Array.from(e.target.files || []);
          e.target.value = '';
          requestUpload(list);
        }}
      />

      {/* Directory workspace: desks + search + table stay together (no scroll gap on tab switch) */}
      <div className="card-ats-bordered relative overflow-hidden min-h-[320px]">
        <div
          className="px-3 sm:px-5 pt-3 sm:pt-4 pb-0 border-b border-stone-100/90 bg-gradient-to-b from-stone-50/50 to-white"
          data-tour="mis-desk-tabs"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 min-w-0">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-400">Directory</p>
              <p className="text-[12px] text-stone-500 mt-0.5 truncate">
                {loading && deskSwitchLabel
                  ? `Updating ${deskSwitchLabel.toLowerCase()}…`
                  : misDeskHint(deskView)}
              </p>
            </div>
            <div className="overflow-x-auto scrollbar-thin min-w-0 sm:max-w-full">
              <div className="inline-flex items-center gap-0.5 p-1 rounded-xl border border-stone-200 bg-white shadow-sm shadow-stone-900/5">
                {[
                  canSeeAllDesk
                    ? { id: 'all', label: 'All', icon: Layers, hint: 'Organisation directory and your records' }
                    : null,
                  { id: 'mine', label: 'My records', icon: UserRound, hint: 'Contacts you added' },
                  { id: 'company', label: 'Organisation', icon: Building2, hint: 'Shared organisation directory' },
                ].filter(Boolean).map((tab) => {
                  const Icon = tab.icon;
                  const active = deskView === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setDeskView(tab.id)}
                      disabled={loading && active}
                      title={tab.hint}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 h-9 text-sm font-semibold transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-gradient-to-br from-brand-600 to-teal-600 text-white shadow-md shadow-brand-500/20'
                          : 'text-stone-600 hover:bg-stone-50'
                      } disabled:opacity-80`}
                    >
                      {loading && active ? (
                        <Loader2 size={14} className="shrink-0 animate-spin opacity-90" />
                      ) : (
                        <Icon size={14} className="shrink-0 opacity-90" />
                      )}
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {selectedIds.length > 0 ? (
          <MisBulkToolbar
            selectedIds={selectedIds}
            onClear={() => { setSelected(new Set()); setConsentMenuOpen(false); }}
            onEmail={startMisCampaign}
            onWhatsApp={handleBulkWhatsApp}
            onBulkEdit={() => { setConsentMenuOpen(false); setBulkEditOpen(true); }}
            onConsentMenuToggle={() => setConsentMenuOpen((v) => !v)}
            consentMenuOpen={consentMenuOpen}
            onSetConsent={requestBulkConsent}
            onMoveToCandidates={() => requestMove(selectedIds)}
            onDelete={() => setDeleteConfirmOpen(true)}
            filteredCount={filteredCount}
            isAllFilteredSelected={isAllFilteredSelected}
            onSelectAllFiltered={handleSelectAllFiltered}
          />
        ) : null}
        <div className="px-3 sm:px-5 py-3 sm:py-3.5 border-b border-stone-100/90 space-y-2.5 bg-white" data-tour="mis-search">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
            <div className="relative flex-1 min-w-0 flex h-10 overflow-hidden rounded-xl border border-stone-200/90 bg-white shadow-sm shadow-stone-900/5 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/15 transition-all">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none z-[1]" />
                <input
                  type="text"
                  placeholder="Search by name, email, company, or phone"
                  aria-label="Search directory"
                  className="w-full h-full min-w-0 pl-10 pr-9 bg-transparent border-0 outline-none ring-0 shadow-none text-sm font-medium text-stone-900 placeholder:text-stone-400"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
                />
                {draft.trim() ? (
                  <button
                    type="button"
                    onClick={() => { setDraft(''); setQ(''); setPage(1); }}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 z-[1]"
                    title="Clear search"
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>
            </div>
            <div className="inline-flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                className="btn-secondary h-10 justify-center shadow-sm shadow-stone-900/5 px-3.5 min-w-[6.75rem]"
                onClick={runSearch}
                disabled={loading}
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                {loading ? 'Searching' : 'Search'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraftFilters({ ...appliedFilters });
                  setShowFilters((v) => !v);
                }}
                className={`relative inline-flex h-10 w-10 sm:w-auto sm:px-3.5 items-center justify-center gap-2 rounded-xl font-semibold border shadow-sm shadow-stone-900/5 transition-all text-sm ${
                  showFilters || activeFilterCount > 0
                    ? 'border-brand-400 bg-brand-50 text-brand-800'
                    : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50 text-stone-700'
                }`}
                title="Refine results"
                aria-label="Refine results"
              >
                <Filter size={15} strokeWidth={1.75} />
                <span className="hidden sm:inline">Filters</span>
                {activeFilterCount > 0 ? (
                  <span className="absolute -top-1 -right-1 sm:static sm:relative inline-flex items-center justify-center min-w-[1.15rem] h-4 sm:h-5 px-1 sm:px-1.5 rounded-full sm:rounded bg-stone-900 text-white text-[9px] sm:text-[10px] font-bold tabular-nums">
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>
            </div>
          </div>

          {activeChips.length > 0 && !showFilters ? (
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-stone-400">Applied</span>
              {activeChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => clearOneFilter(chip.key)}
                  className="cand-filters-chip"
                  title={`Remove ${chip.label}`}
                >
                  <span className="cand-filters-chip-key">{chip.label}</span>
                  <span className="cand-filters-chip-val">{chip.value}</span>
                  <X size={11} className="opacity-70 flex-shrink-0" aria-hidden="true" />
                </button>
              ))}
              <button
                type="button"
                className="h-8 px-2.5 rounded-lg text-xs font-semibold text-stone-600 hover:bg-stone-100 inline-flex items-center gap-1"
                onClick={clearFilters}
              >
                <RotateCcw size={12} />
                Clear all
              </button>
            </div>
          ) : null}

          <MisAdvancedFilters
            show={showFilters}
            filters={draftFilters}
            onPatch={patchDraftFilter}
            onClearAll={clearFilters}
            onClearOne={clearOneFilter}
            onApply={applyFilters}
            filtersDirty={filtersDirty}
            isSearching={loading}
            activeFilterCount={activeFilterCount}
            positionFilterOptions={positionFilterOptions}
            clientFilterOptions={clientFilterOptions}
            sourceFilterOptions={sourceFilterOptions}
            productFilterOptions={productFilterOptions}
            statusFilterOptions={statusFilterOptions}
            expOptions={expOptions}
            ctcFilterOptions={ctcFilterOptions}
          />
        </div>

        <div className="relative min-h-[280px]" data-tour="mis-table">
          <div
            ref={tableScrollRef}
            className={`cand-table-scroll overflow-x-auto select-none transition-[filter,opacity] duration-300 ease-out ${
              showOverlay
                ? 'pointer-events-none select-none opacity-45 blur-[2.5px] saturate-75'
                : 'opacity-100 blur-0'
            }`}
            onMouseDown={showOverlay ? undefined : onTableDragScrollStart}
            onMouseMove={showOverlay ? undefined : onTableDragScrollMove}
            onMouseUp={showOverlay ? undefined : onTableDragScrollEnd}
            onMouseLeave={showOverlay ? undefined : onTableDragScrollEnd}
            onCopy={guardTableCopy}
            aria-busy={showOverlay}
          >
            <table
              className="cand-table-drag w-max min-w-full text-left border-collapse select-none border border-stone-200"
              role="table"
              aria-label="MIS contacts"
              style={{ tableLayout: 'auto' }}
            >
              <thead>
                <tr className="bg-stone-100">
                  <th scope="col" className="px-3.5 py-3.5 w-[52px] text-center border border-stone-200 bg-stone-100">
                    <button
                      type="button"
                      title={isPageSelected ? 'Deselect this page' : 'Select this page only'}
                      aria-label={isPageSelected ? 'Deselect this page' : 'Select this page only'}
                      onClick={togglePageSelection}
                      className="cursor-pointer flex justify-center mx-auto p-1 rounded hover:bg-stone-200/80"
                      disabled={showOverlay}
                    >
                      {isPageSelected ? (
                        <CheckSquare size={18} className="text-brand-600" aria-hidden="true" />
                      ) : isPagePartial ? (
                        <MinusSquare size={18} className="text-brand-500" aria-hidden="true" />
                      ) : (
                        <Square size={18} className="text-stone-400" aria-hidden="true" />
                      )}
                    </button>
                  </th>
                  {columns.map((column) => (
                    <th
                      scope="col"
                      key={column.key}
                      className={`px-3.5 py-3.5 text-[10px] font-bold text-stone-600 uppercase tracking-wider whitespace-nowrap border border-stone-200 bg-stone-100 ${column.className || ''}`}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && rows.length === 0 && Array.from({ length: 8 }).map((_, i) => (
                  <tr key={`sk-${i}`}>
                    <td className="px-3.5 py-3 border border-stone-200">
                      <div className="h-4 w-4 skeleton-ats rounded mx-auto" />
                    </td>
                    {columns.map((column) => (
                      <td key={column.key} className="px-3.5 py-3 border border-stone-200">
                        <div className="h-4 skeleton-ats rounded w-24 max-w-full" />
                      </td>
                    ))}
                  </tr>
                ))}
                {rows.map((row, index) => {
                  const id = String(row._id);
                  const isSelected = selected.has(id);
                  return (
                    <tr
                      key={id}
                      className={`transition-colors ${
                        isSelected ? 'bg-brand-50/80' : index % 2 === 0 ? 'bg-white' : 'bg-stone-50/40'
                      } hover:bg-brand-50/50`}
                    >
                      <td className="px-3.5 py-3 text-center w-[52px] border border-stone-200">
                        <button
                          type="button"
                          aria-label={isSelected ? `Deselect ${row.name || 'contact'}` : `Select ${row.name || 'contact'}`}
                          onClick={() => toggleOne(id)}
                          className="cursor-pointer flex justify-center mx-auto p-1 rounded hover:bg-stone-100"
                          disabled={showOverlay}
                        >
                          {isSelected
                            ? <CheckSquare className="text-brand-600" size={17} aria-hidden="true" />
                            : <Square className="text-stone-300 hover:text-stone-400" size={17} aria-hidden="true" />}
                        </button>
                      </td>
                      {columns.map((column) => (
                        <td
                          key={`${id}-${column.key}`}
                          className={`px-3.5 py-3 text-sm text-stone-700 font-medium border border-stone-200 align-middle whitespace-nowrap overflow-visible ${column.className || ''}`}
                        >
                          {column.render(row, index)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {rows.length === 0 && !loading && (
                  <tr>
                    <td colSpan={columns.length + 1} className="border border-stone-200">
                      {hasActiveFilters ? (
                        <EmptyState
                          icon={Search}
                          tone="amber"
                          message="No matching contacts"
                          subMessage="Adjust filters or clear the search to broaden results."
                        />
                      ) : (
                        <EmptyState
                          icon={Megaphone}
                          tone="teal"
                          message="No contacts in this desk"
                          subMessage={
                            user?.role === 'owner'
                              ? 'Import a spreadsheet or add a contact to build the organisation directory.'
                              : 'Add a contact or import a file with Name and Email to get started.'
                          }
                        />
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {showOverlay ? (
            <div
              className="absolute inset-0 z-20 flex items-center justify-center bg-gradient-to-b from-white/70 via-stone-50/75 to-white/80 backdrop-blur-[1px]"
              role="status"
              aria-live="polite"
              aria-label={overlayTitle}
            >
              <div className="pointer-events-none flex flex-col items-center gap-3.5 rounded-2xl border border-stone-200/90 bg-white/95 px-9 py-7 shadow-[0_18px_50px_-24px_rgba(15,23,42,0.45)] ring-1 ring-stone-900/5">
                <div className="relative h-11 w-11">
                  <span className="absolute inset-0 rounded-full border-2 border-brand-100" aria-hidden="true" />
                  <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand-600 animate-spin" aria-hidden="true" />
                  <span className="absolute inset-2 rounded-full border border-teal-200/80 opacity-70 animate-pulse" aria-hidden="true" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold tracking-tight text-stone-900">{overlayTitle}</p>
                  <p className="mt-1 text-xs font-medium text-stone-500">
                    {hasActiveFilters ? 'Applying your search and filters' : 'Refreshing the selected desk'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5" aria-hidden="true">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-bounce [animation-delay:-0.2s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-bounce [animation-delay:-0.1s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-bounce" />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-stone-100 bg-stone-50/50 px-4 sm:px-5 py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 min-w-0">
            <p className="text-xs sm:text-sm text-stone-500 font-medium">
              Showing{' '}
              <span className="text-stone-800 font-semibold tabular-nums">
                {rangeFrom.toLocaleString()}–{rangeTo.toLocaleString()}
              </span>
              {' '}of{' '}
              <span className="text-stone-800 font-semibold tabular-nums">{filteredCount.toLocaleString()}</span>
              {hasActiveFilters ? <span className="text-stone-400"> · filtered</span> : null}
            </p>
            <span className="hidden sm:inline text-stone-300" aria-hidden>|</span>
            <p className="text-xs sm:text-sm font-semibold text-stone-700 tabular-nums">
              Page <span className="text-brand-700">{safePage.toLocaleString()}</span>
              {' '}of{' '}
              <span className="text-stone-900">{totalPages.toLocaleString()}</span>
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => goToPage(1)}
              disabled={safePage <= 1 || loading}
              className="min-h-[44px] px-3 rounded-xl border-2 border-stone-200 bg-white text-sm font-semibold text-stone-700 hover:border-brand-300 disabled:opacity-40 transition-all"
              aria-label="First page"
            >
              First
            </button>
            <button
              type="button"
              onClick={() => goToPage(safePage - 1)}
              disabled={safePage <= 1 || loading}
              className="min-h-[44px] px-4 rounded-xl border-2 border-stone-200 bg-white text-sm font-semibold text-stone-700 hover:border-brand-300 disabled:opacity-40 transition-all"
            >
              Previous
            </button>

            <div className="flex items-center gap-1" role="navigation" aria-label="Pagination">
              {windowPages[0] > 1 ? (
                <span className="px-1 text-stone-400 text-sm select-none" aria-hidden>…</span>
              ) : null}
              {windowPages.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => goToPage(p)}
                  disabled={loading}
                  aria-current={p === safePage ? 'page' : undefined}
                  className={`min-h-[44px] min-w-[44px] rounded-xl text-sm font-semibold transition disabled:opacity-40 ${pageButtonClass(p === safePage)}`}
                >
                  {p}
                </button>
              ))}
              {windowPages[windowPages.length - 1] < totalPages ? (
                <span className="px-1 text-stone-400 text-sm select-none" aria-hidden>…</span>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => goToPage(safePage + 1)}
              disabled={safePage >= totalPages || loading}
              className="min-h-[44px] px-4 rounded-xl border-2 border-stone-200 bg-white text-sm font-semibold text-stone-700 hover:border-brand-300 disabled:opacity-40 transition-all"
            >
              Next
            </button>
            <button
              type="button"
              onClick={() => goToPage(totalPages)}
              disabled={safePage >= totalPages || loading}
              className="min-h-[44px] px-3 rounded-xl border-2 border-stone-200 bg-white text-sm font-semibold text-stone-700 hover:border-brand-300 disabled:opacity-40 transition-all"
              aria-label="Last page"
            >
              Last
            </button>
          </div>
        </div>
      </div>

      <CandidateEmailModal
        campaignOnly
        recipientNoun="contacts"
        showEmailModal={email.showEmailModal}
        emailRecipient={email.emailRecipient}
        setShowEmailModal={email.setShowEmailModal}
        bulkEmailRecipients={email.bulkEmailRecipients}
        setBulkEmailRecipients={email.setBulkEmailRecipients}
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
        isSendingEmail={email.isSendingEmail || campaignStarting}
        sendTemplateEmail={email.sendTemplateEmail}
        sendSingleEmail={email.sendSingleEmail}
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

      <Modal
        open={Boolean(uploadUi)}
        onClose={() => {
          if (uploading) return;
          setUploadUi(null);
        }}
        title={
          uploadUi?.phase === 'done'
            ? 'Upload results'
            : uploadUi?.phase === 'error'
              ? 'Upload issue'
              : uploadUi?.phase === 'processing'
                ? 'Importing rows'
                : 'Uploading MIS file'
        }
        description={
          uploadUi?.fileTotal > 1
            ? `File ${uploadUi.fileIndex || 1} of ${uploadUi.fileTotal} · ${uploadUi?.fileName || ''}`
            : (uploadUi?.fileName || 'Excel / CSV import')
        }
        size="md"
        icon={Upload}
        closeOnBackdrop={!uploading}
        zClass="z-[120]"
        footer={
          uploading ? null : (
            <button type="button" className="btn-primary" onClick={() => setUploadUi(null)}>
              Close
            </button>
          )
        }
      >
        {uploadUi ? (
          <div className="space-y-4">
            {(uploadUi.phase === 'upload' || uploadUi.phase === 'processing') ? (
              <>
                <div className="rounded-xl border border-stone-200 bg-gradient-to-br from-stone-50 to-white p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500">
                        {uploadUi.phase === 'upload' ? 'File transfer' : 'Row import'}
                      </p>
                      <p className="text-sm font-semibold text-stone-900 mt-0.5 truncate">
                        {uploadUi.phase === 'upload'
                          ? 'Uploading spreadsheet…'
                          : (uploadUi.totalRows
                            ? `Processed ${(uploadUi.processed || 0).toLocaleString()} of ${(uploadUi.totalRows || 0).toLocaleString()} rows`
                            : (uploadUi.message || 'Reading spreadsheet…'))}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-2xl font-bold tabular-nums text-brand-700 leading-none">
                        {uploadUi.phase === 'processing'
                          ? (uploadUi.totalRows
                            ? Math.min(100, Math.round(((uploadUi.processed || 0) / uploadUi.totalRows) * 100))
                            : (uploadUi.percent || 0))
                          : (uploadUi.percent || 0)}
                        <span className="text-sm font-semibold text-brand-500">%</span>
                      </p>
                      <p className="text-[10px] font-medium text-stone-400 mt-1 uppercase tracking-wider">
                        {uploadUi.phase === 'processing' ? 'Live' : 'Transfer'}
                      </p>
                    </div>
                  </div>
                  <div className="h-2.5 rounded-full bg-stone-100 overflow-hidden border border-stone-200/80">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 via-teal-600 to-brand-600 transition-[width] duration-300 ease-out"
                      style={{
                        width: `${Math.max(
                          3,
                          uploadUi.phase === 'processing' && uploadUi.totalRows
                            ? Math.min(100, Math.round(((uploadUi.processed || 0) / uploadUi.totalRows) * 100))
                            : (uploadUi.percent || 0)
                        )}%`,
                      }}
                    />
                  </div>
                  {uploadUi.phase === 'processing' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                      {[
                        { label: 'Added', value: uploadUi.created ?? 0, tone: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
                        { label: 'Duplicates', value: uploadUi.duplicates ?? 0, tone: 'text-sky-700 bg-sky-50 border-sky-100' },
                        { label: 'In-file', value: uploadUi.duplicatesInFile ?? 0, tone: 'text-violet-700 bg-violet-50 border-violet-100' },
                        { label: 'Failed', value: uploadUi.skipped ?? 0, tone: 'text-amber-700 bg-amber-50 border-amber-100' },
                      ].map((card) => (
                        <div key={card.label} className={`rounded-xl border px-2.5 py-2 ${card.tone}`}>
                          <p className="text-[9px] font-bold uppercase tracking-wider opacity-80">{card.label}</p>
                          <p className="text-base font-bold tabular-nums mt-0.5">{card.value}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-stone-500 leading-relaxed">
                      After the file finishes uploading, row import progress appears live (added / duplicates / failed).
                    </p>
                  )}
                </div>
              </>
            ) : null}

            {uploadUi.phase === 'done' && uploadUi.result ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">Import complete</p>
                  <p className="text-sm font-semibold text-stone-900 mt-1">
                    {(uploadUi.result.processed ?? 0).toLocaleString()} of {(uploadUi.result.totalRows ?? 0).toLocaleString()} rows handled.
                    Existing contacts were not overwritten.
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Added', value: uploadUi.result.created ?? 0, tone: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
                    {
                      label: 'Duplicates kept',
                      value: uploadUi.result.duplicates ?? 0,
                      tone: 'text-sky-700 bg-sky-50 border-sky-100',
                    },
                    {
                      label: 'In-file repeats',
                      value: uploadUi.result.duplicatesInFile ?? 0,
                      tone: 'text-violet-700 bg-violet-50 border-violet-100',
                    },
                    {
                      label: 'Failed / invalid',
                      value: uploadUi.result.skipped ?? 0,
                      tone: 'text-amber-700 bg-amber-50 border-amber-100',
                    },
                  ].map((card) => (
                    <div key={card.label} className={`rounded-xl border px-3 py-2.5 ${card.tone}`}>
                      <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">{card.label}</p>
                      <p className="text-lg font-bold tabular-nums mt-0.5">{card.value}</p>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-stone-600 leading-relaxed">{uploadUi.result.message}</p>
                {Array.isArray(uploadUi.result.errors) && uploadUi.result.errors.length ? (
                  <div className="rounded-xl border border-stone-200 bg-stone-50/80 max-h-36 overflow-y-auto p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                      Sample notes ({uploadUi.result.errors.length})
                    </p>
                    <ul className="space-y-1 text-xs text-stone-600">
                      {uploadUi.result.errors.slice(0, 12).map((err, i) => (
                        <li key={`${err.sheet || ''}-${err.row}-${i}`}>
                          {err.sheet ? `${err.sheet} · ` : ''}Row {err.row}: {err.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}

            {uploadUi.phase === 'error' ? (
              <div className="space-y-3">
                <p className="text-sm text-rose-700 font-medium">{uploadUi.error || 'Upload failed'}</p>
                {uploadUi.result && (uploadUi.result.created > 0 || uploadUi.result.duplicates > 0) ? (
                  <p className="text-sm text-stone-600">
                    Partial progress before the issue: {uploadUi.result.created || 0} added, {uploadUi.result.duplicates || 0} duplicates, {uploadUi.result.skipped || 0} failed.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <MisAddContactModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        toast={toast}
        onCreated={() => {
          setPage(1);
          load(1);
          loadStats();
        }}
      />

      <ConfirmationModal
        isOpen={pendingUploadFiles.length > 0}
        onClose={() => setPendingUploadFiles([])}
        onConfirm={() => {
          const files = pendingUploadFiles;
          if (files.length) onUploadMany(files);
        }}
        type="info"
        eyebrow="Import"
        title={pendingUploadFiles.length > 1 ? `Import ${pendingUploadFiles.length} files?` : 'Import contacts?'}
        message={
          pendingUploadFiles.length > 1
            ? `${pendingUploadFiles.length} spreadsheets will be imported in sequence. Each row requires Name and Email. Duplicate emails are skipped. Files: ${pendingUploadFiles.map((f) => f.name).slice(0, 5).join(', ')}${pendingUploadFiles.length > 5 ? ` +${pendingUploadFiles.length - 5} more` : ''}.`
            : `“${pendingUploadFiles[0]?.name || 'file'}” will be imported. Each row requires Name and Email. Duplicate emails are skipped.`
        }
        confirmText={pendingUploadFiles.length > 1 ? `Import ${pendingUploadFiles.length} files` : 'Import'}
        cancelText="Cancel"
        zClass="z-[140]"
      />

      {isOwner ? (
        <ConfirmationModal
          isOpen={exportOpen}
          onClose={() => { if (!exporting) setExportOpen(false); }}
          onConfirm={handleExport}
          type="info"
          eyebrow="Export"
          title="Export contacts to Excel?"
          message={
            selectedIds.length > 0
              ? `Download ${selectedIds.length.toLocaleString()} selected contact${selectedIds.length === 1 ? '' : 's'} as an Excel file.`
              : `Download ${filteredCount.toLocaleString()} contact${filteredCount === 1 ? '' : 's'} matching the current filters.`
          }
          confirmText={exporting ? 'Exporting…' : 'Download Excel'}
          cancelText="Cancel"
          isLoading={exporting}
          zClass="z-[140]"
        />
      ) : null}

      <ConfirmationModal
        isOpen={deleteConfirmOpen}
        onClose={() => { if (!deleting) setDeleteConfirmOpen(false); }}
        onConfirm={deleteSelected}
        type="delete"
        eyebrow="Bulk delete"
        title={`Delete ${selectedIds.length} contact${selectedIds.length === 1 ? '' : 's'}?`}
        message="Selected contacts will be removed from MIS. Candidate records are not affected."
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={deleting}
        zClass="z-[140]"
      />

      <ConfirmationModal
        isOpen={moveConfirmOpen}
        onClose={() => {
          if (moving) return;
          setMoveConfirmOpen(false);
          setMoveResult(null);
          setMoveIds([]);
        }}
        onConfirm={() => {
          if (moveResult) {
            setMoveConfirmOpen(false);
            setMoveResult(null);
            setMoveIds([]);
            return;
          }
          confirmMoveToCandidates();
        }}
        type={moveResult ? 'success' : 'info'}
        eyebrow="Transfer"
        title={moveResult ? 'Transfer complete' : `Move ${moveIds.length} contact${moveIds.length === 1 ? '' : 's'} to Candidates?`}
        message={
          moveResult
            ? (moveResult.message || 'Transfer complete.')
            : 'Creates candidate records from the selected contacts, then removes those contacts from MIS. Existing candidate emails and phone numbers are skipped.'
        }
        confirmText={moveResult ? 'Close' : 'Move to Candidates'}
        cancelText={moveResult ? undefined : 'Cancel'}
        showCancel={!moveResult}
        isLoading={moving}
        zClass="z-[140]"
        stats={moveResult ? [
          { label: 'Moved', value: moveResult.moved ?? 0, tone: 'emerald' },
          { label: 'Already there', value: moveResult.skippedDuplicate ?? 0, tone: 'amber' },
          { label: 'Skipped', value: moveResult.skippedInvalid ?? 0, tone: 'red' },
        ] : [
          { label: 'Selected', value: moveIds.length, tone: 'brand' },
        ]}
      />

      <ConfirmationModal
        isOpen={whatsAppConfirmOpen}
        onClose={() => { setWhatsAppConfirmOpen(false); setWhatsAppTargets([]); }}
        onConfirm={openWhatsAppTabs}
        type="info"
        eyebrow="WhatsApp"
        title="Open WhatsApp"
        message={`Open WhatsApp for ${whatsAppTargets.length} contact${whatsAppTargets.length === 1 ? '' : 's'}? Each conversation opens in a new tab.`}
        confirmText="Open WhatsApp"
        cancelText="Cancel"
        zClass="z-[140]"
      />

      <ConfirmationModal
        isOpen={consentBulkConfirmOpen}
        onClose={() => {
          if (consentBulkSaving) return;
          setConsentBulkConfirmOpen(false);
          setConsentBulk(null);
        }}
        onConfirm={confirmBulkConsent}
        type="info"
        eyebrow="Marketing consent"
        title={consentBulk ? 'Enable consent?' : 'Remove consent?'}
        message={
          consentBulk
            ? `Enable marketing consent for ${selectedIds.length} selected contact${selectedIds.length === 1 ? '' : 's'}. Unsubscribed flags are cleared when consent is enabled.`
            : `Remove marketing consent for ${selectedIds.length} selected contact${selectedIds.length === 1 ? '' : 's'}. They will be excluded from marketing campaigns.`
        }
        confirmText={consentBulk ? 'Enable consent' : 'Remove consent'}
        cancelText="Cancel"
        isLoading={consentBulkSaving}
        zClass="z-[140]"
      />

      <MisBulkEditModal
        open={bulkEditOpen}
        onClose={() => { if (!bulkEditing) setBulkEditOpen(false); }}
        selectedCount={selectedIds.length}
        onSubmit={submitBulkEdit}
        isLoading={bulkEditing}
      />

      <Modal
        open={rankOpen}
        onClose={() => setRankOpen(false)}
        title="Match MIS to a job"
        description="Pick an open job to rank your MIS directory by fit, then email or WhatsApp the shortlist."
        size="workbench"
        fillHeight
        icon={Sparkles}
        bodyClassName="p-0 flex-1 min-h-0 flex flex-col overflow-hidden bg-white"
      >
        {rankOpen ? (
          <TalentMatchDesk initialSource="mis" sources={['mis']} embedded />
        ) : null}
      </Modal>

      <TourHelpFab
        onClick={() => setTourOpen(true)}
        label={t('common.takeTour')}
        title={t('pages.mis.tourTitle')}
      />
      <ProductTour
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        steps={MIS_TOUR_STEPS}
        storageKey={MIS_TOUR_KEY}
      />
    </div>
  );
}
