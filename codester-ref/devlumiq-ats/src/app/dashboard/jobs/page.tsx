'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Briefcase, Plus, Search, MapPin, Building2, Users,
  MoreHorizontal, Eye, Edit3, Trash2, ExternalLink,
  CheckCircle2, AlertTriangle, Sparkles, ChevronDown, Clock,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import PageShell from '@/components/ui/PageShell';
import { EmptyState } from '@/components/ui/EmptyState';
import { useLocale } from '@/components/providers/LocaleProvider';
import { useToast } from '@/components/ui/Toast';
import { PermissionGate } from '@/components/PermissionGate';

// --- Helpers ---
const TYPE_CONFIG: Record<string, { bg: string; text: string; border: string }> = {
  'Full-time':  { bg: 'bg-brand-50',   text: 'text-brand-700',   border: 'border-brand-200/70'  },
  'Full Time':  { bg: 'bg-brand-50',   text: 'text-brand-700',   border: 'border-brand-200/70'  },
  'Remote':     { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200/70'   },
  'Contract':   { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200/70'  },
  'Part-time':  { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200/70' },
  'Part Time':  { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200/70' },
  'Internship': { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200/70'   },
};
const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  Active:  { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  Closed:  { bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-500'     },
  Draft:   { bg: 'bg-stone-100',  text: 'text-stone-600',   dot: 'bg-stone-400'   },
};
const STATUS_TABS = ['All', 'Active', 'Closed', 'Draft'] as const;
type StatusTab = typeof STATUS_TABS[number];

function relativeDate(iso: string, t: (k: string, vars?: Record<string, string>) => string) {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86400000);
  if (days === 0) return t('dashboard.today');
  if (days === 1) return t('dashboard.yesterday');
  if (days < 7) return t('dashboard.daysAgo', { days: String(days) });
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return t('dashboard.weeksAgo', { weeks: String(weeks) });
  return t('dashboard.monthsAgo', { months: String(Math.floor(days / 30)) });
}

// --- Portal Dropdown ---
// Portal Dropdown for Jobs - Premium Style matching Candidates page
function JobActionDropdownPortal({
  isOpen,
  onClose,
  jobId,
  jobTitle,
  onDeleteClick,
  router,
}: {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  jobTitle: string;
  onDeleteClick: () => void;
  router: ReturnType<typeof useRouter>;
}) {
  const [position, setPosition] = useState<{ top?: number; bottom?: number; right: number }>({ right: 20 });
  const portalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      const button = document.getElementById(`job-action-btn-${jobId}`);
      if (button) {
        const rect = button.getBoundingClientRect();
        const dropdownHeight = 200;
        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;
        let newPosition: { top?: number; bottom?: number; right: number };
        if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
          newPosition = { bottom: viewportHeight - rect.top + 8, right: Math.max(8, window.innerWidth - rect.right) };
        } else {
          newPosition = { top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) };
        }
        setPosition(newPosition);
      }
    }
  }, [isOpen, jobId]);

  if (!isOpen) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        ref={portalRef}
        className="fixed w-60 rounded-xl border border-stone-200 bg-white shadow-2xl z-50 overflow-hidden"
        style={{
          ...(position.top !== undefined ? { top: position.top } : {}),
          ...(position.bottom !== undefined ? { bottom: position.bottom } : {}),
          right: position.right,
          maxHeight: 'calc(100vh - 40px)',
          maxWidth: 'calc(100vw - 16px)',
        }}
      >
        {/* Premium Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-brand-600 to-teal-600 rounded-t-xl">
          <p className="text-xs font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-white/80" />
            Job Options
          </p>
        </div>

        <div className="py-2">
          {/* External Links */}
          <div className="px-3">
            <p className="px-1 pb-1 pt-0.5 text-[10px] font-bold text-stone-400 uppercase tracking-widest">External</p>
            <button
              type="button"
              onClick={() => { router.push(`/careers/${jobId}`); onClose(); }}
              className="w-full flex items-center gap-3 px-2 py-2.5 hover:bg-stone-50 rounded-lg text-sm text-stone-700 text-left transition-colors group"
            >
              <div className="w-7 h-7 rounded-lg bg-stone-100 flex items-center justify-center flex-shrink-0">
                <ExternalLink className="w-3.5 h-3.5 text-stone-600" />
              </div>
              <span className="flex-1 font-medium">View Public Page</span>
              <ExternalLink className="w-3 h-3 text-stone-300 group-hover:text-stone-500 flex-shrink-0" />
            </button>
          </div>

          {/* Danger Zone */}
          <PermissionGate permission="DELETE_JOB">
            <div className="border-t border-red-100 bg-gradient-to-r from-red-50/40 to-rose-50/40 mt-2 pt-0.5 rounded-b-xl">
              <div className="px-3 py-1">
                <button
                  type="button"
                  onClick={() => { onDeleteClick(); onClose(); }}
                  className="w-full flex items-center gap-3 px-2 py-2.5 hover:bg-red-100/70 text-sm text-red-600 text-left transition-colors rounded-lg"
                >
                  <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  </div>
                  <span className="font-semibold">Delete Job</span>
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

type JobRow = { 
  id: string; 
  title: string; 
  department: string; 
  location: string; 
  type: string; 
  applicants?: number; 
  status: string; 
  postedAt: string;
  description?: string;
};

const JOBS_PER_PAGE = 8;

export default function JobsPage() {
  const router = useRouter();
  const { t } = useLocale();
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<StatusTab>('All');
  const [activeDept, setActiveDept] = useState('All Departments');
  const [deptMenuOpen, setDeptMenuOpen] = useState(false);
  const deptBtnRef = useRef<HTMLButtonElement>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [openPositions, setOpenPositions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);

  const [deleteModal, setDeleteModal] = useState<{ open: boolean; jobId: string; jobTitle: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const departments = useMemo(() => {
    const s = new Set(jobs.map(j => j.department).filter(Boolean));
    return ['All Departments', ...Array.from(s).sort()];
  }, [jobs]);

  const handleDeleteClick = (jobId: string, jobTitle: string) => {
    setDeleteModal({ open: true, jobId, jobTitle });
    setActionMenuOpen(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/jobs/${deleteModal.jobId}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        setJobs(prev => prev.filter(j => j.id !== deleteModal.jobId));
        toast.success(`"${deleteModal.jobTitle}" has been deleted`);
        setDeleteModal(null);
      } else {
        throw new Error('Failed to delete');
      }
    } catch {
      toast.error('Failed to delete job. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleStatus = async (job: JobRow) => {
    const next = job.status === 'Active' ? 'Closed' : 'Active';
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: next } : j));
    try {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error();
      toast.success(`"${job.title}" is now ${next}`);
    } catch {
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: job.status } : j));
      toast.error('Failed to update status');
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActionMenuOpen(null);
    if (actionMenuOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [actionMenuOpen]);

  // Close dept menu on outside click
  useEffect(() => {
    if (!deptMenuOpen) return;
    const close = (e: MouseEvent) => {
      if (deptBtnRef.current && !deptBtnRef.current.closest('[data-dept-menu]')?.contains(e.target as Node)) {
        setDeptMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [deptMenuOpen]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    async function load() {
      try {
        const res = await fetch('/api/jobs', { credentials: 'include', cache: 'no-store' });
        if (!res.ok) throw new Error('Failed');
        const json = await res.json();
        const list = Array.isArray(json) ? json : json.jobs ?? [];
        const mapped: JobRow[] = (list as { id: string; title: string; department: string; location: string; type: string; applicants?: number; status: string; postedAt: string }[]).map((j) => ({
          id: String(j.id),
          title: j.title,
          department: j.department,
          location: j.location,
          type: j.type,
          applicants: j.applicants ?? 0,
          status: j.status,
          postedAt: j.postedAt,
        }));
        if (!cancelled) {
          setJobs(mapped);
          setOpenPositions(mapped.filter((j) => j.status === 'Active').length);
        }
      } catch {
        if (!cancelled) {
          setJobs([]);
          setOpenPositions(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(
    () =>
      jobs.filter((j) => {
        const matchSearch = !searchQuery.trim() ||
          j.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (j.department && j.department.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchStatus = activeTab === 'All' || j.status === activeTab;
        const matchDept = activeDept === 'All Departments' || j.department === activeDept;
        return matchSearch && matchStatus && matchDept;
      }),
    [jobs, searchQuery, activeTab, activeDept]
  );
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { All: jobs.length };
    jobs.forEach((j) => { counts[j.status] = (counts[j.status] ?? 0) + 1; });
    return counts;
  }, [jobs]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / JOBS_PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const pageJobs = filtered.slice(safePage * JOBS_PER_PAGE, (safePage + 1) * JOBS_PER_PAGE);

  useEffect(() => {
    setPage(0);
  }, [searchQuery, activeTab, activeDept]);

  return (
    <PageShell>
      <PageHeader
        icon={Briefcase}
        title={t('jobs.title')}
        subtitle={loading ? '...' : `${openPositions} ${t('jobs.activeRolesTotal')} · ${jobs.length} ${t('jobs.totalListings')}`}
      >
        <PermissionGate permission="CREATE_JOB">
          <Link href="/dashboard/jobs/new">
            <motion.span
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="btn-primary !px-6 !py-3.5 inline-flex items-center justify-center gap-2.5"
            >
              <Plus className="w-5 h-5" />
              {t('jobs.postNewJob')}
            </motion.span>
          </Link>
        </PermissionGate>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {[
          { label: t('jobs.activeRoles'), value: openPositions, color: 'text-brand-600', bg: 'bg-brand-50' },
          {
            label: t('jobs.totalApplicants'),
            value: jobs.reduce((s, j) => s + (j.applicants ?? 0), 0),
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
          },
          {
            label: t('jobs.avgPerRole'),
            value: jobs.length ? Math.round(jobs.reduce((s, j) => s + (j.applicants ?? 0), 0) / jobs.length) : 0,
            color: 'text-amber-600',
            bg: 'bg-amber-50',
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="group relative overflow-hidden rounded-xl border border-stone-200/80 bg-white p-4 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <p className="text-sm font-semibold text-stone-500">{stat.label}</p>
            <p className={`text-2xl font-extrabold mt-1 ${stat.color}`}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-stone-200/80 bg-white overflow-hidden shadow-[var(--shadow-card)]"
      >
        {/* Toolbar: Search + Status Tabs + Department filter */}
        <div className="border-b border-stone-100">
          {/* Top row: search + dept filter */}
          <div className="p-4 sm:p-5 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('jobs.searchPlaceholder')}
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 outline-none text-sm font-medium text-stone-900 placeholder:text-stone-400"
              />
            </div>
            {/* Department filter */}
            <div className="relative flex-shrink-0" data-dept-menu>
              <button
                ref={deptBtnRef}
                type="button"
                onClick={() => setDeptMenuOpen(!deptMenuOpen)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                  activeDept !== 'All Departments'
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-stone-200 bg-stone-50/50 text-stone-700 hover:bg-stone-100'
                }`}
              >
                <Building2 className="w-4 h-4 flex-shrink-0" />
                <span className="max-w-[140px] truncate">{activeDept === 'All Departments' ? 'Department' : activeDept}</span>
                <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${deptMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {deptMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.98 }}
                    transition={{ duration: 0.13 }}
                    className="absolute right-0 top-full mt-2 min-w-[200px] max-h-64 overflow-y-auto rounded-xl border border-stone-200 bg-white shadow-xl z-30"
                  >
                    {departments.map((dept) => (
                      <button
                        key={dept}
                        type="button"
                        onClick={() => { setActiveDept(dept); setDeptMenuOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors first:rounded-t-xl last:rounded-b-xl ${
                          activeDept === dept ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-stone-700 hover:bg-stone-50'
                        }`}
                      >
                        {dept}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          {/* Status filter tabs */}
          <div className="flex items-center gap-1 px-4 sm:px-5 pb-0 overflow-x-auto scrollbar-hide">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
                  activeTab === tab
                    ? 'border-brand-500 text-brand-700'
                    : 'border-transparent text-stone-500 hover:text-stone-700'
                }`}
              >
                {tab}
                <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                  activeTab === tab ? 'bg-brand-100 text-brand-700' : 'bg-stone-100 text-stone-500'
                }`}>
                  {tabCounts[tab] ?? 0}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── MOBILE: Card grid (hidden md+) ── */}
        <div className="md:hidden divide-y divide-stone-100">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-28 bg-stone-50 rounded-xl animate-pulse" />)}
            </div>
          ) : pageJobs.length === 0 ? (
            <div className="py-16 text-center">
              <EmptyState message={t('common.noRecordFound') ?? 'No record found.'} />
            </div>
          ) : (
            pageJobs.map((job, i) => {
              const sc = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.Draft;
              const tc = TYPE_CONFIG[job.type] ?? { bg: 'bg-stone-50', text: 'text-stone-600', border: 'border-stone-200' };
              return (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-100 to-teal-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Briefcase className="w-5 h-5 text-brand-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-stone-900 text-sm leading-tight truncate">{job.title}</h3>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(job)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold flex-shrink-0 ${sc.bg} ${sc.text} cursor-pointer`}
                          title="Click to toggle status"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                          {job.status}
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${tc.bg} ${tc.text} ${tc.border}`}>{job.type}</span>
                        {job.department && <span className="text-xs text-stone-500">{job.department}</span>}
                        {job.location && <span className="flex items-center gap-0.5 text-xs text-stone-400"><MapPin className="w-3 h-3" />{job.location}</span>}
                      </div>
                      <div className="flex items-center justify-between mt-2.5">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => router.push(`/dashboard/jobs/${job.id}`)}
                            className="flex items-center gap-1 text-xs font-semibold text-brand-600 bg-brand-50 px-2 py-1 rounded-lg"
                          >
                            <Users className="w-3 h-3" />{job.applicants ?? 0} applicants
                          </button>
                          <span className="flex items-center gap-1 text-xs text-stone-400">
                            <Clock className="w-3 h-3" />{relativeDate(job.postedAt, t)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => router.push(`/dashboard/jobs/${job.id}`)}
                            className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center hover:bg-brand-100 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => router.push(`/dashboard/jobs/${job.id}/edit`)}
                            className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center hover:bg-amber-100 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <PermissionGate permission="DELETE_JOB">
                            <button
                              type="button"
                              onClick={() => handleDeleteClick(job.id, job.title)}
                              className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </PermissionGate>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* ── DESKTOP: Table (hidden on mobile) ── */}
        <div className="hidden md:block w-full max-w-full min-w-0 overflow-x-auto rounded-xl border border-stone-200/80 bg-white" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className="w-full border-collapse table-fixed md:table-auto" style={{ minWidth: '640px' }}>
            <colgroup>
              <col style={{ width: '28%', minWidth: '160px' }} />
              <col style={{ width: '14%', minWidth: '100px' }} />
              <col style={{ width: '14%', minWidth: '100px' }} />
              <col style={{ width: '12%', minWidth: '80px' }} />
              <col style={{ width: '12%', minWidth: '90px' }} />
              <col style={{ width: '10%', minWidth: '80px' }} />
              <col style={{ width: '10%', minWidth: '100px' }} />
            </colgroup>
            <thead>
                <tr className="bg-stone-50 border-b-2 border-stone-200">
                  {[
                    { icon: Briefcase, label: 'Job Title', align: 'left' },
                    { icon: Building2, label: 'Department', align: 'left' },
                    { icon: MapPin, label: 'Location', align: 'left' },
                    { icon: Users, label: 'Applicants', align: 'center' },
                    { icon: CheckCircle2, label: 'Status', align: 'center' },
                    { icon: Clock, label: 'Posted', align: 'center' },
                    { icon: MoreHorizontal, label: 'Actions', align: 'center' },
                  ].map(({ icon: Icon, label, align }) => (
                    <th key={label} className={`text-${align} py-3.5 px-4 text-xs font-bold text-stone-600 uppercase tracking-wider`}>
                      <span className={`flex items-center gap-2 ${align === 'center' ? 'justify-center' : ''}`}>
                        <span className="flex items-center justify-center w-5 h-5 rounded-md bg-brand-50 border border-brand-200/70 flex-shrink-0">
                          <Icon className="w-3 h-3 text-brand-600" />
                        </span>
                        {label}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-6">
                      <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div key={i} className="h-14 bg-stone-50 rounded-lg w-full animate-pulse" />
                        ))}
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <EmptyState
                        message={t('common.noRecordFound') ?? 'No record found.'}
                        subMessage={jobs.length === 0 ? undefined : t('jobs.noMatchSearch')}
                      />
                    </td>
                  </tr>
                ) : (
                  <>
                    {pageJobs.map((job, i) => {
                      const tc = TYPE_CONFIG[job.type] ?? { bg: 'bg-stone-50', text: 'text-stone-600', border: 'border-stone-200' };
                      const sc = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.Draft;
                      return (
                      <motion.tr
                        key={job.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.05 + i * 0.03 }}
                        className="border-b border-stone-100 last:border-b-0 hover:bg-stone-50 transition-colors"
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-100 to-teal-100 flex items-center justify-center flex-shrink-0">
                              <Briefcase className="w-4 h-4 text-brand-600" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-bold text-stone-900 text-sm truncate">{job.title}</h3>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border mt-0.5 ${tc.bg} ${tc.text} ${tc.border}`}>
                                {job.type}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-sm text-stone-600 font-medium">
                          {job.department || '—'}
                        </td>
                        <td className="py-4 px-4 text-sm text-stone-500">
                          <span className="flex items-center gap-1 min-w-0">
                            <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-stone-400" />
                            <span className="truncate">{job.location || '—'}</span>
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => router.push(`/dashboard/jobs/${job.id}`)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-50 text-brand-700 text-sm font-semibold hover:bg-brand-100 transition-colors"
                          >
                            <Users className="w-4 h-4" />
                            {job.applicants ?? 0}
                          </button>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(job)}
                            title="Click to toggle status"
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all hover:opacity-80 ${sc.bg} ${sc.text}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                            {job.status}
                          </button>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="flex items-center justify-center gap-1 text-xs text-stone-400 whitespace-nowrap">
                            <Clock className="w-3 h-3" />
                            {relativeDate(job.postedAt, t)}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-center gap-1.5">
                            <motion.button
                              type="button"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => router.push(`/dashboard/jobs/${job.id}`)}
                              className="group relative w-9 h-9 rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 hover:from-brand-100 hover:to-brand-200 text-brand-600 flex items-center justify-center transition-all duration-200 shadow-sm hover:shadow-md border border-brand-200/50"
                              title="View Applicants"
                            >
                              <Eye className="w-4 h-4 group-hover:scale-110 transition-transform" />
                            </motion.button>
                            <motion.button
                              type="button"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => router.push(`/dashboard/jobs/${job.id}/edit`)}
                              className="group relative w-9 h-9 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 hover:from-amber-100 hover:to-amber-200 text-amber-600 flex items-center justify-center transition-all duration-200 shadow-sm hover:shadow-md border border-amber-200/50"
                              title="Edit Job"
                            >
                              <Edit3 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                            </motion.button>
                            <div className="relative">
                              <motion.button
                                type="button"
                                id={`job-action-btn-${job.id}`}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActionMenuOpen(actionMenuOpen === job.id ? null : job.id);
                                }}
                                className={`group relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 shadow-sm hover:shadow-md border ${
                                  actionMenuOpen === job.id
                                    ? 'bg-stone-800 text-white border-stone-700'
                                    : 'bg-gradient-to-br from-stone-50 to-stone-100 hover:from-stone-100 hover:to-stone-200 text-stone-500 border-stone-200/50'
                                }`}
                              >
                                <MoreHorizontal className="w-4 h-4 group-hover:scale-110 transition-transform" />
                              </motion.button>
                              <JobActionDropdownPortal
                                isOpen={actionMenuOpen === job.id}
                                onClose={() => setActionMenuOpen(null)}
                                jobId={job.id}
                                jobTitle={job.title}
                                onDeleteClick={() => handleDeleteClick(job.id, job.title)}
                                router={router}
                              />
                            </div>
                          </div>
                        </td>
                      </motion.tr>
                      );
                    })}
                  </>
                )}
              </tbody>
            </table>
        </div>
        {/* end hidden md:block table wrapper */}

        {/* Pagination (shared, below both views) */}
        {!loading && filtered.length > 0 && totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-4 border-t border-stone-200 bg-stone-50/50">
            <p className="text-sm font-medium text-stone-500">
              Showing {safePage * JOBS_PER_PAGE + 1}–{Math.min((safePage + 1) * JOBS_PER_PAGE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                className="px-4 py-2 rounded-xl border border-stone-200 bg-white text-stone-700 font-medium text-sm hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) { pageNum = i + 1; }
                  else if (safePage < 2) { pageNum = i + 1; }
                  else if (safePage > totalPages - 3) { pageNum = totalPages - 4 + i; }
                  else { pageNum = safePage - 1 + i; }
                  return (
                    <button key={pageNum} type="button" onClick={() => setPage(pageNum - 1)}
                      className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${pageNum === safePage + 1 ? 'bg-brand-500 text-white' : 'hover:bg-stone-200 text-stone-600'}`}
                    >{pageNum}</button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={safePage >= totalPages - 1}
                className="px-4 py-2 rounded-xl border border-stone-200 bg-white text-stone-700 font-medium text-sm hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Premium Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteModal?.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setDeleteModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-red-500 to-red-600 p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Delete Job</h3>
                    <p className="text-red-100 text-sm">This action cannot be undone</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <p className="text-stone-600 mb-6">
                  Are you sure you want to delete <span className="font-semibold text-stone-900">"{deleteModal?.jobTitle}"</span>? All applications and data associated with this job will be permanently removed.
                </p>

                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setDeleteModal(null)}
                    className="flex-1 px-5 py-2.5 border border-stone-200 text-stone-700 rounded-xl font-medium hover:bg-stone-50 transition-all"
                    disabled={deleting}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleConfirmDelete}
                    disabled={deleting}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold hover:from-red-600 hover:to-red-700 disabled:opacity-50 transition-all shadow-lg shadow-red-500/25"
                  >
                    {deleting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageShell>
  );
}

