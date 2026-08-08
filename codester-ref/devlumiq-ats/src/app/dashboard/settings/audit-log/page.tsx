'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Shield, Search, RefreshCw, ChevronLeft, ChevronRight,
  Loader2, LogIn, Edit2, UserX, UserCheck, Settings,
  Crown, Activity, Filter,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import PageShell from '@/components/ui/PageShell';
import StatCard from '@/components/ui/StatCard';
import { useAuth } from '@/hooks/useAuth';

interface LogEntry {
  id: string;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  user: { id: string; name: string; email: string; role: string };
}

const ACTION_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  login:            { icon: LogIn,       color: 'text-emerald-600 bg-emerald-50',  label: 'Login' },
  logout:           { icon: LogIn,       color: 'text-stone-500 bg-stone-100',     label: 'Logout' },
  role_change:      { icon: Crown,       color: 'text-violet-600 bg-violet-50',    label: 'Role Changed' },
  user_deactivated: { icon: UserX,       color: 'text-red-600 bg-red-50',          label: 'User Deactivated' },
  user_activated:   { icon: UserCheck,   color: 'text-emerald-600 bg-emerald-50',  label: 'User Activated' },
  profile_update:   { icon: Edit2,       color: 'text-brand-600 bg-brand-50',      label: 'Profile Updated' },
  settings_change:  { icon: Settings,    color: 'text-amber-600 bg-amber-50',      label: 'Settings Changed' },
};

const DEFAULT_ACTION = { icon: Activity, color: 'text-stone-500 bg-stone-100', label: 'Activity' };

function ActionBadge({ action }: { action: string }) {
  const cfg = ACTION_CONFIG[action] ?? DEFAULT_ACTION;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>
      <Icon className="w-3 h-3" />{cfg.label}
    </span>
  );
}

export default function AuditLogPage() {
  const { isAdmin } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '25' });
      if (actionFilter) params.set('action', actionFilter);
      const res = await fetch(`/api/audit-logs?${params}`, { credentials: 'include' });
      const data = await res.json();
      setLogs(data.logs ?? []);
      setPages(data.pages ?? 1);
      setTotal(data.total ?? 0);
      setPage(p);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [actionFilter]);

  useEffect(() => { load(1); }, [load]);

  const filtered = search
    ? logs.filter(l =>
        l.user.name.toLowerCase().includes(search.toLowerCase()) ||
        l.user.email.toLowerCase().includes(search.toLowerCase()) ||
        l.action.toLowerCase().includes(search.toLowerCase()),
      )
    : logs;

  const formatMeta = (meta: Record<string, unknown>) => {
    if (!meta || Object.keys(meta).length === 0) return null;
    if (meta.fromRole && meta.toRole) {
      return <span className="text-xs text-stone-400">Role: <span className="font-medium text-stone-600">{String(meta.fromRole)}</span> → <span className="font-medium text-violet-600">{String(meta.toRole)}</span></span>;
    }
    if (meta.method) return <span className="text-xs text-stone-400">via {String(meta.method)}</span>;
    return null;
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <div className="p-4 bg-red-50 rounded-2xl"><Shield className="w-8 h-8 text-red-400" /></div>
        <h2 className="text-lg font-bold text-stone-900">Access Restricted</h2>
        <p className="text-stone-500 text-sm max-w-sm">Only Administrators can view audit logs.</p>
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Audit Logs"
        subtitle="Track all user actions and security events across your workspace"
        icon={Shield}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard
          label="Total Events"
          value={total}
          icon={Activity}
          iconClassName="text-stone-600 bg-stone-100"
        />
        <StatCard
          label="Role Changes"
          value={logs.filter(l => l.action === 'role_change').length}
          icon={Crown}
          iconClassName="text-violet-600 bg-violet-50"
        />
        <StatCard
          label="Logins (this page)"
          value={logs.filter(l => l.action === 'login').length}
          icon={LogIn}
          iconClassName="text-emerald-600 bg-emerald-50"
          className="col-span-2 sm:col-span-1"
        />
      </div>

      {/* Toolbar */}
      <div className="toolbar-ats">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              className="input-ats pl-9"
              placeholder="Search by user or action…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
            <select
              className="input-ats appearance-none pl-8 pr-7 cursor-pointer"
              value={actionFilter}
              onChange={e => { setActionFilter(e.target.value); }}
            >
              <option value="">All Actions</option>
              {Object.entries(ACTION_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => load(1)}
            className="p-2.5 rounded-xl border border-stone-200 hover:bg-stone-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-stone-500" />
          </button>
        </div>
      </div>

      {/* Log table — desktop */}
      <div className="hidden md:block table-shell-ats">
        <div className="table-scroll-ats">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50/60">
                <th className="text-left px-5 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">User</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Action</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Details</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {loading ? (
                <tr><td colSpan={4} className="text-center py-12 text-stone-400">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />Loading logs…
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-12 text-stone-400">No events found</td></tr>
              ) : filtered.map(log => (
                <motion.tr key={log.id} layout className="hover:bg-stone-50/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-xs font-bold text-brand-700 shrink-0">
                        {log.user.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-stone-800">{log.user.name}</p>
                        <p className="text-xs text-stone-400 truncate">{log.user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5"><ActionBadge action={log.action} /></td>
                  <td className="px-5 py-3.5">{formatMeta(log.metadata) ?? <span className="text-xs text-stone-300">—</span>}</td>
                  <td className="px-5 py-3.5 text-xs text-stone-400 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-stone-50 bg-stone-50/40">
            <span className="text-xs text-stone-400">{total} total events</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => load(page - 1)}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-100 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-medium text-stone-600">Page {page} of {pages}</span>
              <button
                onClick={() => load(page + 1)}
                disabled={page >= pages}
                className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-100 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Cards — mobile */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="flex flex-col items-center py-10 text-stone-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Loading…</span>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-10 text-sm text-stone-400">No events found</p>
        ) : filtered.map(log => (
          <div key={log.id} className="card-ats-bordered p-4 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-xs font-bold text-brand-700 shrink-0">
                  {log.user.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-stone-800 text-sm truncate">{log.user.name}</p>
                  <p className="text-xs text-stone-400 truncate">{log.user.email}</p>
                </div>
              </div>
              <ActionBadge action={log.action} />
            </div>
            <div className="flex items-center justify-between">
              {formatMeta(log.metadata) ?? <span />}
              <span className="text-xs text-stone-400">
                {new Date(log.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
        {!loading && pages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <button onClick={() => load(page - 1)} disabled={page <= 1} className="p-2 rounded-lg border border-stone-200 disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-xs text-stone-500">Page {page} of {pages}</span>
            <button onClick={() => load(page + 1)} disabled={page >= pages} className="p-2 rounded-lg border border-stone-200 disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
          </div>
        )}
      </div>
    </PageShell>
  );
}
