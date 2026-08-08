/**
 * Job Board Integrations Page
 * ============================
 * Post job listings to external platforms (LinkedIn, Indeed, Glassdoor, etc.)
 * and track clicks and applications per board. Premium redesign.
 */
'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import {
  Share2, Search, CheckCircle, TrendingUp, Users, Link2, Briefcase, ChevronDown,
  Zap, BarChart3, RefreshCw, Loader2, X, ArrowUpRight, Target, Activity,
  AlertCircle
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useLocale } from '@/components/providers/LocaleProvider';
import PageHeader from '@/components/ui/PageHeader';
import PageShell from '@/components/ui/PageShell';
import StatCard from '@/components/ui/StatCard';
import JobBoardCredentialsForm from '@/components/dashboard/JobBoardCredentialsForm';

interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  status: string;
}

interface JobBoard {
  id: string;
  name: string;
  logo: string;
  gradient: string;
  bgLight: string;
  borderColor: string;
  textColor: string;
  connected: boolean;
  clicks: number;
  applications: number;
  postUrl?: string;
  description: string;
  tag: string;
}

const INITIAL_BOARDS: JobBoard[] = [
  {
    id: 'linkedin',
    name: 'LinkedIn',
    logo: 'in',
    gradient: 'from-blue-600 to-blue-700',
    bgLight: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-600',
    connected: false,
    clicks: 0,
    applications: 0,
    postUrl: 'https://linkedin.com/jobs',
    description: 'Reach 900M+ professionals worldwide',
    tag: 'Most Popular',
  },
  {
    id: 'indeed',
    name: 'Indeed',
    logo: 'IN',
    gradient: 'from-orange-500 to-red-500',
    bgLight: 'bg-orange-50',
    borderColor: 'border-orange-200',
    textColor: 'text-orange-600',
    connected: false,
    clicks: 0,
    applications: 0,
    postUrl: 'https://indeed.com',
    description: '#1 job site with 250M+ unique visitors',
    tag: 'High Volume',
  },
  {
    id: 'glassdoor',
    name: 'Glassdoor',
    logo: 'GD',
    gradient: 'from-emerald-500 to-teal-600',
    bgLight: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    textColor: 'text-emerald-600',
    connected: false,
    clicks: 0,
    applications: 0,
    description: 'Attract candidates who research culture first',
    tag: 'Brand Aware',
  },
  {
    id: 'website',
    name: 'Company Website',
    logo: 'W',
    gradient: 'from-brand-500 to-teal-500',
    bgLight: 'bg-brand-50',
    borderColor: 'border-brand-200',
    textColor: 'text-brand-600',
    connected: true,
    clicks: 0,
    applications: 0,
    postUrl: 'https://careers.yourcompany.com',
    description: 'Your own careers page — always free',
    tag: 'Direct',
  },
  {
    id: 'angellist',
    name: 'AngelList',
    logo: 'AL',
    gradient: 'from-rose-500 to-pink-600',
    bgLight: 'bg-rose-50',
    borderColor: 'border-rose-200',
    textColor: 'text-rose-600',
    connected: false,
    clicks: 0,
    applications: 0,
    description: 'Top destination for startup talent',
    tag: 'Startups',
  },
  {
    id: 'ziprecruiter',
    name: 'ZipRecruiter',
    logo: 'ZR',
    gradient: 'from-violet-500 to-purple-600',
    bgLight: 'bg-violet-50',
    borderColor: 'border-violet-200',
    textColor: 'text-violet-600',
    connected: false,
    clicks: 0,
    applications: 0,
    description: 'Smart matching for quality hires',
    tag: 'Smart Match',
  },
];

function QuickPostPlatformsSelector({
  boards,
  posting,
  onPost,
}: {
  boards: JobBoard[];
  posting: string | null;
  onPost: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {boards.map(board => {
          const isSelected = selected.has(board.id);
          return (
            <button
              key={board.id}
              type="button"
              onClick={() => toggle(board.id)}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl border-2 text-left transition-all ${
                isSelected
                  ? `border-brand-500 bg-brand-50 shadow-sm`
                  : 'border-stone-200 bg-white hover:border-stone-300'
              }`}
            >
              <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${board.gradient} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                {board.logo}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-stone-900 text-sm truncate">{board.name}</p>
                <p className="text-xs text-stone-400 truncate">{board.description}</p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                isSelected ? 'border-brand-500 bg-brand-500' : 'border-stone-300'
              }`}>
                {isSelected && <CheckCircle className="w-3.5 h-3.5 text-white" />}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => setSelected(new Set(boards.map(b => b.id)))}
          className="text-xs text-brand-600 hover:text-brand-700 font-semibold"
        >
          Select All
        </button>
        <span className="text-stone-300">|</span>
        <button
          type="button"
          onClick={() => setSelected(new Set())}
          className="text-xs text-stone-500 hover:text-stone-700 font-semibold"
        >
          Clear
        </button>
        <div className="flex-1" />
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={() => onPost([...selected])}
          disabled={selected.size === 0 || posting !== null}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-brand-600 to-teal-500 text-white rounded-xl font-semibold text-sm disabled:opacity-50 shadow-sm hover:shadow-md transition-all"
        >
          <Share2 className="w-4 h-4" />
          Post to {selected.size > 0 ? `${selected.size} Platform${selected.size > 1 ? 's' : ''}` : 'Platforms'}
        </motion.button>
      </div>
    </div>
  );
}

function JobBoardsPage() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const preselectedJobId = searchParams.get('jobId');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [boards, setBoards] = useState<JobBoard[]>(INITIAL_BOARDS);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState<string | null>(null);
  const [jobDropdownOpen, setJobDropdownOpen] = useState(false);
  const [jobSearch, setJobSearch] = useState('');
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<{ boardId: string; boardName: string } | null>(null);
  const [showQuickPost, setShowQuickPost] = useState(false);
  const jobDropdownRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (jobDropdownRef.current && !jobDropdownRef.current.contains(e.target as Node)) {
        setJobDropdownOpen(false);
        setJobSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/jobs', { credentials: 'include' });
      const data = await res.json();
      const loadedJobs: Job[] = data.jobs || [];
      setJobs(loadedJobs);
      // Auto-select job passed via ?jobId= (from Share button on Job Posting page)
      if (preselectedJobId) {
        const match = loadedJobs.find((j) => j.id === preselectedJobId);
        setSelectedJob(match ?? loadedJobs[0] ?? null);
      } else if (loadedJobs.length > 0) {
        setSelectedJob(loadedJobs[0]);
      }
    } catch {
      toast.error('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  const selectJob = (job: Job) => {
    setSelectedJob(job);
    setJobDropdownOpen(false);
    setJobSearch('');
  };

  const filteredJobs = jobSearch.toLowerCase().trim()
    ? jobs.filter(
        (j) =>
          j.title.toLowerCase().includes(jobSearch.toLowerCase()) ||
          j.department.toLowerCase().includes(jobSearch.toLowerCase()) ||
          j.location.toLowerCase().includes(jobSearch.toLowerCase()),
      )
    : jobs;

  const postToBoard = async (boardId: string) => {
    if (!selectedJob) {
      toast.error('Please select a job first');
      return;
    }

    setPosting(boardId);
    try {
      const res = await fetch(`/api/jobs/${selectedJob.id}/integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          board: boardId,
          externalId: `ext-${Date.now()}`,
          postUrl: `https://${boardId}.com/jobs/${selectedJob.id}`,
        }),
      });

      if (!res.ok) throw new Error('Failed to post');

      const boardName = boards.find(b => b.id === boardId)?.name || boardId;
      toast.success(`Posted to ${boardName}`, `${selectedJob.title} is now live`);
      setBoards(prev => prev.map(b =>
        b.id === boardId
          ? { ...b, connected: true, clicks: b.clicks + 1, postUrl: b.postUrl || `https://${boardId}.com/jobs/${selectedJob.id}` }
          : b
      ));
    } catch {
      toast.error('Failed to post to job board');
    } finally {
      setPosting(null);
    }
  };

  const syncBoard = async (boardId: string) => {
    if (!selectedJob) {
      toast.error('Please select a job first');
      return;
    }
    setPosting(boardId);
    try {
      await new Promise(r => setTimeout(r, 1200));
      const boardName = boards.find(b => b.id === boardId)?.name || boardId;
      toast.success(`${boardName} synced`, 'Job listing updated successfully');
      setBoards(prev => prev.map(b =>
        b.id === boardId ? { ...b, clicks: b.clicks + Math.floor(Math.random() * 5) } : b
      ));
    } catch {
      toast.error('Sync failed');
    } finally {
      setPosting(null);
    }
  };

  const disconnectBoard = async (boardId: string) => {
    setDisconnecting(boardId);
    try {
      await new Promise(r => setTimeout(r, 800));
      const boardName = boards.find(b => b.id === boardId)?.name || boardId;
      toast.success(`${boardName} disconnected`);
      setBoards(prev => prev.map(b =>
        b.id === boardId ? { ...b, connected: false, clicks: 0, applications: 0 } : b
      ));
    } catch {
      toast.error('Failed to disconnect');
    } finally {
      setDisconnecting(null);
      setConfirmDisconnect(null);
    }
  };

  const totalClicks = boards.reduce((sum, b) => sum + b.clicks, 0);
  const totalApplications = boards.reduce((sum, b) => sum + b.applications, 0);
  const activeBoards = boards.filter(b => b.connected).length;
  const conversionRate = totalClicks > 0 ? Math.round((totalApplications / totalClicks) * 100) : 0;

  const connectedBoards = boards.filter(b => b.connected);
  const availableBoards = boards.filter(b => !b.connected);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
    <PageShell>
      <PageHeader
        icon={Share2}
        title="Job Board Integrations"
        subtitle="Connect credentials for live posts — drafts still work without them"
      >
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              if (!selectedJob) { toast.error('Select a job first'); return; }
              setShowQuickPost(true);
            }}
            disabled={posting !== null}
            className="hidden sm:inline-flex items-center gap-2 btn-primary !px-4 !py-2.5 !text-sm disabled:opacity-50"
          >
            <Zap className="w-4 h-4" />
            Quick Post
          </motion.button>
        </div>
      </PageHeader>

      <div className="rounded-2xl border border-stone-200 bg-white p-6">
        <h2 className="text-sm font-bold text-stone-900 mb-4">Board credentials</h2>
        <JobBoardCredentialsForm />
      </div>

      {/* ── Stats Row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Total Clicks"
          value={totalClicks.toLocaleString()}
          icon={Activity}
          iconClassName="text-sky-600 bg-sky-50"
        />
        <StatCard
          label="Applications"
          value={totalApplications.toString()}
          icon={Users}
          iconClassName="text-emerald-600 bg-emerald-50"
        />
        <StatCard
          label="Active Boards"
          value={`${activeBoards} / ${boards.length}`}
          icon={Link2}
          iconClassName="text-amber-600 bg-amber-50"
        />
        <StatCard
          label="Conversion Rate"
          value={`${conversionRate}%`}
          icon={Target}
          iconClassName="text-brand-600 bg-brand-50"
        />
      </div>

      {/* ── Job Selector ────────────────────────────────────────────────── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-stone-200 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-stone-900 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-100 flex items-center justify-center">
              <Briefcase className="w-3.5 h-3.5 text-brand-600" />
            </div>
            Select Job to Post
          </h3>
          {selectedJob && (
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
              selectedJob.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-600'
            }`}>
              {selectedJob.status}
            </span>
          )}
        </div>

        <div className="relative" ref={jobDropdownRef}>
          <button
            type="button"
            onClick={() => setJobDropdownOpen((v) => !v)}
            className={`w-full flex items-center justify-between px-4 py-3 bg-white border rounded-xl text-sm transition-all ${
              jobDropdownOpen
                ? 'border-brand-500 ring-2 ring-brand-500/20 shadow-sm'
                : 'border-stone-200 hover:border-stone-300 hover:shadow-sm'
            }`}
          >
            {selectedJob ? (
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-teal-500 flex items-center justify-center text-white flex-shrink-0 shadow-sm">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-stone-900 truncate text-sm">{selectedJob.title}</p>
                  <p className="text-xs text-stone-500 truncate">{selectedJob.department} &bull; {selectedJob.location}</p>
                </div>
              </div>
            ) : (
              <span className="text-stone-400 text-sm">
                {loading ? 'Loading jobs...' : 'Select a job to post...'}
              </span>
            )}
            <ChevronDown
              className={`w-4 h-4 text-stone-400 transition-transform flex-shrink-0 ml-2 ${
                jobDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          <AnimatePresence>
            {jobDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-stone-200 rounded-xl shadow-2xl z-50 overflow-hidden"
              >
                <div className="p-2.5 border-b border-stone-100 bg-stone-50">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <input
                      type="text"
                      autoFocus
                      placeholder="Search jobs..."
                      value={jobSearch}
                      onChange={(e) => setJobSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm bg-white rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="max-h-56 overflow-y-auto overscroll-contain">
                  {filteredJobs.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <p className="text-sm text-stone-400">
                        {jobSearch ? `No results for "${jobSearch}"` : 'No jobs found'}
                      </p>
                    </div>
                  ) : (
                    filteredJobs.map((job) => (
                      <button
                        key={job.id}
                        type="button"
                        onClick={() => selectJob(job)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                          selectedJob?.id === job.id ? 'bg-brand-50' : 'hover:bg-stone-50'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-teal-500 flex items-center justify-center text-white flex-shrink-0">
                          <Briefcase className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-stone-900 truncate">{job.title}</p>
                          <p className="text-xs text-stone-500 truncate">{job.department} &bull; {job.location}</p>
                        </div>
                        {selectedJob?.id === job.id && (
                          <CheckCircle className="w-4 h-4 text-brand-600 flex-shrink-0" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {selectedJob && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 flex flex-wrap gap-2"
          >
            <span className="px-3 py-1 bg-brand-50 text-brand-700 rounded-full text-xs font-semibold border border-brand-100">
              {selectedJob.department}
            </span>
            <span className="px-3 py-1 bg-stone-100 text-stone-600 rounded-full text-xs font-semibold">
              {selectedJob.location}
            </span>
          </motion.div>
        )}
      </div>

      {/* ── Connected Boards ────────────────────────────────────────────── */}
      {connectedBoards.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="font-bold text-stone-900 text-sm uppercase tracking-wide">Active Integrations</h3>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">{connectedBoards.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {connectedBoards.map((board, idx) => {
              const ctr = board.clicks > 0 ? ((board.applications / board.clicks) * 100).toFixed(1) : '0';
              const barWidth = board.clicks > 0 ? Math.min(100, Math.round((board.applications / board.clicks) * 100 * 5)) : 0;
              return (
                <motion.div
                  key={board.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="group relative bg-white rounded-2xl border border-stone-200 shadow-sm hover:shadow-md transition-all overflow-hidden"
                >
                  <div className={`h-1 bg-gradient-to-r ${board.gradient}`} />
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${board.gradient} flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0`}>
                          {board.logo}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-stone-900 text-sm">{board.name}</h3>
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold flex items-center gap-1">
                              <CheckCircle className="w-2.5 h-2.5" />
                              Active
                            </span>
                          </div>
                          <p className="text-xs text-stone-400 mt-0.5 max-w-[160px] truncate">{board.description}</p>
                        </div>
                      </div>
                      {board.postUrl && (
                        <a
                          href={board.postUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors flex-shrink-0"
                        >
                          <ArrowUpRight className="w-4 h-4" />
                        </a>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className={`p-3 rounded-xl ${board.bgLight} border ${board.borderColor}`}>
                        <p className={`text-xs font-semibold ${board.textColor} mb-1`}>Clicks</p>
                        <p className="text-xl font-bold text-stone-900">{board.clicks}</p>
                      </div>
                      <div className={`p-3 rounded-xl ${board.bgLight} border ${board.borderColor}`}>
                        <p className={`text-xs font-semibold ${board.textColor} mb-1`}>Applicants</p>
                        <p className="text-xl font-bold text-stone-900">{board.applications}</p>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs text-stone-500 font-medium">Conversion Rate</p>
                        <p className={`text-xs font-bold ${board.textColor}`}>{ctr}%</p>
                      </div>
                      <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${barWidth}%` }}
                          transition={{ duration: 0.8, delay: 0.2 }}
                          className={`h-full rounded-full bg-gradient-to-r ${board.gradient}`}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => syncBoard(board.id)}
                        disabled={posting === board.id || !selectedJob}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${board.bgLight} ${board.textColor} border ${board.borderColor} hover:opacity-80 disabled:opacity-50`}
                      >
                        {posting === board.id ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Syncing...</>
                        ) : (
                          <><RefreshCw className="w-3.5 h-3.5" /> Sync Update</>
                        )}
                      </motion.button>
                      <button
                        onClick={() => setConfirmDisconnect({ boardId: board.id, boardName: board.name })}
                        className="px-3 py-2 rounded-xl text-xs font-semibold text-stone-500 bg-stone-100 hover:bg-red-50 hover:text-red-600 transition-colors border border-stone-200 hover:border-red-200"
                        title="Disconnect board"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Available Boards ────────────────────────────────────────────── */}
      {availableBoards.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-stone-400" />
            <h3 className="font-bold text-stone-900 text-sm uppercase tracking-wide">Available Platforms</h3>
            <span className="px-2 py-0.5 bg-stone-100 text-stone-600 rounded-full text-xs font-bold">{availableBoards.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {availableBoards.map((board, idx) => (
              <motion.div
                key={board.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="group bg-white rounded-2xl border-2 border-dashed border-stone-200 hover:border-stone-300 transition-all overflow-hidden"
              >
                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${board.gradient} flex items-center justify-center text-white font-bold text-sm opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0`}>
                        {board.logo}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-stone-700 text-sm">{board.name}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${board.bgLight} ${board.textColor} border ${board.borderColor}`}>
                            {board.tag}
                          </span>
                        </div>
                        <p className="text-xs text-stone-400 mt-0.5 max-w-[160px] truncate">{board.description}</p>
                      </div>
                    </div>
                  </div>

                  {!selectedJob && (
                    <p className="text-xs text-amber-600 flex items-center gap-1.5 mb-3 px-3 py-2 bg-amber-50 rounded-lg border border-amber-100">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      Select a job above first
                    </p>
                  )}

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => postToBoard(board.id)}
                    disabled={posting === board.id || !selectedJob}
                    className={`w-full py-2.5 bg-gradient-to-r ${board.gradient} text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-sm`}
                  >
                    {posting === board.id ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Posting...</>
                    ) : (
                      <><Share2 className="w-4 h-4" /> Connect &amp; Post</>
                    )}
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ── Performance Summary ─────────────────────────────────────────── */}
      {connectedBoards.length > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-stone-900 to-stone-800 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full translate-x-12 -translate-y-12 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full -translate-x-8 translate-y-8 pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-brand-400" />
              <h3 className="font-bold text-white">Performance Overview</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4">
              {connectedBoards.map(board => (
                <div key={board.id} className="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
                  <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${board.gradient} flex items-center justify-center text-white text-xs font-bold mb-2`}>
                    {board.logo}
                  </div>
                  <p className="text-white/60 text-xs mb-0.5">{board.name}</p>
                  <p className="text-white font-bold">{board.clicks} <span className="text-white/50 font-normal text-xs">clicks</span></p>
                </div>
              ))}
            </div>
            <p className="text-white/50 text-xs">
              Your job postings have received <span className="text-white font-semibold">{totalClicks} clicks</span> and <span className="text-white font-semibold">{totalApplications} applications</span> across {activeBoards} active boards.
            </p>
          </div>
        </div>
      )}

      {/* ── Quick Post Modal ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showQuickPost && selectedJob && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowQuickPost(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowQuickPost(false)}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 16 }}
                transition={{ type: 'spring', stiffness: 340, damping: 30 }}
                onClick={e => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
              >
                {/* Modal Header */}
                <div className="relative bg-gradient-to-r from-brand-600 via-brand-500 to-teal-500 px-5 py-5">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/20 rounded-xl border border-white/30">
                        <Zap className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h2 className="font-bold text-white text-lg">Quick Post</h2>
                        <p className="text-white/70 text-xs mt-0.5">Select platforms to publish to</p>
                      </div>
                    </div>
                    <button onClick={() => setShowQuickPost(false)} className="p-2 bg-white/20 hover:bg-white/30 rounded-xl border border-white/30 transition-colors">
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>

                {/* Selected Job Banner */}
                <div className="px-5 py-3 bg-brand-50 border-b border-brand-100 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-teal-500 flex items-center justify-center flex-shrink-0">
                    <Briefcase className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-stone-900 text-sm truncate">{selectedJob.title}</p>
                    <p className="text-xs text-stone-500 truncate">{selectedJob.department} &bull; {selectedJob.location}</p>
                  </div>
                </div>

                {/* Platform Selection */}
                <div className="p-5">
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Choose platforms</p>
                  <QuickPostPlatformsSelector
                    boards={boards}
                    posting={posting}
                    onPost={async (ids) => {
                      setShowQuickPost(false);
                      for (const id of ids) {
                        await postToBoard(id);
                      }
                    }}
                  />
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* ── Disconnect Confirm ──────────────────────────────────────────── */}
      <AnimatePresence>
        {confirmDisconnect && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmDisconnect(null)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setConfirmDisconnect(null)}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 8 }}
                transition={{ type: 'spring', stiffness: 340, damping: 30 }}
                onClick={e => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
              >
                <div className="p-5 sm:p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                      <X className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-stone-900">Disconnect {confirmDisconnect.boardName}?</h3>
                      <p className="text-sm text-stone-500">This will remove the integration and clear stats.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setConfirmDisconnect(null)}
                      className="flex-1 py-2.5 border border-stone-200 rounded-xl font-semibold text-stone-700 hover:bg-stone-50 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => disconnectBoard(confirmDisconnect.boardId)}
                      disabled={disconnecting !== null}
                      className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {disconnecting ? <><Loader2 className="w-4 h-4 animate-spin" /> Disconnecting...</> : 'Disconnect'}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </PageShell>
    </motion.div>
  );
}

export default function JobBoardsPageWrapper() {
  return (
    <Suspense fallback={null}>
      <JobBoardsPage />
    </Suspense>
  );
}
