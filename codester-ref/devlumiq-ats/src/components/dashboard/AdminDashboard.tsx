'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Shield, Activity, Crown, RefreshCw, UserCheck,
  UserX, Edit2, LogIn, Settings, BarChart3, Briefcase,
  TrendingUp, AlertTriangle, ArrowRight, Clock, Zap,
  ChevronRight, Sparkles, Layers, PieChart, Search,
  Radio,
} from 'lucide-react';
import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import PageShell from '@/components/ui/PageShell';
import StatCard from '@/components/ui/StatCard';
import RoleBadge from '@/components/ui/RoleBadge';
import { ROLE_UI } from '@/lib/roleUi';

interface UserRow { id: string; name: string; email: string; role: string; isActive: boolean; lastLoginAt: string | null; createdAt: string }
interface LogEntry { id: string; action: string; metadata: Record<string, unknown>; createdAt: string; user: { name: string; email: string; role: string } }
interface SummaryData { totalCandidates: number; openPositions: number; conversionRate: number; pipeline: { stage: string; count: number }[] }

const ACTION_CONFIG: Record<string, { icon: React.ElementType; bg: string; text: string; label: string }> = {
  login:            { icon: LogIn,       bg: 'bg-emerald-50', text: 'text-emerald-600', label: 'Signed in' },
  logout:           { icon: LogIn,       bg: 'bg-stone-100',  text: 'text-stone-500',   label: 'Signed out' },
  role_change:      { icon: Crown,       bg: 'bg-violet-50',  text: 'text-violet-600',  label: 'Role changed' },
  user_deactivated: { icon: UserX,       bg: 'bg-red-50',     text: 'text-red-600',     label: 'Deactivated' },
  user_activated:   { icon: UserCheck,   bg: 'bg-emerald-50', text: 'text-emerald-600', label: 'Activated' },
  profile_update:   { icon: Edit2,       bg: 'bg-brand-50',   text: 'text-brand-600',   label: 'Profile updated' },
  settings_change:  { icon: Settings,    bg: 'bg-amber-50',   text: 'text-amber-600',   label: 'Settings changed' },
};
const DEFAULT_ACTION = { icon: Activity, bg: 'bg-stone-100', text: 'text-stone-500', label: 'Activity' };

const STAGE_META: Record<string, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  Applied:    { icon: Layers,    color: 'text-brand-600',    bg: 'bg-brand-50',    border: 'border-brand-200' },
  Screening:  { icon: Search,    color: 'text-violet-600',   bg: 'bg-violet-50',   border: 'border-violet-200' },
  Interview:  { icon: Radio,     color: 'text-sky-600',      bg: 'bg-sky-50',      border: 'border-sky-200' },
  Offer:      { icon: Zap,       color: 'text-amber-600',    bg: 'bg-amber-50',    border: 'border-amber-200' },
  Hired:      { icon: UserCheck, color: 'text-emerald-600',  bg: 'bg-emerald-50',  border: 'border-emerald-200' },
  Rejected:   { icon: UserX,     color: 'text-red-600',      bg: 'bg-red-50',      border: 'border-red-200' },
  Dropped:    { icon: Clock,     color: 'text-stone-600',    bg: 'bg-stone-50',    border: 'border-stone-200' },
};

const ROLES_ORDER = ['ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER', 'VIEWER'] as const;

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.05 } } };
const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] } } };

export default function AdminDashboard() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, lRes, sRes] = await Promise.all([
        fetch('/api/users', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/audit-logs?limit=8', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/dashboard/summary', { credentials: 'include', cache: 'no-store' }),
      ]);
      if (uRes.ok) { const d = await uRes.json(); setUsers(d.users ?? []); }
      if (lRes.ok) { const d = await lRes.json(); setLogs(d.logs ?? []); }
      if (sRes.ok) { const d = await sRes.json(); setSummary(d); }
      setLastRefreshed(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const roleCount = (role: string) => users.filter(u => u.role === role).length;
  const activeCount = users.filter(u => u.isActive).length;
  const inactiveCount = users.length - activeCount;

  return (
    <PageShell>
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        <motion.div variants={fadeUp}>
          <PageHeader
            icon={Shield}
            title="Admin Console"
            subtitle={
              <>
                Organisation health · updated{' '}
                <span className="text-stone-700 font-medium">{lastRefreshed.toLocaleTimeString()}</span>
              </>
            }
          >
            <div className="flex items-center gap-2.5 flex-wrap">
              <Link
                href="/dashboard/settings/users"
                className="btn-primary !px-4 !py-2.5 !text-sm"
              >
                <Users className="w-4 h-4" />
                Manage Users
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
          <StatCard
            label="Total Users"
            value={users.length}
            icon={Users}
            iconClassName="text-violet-600 bg-violet-50"
            sub={`${activeCount} active · ${inactiveCount} inactive`}
          />
          <StatCard
            label="Open Positions"
            value={summary?.openPositions ?? 0}
            icon={Briefcase}
            iconClassName="text-brand-600 bg-brand-50"
            sub="Active jobs posted"
          />
          <StatCard
            label="Candidates"
            value={summary?.totalCandidates ?? 0}
            icon={TrendingUp}
            iconClassName="text-sky-600 bg-sky-50"
            sub="In hiring pipeline"
          />
          <StatCard
            label="Hire Rate"
            value={`${summary?.conversionRate ?? 0}%`}
            icon={BarChart3}
            iconClassName="text-emerald-600 bg-emerald-50"
            sub="Overall conversion"
          />
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <motion.div variants={fadeUp} className="lg:col-span-2 card-ats-bordered p-5 sm:p-6 min-w-0">
            <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-4 h-4 text-violet-600" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-stone-900">Team Roles</h2>
                  <p className="text-xs text-stone-500 truncate">Role distribution across {users.length} members</p>
                </div>
              </div>
              <Link href="/dashboard/settings/users" className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors flex-shrink-0">
                View all <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-3">
              {ROLES_ORDER.map((role) => {
                const count = roleCount(role);
                const pct = users.length > 0 ? Math.round((count / users.length) * 100) : 0;
                const meta = ROLE_UI[role];
                return (
                  <div key={role} className="group flex items-center gap-2 sm:gap-4 p-2.5 -mx-1 rounded-xl hover:bg-stone-50 transition-colors min-w-0">
                    <span className={`text-[10px] font-bold px-2 sm:px-2.5 py-1 rounded-lg uppercase border ${meta.badge} w-[88px] sm:w-[120px] text-center flex-shrink-0 truncate`}>
                      {meta.label}
                    </span>
                    <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden min-w-0">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
                        className={`h-full rounded-full bg-gradient-to-r ${meta.barFrom} ${meta.barTo}`}
                      />
                    </div>
                    <span className="text-sm font-bold text-stone-700 w-6 sm:w-8 text-right flex-shrink-0">{count}</span>
                    <span className="text-xs text-stone-400 w-8 sm:w-9 flex-shrink-0 hidden sm:inline">{pct}%</span>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 pt-5 border-t border-stone-100">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Recently Added</p>
              </div>
              <div className="space-y-2">
                {users.slice(0, 5).map((u, idx) => {
                  const avatarGrad = ['from-violet-500 to-purple-600', 'from-brand-500 to-teal-600', 'from-sky-500 to-blue-500', 'from-amber-500 to-orange-500', 'from-stone-500 to-stone-400'][idx % 5];
                  return (
                    <div key={u.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-stone-50 transition-colors group min-w-0">
                      <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${avatarGrad} flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 shadow-sm`}>
                        {u.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-stone-800 truncate">{u.name}</p>
                        <p className="text-xs text-stone-400 truncate">{u.email}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end max-w-[50%]">
                        <RoleBadge role={u.role} />
                        {!u.isActive && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            <AlertTriangle className="w-2.5 h-2.5" />Inactive
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>

          <motion.div variants={fadeUp} className="card-ats-bordered p-5 sm:p-6 min-w-0">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0">
                <Activity className="w-4 h-4 text-brand-600" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-stone-900">Audit Activity</h2>
                <p className="text-xs text-stone-500">Recent system events</p>
              </div>
            </div>

            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center mb-3">
                  <Activity className="w-5 h-5 text-stone-400" />
                </div>
                <p className="text-sm text-stone-500 font-medium">No activity yet</p>
                <p className="text-xs text-stone-400 mt-1">Events will appear here</p>
              </div>
            ) : (
              <div className="relative space-y-0">
                <div className="absolute left-[15px] top-2 bottom-2 w-px bg-gradient-to-b from-stone-200 via-stone-200 to-transparent" />
                {logs.map((log) => {
                  const cfg = ACTION_CONFIG[log.action] ?? DEFAULT_ACTION;
                  const Icon = cfg.icon;
                  const time = new Date(log.createdAt);
                  const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const dateStr = time.toLocaleDateString([], { month: 'short', day: 'numeric' });
                  return (
                    <div key={log.id} className="relative flex items-start gap-3.5 pb-5 last:pb-0 group min-w-0">
                      <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center ${cfg.bg} ring-2 ring-white shadow-sm flex-shrink-0 mt-0.5`}>
                        <Icon className={`w-3.5 h-3.5 ${cfg.text}`} />
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <p className="text-sm font-semibold text-stone-800 truncate">{log.user.name}</p>
                        <p className="text-xs text-stone-500 mt-0.5">{cfg.label}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-[10px] font-medium text-stone-400">{dateStr}</span>
                          <span className="w-1 h-1 rounded-full bg-stone-300" />
                          <span className="text-[10px] font-medium text-stone-400">{timeStr}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-5 pt-4 border-t border-stone-100">
              <Link
                href="/dashboard/settings/audit-log"
                className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl text-xs font-semibold text-stone-600 bg-stone-50 hover:bg-stone-100 border border-stone-200 transition-colors"
              >
                View Full Audit Log <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </motion.div>
        </div>

        {summary?.pipeline && (
          <motion.div variants={fadeUp} className="card-ats-bordered p-5 sm:p-6 min-w-0">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-xl bg-sky-100 flex items-center justify-center flex-shrink-0">
                <PieChart className="w-4 h-4 text-sky-600" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-stone-900">Pipeline Overview</h2>
                <p className="text-xs text-stone-500">Candidate distribution by stage</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-3">
              {summary.pipeline
                .filter((p) => p.count > 0 || ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected', 'Dropped'].includes(p.stage))
                .map((p, i) => {
                  const meta = STAGE_META[p.stage] ?? STAGE_META.Dropped;
                  const Icon = meta.icon;
                  return (
                    <motion.div
                      key={p.stage}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 + i * 0.04, duration: 0.3 }}
                      className={`relative rounded-2xl border ${meta.border} ${meta.bg} p-4 text-center min-w-0 overflow-hidden`}
                    >
                      <div className={`absolute bottom-0 left-0 right-0 h-[3px] ${meta.color.replace('text-', 'bg-')}`} />
                      <div className="relative">
                        <div className={`w-10 h-10 rounded-xl ${meta.bg} border ${meta.border} flex items-center justify-center mx-auto mb-3`}>
                          <Icon className={`w-5 h-5 ${meta.color}`} />
                        </div>
                        <p className="text-2xl font-bold text-stone-900">{p.count}</p>
                        <p className={`text-xs font-semibold mt-1 truncate ${meta.color}`}>{p.stage}</p>
                      </div>
                    </motion.div>
                  );
                })}
            </div>
          </motion.div>
        )}
      </motion.div>
    </PageShell>
  );
}
