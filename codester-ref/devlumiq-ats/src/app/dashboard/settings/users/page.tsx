'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Plus, Shield, Search, ChevronDown, X, Check,
  Loader2, AlertTriangle, UserCheck, UserX,
  Crown, RefreshCw, Mail,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import PageShell from '@/components/ui/PageShell';
import StatCard from '@/components/ui/StatCard';
import RoleBadge from '@/components/ui/RoleBadge';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_DISPLAY_NAMES, ROLE_DESCRIPTIONS, ROLES, Role } from '@/lib/roles';
import { ROLE_UI } from '@/lib/roleUi';

// ─── Types ──────────────────────────────────────────────────────────────────
interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

const labelCls = 'block text-xs font-semibold text-stone-500 mb-1.5';

// ─── Invite Modal ────────────────────────────────────────────────────────────
function InviteModal({ onClose, onCreated }: { onClose: () => void; onCreated: (u: UserRow) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('RECRUITER');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!name.trim()) return setError('Name is required');
    if (!email.trim()) return setError('Email is required');
    setSaving(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), role }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? 'Failed to create user');
      onCreated(data.user);
      onClose();
    } catch {
      setError('Network error, please try again');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-stone-100 overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-brand-50 rounded-lg"><Users className="w-4 h-4 text-brand-600" /></div>
            <h2 className="font-bold text-stone-900">Invite Team Member</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-100 transition-colors">
            <X className="w-4 h-4 text-stone-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}
          <div>
            <label className={labelCls}>Full Name</label>
            <input className="input-ats" placeholder="Jane Smith" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Email Address</label>
            <input className="input-ats" type="email" placeholder="jane@company.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Role</label>
            <div className="relative">
              <select
                className="input-ats appearance-none pr-8"
                value={role}
                onChange={e => setRole(e.target.value as Role)}
              >
                {(Object.keys(ROLES) as Role[]).map(r => (
                  <option key={r} value={r}>{ROLE_DISPLAY_NAMES[r]}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
            </div>
            <p className="mt-1.5 text-xs text-stone-400">{ROLE_DESCRIPTIONS[role]}</p>
          </div>
          <p className="text-xs text-stone-400 bg-stone-50 rounded-lg px-3 py-2">
            An invitation email with a secure setup link will be sent to this address. The user will set their own password.
          </p>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-stone-100 bg-stone-50/50">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-xl border border-stone-200 text-sm font-semibold text-stone-600 hover:bg-stone-100 transition-colors">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex-1 btn-primary !px-4 !py-2.5 !text-sm disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {saving ? 'Creating…' : 'Invite User'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Role Edit Dropdown ──────────────────────────────────────────────────────
function RoleSelect({ userId, current, onUpdated }: { userId: string; current: Role; onUpdated: (role: Role) => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const change = async (role: Role) => {
    if (role === current) return setOpen(false);
    setSaving(true);
    setOpen(false);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
        credentials: 'include',
      });
      if (res.ok) onUpdated(role);
    } finally {
      setSaving(false);
    }
  };

  const meta = ROLE_UI[current];
  const RoleIcon = meta.icon;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        disabled={saving}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all hover:opacity-80 ${meta.badge}`}
      >
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <RoleIcon className="w-3 h-3" />}
        {ROLE_DISPLAY_NAMES[current]}
        <ChevronDown className="w-3 h-3" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            className="absolute left-0 top-full mt-1 z-20 bg-white border border-stone-200 rounded-xl shadow-xl min-w-[180px] overflow-hidden"
          >
            {(Object.keys(ROLES) as Role[]).map(r => {
              const s = ROLE_UI[r];
              const Icon = s.icon;
              return (
                <button
                  key={r}
                  onClick={() => change(r)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold transition-colors hover:bg-stone-50 ${r === current ? 'bg-stone-50' : ''}`}
                >
                  <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${s.badge}`}>
                    <Icon className="w-3 h-3" />{ROLE_DISPLAY_NAMES[r]}
                  </span>
                  {r === current && <Check className="w-3 h-3 text-brand-500 ml-auto" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function UsersPage() {
  const { user: me, isAdmin } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'ALL'>('ALL');
  const [showInvite, setShowInvite] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users', { credentials: 'include' });
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (u: UserRow) => {
    if (u.id === me?.id) return;
    setTogglingId(u.id);
    try {
      const res = await fetch(`/api/users/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !u.isActive }),
        credentials: 'include',
      });
      if (res.ok) {
        setUsers(prev => prev.map(x => x.id === u.id ? { ...x, isActive: !u.isActive } : x));
      }
    } finally {
      setTogglingId(null);
    }
  };

  const resendInvite = async (u: UserRow) => {
    if (u.id === me?.id) return;
    setResendingId(u.id);
    try {
      const res = await fetch(`/api/users/${u.id}/resend-invite`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        alert(`Invite resent to ${u.email}`);
      } else {
        alert(data?.error ?? 'Failed to resend invite');
      }
    } finally {
      setResendingId(null);
    }
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchesSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const stats = {
    total: users.length,
    active: users.filter(u => u.isActive).length,
    admins: users.filter(u => u.role === 'ADMIN').length,
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <div className="p-4 bg-red-50 rounded-2xl"><Shield className="w-8 h-8 text-red-400" /></div>
        <h2 className="text-lg font-bold text-stone-900">Access Restricted</h2>
        <p className="text-stone-500 text-sm max-w-sm">Only Administrators can manage users and roles. Contact your admin for access.</p>
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="User Management"
        subtitle="Manage team members, roles, and access permissions"
        icon={Users}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard
          label="Total Users"
          value={stats.total}
          icon={Users}
          iconClassName="text-brand-600 bg-brand-50"
        />
        <StatCard
          label="Active"
          value={stats.active}
          icon={UserCheck}
          iconClassName="text-emerald-600 bg-emerald-50"
        />
        <StatCard
          label="Admins"
          value={stats.admins}
          icon={Crown}
          iconClassName="text-violet-600 bg-violet-50"
        />
      </div>

      {/* Toolbar */}
      <div className="toolbar-ats">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              className="input-ats pl-9"
              placeholder="Search by name or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="relative">
            <select
              className="input-ats appearance-none pl-3 pr-8 py-2.5 cursor-pointer font-medium text-stone-700"
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value as Role | 'ALL')}
            >
              <option value="ALL">All Roles</option>
              {(Object.keys(ROLES) as Role[]).map(r => (
                <option key={r} value={r}>{ROLE_DISPLAY_NAMES[r]}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400 pointer-events-none" />
          </div>
          <div className="flex gap-2">
            <button
              onClick={load}
              className="p-2.5 rounded-xl border border-stone-200 hover:bg-stone-50 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4 text-stone-500" />
            </button>
            <button
              onClick={() => setShowInvite(true)}
              className="btn-primary !px-4 !py-2.5 !text-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Invite User</span>
              <span className="sm:hidden">Invite</span>
            </button>
          </div>
        </div>
      </div>

      {/* Table — desktop */}
      <div className="hidden md:block table-shell-ats">
        <div className="table-scroll-ats">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50/60">
                <th className="text-left px-5 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">User</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Role</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Last Login</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {loading ? (
                <tr><td colSpan={5} className="text-center py-12 text-stone-400">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />Loading users…
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-stone-400">No users found</td></tr>
              ) : filtered.map(u => (
                <motion.tr
                  key={u.id}
                  layout
                  className="hover:bg-stone-50/50 transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${u.isActive ? 'bg-brand-100 text-brand-700' : 'bg-stone-100 text-stone-400'}`}>
                        {u.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className={`font-semibold ${u.isActive ? 'text-stone-900' : 'text-stone-400'}`}>{u.name}</p>
                        <p className="text-xs text-stone-400">{u.email}</p>
                      </div>
                      {u.id === me?.id && (
                        <span className="text-xs px-1.5 py-0.5 bg-brand-50 text-brand-600 rounded font-medium">You</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    {u.id === me?.id ? (
                      <RoleBadge role={u.role} showIcon size="sm" className="normal-case tracking-normal font-semibold" />
                    ) : (
                      <RoleSelect
                        userId={u.id}
                        current={u.role}
                        onUpdated={role => setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role } : x))}
                      />
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${u.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                      {u.isActive ? <><UserCheck className="w-3 h-3" />Active</> : <><UserX className="w-3 h-3" />Inactive</>}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-stone-400">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never'}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      {u.id !== me?.id && !u.lastLoginAt && (
                        <button
                          onClick={() => resendInvite(u)}
                          disabled={resendingId === u.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-50 text-brand-600 hover:bg-brand-100 transition-all disabled:opacity-50"
                          title="Resend invitation email"
                        >
                          {resendingId === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                          Resend
                        </button>
                      )}
                      {u.id !== me?.id && (
                        <button
                          onClick={() => toggleActive(u)}
                          disabled={togglingId === u.id}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            u.isActive
                              ? 'bg-red-50 text-red-600 hover:bg-red-100'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          } disabled:opacity-50`}
                        >
                          {togglingId === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : u.isActive ? <UserX className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                          {u.isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && (
          <div className="px-5 py-3 border-t border-stone-50 bg-stone-50/40 text-xs text-stone-400">
            Showing {filtered.length} of {users.length} users
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
          <p className="text-center py-10 text-sm text-stone-400">No users found</p>
        ) : filtered.map(u => (
          <motion.div key={u.id} layout className="card-ats-bordered p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${u.isActive ? 'bg-brand-100 text-brand-700' : 'bg-stone-100 text-stone-400'}`}>
                {u.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-stone-900 truncate">{u.name}</p>
                <p className="text-xs text-stone-400 truncate">{u.email}</p>
              </div>
              <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${u.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                {u.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-stone-400">Role:</span>
                {u.id === me?.id ? (
                  <RoleBadge role={u.role} showIcon size="sm" className="normal-case tracking-normal font-semibold" />
                ) : (
                  <RoleSelect
                    userId={u.id}
                    current={u.role}
                    onUpdated={role => setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role } : x))}
                  />
                )}
              </div>
              <div className="flex items-center gap-2">
                {u.id !== me?.id && !u.lastLoginAt && (
                  <button
                    onClick={() => resendInvite(u)}
                    disabled={resendingId === u.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-50 text-brand-600 disabled:opacity-50"
                  >
                    {resendingId === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                    Resend
                  </button>
                )}
                {u.id !== me?.id && (
                  <button
                    onClick={() => toggleActive(u)}
                    disabled={togglingId === u.id}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 ${
                      u.isActive ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {togglingId === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : u.isActive ? <UserX className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                    {u.isActive ? 'Deactivate' : 'Reactivate'}
                  </button>
                )}
              </div>
            </div>

            <p className="text-xs text-stone-400">
              Last login: {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Invite Modal */}
      <AnimatePresence>
        {showInvite && (
          <InviteModal
            onClose={() => setShowInvite(false)}
            onCreated={u => setUsers(prev => [u, ...prev])}
          />
        )}
      </AnimatePresence>
    </PageShell>
  );
}
