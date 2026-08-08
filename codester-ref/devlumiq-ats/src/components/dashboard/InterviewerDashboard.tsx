'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar, Clock, User, Briefcase, Video,
  RefreshCw, CheckCircle2, Star, ArrowRight,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import PageShell from '@/components/ui/PageShell';
import StatCard from '@/components/ui/StatCard';

interface InterviewItem {
  id: string;
  candidate: string;
  position: string;
  time: string;
  type: string;
  interviewer: string;
}

interface CallbackItem {
  id: string;
  candidateName: string;
  candidatePosition: string;
  callBackDate: string;
  daysRemaining: number;
  priority: 'urgent' | 'high' | 'medium';
}

interface SummaryData {
  upcomingInterviews: InterviewItem[];
  callbacks: CallbackItem[];
  totalCandidates: number;
  openPositions: number;
}

const PRIORITY_META: Record<string, { badge: string; dot: string }> = {
  urgent: { badge: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
  high:   { badge: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  medium: { badge: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-500' },
};

const TYPE_META: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  Technical:  { icon: Star,         color: 'text-violet-600', bg: 'bg-violet-100' },
  Behavioral: { icon: User,         color: 'text-sky-600',    bg: 'bg-sky-100' },
  'HR Screen':{ icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-100' },
};

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.05 } } };
const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] } } };

export default function InterviewerDashboard() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/summary', { credentials: 'include', cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        setData(d);
        setLastRefreshed(new Date());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const interviews = data?.upcomingInterviews ?? [];
  const callbacks = data?.callbacks ?? [];

  return (
    <PageShell>
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        <motion.div variants={fadeUp}>
          <PageHeader
            icon={Calendar}
            title="My Interview Queue"
            subtitle={
              <>
                Your assigned interviews ·{' '}
                <span className="text-stone-700 font-medium">{lastRefreshed.toLocaleTimeString()}</span>
              </>
            }
          >
            <div className="flex items-center gap-2.5 flex-wrap">
              <Link href="/dashboard/calendar" className="btn-primary !px-4 !py-2.5 !text-sm">
                <Calendar className="w-4 h-4" />
                Calendar
              </Link>
              <button
                type="button"
                onClick={load}
                disabled={loading}
                className="btn-secondary !px-2.5 !py-2.5 disabled:opacity-40"
                aria-label="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </PageHeader>
        </motion.div>

        <motion.div variants={fadeUp} className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard label="Upcoming Interviews" value={interviews.length} icon={Calendar} iconClassName="text-sky-600 bg-sky-50" sub="Next 7 days" />
          <StatCard label="Pending Follow-ups" value={callbacks.length} icon={Clock} iconClassName="text-amber-600 bg-amber-50" sub="Need action" />
          <StatCard label="Open Positions" value={data?.openPositions ?? 0} icon={Briefcase} iconClassName="text-brand-600 bg-brand-50" sub="Active jobs" />
          <StatCard label="In Pipeline" value={data?.totalCandidates ?? 0} icon={User} iconClassName="text-violet-600 bg-violet-50" sub="Total candidates" />
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <motion.div variants={fadeUp} className="card-ats-bordered p-5 sm:p-6 min-w-0">
            <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-sky-100 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-4 h-4 text-sky-600" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-stone-900">Upcoming Interviews</h2>
                  <p className="text-xs text-stone-500">{interviews.length} scheduled</p>
                </div>
              </div>
              <Link href="/dashboard/calendar" className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors flex-shrink-0">
                View calendar <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {interviews.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center mb-3">
                  <Calendar className="w-5 h-5 text-stone-400" />
                </div>
                <p className="text-sm text-stone-500 font-medium">No upcoming interviews</p>
                <p className="text-xs text-stone-400 mt-1">You have no assigned interviews in the next 7 days.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {interviews.map((iv) => {
                  const typeMeta = TYPE_META[iv.type] ?? { icon: Video, color: 'text-stone-600', bg: 'bg-stone-100' };
                  const TypeIcon = typeMeta.icon;
                  return (
                    <div key={iv.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-stone-50 transition-colors group border border-transparent hover:border-stone-200 min-w-0">
                      <div className={`w-9 h-9 rounded-xl ${typeMeta.bg} flex items-center justify-center flex-shrink-0`}>
                        <TypeIcon className={`w-4 h-4 ${typeMeta.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-stone-900 truncate">{iv.candidate}</p>
                        <p className="text-xs text-stone-500 truncate">{iv.position}</p>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="flex items-center gap-1 text-xs text-stone-500">
                            <Clock className="w-3 h-3" />{iv.time}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeMeta.bg.replace('bg-', 'border-').replace('100', '200')} ${typeMeta.color}`}>{iv.type}</span>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-stone-300 group-hover:text-stone-500 flex-shrink-0 mt-2" />
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>

          <motion.div variants={fadeUp} className="card-ats-bordered p-5 sm:p-6 min-w-0">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-stone-900">Pending Follow-ups</h2>
                <p className="text-xs text-stone-500">{callbacks.length} need attention</p>
              </div>
            </div>

            {callbacks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-5 h-5 text-stone-400" />
                </div>
                <p className="text-sm text-stone-500 font-medium">All caught up</p>
                <p className="text-xs text-stone-400 mt-1">No pending follow-ups</p>
              </div>
            ) : (
              <div className="space-y-2">
                {callbacks.map((cb) => {
                  const meta = PRIORITY_META[cb.priority] ?? PRIORITY_META.medium;
                  return (
                    <div key={cb.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-stone-50 transition-colors border border-transparent hover:border-stone-200 min-w-0">
                      <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${meta.dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-stone-900 truncate">{cb.candidateName}</p>
                        <p className="text-xs text-stone-500 truncate">{cb.candidatePosition}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.badge}`}>{cb.priority}</span>
                          <span className="text-[10px] text-stone-400">{cb.daysRemaining}d remaining</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>
      </motion.div>
    </PageShell>
  );
}
