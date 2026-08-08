'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  createColumnHelper,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import * as ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Plus, Search, Filter, MoreVertical, Mail, ChevronLeft, ChevronRight,
  Columns3, FileSpreadsheet, FileText, Sparkles, Users, Star, FileText as FileTextIcon,
  MessageCircle, Phone, Calendar, FileCheck, Trash2, Eye, Edit3, Send, Copy,
  Linkedin, Github, ExternalLink, Archive, MoreHorizontal, X, RefreshCw, CheckCircle2, Upload
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import PageShell from '@/components/ui/PageShell';
import { useLocale } from '@/components/providers/LocaleProvider';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { required, email as validateEmail } from '@/lib/validation';
import { PermissionGate } from '@/components/PermissionGate';
import { CandidateCsvImport } from '@/components/dashboard/CandidateCsvImport';

// Portal Dropdown Component - Clean Professional Style (No Animation)
function ActionDropdownPortal({
  isOpen,
  onClose,
  candidate,
  onCopy,
  onEdit,
  onDelete,
}: {
  isOpen: boolean;
  onClose: () => void;
  candidate: { id: string; name: string; email?: string; phone?: string };
  onCopy: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useLocale();
  const [position, setPosition] = useState<{ top?: number; bottom?: number; right: number }>({ right: 20 });
  const portalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      const button = document.getElementById(`action-btn-${candidate.id}`);
      if (button) {
        const rect = button.getBoundingClientRect();
        const dropdownHeight = 280; // Approximate max height
        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;

        // Smart positioning: show above if not enough space below
        let newPosition: { top?: number; bottom?: number; right: number };
        if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
          // Position above the button
          newPosition = {
            bottom: viewportHeight - rect.top + 8,
            right: window.innerWidth - rect.right,
          };
        } else {
          // Position below the button
          newPosition = {
            top: rect.bottom + 8,
            right: window.innerWidth - rect.right,
          };
        }
        setPosition(newPosition);
      }
    }
  }, [isOpen, candidate.id]);

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      {/* Dropdown Menu - Clean Professional Style (No Animation) */}
      <div
        ref={portalRef}
        className="fixed w-60 rounded-xl border border-stone-200 bg-white shadow-2xl z-50 overflow-hidden"
        style={{
          ...(position.top !== undefined ? { top: position.top } : {}),
          ...(position.bottom !== undefined ? { bottom: position.bottom } : {}),
          right: Math.max(8, position.right),
          maxHeight: 'calc(100vh - 40px)',
          maxWidth: 'calc(100vw - 16px)',
        }}
      >
        {/* Premium Header - Brand Gradient */}
        <div className="px-4 py-3 bg-gradient-to-r from-brand-600 to-teal-600 rounded-t-xl">
          <p className="text-xs font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-white/80" />
            {t('candidates.actions.moreActions')}
          </p>
        </div>

        {/* Actions List */}
        <div className="py-2">
          {/* External Links */}
          <div className="px-3">
            <p className="px-1 pb-1 pt-0.5 text-[10px] font-bold text-stone-400 uppercase tracking-widest">{t('candidates.actions.external')}</p>
            <a
              href={`https://linkedin.com/search/results/people/?keywords=${encodeURIComponent(candidate.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-3 px-2 py-2.5 hover:bg-sky-50 rounded-lg text-sm text-stone-700 transition-colors group"
            >
              <div className="w-7 h-7 rounded-lg bg-sky-100 flex items-center justify-center flex-shrink-0">
                <Linkedin className="w-3.5 h-3.5 text-[#0077b5]" />
              </div>
              <span className="flex-1 font-medium">{t('candidates.actions.linkedIn')}</span>
              <ExternalLink className="w-3 h-3 text-stone-300 group-hover:text-sky-500 flex-shrink-0" />
            </a>
          </div>

          <div className="h-px bg-stone-100 mx-3 my-1.5" />

          {/* Manage Actions */}
          <div className="px-3">
            <p className="px-1 pb-1 text-[10px] font-bold text-stone-400 uppercase tracking-widest">{t('candidates.actions.manage')}</p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
                onClose();
              }}
              className="w-full flex items-center gap-3 px-2 py-2.5 hover:bg-blue-50 rounded-lg text-sm text-stone-700 text-left transition-colors"
            >
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Edit3 className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <span className="font-medium">{t('candidates.actions.edit')}</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCopy();
                onClose();
              }}
              className="w-full flex items-center gap-3 px-2 py-2.5 hover:bg-amber-50 rounded-lg text-sm text-stone-700 text-left transition-colors"
            >
              <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Copy className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <span className="font-medium">{t('candidates.actions.copyInfo')}</span>
            </button>
          </div>

          {/* Danger Zone */}
          <PermissionGate permission="DELETE_CANDIDATE">
            <div className="border-t border-red-100 bg-gradient-to-r from-red-50/40 to-rose-50/40 mt-2 pt-0.5 rounded-b-xl">
              <div className="px-3 py-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 px-2 py-2.5 hover:bg-red-100/70 text-sm text-red-600 text-left transition-colors rounded-lg"
                >
                  <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  </div>
                  <span className="font-semibold">{t('candidates.actions.delete')}</span>
                </button>
              </div>
            </div>
          </PermissionGate>
        </div>
      </div>
    </>,
    document.body
  );
}

type CandidatesColumnId = 'candidate' | 'position' | 'experience' | 'source' | 'status' | 'assessmentScore' | 'smartMatch' | 'actions';
const ALL_COLUMNS_VISIBLE: Record<CandidatesColumnId, boolean> = {
  candidate: true,
  position: true,
  experience: true,
  source: true,
  status: true,
  assessmentScore: true,
  smartMatch: true,
  actions: true,
};

const PER_PAGE = 8;
const statusColors: Record<string, string> = {
  Applied: 'bg-brand-100 text-brand-700',
  Screening: 'bg-warm-100 text-warm-700',
  Interview: 'bg-amber-100 text-amber-700',
  Offer: 'bg-emerald-100 text-emerald-700',
  Hired: 'bg-green-100 text-green-700',
  Joined: 'bg-brand-100 text-brand-700',
  Rejected: 'bg-red-100 text-red-700',
};

/** Mock Smart Match score 65–98 based on id for demo. */
function getSmartMatchScore(id: string): number {
  let n = 0;
  for (let i = 0; i < id.length; i++) n += id.charCodeAt(i);
  return 65 + (n % 34);
}

type Candidate = {
  id: string;
  name: string;
  email?: string;
  position?: string;
  experience?: number | null;
  source?: string;
  status?: string;
  createdAt?: string;
  phone?: string;
  smartMatch?: number;
  assessmentScore?: number | null;
  assessmentPassed?: boolean | null;
};

export default function CandidatesPage() {
  const { t } = useLocale();
  const toast = useToast();
  const [columnVisibility, setColumnVisibility] = useState<Record<CandidatesColumnId, boolean>>(ALL_COLUMNS_VISIBLE);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [columnsDropdownPos, setColumnsDropdownPos] = useState<{ top?: number; bottom?: number; left?: number; right?: number }>({});
  const columnsButtonRef = useRef<HTMLButtonElement>(null);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: PER_PAGE });
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPosition, setFormPosition] = useState('');
  const [formExperience, setFormExperience] = useState('');
  const [formSource, setFormSource] = useState('LinkedIn');
  const [formPhone, setFormPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<{ name?: string; email?: string }>({});
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({
    skills: '',
    skillIds: [] as string[],
    experience: '',
    source: '',
    status: '',
    minAssessmentScore: '',
    sortBy: '' as '' | 'assessmentScore',
  });
  const [taxonomySkills, setTaxonomySkills] = useState<Array<{ id: string; name: string }>>([]);

  const [data, setData] = useState<Candidate[]>([]);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  
  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<Candidate | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  
  // Delete confirmation state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<Candidate | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const fetchCandidates = async (opts?: { minAssessmentScore?: string; sortBy?: string }) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const minScore = opts?.minAssessmentScore ?? advancedFilters.minAssessmentScore;
      const sortBy = opts?.sortBy ?? advancedFilters.sortBy;
      if (minScore) params.set('minAssessmentScore', minScore);
      if (sortBy) {
        params.set('sortBy', sortBy);
        params.set('sortDir', 'desc');
      }
      const qs = params.toString();
      const res = await fetch(`/api/candidates${qs ? `?${qs}` : ''}`, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      const list = json.candidates ?? json.candidatesList ?? [];
      const mapped: Candidate[] = (Array.isArray(list) ? list : []).map((c: any) => ({
        id: String(c.id),
        name: c.name,
        email: c.email,
        position: c.position,
        experience: c.experience ?? null,
        source: c.source,
        status: c.status,
        createdAt: c.createdAt,
        phone: c.phone,
        smartMatch: getSmartMatchScore(String(c.id)),
        assessmentScore: c.assessmentScore ?? null,
        assessmentPassed: c.assessmentPassed ?? null,
      }));
      setData(mapped);
    } catch {
      setData([]);
      toast.error(t('common.error') || 'Failed to load candidates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
    // Force reset column visibility to ensure Experience column is visible
    setColumnVisibility(ALL_COLUMNS_VISIBLE);
    fetch('/api/skills?limit=200', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.skills) {
          setTaxonomySkills(d.skills.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));
        }
      })
      .catch(() => {});
  }, []);

  // Edit candidate handlers
  const openEditModal = (candidate: Candidate) => {
    setEditFormData({ ...candidate });
    setEditModalOpen(true);
    setActionMenuOpen(null);
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditFormData(null);
    setEditSubmitting(false);
  };

  const handleEditSubmit = async () => {
    if (!editFormData?.id || !editFormData?.name) return;
    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/candidates/${editFormData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: editFormData.name,
          email: editFormData.email,
          phone: editFormData.phone,
        }),
      });
      if (res.ok) {
        toast.success(t('toast.candidates.updated'));
        closeEditModal();
        fetchCandidates();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('toast.candidates.updateFailed'));
      }
    } catch {
      toast.error(t('toast.candidates.updateFailed'));
    } finally {
      setEditSubmitting(false);
    }
  };

  // Delete candidate handlers
  const openDeleteModal = (candidate: Candidate) => {
    setDeleteCandidate(candidate);
    setDeleteModalOpen(true);
    setActionMenuOpen(null);
  };

  const closeDeleteModal = () => {
    setDeleteModalOpen(false);
    setDeleteCandidate(null);
    setDeleteSubmitting(false);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteCandidate?.id) return;
    setDeleteSubmitting(true);
    try {
      const res = await fetch(`/api/candidates/${deleteCandidate.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        toast.success(t('toast.candidates.deleted'));
        closeDeleteModal();
        fetchCandidates();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('toast.candidates.deleteFailed'));
      }
    } catch {
      toast.error(t('toast.candidates.deleteFailed'));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const applyAdvancedFilters = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (globalFilter) params.append('q', globalFilter);
      if (advancedFilters.skills) params.append('skills', advancedFilters.skills);
      if (advancedFilters.skillIds.length > 0) {
        params.append('skillIds', advancedFilters.skillIds.join(','));
      }
      if (advancedFilters.experience) params.append('experience', advancedFilters.experience);
      if (advancedFilters.source) params.append('source', advancedFilters.source);
      if (advancedFilters.status) params.append('stage', advancedFilters.status);

      const res = await fetch(`/api/candidates/search?${params}`, { credentials: 'include' });
      const data = await res.json();
      const list = data.candidates || [];
      const mapped: Candidate[] = list.map((c: any) => ({
        id: String(c.id),
        name: c.name,
        email: c.email,
        position: c.position ?? '',
        experience: c.experience ?? null,
        source: c.source,
        status: c.status || 'New',
        createdAt: c.createdAt,
        phone: c.phone,
        smartMatch: getSmartMatchScore(String(c.id)),
      }));
      setData(mapped);
      toast.success(t('toast.candidates.searchApplied'), t('toast.candidates.searchResults', { count: String(mapped.length) }));
    } catch {
      toast.error(t('toast.candidates.searchFailed'), t('toast.candidates.searchFailedDesc'));
    } finally {
      setLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    if (!globalFilter.trim()) return data;
    const q = globalFilter.toLowerCase().trim();
    return data.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.position && c.position.toLowerCase().includes(q)) ||
        (c.source && c.source.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
    );
  }, [data, globalFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredData.length / pagination.pageSize));
  const safePageIndex = Math.min(pagination.pageIndex, pageCount - 1);
  const pageStart = safePageIndex * pagination.pageSize;
  const pageData = useMemo(
    () => filteredData.slice(pageStart, pageStart + pagination.pageSize),
    [filteredData, pageStart, pagination.pageSize]
  );

  const columnHelper = createColumnHelper<Candidate>();

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        id: 'candidate',
        header: () => t('candidates.candidate'),
        cell: ({ row }) => (
          <Link href={`/dashboard/candidates/${row.original.id}`} className="flex items-center gap-3 group">
            <motion.div
              layoutId={`candidate-avatar-${row.original.id}`}
              whileHover={{ scale: 1.05 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 flex items-center justify-center font-bold text-brand-700 text-sm border border-brand-200/50"
            >
              {row.original.name[0]}
            </motion.div>
            <div>
              <p className="font-semibold text-stone-900 group-hover:text-brand-600">{row.original.name}</p>
              <p className="text-xs text-stone-500 sm:hidden mt-0.5">{row.original.position}</p>
            </div>
          </Link>
        ),
      }),
      columnHelper.accessor('position', {
        id: 'position',
        header: () => t('candidates.position'),
        cell: (info) => <span className="font-medium text-stone-600">{info.getValue()}</span>,
      }),
      columnHelper.accessor('experience', {
        id: 'experience',
        header: () => t('candidates.experience') || 'Experience',
        cell: (info) => {
          const exp = info.getValue();
          if (exp === null || exp === undefined) return <span className="text-stone-400">-</span>;
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700">
              {exp} {exp === 1 ? 'year' : 'years'}
            </span>
          );
        },
      }),
      columnHelper.accessor('source', {
        id: 'source',
        header: () => t('candidates.source'),
        cell: (info) => <span className="text-stone-500">{info.getValue()}</span>,
      }),
      columnHelper.accessor('status', {
        id: 'status',
        header: () => t('candidates.status'),
        cell: (info) => {
          const status = info.getValue() as string | undefined;
          return (
            <span
              className={`inline-flex px-3 py-1.5 rounded-lg text-xs font-bold ${
                status && statusColors[status] ? statusColors[status] : 'bg-stone-100 text-stone-700'
              }`}
            >
              {status ?? ''}
            </span>
          );
        },
      }),
      columnHelper.accessor((row) => row.assessmentScore ?? null, {
        id: 'assessmentScore',
        header: () => 'Assessment',
        cell: ({ row }) => {
          const v = row.original.assessmentScore;
          if (v == null) return <span className="text-stone-400 text-xs">—</span>;
          const passed = row.original.assessmentPassed;
          return (
            <span
              className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-bold ${
                passed ? 'bg-emerald-50 text-emerald-700' : passed === false ? 'bg-red-50 text-red-700' : 'bg-stone-100 text-stone-700'
              }`}
            >
              {Math.round(v)}%
            </span>
          );
        },
      }),
      columnHelper.accessor((row) => row.smartMatch ?? 0, {
        id: 'smartMatch',
        header: () => (
          <span className="inline-flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            {t('candidates.smartMatch')}
          </span>
        ),
        cell: ({ getValue }) => {
          const v = getValue();
          const high = v >= 85;
          const mid = v >= 70;
          return (
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                high ? 'bg-emerald-100 text-emerald-700' : mid ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-600'
              }`}
            >
              {v}%
            </span>
          );
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: () => null,
        cell: () => null, // Custom HTML table handles actions rendering
      }),
    ],
    [t]
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      columnFilters,
      globalFilter,
      columnVisibility: { ...(columnVisibility as Record<string, boolean>), experience: true },
      pagination,
    },
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: (updater) => setPagination((prev) => (typeof updater === 'function' ? updater(prev) : prev)),
    onColumnVisibilityChange: () => {},
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const exportExcel = async () => {
    const rows = filteredData.map((c) => ({
      [t('candidates.candidate')]: c.name,
      [t('candidates.position')]: c.position,
      [t('candidates.experience') || 'Experience']: c.experience !== null && c.experience !== undefined ? `${c.experience} years` : '-',
      [t('candidates.source')]: c.source,
      [t('candidates.status')]: c.status,
      [t('candidates.smartMatch')]: `${c.smartMatch ?? 0}%`,
    }));
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Candidates');
    const headers = Object.keys(rows[0] ?? {
      Candidate: '',
      Position: '',
      Experience: '',
      Source: '',
      Status: '',
      Match: '',
    });
    worksheet.columns = headers.map((header) => ({ header, key: header, width: 20 }));
    for (const row of rows) {
      worksheet.addRow(row);
    }
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'candidates.xlsx';
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('candidates.exportExcelSuccess'), t('candidates.exportExcelDone'));
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    const rows = filteredData.map((c) => [
      c.name ?? '',
      c.position ?? '',
      c.experience !== null && c.experience !== undefined ? `${c.experience} years` : '-',
      c.source ?? '',
      c.status ?? '',
      `${c.smartMatch ?? 0}%`,
    ]);
    autoTable(doc, {
      head: [[t('candidates.candidate'), t('candidates.position'), t('candidates.experience') || 'Experience', t('candidates.source'), t('candidates.status'), t('candidates.smartMatch')]],
      body: rows,
      theme: 'striped',
      headStyles: { fillColor: [13, 148, 136] },
    });
    doc.save('candidates.pdf');
    toast.success(t('candidates.exportExcelSuccess'), t('candidates.exportPDFDone'));
  };

  const columnIds: { id: CandidatesColumnId; label: string }[] = [
    { id: 'candidate', label: t('candidates.candidate') },
    { id: 'position', label: t('candidates.position') },
    { id: 'experience', label: t('candidates.experience') || 'Experience' },
    { id: 'source', label: t('candidates.source') },
    { id: 'status', label: t('candidates.status') },
    { id: 'assessmentScore', label: 'Assessment' },
    { id: 'smartMatch', label: t('candidates.smartMatch') },
    { id: 'actions', label: t('candidates.actions') },
  ];

  return (
    <PageShell>
      {/* --- Section: Candidates Root - start --- */}
      <PageHeader
        icon={Users}
        title={t('candidates.title')}
        subtitle={loading ? '...' : `${data.length} ${t('candidates.totalCount')}`}
      >
        <PermissionGate permission="CREATE_CANDIDATE">
          <div className="flex flex-wrap items-center gap-2">
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setImportModalOpen(true)}
              className="btn-secondary !px-5 !py-3.5 inline-flex items-center justify-center gap-2"
            >
              <Upload className="w-5 h-5 text-brand-600" />
              Import CSV
            </motion.button>
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setAddModalOpen(true)}
              className="btn-primary !px-6 !py-3.5 inline-flex items-center justify-center gap-2.5"
            >
              <Plus className="w-5 h-5" />
              {t('candidates.addCandidate')}
            </motion.button>
          </div>
        </PermissionGate>
      </PageHeader>

      <CandidateCsvImport
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImported={() => { void fetchCandidates(); }}
      />

      <div
        className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-[var(--shadow-card)] min-h-[320px]"
      >
        <div className="p-4 sm:p-6 border-b border-stone-100 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
          <div className="relative flex-1 min-w-0 w-full sm:min-w-[200px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder={t('candidates.searchPlaceholder')}
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 outline-none text-sm font-medium text-stone-900 placeholder:text-stone-400 transition-all"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold border-2 transition-all text-sm ${
                showAdvancedFilters 
                  ? 'border-brand-500 bg-brand-50 text-brand-700' 
                  : 'border-stone-200 hover:border-brand-300 hover:bg-brand-50/50 text-stone-700'
              }`}
            >
              <Filter className="w-4 h-4" />
              Advanced Search
            </motion.button>
            <div className="relative">
              <motion.button
                ref={columnsButtonRef}
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  if (!columnsOpen && columnsButtonRef.current) {
                    const rect = columnsButtonRef.current.getBoundingClientRect();
                    const dropdownWidth = 220;
                    const dropdownHeight = 320;
                    const viewportWidth = window.innerWidth;
                    const viewportHeight = window.innerHeight;
                    const spaceRight = viewportWidth - rect.left;
                    const spaceBelow = viewportHeight - rect.bottom;
                    const pos: typeof columnsDropdownPos = {};
                    // Vertical
                    if (spaceBelow < dropdownHeight && rect.top > spaceBelow) {
                      pos.bottom = viewportHeight - rect.top + 8;
                    } else {
                      pos.top = rect.bottom + 8;
                    }
                    // Horizontal: prefer aligning to left edge of button, but clamp
                    if (spaceRight >= dropdownWidth) {
                      pos.left = Math.min(rect.left, viewportWidth - dropdownWidth - 8);
                    } else {
                      pos.left = Math.max(8, rect.right - dropdownWidth);
                    }
                    setColumnsDropdownPos(pos);
                  }
                  setColumnsOpen((o) => !o);
                }}
                className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold border-2 transition-all text-sm ${
                  columnsOpen
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-stone-200 hover:border-stone-300 text-stone-700'
                }`}
              >
                <Columns3 className="w-4 h-4" />
                {t('candidates.columns')}
              </motion.button>
              {columnsOpen && createPortal(
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setColumnsOpen(false)} />
                  <div
                    className="fixed z-50 w-56 rounded-xl border border-stone-200 bg-white shadow-2xl overflow-hidden"
                    style={{
                      ...(columnsDropdownPos.top !== undefined ? { top: columnsDropdownPos.top } : {}),
                      ...(columnsDropdownPos.bottom !== undefined ? { bottom: columnsDropdownPos.bottom } : {}),
                      ...(columnsDropdownPos.left !== undefined ? { left: columnsDropdownPos.left } : {}),
                      ...(columnsDropdownPos.right !== undefined ? { right: columnsDropdownPos.right } : {}),
                      maxHeight: 'calc(100vh - 40px)',
                      maxWidth: 'calc(100vw - 16px)',
                    }}
                  >
                    {/* Premium header */}
                    <div className="px-4 py-3 bg-gradient-to-r from-brand-600 to-teal-600">
                      <p className="text-xs font-semibold text-white flex items-center gap-2">
                        <Columns3 className="w-3.5 h-3.5 text-white/80" />
                        {t('candidates.columns')}
                      </p>
                    </div>
                    <div className="py-1.5 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 120px)' }}>
                      {columnIds.map(({ id, label }) => (
                        <label
                          key={id}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-stone-50 cursor-pointer group"
                        >
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                            columnVisibility[id]
                              ? 'bg-brand-500 border-brand-500'
                              : 'border-stone-300 group-hover:border-brand-400'
                          }`}>
                            {columnVisibility[id] && (
                              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8">
                                <path d="M1 4l2.5 2.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                            <input
                              type="checkbox"
                              checked={columnVisibility[id]}
                              onChange={() => {
                                setColumnVisibility((prev) => {
                                  const next = { ...prev, [id]: !prev[id] };
                                  if (Object.values(next).every((v) => !v)) next[id] = true;
                                  return next;
                                });
                              }}
                              className="sr-only"
                            />
                          </div>
                          <span className={`text-sm font-medium transition-colors ${columnVisibility[id] ? 'text-stone-900' : 'text-stone-500'}`}>{label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="px-4 py-3 border-t border-stone-100 bg-stone-50/50">
                      <button
                        type="button"
                        onClick={() => setColumnVisibility(ALL_COLUMNS_VISIBLE)}
                        className="w-full py-2 rounded-lg text-xs font-semibold text-brand-600 hover:bg-brand-50 border border-brand-200 transition-colors"
                      >
                        Reset to Default
                      </button>
                    </div>
                  </div>
                </>,
                document.body
              )}
            </div>
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={exportExcel}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold border-2 border-stone-200 hover:border-emerald-400 hover:bg-emerald-50/50 text-stone-700 text-sm transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" />
              {t('candidates.exportExcel')}
            </motion.button>
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={exportPDF}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold border-2 border-stone-200 hover:border-red-400 hover:bg-red-50/50 text-stone-700 text-sm transition-all"
            >
              <FileText className="w-4 h-4" />
              {t('candidates.exportPDF')}
            </motion.button>
          </div>
        </div>

        {/* Advanced Search Panel */}
        {showAdvancedFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 sm:px-6 py-4 border-b border-stone-100 bg-gradient-to-r from-brand-50/50 to-stone-50"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Skills (taxonomy)</label>
                <div className="flex flex-wrap gap-1.5 mb-2 max-h-24 overflow-y-auto">
                  {taxonomySkills.slice(0, 80).map((s) => {
                    const on = advancedFilters.skillIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() =>
                          setAdvancedFilters((prev) => ({
                            ...prev,
                            skillIds: on
                              ? prev.skillIds.filter((id) => id !== s.id)
                              : [...prev.skillIds, s.id],
                          }))
                        }
                        className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                          on
                            ? 'bg-brand-600 text-white border-brand-600'
                            : 'bg-white text-stone-600 border-stone-200 hover:border-brand-300'
                        }`}
                      >
                        {s.name}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="text"
                  placeholder="Or free-text skills: React, Node.js…"
                  value={advancedFilters.skills}
                  onChange={(e) => setAdvancedFilters({ ...advancedFilters, skills: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Experience</label>
                <select
                  value={advancedFilters.experience}
                  onChange={(e) => setAdvancedFilters({ ...advancedFilters, experience: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
                >
                  <option value="">Any experience</option>
                  <option value="0-2">0-2 years</option>
                  <option value="3-5">3-5 years</option>
                  <option value="6-10">6-10 years</option>
                  <option value="10+">10+ years</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Source</label>
                <select
                  value={advancedFilters.source}
                  onChange={(e) => setAdvancedFilters({ ...advancedFilters, source: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
                >
                  <option value="">All sources</option>
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="Indeed">Indeed</option>
                  <option value="Referral">Referral</option>
                  <option value="Company Website">Company Website</option>
                  <option value="Glassdoor">Glassdoor</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Status</label>
                <select
                  value={advancedFilters.status}
                  onChange={(e) => setAdvancedFilters({ ...advancedFilters, status: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
                >
                  <option value="">All stages</option>
                  <option value="APPLIED">Applied</option>
                  <option value="SCREENING">Screening</option>
                  <option value="INTERVIEW">Interview</option>
                  <option value="OFFER">Offer</option>
                  <option value="HIRED">Hired</option>
                  <option value="JOINED">Joined</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Min assessment %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="e.g. 70"
                  value={advancedFilters.minAssessmentScore}
                  onChange={(e) => setAdvancedFilters({ ...advancedFilters, minAssessmentScore: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Sort by</label>
                <select
                  value={advancedFilters.sortBy}
                  onChange={(e) =>
                    setAdvancedFilters({
                      ...advancedFilters,
                      sortBy: e.target.value === 'assessmentScore' ? 'assessmentScore' : '',
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
                >
                  <option value="">Newest first</option>
                  <option value="assessmentScore">Assessment score</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  void applyAdvancedFilters();
                  void fetchCandidates({
                    minAssessmentScore: advancedFilters.minAssessmentScore,
                    sortBy: advancedFilters.sortBy,
                  });
                }}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-semibold hover:bg-brand-700 transition-colors"
              >
                Apply Filters
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setAdvancedFilters({
                    skills: '',
                    skillIds: [],
                    experience: '',
                    source: '',
                    status: '',
                    minAssessmentScore: '',
                    sortBy: '',
                  });
                  fetchCandidates({ minAssessmentScore: '', sortBy: '' });
                }}
                className="px-4 py-2 border border-stone-300 text-stone-600 rounded-lg text-sm font-medium hover:bg-stone-50 transition-colors"
              >
                Clear
              </motion.button>
            </div>
          </motion.div>
        )}

        {loading ? (
          <div className="p-6 space-y-4 animate-pulse">
            <div className="h-10 bg-stone-100 rounded-lg w-full" />
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="h-14 bg-stone-50 rounded-lg w-full" />
            ))}
          </div>
        ) : (
        <>
        {/* Professional Table Container */}
        <div className="overflow-x-auto border border-stone-200 rounded-xl bg-white shadow-sm" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className="w-full border-collapse" style={{ minWidth: '820px' }}>
            <colgroup>
              {columnVisibility.candidate && <col style={{ width: '22%', minWidth: '200px' }} />}
              {columnVisibility.position && <col style={{ width: '16%', minWidth: '130px' }} />}
              {columnVisibility.experience && <col style={{ width: '11%', minWidth: '110px' }} />}
              {columnVisibility.source && <col style={{ width: '12%', minWidth: '100px' }} />}
              {columnVisibility.status && <col style={{ width: '10%', minWidth: '90px' }} />}
              {columnVisibility.smartMatch && <col style={{ width: '11%', minWidth: '120px' }} />}
              {columnVisibility.actions && <col style={{ width: '18%', minWidth: '150px' }} />}
            </colgroup>
            <thead>
              <tr className="bg-stone-50 border-b-2 border-stone-200">
                {columnVisibility.candidate && (
                  <th className="text-left py-3 px-4 text-xs font-bold text-stone-600 uppercase tracking-wider border-r border-stone-100 whitespace-nowrap">
                    <span className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-5 h-5 rounded-md bg-brand-50 border border-brand-200/70 flex-shrink-0">
                        <Users className="w-3 h-3 text-brand-600" />
                      </span>
                      {t('candidates.candidate')}
                    </span>
                  </th>
                )}
                {columnVisibility.position && (
                  <th className="text-left py-3 px-4 text-xs font-bold text-stone-600 uppercase tracking-wider border-r border-stone-100 whitespace-nowrap">
                    <span className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-5 h-5 rounded-md bg-brand-50 border border-brand-200/70 flex-shrink-0">
                        <FileTextIcon className="w-3 h-3 text-brand-600" />
                      </span>
                      {t('candidates.position')}
                    </span>
                  </th>
                )}
                {columnVisibility.experience && (
                  <th className="text-left py-3 px-4 text-xs font-bold text-stone-600 uppercase tracking-wider border-r border-stone-100 whitespace-nowrap">
                    <span className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-5 h-5 rounded-md bg-brand-50 border border-brand-200/70 flex-shrink-0">
                        <Star className="w-3 h-3 text-brand-600" />
                      </span>
                      {t('candidates.experience') || 'Experience'}
                    </span>
                  </th>
                )}
                {columnVisibility.source && (
                  <th className="text-left py-3 px-4 text-xs font-bold text-stone-600 uppercase tracking-wider border-r border-stone-100 whitespace-nowrap">
                    <span className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-5 h-5 rounded-md bg-brand-50 border border-brand-200/70 flex-shrink-0">
                        <ExternalLink className="w-3 h-3 text-brand-600" />
                      </span>
                      {t('candidates.source')}
                    </span>
                  </th>
                )}
                {columnVisibility.status && (
                  <th className="text-left py-3 px-4 text-xs font-bold text-stone-600 uppercase tracking-wider border-r border-stone-100 whitespace-nowrap">
                    <span className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-5 h-5 rounded-md bg-brand-50 border border-brand-200/70 flex-shrink-0">
                        <CheckCircle2 className="w-3 h-3 text-brand-600" />
                      </span>
                      {t('candidates.status') || 'Status'}
                    </span>
                  </th>
                )}
                {columnVisibility.smartMatch && (
                  <th className="text-left py-3 px-4 text-xs font-bold text-stone-600 uppercase tracking-wider border-r border-stone-100 whitespace-nowrap">
                    <span className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-5 h-5 rounded-md bg-amber-50 border border-amber-200/70 flex-shrink-0">
                        <Sparkles className="w-3 h-3 text-amber-600" />
                      </span>
                      {t('candidates.smartMatch') || 'Smart Match'}
                    </span>
                  </th>
                )}
                {columnVisibility.actions && (
                  <th className="text-left py-3 px-4 text-xs font-bold text-stone-600 uppercase tracking-wider border-l border-stone-100 whitespace-nowrap">
                    <span className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-5 h-5 rounded-md bg-brand-50 border border-brand-200/70 flex-shrink-0">
                        <MoreVertical className="w-3 h-3 text-brand-600" />
                      </span>
                      {t('candidates.actions') || 'Actions'}
                    </span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {pageData.length === 0 ? (
                <tr>
                  <td colSpan={Object.values(columnVisibility).filter(Boolean).length} className="py-16 text-center border-t border-stone-100">
                    <p className="text-stone-600 font-semibold">{data.length === 0 ? (t('common.noRecordFound') ?? 'No record found.') : (t('candidates.noMatchSearch') ?? 'No candidates match your search.')}</p>
                    {data.length > 0 && <p className="text-sm text-stone-500 mt-1">{t('jobs.noMatchSearch') ?? 'Try changing your search.'}</p>}
                  </td>
                </tr>
              ) : (
                pageData.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-stone-50 transition-colors border-b border-stone-100 last:border-b-0"
                  >
                    {columnVisibility.candidate && (
                      <td className="py-4 px-4 sm:px-6 border-r border-stone-100 last:border-r-0">
                        <Link href={`/dashboard/candidates/${c.id}`} className="flex items-center gap-3 group/link">
                          <span
                            className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-100 to-teal-100 flex items-center justify-center font-bold text-brand-700 text-sm border border-brand-200/50 flex-shrink-0"
                          >
                            {c.name[0]}
                          </span>
                          <div>
                            <p className="font-semibold text-stone-900 group-hover/link:text-brand-600 text-sm">{c.name}</p>
                            <p className="text-xs text-stone-500 sm:hidden mt-0.5">{c.position}</p>
                          </div>
                        </Link>
                      </td>
                    )}
                    {columnVisibility.position && (
                      <td className="py-4 px-4 sm:px-6 font-medium text-stone-600 text-sm border-r border-stone-100 last:border-r-0">{c.position}</td>
                    )}
                    {columnVisibility.experience && (
                    <td className="py-4 px-4 sm:px-6 border-r border-stone-100 last:border-r-0">
                      {c.experience !== null && c.experience !== undefined ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700">
                          {c.experience} {c.experience === 1 ? 'year' : 'years'}
                        </span>
                      ) : (
                        <span className="text-stone-400">-</span>
                      )}
                    </td>
                    )}
                    {columnVisibility.source && (
                      <td className="py-4 px-4 sm:px-6 text-stone-500 text-sm border-r border-stone-100 last:border-r-0">{c.source}</td>
                    )}
                    {columnVisibility.status && (
                      <td className="py-4 px-4 sm:px-6 border-r border-stone-100 last:border-r-0">
                        <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-semibold ${c.status && statusColors[c.status] ? statusColors[c.status] : 'bg-stone-100 text-stone-700'}`}>
                          {c.status ?? ''}
                        </span>
                      </td>
                    )}
                    {columnVisibility.smartMatch && (
                      <td className="py-4 px-4 sm:px-6 border-r border-stone-100 last:border-r-0">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold ${
                            (c.smartMatch ?? 0) >= 85
                              ? 'bg-emerald-100 text-emerald-700'
                              : (c.smartMatch ?? 0) >= 70
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-stone-100 text-stone-600'
                          }`}
                        >
                          {c.smartMatch ?? 0}%
                        </span>
                      </td>
                    )}
                    {columnVisibility.actions && (
                      <td className="py-4 px-4 sm:px-6 border-l border-stone-100">
                        <div className="flex items-center justify-start gap-1">
                          {/* View Profile - Always visible */}
                          <Link
                            href={`/dashboard/candidates/${c.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="w-9 h-9 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition-all hover:scale-105"
                            title="View Profile"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>

                          {/* Email - Always visible if email exists */}
                          {c.email && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCandidate(c);
                                setEmailModalOpen(true);
                              }}
                              className="w-9 h-9 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-600 flex items-center justify-center transition-all hover:scale-105"
                              title="Send Email"
                            >
                              <Mail className="w-4 h-4" />
                            </button>
                          )}

                          {/* WhatsApp - Only if phone exists */}
                          {c.phone && (
                            <a
                              href={`https://wa.me/${c.phone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="w-9 h-9 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 flex items-center justify-center transition-all hover:scale-105"
                              title="WhatsApp"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>
                          )}

                          {/* More Actions - Portal Dropdown (prevents clipping) */}
                          <button
                            id={`action-btn-${c.id}`}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActionMenuOpen(actionMenuOpen === c.id ? null : c.id);
                            }}
                            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all hover:scale-105 ${
                              actionMenuOpen === c.id 
                                ? 'bg-stone-800 text-white' 
                                : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
                            }`}
                            title="More Actions"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          <ActionDropdownPortal
                            isOpen={actionMenuOpen === c.id}
                            onClose={() => setActionMenuOpen(null)}
                            candidate={c}
                            onCopy={() => {
                              navigator.clipboard.writeText(`${c.name} - ${c.email || t('candidates.noEmail')}`);
                              toast.success(t('toast.candidates.copied'));
                            }}
                            onEdit={() => openEditModal(c)}
                            onDelete={() => openDeleteModal(c)}
                          />
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filteredData.length > 0 && (
          <div className="flex flex-col xs:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-4 border-t border-stone-100 bg-stone-50/50">
            <p className="text-sm font-medium text-stone-500">
              {t('candidates.showing')} {pageStart + 1}–
              {Math.min(pageStart + pagination.pageSize, filteredData.length)} {t('candidates.of')} {filteredData.length}
            </p>
            <div className="flex items-center gap-2">
              <motion.button
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setPagination((p) => ({ ...p, pageIndex: Math.max(0, p.pageIndex - 1) }))}
                disabled={safePageIndex === 0}
                className="p-2.5 rounded-lg border border-stone-200 hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <ChevronLeft className="w-4 h-4 text-stone-700" />
              </motion.button>
              <span className="text-sm font-semibold text-stone-700 px-3">
                {t('candidates.pageOf')} {safePageIndex + 1} {t('candidates.of')} {pageCount}
              </span>
              <motion.button
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setPagination((p) => ({ ...p, pageIndex: Math.min(pageCount - 1, p.pageIndex + 1) }))}
                disabled={safePageIndex >= pageCount - 1}
                className="p-2.5 rounded-lg border border-stone-200 hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <ChevronRight className="w-4 h-4 text-stone-700" />
              </motion.button>
            </div>
          </div>
        )}
        </>
        )}
      </div>

      <Modal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title={t('candidates.modalTitle')}
        description={t('candidates.modalDesc')}
        size="md"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setFormErrors({});
            const nameErr = required(formName, t('candidates.formName'));
            const emailErr = validateEmail(formEmail) || required(formEmail, t('candidates.formEmail'));
            if (nameErr || emailErr) {
              setFormErrors({
                name: nameErr ? t('validation.nameRequired') : undefined,
                email: emailErr ? (formEmail?.trim() ? t('validation.emailInvalid') : t('validation.emailRequired')) : undefined,
              });
              return;
            }
            setSubmitting(true);
            try {
              const res = await fetch('/api/candidates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  name: formName!.trim(),
                  email: formEmail!.trim(),
                  source: formSource,
                  position: formPosition?.trim() || undefined,
                  experience: formExperience ? parseInt(formExperience, 10) : undefined,
                  phone: formPhone?.trim() || undefined,
                }),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                const msg = data?.error ?? t('common.error');
                toast.error(t('candidates.save') + ' failed', msg);
                setSubmitting(false);
                return;
              }
              setFormName('');
              setFormEmail('');
              setFormPosition('');
              setFormExperience('');
              setFormSource('LinkedIn');
              setFormPhone('');
              setFormErrors({});
              setAddModalOpen(false);
              await fetchCandidates();
              toast.success(t('candidates.saved'), formName ? `${formName} ${t('candidates.addedToPipeline')}` : undefined);
            } catch {
              toast.error(t('common.error'), t('candidates.save') + ' failed');
            } finally {
              setSubmitting(false);
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-1.5">{t('candidates.formName')}</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => { setFormName(e.target.value); setFormErrors((p) => ({ ...p, name: undefined })); }}
              placeholder="e.g. Jane Smith"
              className={`w-full px-4 py-3 rounded-xl border bg-white text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-brand-500 outline-none transition-all ${formErrors.name ? 'border-red-400' : 'border-stone-200 focus:border-brand-500'}`}
              aria-invalid={!!formErrors.name}
            />
            {formErrors.name && <p className="text-sm text-red-600 mt-1">{formErrors.name}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-1.5">{t('candidates.formEmail')}</label>
            <input
              type="email"
              value={formEmail}
              onChange={(e) => { setFormEmail(e.target.value); setFormErrors((p) => ({ ...p, email: undefined })); }}
              placeholder={t('candidates.formEmailPlaceholder')}
              className={`w-full px-4 py-3 rounded-xl border bg-white text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-brand-500 outline-none transition-all ${formErrors.email ? 'border-red-400' : 'border-stone-200 focus:border-brand-500'}`}
              aria-invalid={!!formErrors.email}
            />
            {formErrors.email && <p className="text-sm text-red-600 mt-1">{formErrors.email}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-1.5">{t('candidates.formPosition')}</label>
            <input
              type="text"
              value={formPosition}
              onChange={(e) => setFormPosition(e.target.value)}
              placeholder={t('candidates.formPositionPlaceholder')}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-1.5">Experience (Years)</label>
            <input
              type="number"
              min="0"
              max="50"
              value={formExperience}
              onChange={(e) => setFormExperience(e.target.value)}
              placeholder="e.g. 5"
              className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-1.5">{t('candidates.formSource')}</label>
            <select
              value={formSource}
              onChange={(e) => setFormSource(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-900 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
            >
              <option value="LinkedIn">LinkedIn</option>
              <option value="Indeed">Indeed</option>
              <option value="Referral">Referral</option>
              <option value="Company Website">Company Website</option>
              <option value="Glassdoor">Glassdoor</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-1.5">Phone Number</label>
            <input
              type="tel"
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
              placeholder="+1 (555) 123-4567"
              className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
            />
            <p className="text-xs text-stone-400 mt-1">Required to enable WhatsApp quick action</p>
          </div>
          <div className="flex gap-3 pt-2">
            <motion.button
              type="submit"
              disabled={submitting}
              whileHover={{ scale: submitting ? 1 : 1.01 }}
              whileTap={{ scale: submitting ? 1 : 0.99 }}
              className="flex-1 py-3.5 rounded-xl font-semibold bg-gradient-to-r from-brand-600 to-teal-600 text-white shadow-lg shadow-brand-500/25 hover:shadow-brand-500/35 transition-all disabled:opacity-70"
            >
              {submitting ? '...' : t('candidates.save')}
            </motion.button>
            <motion.button
              type="button"
              disabled={submitting}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => { setAddModalOpen(false); setFormErrors({}); }}
              className="px-5 py-3.5 rounded-xl font-semibold border-2 border-stone-200 text-stone-700 hover:bg-stone-50 transition-all"
            >
              {t('common.cancel')}
            </motion.button>
          </div>
        </form>
      </Modal>

      {/* Email Modal */}
      <Modal
        open={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        title="Send Email"
        description={selectedCandidate ? `To: ${selectedCandidate.name} (${selectedCandidate.email})` : ''}
        size="md"
      >
        <EmailComposer
          candidate={selectedCandidate}
          onClose={() => setEmailModalOpen(false)}
          onSent={() => {
            toast.success(t('toast.email.sent'));
            setEmailModalOpen(false);
          }}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={editModalOpen}
        onClose={closeEditModal}
        title="Edit Candidate"
        description="Update candidate information"
        size="md"
      >
        {editFormData && (
          <form
            onSubmit={(e) => { e.preventDefault(); handleEditSubmit(); }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1.5">Name *</label>
              <input
                type="text"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                placeholder="Candidate name"
                className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1.5">Email</label>
              <input
                type="email"
                value={editFormData.email || ''}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                placeholder="candidate@email.com"
                className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1.5">Phone</label>
              <input
                type="tel"
                value={editFormData.phone || ''}
                onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                placeholder="+1 (555) 123-4567"
                className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <motion.button
                type="submit"
                disabled={editSubmitting}
                whileHover={{ scale: editSubmitting ? 1 : 1.01 }}
                whileTap={{ scale: editSubmitting ? 1 : 0.99 }}
                className="flex-1 py-3.5 rounded-xl font-semibold bg-gradient-to-r from-brand-600 to-teal-600 text-white shadow-lg shadow-brand-500/25 hover:shadow-brand-500/35 transition-all disabled:opacity-70"
              >
                {editSubmitting ? 'Saving...' : 'Save Changes'}
              </motion.button>
              <motion.button
                type="button"
                disabled={editSubmitting}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={closeEditModal}
                className="px-5 py-3.5 rounded-xl font-semibold border-2 border-stone-200 text-stone-700 hover:bg-stone-50 transition-all"
              >
                Cancel
              </motion.button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteModalOpen}
        onClose={closeDeleteModal}
        title="Delete Candidate"
        description="This action cannot be undone"
        size="sm"
      >
        {deleteCandidate && (
          <div className="space-y-4">
            <div className="p-4 bg-red-50 rounded-xl border border-red-100">
              <p className="text-stone-700">
                Are you sure you want to delete <span className="font-semibold text-stone-900">{deleteCandidate.name}</span>?
              </p>
              <p className="text-sm text-stone-500 mt-1">
                All associated data including applications and assessments will be permanently removed.
              </p>
            </div>
            <div className="flex gap-3">
              <motion.button
                type="button"
                disabled={deleteSubmitting}
                whileHover={{ scale: deleteSubmitting ? 1 : 1.01 }}
                whileTap={{ scale: deleteSubmitting ? 1 : 0.99 }}
                onClick={handleDeleteConfirm}
                className="flex-1 py-3.5 rounded-xl font-semibold bg-red-600 text-white shadow-lg shadow-red-500/25 hover:shadow-red-500/35 transition-all disabled:opacity-70"
              >
                {deleteSubmitting ? 'Deleting...' : 'Delete Candidate'}
              </motion.button>
              <motion.button
                type="button"
                disabled={deleteSubmitting}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={closeDeleteModal}
                className="px-5 py-3.5 rounded-xl font-semibold border-2 border-stone-200 text-stone-700 hover:bg-stone-50 transition-all"
              >
                Cancel
              </motion.button>
            </div>
          </div>
        )}
      </Modal>
      {/* --- Section: Candidates Root - end --- */}
    </PageShell>
  );
}

// Email Composer Component
function EmailComposer({ candidate, onClose, onSent }: { candidate: Candidate | null; onClose: () => void; onSent: () => void }) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const toast = useToast();
  const { t } = useLocale();

  useEffect(() => {
    fetch('/api/email-templates')
      .then(r => r.json())
      .then(d => setTemplates(d.templates || []));
  }, []);

  const applyTemplate = (t: any) => {
    setSelectedTemplate(t);
    setSubject(t.subject);
    setBody(t.body.replace(/{{name}}/g, candidate?.name || '').replace(/{{position}}/g, candidate?.position || ''));
  };

  const sendEmail = async () => {
    if (!candidate?.email || !subject) return;
    setSending(true);
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          candidate: { email: candidate.email, name: candidate.name },
          job: { title: candidate?.position || 'Position' },
          template: { subject, body }
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string })?.error ?? 'Send failed');
      }
      onSent();
    } catch {
      toast.error(t('toast.email.failed'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Template Selector */}
      {templates.length > 0 && (
        <div>
          <label className="block text-sm font-semibold text-stone-700 mb-2">{t('email.quickTemplates')}</label>
          <div className="flex flex-wrap gap-2">
            {templates.slice(0, 4).map((t) => (
              <button
                key={t.id}
                onClick={() => applyTemplate(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedTemplate?.id === t.id
                    ? 'bg-brand-500 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Subject */}
      <div>
        <label className="block text-sm font-semibold text-stone-700 mb-1.5">{t('email.subject')}</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={t('email.subjectPlaceholder')}
          className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
        />
      </div>

      {/* Body */}
      <div>
        <label className="block text-sm font-semibold text-stone-700 mb-1.5">{t('email.message')}</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t('email.messagePlaceholder')}
          rows={6}
          className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all resize-none"
        />
        <p className="text-xs text-stone-500 mt-1">Use {'{{name}}'} and {'{{position}}'} as placeholders</p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <motion.button
          onClick={sendEmail}
          disabled={sending || !subject || !body}
          whileHover={{ scale: sending ? 1 : 1.01 }}
          whileTap={{ scale: sending ? 1 : 0.99 }}
          className="flex-1 py-3.5 rounded-xl font-semibold bg-gradient-to-r from-brand-600 to-teal-600 text-white shadow-lg shadow-brand-500/25 hover:shadow-brand-500/35 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
        >
          {sending ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Send Email
            </>
          )}
        </motion.button>
        <motion.button
          onClick={onClose}
          disabled={sending}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className="px-5 py-3.5 rounded-xl font-semibold border-2 border-stone-200 text-stone-700 hover:bg-stone-50 transition-all"
        >
          Cancel
        </motion.button>
      </div>
    </div>
  );
}

