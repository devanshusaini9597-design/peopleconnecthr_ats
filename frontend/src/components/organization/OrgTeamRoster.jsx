import React, { useMemo, useState } from 'react';
import {
  Users, Loader2, Trash2, Link2, KeyRound, Search,
} from 'lucide-react';
import PremiumSelect from '../ui/PremiumSelect';
import EmptyState from '../ui/EmptyState';
import PresenceAvatar from '../ui/PresenceAvatar';
import PresenceBadge, { presenceFromLastActive, lastSeenLabel } from '../ui/PresenceBadge';
import { usePresence } from '../../context/PresenceContext';
import { useAuth } from '../../context/AuthContext';
import useTableDragScroll from '../../hooks/useTableDragScroll';
import { MEMBER_ROLE_OPTIONS, ROLE_LABELS } from './constants';

function formatPersonName(name, fallback = '') {
  const raw = String(name || '').trim();
  if (!raw) return fallback;
  const shouting = raw === raw.toUpperCase() && /[A-Z]/.test(raw) && raw.length > 1;
  if (!shouting) return raw;
  return raw.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function CellSelect({ busy, children }) {
  return (
    <div className="relative min-w-0 w-full">
      {children}
      {busy ? (
        <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-600 animate-spin pointer-events-none" />
      ) : null}
    </div>
  );
}

function StaticCell({ children }) {
  return (
    <span className="text-[13px] font-medium text-stone-600">{children}</span>
  );
}

export default function OrgTeamRoster({
  members,
  customRoles,
  handleChangeMemberRole,
  handleChangeMemberCustomRole,
  handleChangeMemberReportsTo,
  roleUpdatingId,
  customRoleUpdatingId,
  reportsToUpdatingId,
  setRemoveTarget,
  handleGetMemberInviteLink,
  inviteLinkLoadingId,
  setResetTarget,
}) {
  const { user } = useAuth();
  const { byId } = usePresence();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const {
    tableScrollRef,
    onTableDragScrollStart,
    onTableDragScrollMove,
    onTableDragScrollEnd,
  } = useTableDragScroll();

  const canResetPasswords = ['owner', 'admin'].includes(user?.role);
  const selfId = String(user?.id || user?._id || '');
  const canAssignReports = ['owner', 'admin', 'hr_manager'].includes(user?.role);
  const showPack = customRoles.length > 0;
  const tableMinWidth = showPack ? 1180 : 980;

  const packOptions = useMemo(() => ([
    { value: '', label: 'No custom role', description: 'Uses only the system role above' },
    ...customRoles.map((r) => ({
      value: r._id,
      label: r.name,
      description: r.description || `${r.permissions?.length || 0} extra permissions`,
    })),
  ]), [customRoles]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      const pending = m.isActive === false;
      const status = pending
        ? 'invited'
        : (byId[String(m._id)]?.status || presenceFromLastActive(m.lastActiveAt || m.lastLoginAt));
      if (filter === 'invited' && !pending) return false;
      if (filter === 'active' && pending) return false;
      if (filter === 'online' && status !== 'online') return false;
      if (!q) return true;
      const hay = `${m.name || ''} ${m.email || ''} ${m.role || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [members, query, filter, byId]);

  const invitedCount = members.filter((m) => m.isActive === false).length;

  return (
    <div className="table-shell-ats">
      <div className="h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
      <div className="px-4 py-3 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-stone-900 tracking-tight">
            People
            <span className="ml-2 text-xs font-semibold text-stone-500 tabular-nums">{members.length}</span>
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or email"
              className="w-full h-8 pl-8 pr-3 rounded-lg border border-stone-200 bg-white text-[13px] text-stone-800 placeholder:text-stone-400 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div className="inline-flex rounded-lg border border-stone-200 bg-stone-50 p-0.5 text-[11px] font-semibold">
            {[
              { id: 'all', label: 'All' },
              { id: 'active', label: 'Active' },
              { id: 'invited', label: `Invited${invitedCount ? ` ${invitedCount}` : ''}` },
              { id: 'online', label: 'Online' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`h-7 px-2.5 rounded-md transition-colors ${
                  filter === tab.id ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          tone="emerald"
          message={members.length ? 'No people match that search' : 'No team members yet'}
          subMessage={members.length ? 'Try a different name or filter.' : 'Invite colleagues above to collaborate on hiring.'}
        />
      ) : (
        <div
          ref={tableScrollRef}
          className="cand-table-scroll overflow-x-auto select-none"
          onMouseDown={onTableDragScrollStart}
          onMouseMove={onTableDragScrollMove}
          onMouseUp={onTableDragScrollEnd}
          onMouseLeave={onTableDragScrollEnd}
        >
          <table
            className="cand-table-drag w-full text-left text-sm border-collapse select-text border border-stone-200"
            style={{ minWidth: tableMinWidth }}
          >
            <thead>
              <tr className="bg-stone-50 text-[11px] font-semibold uppercase tracking-wide text-stone-500 border-b border-stone-200">
                <th className="px-4 py-2.5 font-semibold whitespace-nowrap min-w-[260px] border border-stone-200 bg-stone-50">
                  Member
                </th>
                <th className="px-3 py-2.5 font-semibold whitespace-nowrap min-w-[180px] border border-stone-200 bg-stone-50">System role</th>
                {showPack && (
                  <th className="px-3 py-2.5 font-semibold whitespace-nowrap min-w-[200px] border border-stone-200 bg-stone-50">Custom role</th>
                )}
                <th className="px-3 py-2.5 font-semibold whitespace-nowrap min-w-[200px] border border-stone-200 bg-stone-50">Reports to</th>
                <th className="px-3 py-2.5 font-semibold whitespace-nowrap min-w-[120px] border border-stone-200 bg-stone-50">Status</th>
                <th className="px-3 py-2.5 font-semibold text-right whitespace-nowrap min-w-[132px] border border-stone-200 bg-stone-50">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const isOwner = m.role === 'owner';
                const pending = m.isActive === false;
                const isSelf = String(m._id) === selfId;
                const packId = m.customRoleId
                  ? (typeof m.customRoleId === 'object' ? m.customRoleId._id : m.customRoleId)
                  : '';
                const managerId = m.reportsTo
                  ? (typeof m.reportsTo === 'object' ? m.reportsTo._id : m.reportsTo)
                  : '';
                const managerName = formatPersonName(
                  m.reportsTo && typeof m.reportsTo === 'object'
                    ? (m.reportsTo.name || m.reportsTo.email || '')
                    : ''
                );
                const busy = roleUpdatingId === m._id
                  || customRoleUpdatingId === m._id
                  || reportsToUpdatingId === m._id;
                const canResetThis = canResetPasswords
                  && !isSelf
                  && !(isOwner && user?.role !== 'owner');
                const presence = pending
                  ? null
                  : (byId[String(m._id)]?.status || presenceFromLastActive(m.lastActiveAt || m.lastLoginAt));
                const displayName = formatPersonName(m.name, pending ? 'Invite sent' : 'Unnamed');

                return (
                  <tr
                    key={m._id}
                    className={`group border-b border-stone-100 last:border-b-0 ${busy ? 'bg-brand-50/50' : 'hover:bg-stone-50/90'}`}
                  >
                    <td className="px-4 py-2.5 align-middle min-w-[260px] border border-stone-200 bg-white">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <PresenceAvatar
                          name={displayName}
                          email={m.email}
                          photo={byId[String(m._id)]?.profilePicture || m.profilePicture}
                          status={pending ? undefined : presence}
                          size={32}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className="text-[13px] font-semibold text-stone-900 whitespace-nowrap leading-tight" title={displayName}>
                              {displayName}
                            </p>
                            {isSelf && (
                              <span className="flex-shrink-0 text-[10px] font-semibold text-brand-700 bg-brand-50 border border-brand-200 rounded px-1 leading-4">
                                You
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-stone-500 whitespace-nowrap leading-tight mt-0.5" title={m.email}>{m.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-2.5 align-middle min-w-[180px] border border-stone-200 bg-white">
                      {isOwner ? (
                        <StaticCell>{ROLE_LABELS.owner}</StaticCell>
                      ) : (
                        <CellSelect busy={roleUpdatingId === m._id}>
                          <PremiumSelect
                            compact
                            variant="list"
                            value={m.role}
                            onChange={(v) => handleChangeMemberRole(m._id, v)}
                            options={MEMBER_ROLE_OPTIONS}
                            placeholder="Select role"
                            disabled={roleUpdatingId === m._id}
                            menuMinWidth={240}
                          />
                        </CellSelect>
                      )}
                    </td>

                    {showPack && (
                      <td className="px-3 py-2.5 align-middle min-w-[200px] border border-stone-200 bg-white">
                        {isOwner ? (
                          <StaticCell>Full access</StaticCell>
                        ) : (
                          <CellSelect busy={customRoleUpdatingId === m._id}>
                            <PremiumSelect
                              compact
                              variant="list"
                              searchable={customRoles.length > 6}
                              searchPlaceholder="Search custom roles…"
                              value={packId || ''}
                              onChange={(v) => handleChangeMemberCustomRole(m._id, v)}
                              options={packOptions}
                              placeholder="No custom role"
                              disabled={customRoleUpdatingId === m._id}
                              menuMinWidth={280}
                            />
                          </CellSelect>
                        )}
                      </td>
                    )}

                    <td className="px-3 py-2.5 align-middle min-w-[200px] border border-stone-200 bg-white">
                      {canAssignReports && !isOwner && m.role !== 'freelancer' ? (
                        <CellSelect busy={reportsToUpdatingId === m._id}>
                          <PremiumSelect
                            compact
                            variant="list"
                            searchable
                            searchPlaceholder="Search…"
                            value={managerId || ''}
                            onChange={(v) => handleChangeMemberReportsTo(m._id, v)}
                            options={[
                              { value: '', label: 'Unassigned', description: 'Does not report to anyone' },
                              ...members
                                .filter((other) => String(other._id) !== String(m._id) && other.isActive !== false)
                                .map((other) => ({
                                  value: other._id,
                                  label: formatPersonName(other.name, other.email),
                                  description: other.email,
                                })),
                            ]}
                            placeholder="Unassigned"
                            disabled={reportsToUpdatingId === m._id}
                            menuMinWidth={280}
                          />
                        </CellSelect>
                      ) : (
                        <StaticCell>
                          <span className="block whitespace-nowrap" title={managerName || undefined}>{managerName || '—'}</span>
                        </StaticCell>
                      )}
                    </td>

                    <td className="px-3 py-2.5 align-middle whitespace-nowrap min-w-[120px] border border-stone-200 bg-white">
                      {pending ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          Invited
                        </span>
                      ) : (
                        <PresenceBadge
                          compact
                          status={presence}
                          lastLabel={
                            presence === 'online'
                              ? null
                              : lastSeenLabel(byId[String(m._id)]?.lastActiveAt || m.lastActiveAt || m.lastLoginAt)
                          }
                        />
                      )}
                    </td>

                    <td className="px-3 py-2.5 align-middle text-right whitespace-nowrap min-w-[132px] border border-stone-200 bg-white">
                      <div className="inline-flex items-center justify-end gap-1">
                        {canResetThis && (
                          <button
                            type="button"
                            className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-stone-200 bg-white text-stone-600 hover:border-brand-300 hover:text-brand-800 hover:bg-brand-50"
                            title="Reset password"
                            aria-label="Reset password"
                            onClick={() => setResetTarget?.(m)}
                          >
                            <KeyRound size={14} />
                          </button>
                        )}
                        {pending && !isOwner && (
                          <button
                            type="button"
                            className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-stone-200 bg-white text-stone-600 hover:border-brand-300 hover:text-brand-800 hover:bg-brand-50 disabled:opacity-50"
                            title="Share invitation"
                            aria-label="Share invitation"
                            disabled={inviteLinkLoadingId === m._id}
                            onClick={() => handleGetMemberInviteLink?.(m._id)}
                          >
                            {inviteLinkLoadingId === m._id
                              ? <Loader2 size={14} className="animate-spin" />
                              : <Link2 size={14} />}
                          </button>
                        )}
                        {!isOwner && !isSelf && (
                          <button
                            type="button"
                            className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-stone-200 bg-white text-stone-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50"
                            aria-label={`Remove ${displayName || m.email}`}
                            title="Remove"
                            onClick={() => setRemoveTarget(m)}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
