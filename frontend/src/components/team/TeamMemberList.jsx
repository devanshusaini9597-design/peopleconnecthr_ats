import React from 'react';
import { Users, Plus, Edit2, Trash2, Mail, Phone, Building2, Loader2, Search, Link2, UserPlus } from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import PresenceAvatar from '../ui/PresenceAvatar';
import PresenceBadge, { presenceFromLastActive, lastSeenLabel } from '../ui/PresenceBadge';
import { usePresence } from '../../context/PresenceContext';
import { ROLE_COLORS, isWorkspaceMember } from './teamConstants';
import { formatRoleLabel } from '../organization/constants';

export default function TeamMemberList({
  isLoading,
  members,
  filtered,
  searchQuery,
  setSearchQuery,
  setActiveTab,
  onAddFirst,
  onInvite,
  onEdit,
  onDelete,
  deletingId,
  onCopyInviteLink,
  inviteLinkLoadingId,
}) {
  const { byId } = usePresence();
  if (isLoading) {
    return (
      <div className="card-ats-bordered overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-stone-100 bg-stone-50/80 flex items-center gap-3">
          <div className="h-4 w-32 skeleton-ats rounded-lg" />
        </div>
        <div className="divide-y divide-stone-100">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 px-5 sm:px-6 py-4">
              <div className="w-11 h-11 rounded-full skeleton-ats flex-shrink-0" />
              <div className="flex-1 space-y-2 min-w-0">
                <div className="h-4 w-40 skeleton-ats rounded-lg" />
                <div className="h-3 w-56 max-w-full skeleton-ats rounded-lg" />
              </div>
              <div className="hidden sm:block h-8 w-16 skeleton-ats rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="card-ats-bordered">
        <EmptyState
          icon={Users}
          tone="brand"
          message="No people in this workspace yet"
          subMessage="Invite a teammate for Skillnix access, or add a stakeholder to CC on candidate mail."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button type="button" onClick={onInvite} className="btn-primary">
                <UserPlus size={16} /> Invite teammate
              </button>
              <button type="button" onClick={onAddFirst} className="btn-secondary">
                <Plus size={16} /> Add stakeholder
              </button>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="card-ats-bordered overflow-hidden relative">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
      <div className="px-5 sm:px-6 py-4 border-b border-stone-100 bg-stone-50/80 flex items-center justify-between gap-3 mt-1">
        <p className="text-sm font-semibold text-stone-700">
          {filtered.length} {filtered.length === 1 ? 'person' : 'people'}
        </p>
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="text-xs font-semibold text-brand-600 hover:text-brand-700"
          >
            Clear search
          </button>
        )}
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          tone="amber"
          message="No matching people"
          subMessage="Try adjusting your search or filter."
          action={
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setActiveTab('all'); }}
              className="btn-secondary"
            >
              Clear filters
            </button>
          }
        />
      ) : (
        <div className="divide-y divide-stone-100 stagger-children">
          {filtered.map((member) => {
            const workspace = isWorkspaceMember(member);
            const pending = workspace && member.isActive === false;
            const roleLabel = workspace
              ? formatRoleLabel(member.systemRole || member.role)
              : (member.role === 'SPOC' ? 'SPOC' : member.role);
            return (
              <div
                key={member._id}
                className="flex items-center gap-3 sm:gap-4 px-5 sm:px-6 py-4 hover:bg-brand-50/30 transition-colors duration-200 group"
              >
                <PresenceAvatar
                  name={member.name}
                  email={member.email}
                  photo={byId[String(member.userId || member._id)]?.profilePicture || member.profilePicture}
                  status={workspace && !pending
                    ? ((byId[String(member.userId || member._id)]?.status)
                      || presenceFromLastActive(member.lastActiveAt || member.lastLoginAt)
                      || (member.isYou ? 'online' : 'offline'))
                    : undefined}
                  size={44}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-stone-900 truncate tracking-tight">{member.name}</p>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-lg ${ROLE_COLORS[roleLabel] || ROLE_COLORS[member.role] || 'bg-stone-100 text-stone-600'}`}>
                      {roleLabel}
                    </span>
                    {member.isYou && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-brand-50 text-brand-800 border border-brand-200">
                        You
                      </span>
                    )}
                    {workspace ? (
                      pending ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          Invited
                        </span>
                      ) : (
                        <PresenceBadge
                          compact
                          status={(byId[String(member.userId || member._id)]?.status)
                            || presenceFromLastActive(member.lastActiveAt || member.lastLoginAt)
                            || (member.isYou ? 'online' : 'offline')}
                          lastLabel={(() => {
                            const live = byId[String(member.userId || member._id)];
                            const seenAt = live?.lastActiveAt || member.lastActiveAt || member.lastLoginAt;
                            const status = live?.status || presenceFromLastActive(seenAt);
                            if (status === 'online' || member.isYou) return null;
                            return lastSeenLabel(seenAt);
                          })()}
                        />
                      )
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-stone-50 text-stone-500 border border-stone-200">
                        No login
                      </span>
                    )}
                    {member.customRoleName && (
                      <span className="text-[10px] font-semibold text-stone-400">{member.customRoleName}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                    <p className="text-xs text-stone-500 flex items-center gap-1.5 min-w-0">
                      <Mail size={12} className="text-stone-400 flex-shrink-0" />
                      <span className="truncate">{member.email}</span>
                    </p>
                    {member.phone && (
                      <p className="text-xs text-stone-400 flex items-center gap-1.5">
                        <Phone size={12} className="flex-shrink-0" /> {member.phone}
                      </p>
                    )}
                    {member.department && (
                      <p className="text-xs text-stone-400 flex items-center gap-1.5">
                        <Building2 size={12} className="flex-shrink-0" /> {member.department}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
                  {workspace && pending && onCopyInviteLink && (
                    <button
                      type="button"
                      onClick={() => onCopyInviteLink(member._id)}
                      disabled={inviteLinkLoadingId === member._id}
                      className="h-8 px-2.5 inline-flex items-center justify-center gap-1 rounded-lg border border-brand-200 bg-brand-50 text-brand-800 text-[11px] font-bold hover:bg-brand-100 disabled:opacity-50"
                      title="Copy invite link"
                    >
                      {inviteLinkLoadingId === member._id
                        ? <Loader2 size={13} className="animate-spin" />
                        : <Link2 size={13} />}
                      Link
                    </button>
                  )}
                  {!workspace && !member.invitedMe && (
                    <>
                      <button
                        type="button"
                        onClick={() => onEdit(member)}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 hover:text-brand-600 hover:border-brand-300"
                        title="Edit"
                        aria-label={`Edit ${member.name}`}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(member)}
                        disabled={deletingId === member._id}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-400 hover:text-red-600 hover:border-red-200 disabled:opacity-50"
                        title="Remove"
                        aria-label={`Remove ${member.name}`}
                      >
                        {deletingId === member._id
                          ? <Loader2 size={14} className="animate-spin" />
                          : <Trash2 size={14} />}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
