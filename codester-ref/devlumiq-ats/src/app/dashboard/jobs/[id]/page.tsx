'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Briefcase, Building2, MapPin, Users, UserCircle, Globe,
  Calendar, TrendingUp, Clock, CheckCircle2, Mail, ChevronLeft, ChevronRight,
  Sparkles, Target, Eye
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import PageShell from '@/components/ui/PageShell';
import { useLocale } from '@/components/providers/LocaleProvider';
import { stageToDisplay } from '@/lib/api-helpers';
import { JobBoardIntegration } from '@/components/premium/JobBoardIntegration';

type JobDetail = {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  status: string;
  applicants: number;
  postedAt: string;
  applications: { id: string; candidateId: string; candidateName: string; candidateEmail: string; stage: string }[];
};

const statusColors: Record<string, string> = {
  APPLIED: 'bg-blue-50 text-blue-700 border-blue-200',
  SCREENING: 'bg-amber-50 text-amber-700 border-amber-200',
  INTERVIEW: 'bg-violet-50 text-violet-700 border-violet-200',
  OFFER: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  HIRED: 'bg-green-50 text-green-700 border-green-200',
  JOINED: 'bg-brand-50 text-brand-700 border-brand-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  DROPPED: 'bg-stone-50 text-stone-600 border-stone-200',
};

const statusIcons: Record<string, React.ReactNode> = {
  APPLIED: <Target className="w-3 h-3" />,
  SCREENING: <Eye className="w-3 h-3" />,
  INTERVIEW: <Clock className="w-3 h-3" />,
  OFFER: <Sparkles className="w-3 h-3" />,
  HIRED: <CheckCircle2 className="w-3 h-3" />,
};

const PER_PAGE = 10;

export default function JobDetailPage() {
  const params = useParams();
  const { t } = useLocale();
  const id = typeof params.id === 'string' ? params.id : '';
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [activeTab, setActiveTab] = useState<'applicants' | 'boards'>('applicants');

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/jobs/${id}`, { credentials: 'include', cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: JobDetail | null) => {
        if (!cancelled && data) setJob(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  if (loading && !job) {
    return (
      <PageShell>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <Link href="/dashboard/jobs" className="inline-flex items-center gap-2 text-brand-600 font-semibold hover:underline">
            <ArrowLeft className="w-4 h-4" /> {t('jobs.backToJobs') ?? 'Back to Open Positions'}
          </Link>
          <div className="rounded-2xl border border-stone-200/80 bg-white overflow-hidden shadow-[var(--shadow-card)] animate-pulse">
            <div className="p-6 sm:p-8 border-b border-stone-100">
              <div className="h-8 w-64 bg-stone-200 rounded-lg" />
              <div className="h-4 w-48 bg-stone-100 rounded mt-3" />
            </div>
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-14 bg-stone-50 rounded-xl w-full" />
              ))}
            </div>
          </div>
        </motion.div>
      </PageShell>
    );
  }

  if (!job) {
    return (
      <PageShell>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <Link href="/dashboard/jobs" className="inline-flex items-center gap-2 text-brand-600 font-semibold hover:underline">
            <ArrowLeft className="w-4 h-4" /> {t('jobs.backToJobs') ?? 'Back to Open Positions'}
          </Link>
          <EmptyState message={t('common.noRecordFound') ?? 'No record found.'} />
        </motion.div>
      </PageShell>
    );
  }

  const applications = job.applications ?? [];
  const totalPages = Math.max(1, Math.ceil(applications.length / PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const pageApplications = applications.slice(safePage * PER_PAGE, (safePage + 1) * PER_PAGE);

  return (
    <PageShell>
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <Link href="/dashboard/jobs" className="inline-flex items-center gap-2 text-brand-600 font-semibold hover:underline">
        <ArrowLeft className="w-4 h-4" /> {t('jobs.backToJobs') ?? 'Back to Open Positions'}
      </Link>

      {/* Premium Job Header Card */}
      <div className="rounded-2xl border border-stone-200/80 bg-white overflow-hidden shadow-lg shadow-stone-200/50">
        {/* Top gradient bar */}
        <div className="h-1.5 bg-gradient-to-r from-brand-500 via-teal-500 to-emerald-500" />
        
        <div className="p-6 sm:p-8 border-b border-stone-100">
          <div className="flex flex-col lg:flex-row lg:items-start gap-6 flex-wrap">
            {/* Left: Icon & Title */}
            <div className="flex items-start gap-4 min-w-0 flex-1">
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-brand-500 via-brand-600 to-teal-700 flex items-center justify-center flex-shrink-0 shadow-lg shadow-brand-500/20 ring-1 ring-white/20 ring-inset"
              >
                <Briefcase className="w-6 h-6 sm:w-7 sm:h-7 text-white drop-shadow-sm" />
              </motion.div>
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight truncate min-w-0" style={{ letterSpacing: '-0.025em' }}>{job.title}</h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-sm text-stone-600">
                  <span className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-md bg-stone-100 flex items-center justify-center">
                      <Building2 className="w-3.5 h-3.5 text-stone-500" />
                    </div>
                    {job.department}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-md bg-stone-100 flex items-center justify-center">
                      <MapPin className="w-3.5 h-3.5 text-stone-500" />
                    </div>
                    {job.location}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-md bg-stone-100 flex items-center justify-center">
                      <Calendar className="w-3.5 h-3.5 text-stone-500" />
                    </div>
                    {job.type}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Stats */}
            <div className="flex flex-wrap gap-3 lg:ml-auto">
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200/50">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-bold text-emerald-700">{job.status}</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-50 to-blue-50 border border-brand-200/50">
                <Users className="w-4 h-4 text-brand-600" />
                <span className="text-sm font-bold text-brand-700">{job.applicants} Applicants</span>
              </div>
            </div>
          </div>
        </div>

        {/* Premium Responsive Tabs */}
        <div className="border-b border-stone-100 bg-stone-50/50">
          <nav className="flex flex-col sm:flex-row gap-2 sm:gap-1 px-4 sm:px-8 py-2 sm:py-0">
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab('applicants')}
              className={`flex items-center justify-center sm:justify-start gap-2 px-4 sm:px-5 py-3 sm:py-4 text-sm font-semibold border-2 sm:border-b-2 sm:border-t-0 sm:border-x-0 rounded-xl sm:rounded-none transition-all ${
                activeTab === 'applicants'
                  ? 'border-brand-500 text-brand-600 bg-white shadow-sm sm:shadow-none'
                  : 'border-transparent text-stone-500 hover:text-stone-700 hover:bg-white/50'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                activeTab === 'applicants' ? 'bg-brand-100' : 'bg-stone-100'
              }`}>
                <Users className="w-4 h-4" />
              </div>
              <span>Applicants</span>
              <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-stone-100 text-stone-600">
                {applications.length}
              </span>
            </motion.button>
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab('boards')}
              className={`flex items-center justify-center sm:justify-start gap-2 px-4 sm:px-5 py-3 sm:py-4 text-sm font-semibold border-2 sm:border-b-2 sm:border-t-0 sm:border-x-0 rounded-xl sm:rounded-none transition-all ${
                activeTab === 'boards'
                  ? 'border-brand-500 text-brand-600 bg-white shadow-sm sm:shadow-none'
                  : 'border-transparent text-stone-500 hover:text-stone-700 hover:bg-white/50'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                activeTab === 'boards' ? 'bg-brand-100' : 'bg-stone-100'
              }`}>
                <Globe className="w-4 h-4" />
              </div>
              <span>Job Boards</span>
            </motion.button>
          </nav>
        </div>

        <div className="p-4 sm:p-6">
          {activeTab === 'applicants' ? (
            applications.length === 0 ? (
              <EmptyState
                message={t('common.noRecordFound') ?? 'No record found.'}
                subMessage={t('jobs.noApplicantsYet') ?? 'No applicants for this job yet.'}
                icon={Users}
              />
            ) : (
              <>
                {/* Premium Stats Bar */}
                <div className="flex flex-wrap gap-3 mb-6">
                  {['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED'].map((stage) => {
                    const count = applications.filter(a => a.stage === stage).length;
                    if (count === 0) return null;
                    return (
                      <motion.div 
                        key={stage}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border ${statusColors[stage]}`}
                      >
                        {statusIcons[stage]}
                        {count} {stageToDisplay(stage)}
                      </motion.div>
                    );
                  })}
                </div>

                {/* Premium Applicants Table */}
                <div className="overflow-x-auto -mx-1 px-1">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b-2 border-stone-200">
                        <th className="text-left py-4 px-4 text-xs font-bold text-stone-500 uppercase tracking-wider">{t('candidates.candidate') ?? 'Candidate'}</th>
                        <th className="text-left py-4 px-4 text-xs font-bold text-stone-500 uppercase tracking-wider hidden sm:table-cell">Email</th>
                        <th className="text-left py-4 px-4 text-xs font-bold text-stone-500 uppercase tracking-wider">{t('candidates.status') ?? 'Stage'}</th>
                        <th className="w-32 py-4 px-4 text-right" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      <AnimatePresence mode="wait">
                        {pageApplications.map((app, idx) => (
                          <motion.tr 
                            key={app.id} 
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.03 }}
                            className="hover:bg-stone-50/80 transition-colors group"
                          >
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 flex items-center justify-center text-brand-700 font-bold text-sm flex-shrink-0">
                                  {app.candidateName.charAt(0)}
                                </div>
                                <span className="font-semibold text-stone-900">{app.candidateName}</span>
                              </div>
                            </td>
                            <td className="py-4 px-4 hidden sm:table-cell">
                              <div className="flex items-center gap-2 text-stone-600">
                                <Mail className="w-4 h-4 text-stone-400" />
                                <span className="text-sm">{app.candidateEmail}</span>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border ${statusColors[app.stage] ?? 'bg-stone-50 text-stone-600 border-stone-200'}`}>
                                {statusIcons[app.stage]}
                                {stageToDisplay(app.stage)}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                <Link
                                  href={`/dashboard/candidates/${app.candidateId}`}
                                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-50 to-brand-100 text-brand-700 font-semibold text-sm hover:from-brand-100 hover:to-brand-200 transition-all shadow-sm border border-brand-200/50 group-hover:shadow-md"
                                >
                                  <UserCircle className="w-4 h-4" />
                                  View
                                </Link>
                              </motion.div>
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>

                {/* Premium Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between gap-4 mt-6 pt-4 border-t border-stone-200">
                    <p className="text-sm text-stone-500">
                      Showing <span className="font-semibold text-stone-700">{safePage * PER_PAGE + 1}–{Math.min((safePage + 1) * PER_PAGE, applications.length)}</span> of <span className="font-semibold text-stone-700">{applications.length}</span> applicants
                    </p>
                    <div className="flex items-center gap-2">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        disabled={safePage === 0}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-stone-200 bg-white text-stone-700 font-medium text-sm hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Previous
                      </motion.button>
                      
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum: number;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (safePage < 2) {
                            pageNum = i + 1;
                          } else if (safePage > totalPages - 3) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = safePage - 1 + i;
                          }
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setPage(pageNum - 1)}
                              className={`w-9 h-9 rounded-lg text-sm font-semibold transition-all ${
                                pageNum === safePage + 1
                                  ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25'
                                  : 'hover:bg-stone-100 text-stone-600'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                        disabled={safePage >= totalPages - 1}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-stone-200 bg-white text-stone-700 font-medium text-sm hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                      >
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </div>
                )}
              </>
            )
          ) : (
            <JobBoardIntegration jobId={job.id} jobTitle={job.title} />
          )}
        </div>
      </div>
    </motion.div>
    </PageShell>
  );
}

