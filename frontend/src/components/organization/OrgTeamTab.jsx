import React from 'react';
import {
  Users, ExternalLink, UserPlus, Shield, ShieldPlus, Loader2, Columns3, Trash2,
} from 'lucide-react';
import PremiumSelect from '../ui/PremiumSelect';
import EmptyState from '../ui/EmptyState';
import { INVITE_ROLE_OPTIONS, MEMBER_ROLE_OPTIONS, ROLE_BADGE } from './constants';

export default function OrgTeamTab({
  navigate,
  handleInvite,
  inviteEmail,
  setInviteEmail,
  inviting,
  inviteRole,
  setInviteRole,
  customRoles,
  inviteCustomRoleId,
  setInviteCustomRoleId,
  customRolesLoading,
  members,
  handleChangeMemberRole,
  handleChangeMemberCustomRole,
  roleUpdatingId,
  customRoleUpdatingId,
  setRemoveTarget,
}) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="section-title-ats !mb-0">
            <Users className="w-4 h-4 text-brand-600" />
            Team access
          </h3>
          <p className="text-sm text-stone-500 mt-1">Invite colleagues, change roles, or remove members.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/team')}
          className="btn-secondary whitespace-nowrap"
        >
          <Users className="w-4 h-4" />
          Team Directory
          <ExternalLink className="w-3.5 h-3.5 opacity-60" />
        </button>
      </div>

      <div className="rounded-xl border border-stone-200/90 bg-white shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-stone-900 mb-4 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-brand-600" />
            Invite new member
          </h3>
          <form onSubmit={handleInvite} className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1 min-w-0">
                <label className="label-ats">Email</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="input-ats"
                  disabled={inviting}
                />
              </div>
              <div className="sm:w-48 flex-shrink-0">
                <label className="label-ats">System role</label>
                <PremiumSelect
                  value={inviteRole}
                  onChange={(v) => setInviteRole(v || 'recruiter')}
                  options={INVITE_ROLE_OPTIONS}
                  placeholder="Select role"
                  icon={Shield}
                  compact
                />
              </div>
              {customRoles.length > 0 && (
                <div className="sm:w-56 flex-shrink-0">
                  <label className="label-ats">Permission pack</label>
                  <PremiumSelect
                    value={inviteCustomRoleId}
                    onChange={(v) => setInviteCustomRoleId(v || '')}
                    options={[
                      { value: '', label: 'System defaults', description: 'Use system role permissions' },
                      ...customRoles.map((r) => ({
                        value: r._id,
                        label: r.name,
                        description: r.description || `${r.permissions?.length || 0} permissions`,
                      })),
                    ]}
                    placeholder="Optional pack"
                    icon={ShieldPlus}
                    compact
                  />
                </div>
              )}
              <button type="submit" disabled={inviting} className="btn-primary whitespace-nowrap w-full sm:w-auto">
                {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                {inviting ? 'Sending…' : 'Send Invite'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="rounded-xl border border-stone-200/90 bg-white shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
              <ShieldPlus className="w-4 h-4 text-brand-600" />
              Roles & permissions
            </h3>
            <p className="text-sm text-stone-500 mt-1.5 leading-relaxed">
              <span className="font-medium text-stone-700">System roles</span> set the seat type.
              <span className="font-medium text-stone-700"> Custom roles</span> override with your permission pack
              (sidebar modules + actions) — assign below or when inviting.
            </p>
            <p className="text-xs text-stone-400 mt-2">
              {customRolesLoading
                ? 'Loading custom roles…'
                : customRoles.length > 0
                  ? `${customRoles.length} custom role${customRoles.length === 1 ? '' : 's'} configured`
                  : 'No custom roles yet — create one to fine-tune access.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/organization/custom-roles')}
            className="btn-primary whitespace-nowrap flex-shrink-0"
          >
            <ShieldPlus className="w-4 h-4" />
            Manage custom roles
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
            <Columns3 className="w-4 h-4 text-brand-600" />
            Candidate fields
          </h3>
          <p className="text-sm text-stone-500 mt-1.5 leading-relaxed">
            Configure which core columns appear, and add <span className="font-medium text-stone-700">custom fields</span> for
            your Excel sheets — mapped during Bulk Import per organization.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/organization/candidate-fields')}
          className="btn-primary whitespace-nowrap flex-shrink-0"
        >
          <Columns3 className="w-4 h-4" />
          Manage fields
        </button>
      </div>

      <div>
        <h3 className="section-title-ats">
          <Users className="w-4 h-4 text-brand-600" />
          Team members
          {members.length > 0 && (
            <span className="ml-auto text-xs font-bold text-stone-400 normal-case tracking-normal">
              {members.length} total
            </span>
          )}
        </h3>
        {members.length > 0 ? (
          <div className="table-shell-ats">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[640px]">
                <thead className="bg-stone-50/90 border-b border-stone-100 text-stone-500 font-semibold text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-4 sm:px-5 py-3.5">Member</th>
                    <th className="px-4 sm:px-5 py-3.5 min-w-[150px]">System role</th>
                    {customRoles.length > 0 && (
                      <th className="px-4 sm:px-5 py-3.5 min-w-[170px]">Permission pack</th>
                    )}
                    <th className="px-4 sm:px-5 py-3.5">Status</th>
                    <th className="px-4 sm:px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {members.map((m) => {
                    const isOwner = m.role === 'owner';
                    const pending = m.isActive === false;
                    const packId = m.customRoleId
                      ? (typeof m.customRoleId === 'object' ? m.customRoleId._id : m.customRoleId)
                      : '';
                    return (
                      <tr key={m._id} className="hover:bg-stone-50/80 transition-colors group">
                        <td className="px-4 sm:px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-teal-700 text-white flex items-center justify-center font-bold text-xs shadow-sm ring-2 ring-white flex-shrink-0">
                              {(m.name ? m.name.charAt(0) : m.email.charAt(0)).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-stone-900 truncate">{m.name || 'Pending User'}</div>
                              <div className="text-stone-500 text-xs truncate">{m.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 sm:px-5 py-3.5">
                          {isOwner ? (
                            <span className={`${ROLE_BADGE.owner} capitalize`}>Owner</span>
                          ) : (
                            <div className="max-w-[180px]">
                              <PremiumSelect
                                compact
                                value={m.role}
                                onChange={(v) => handleChangeMemberRole(m._id, v)}
                                options={MEMBER_ROLE_OPTIONS}
                                placeholder="Role"
                                icon={Shield}
                                disabled={roleUpdatingId === m._id}
                              />
                            </div>
                          )}
                        </td>
                        {customRoles.length > 0 && (
                          <td className="px-4 sm:px-5 py-3.5">
                            {isOwner ? (
                              <span className="text-xs text-stone-400">Full access</span>
                            ) : (
                              <div className="max-w-[200px]">
                                <PremiumSelect
                                  compact
                                  value={packId || ''}
                                  onChange={(v) => handleChangeMemberCustomRole(m._id, v)}
                                  options={[
                                    { value: '', label: 'System defaults' },
                                    ...customRoles.map((r) => ({
                                      value: r._id,
                                      label: r.name,
                                    })),
                                  ]}
                                  placeholder="Pack"
                                  icon={ShieldPlus}
                                  disabled={customRoleUpdatingId === m._id}
                                />
                              </div>
                            )}
                          </td>
                        )}
                        <td className="px-4 sm:px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                            pending
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${pending ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                            {pending ? 'Invited' : 'Active'}
                          </span>
                        </td>
                        <td className="px-4 sm:px-5 py-3.5 text-right">
                          {!isOwner && (
                            <button
                              type="button"
                              className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-400 hover:text-red-600 hover:border-red-200"
                              aria-label={`Remove ${m.name || m.email}`}
                              title="Remove member"
                              onClick={() => setRemoveTarget(m)}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-stone-200 bg-white">
            <EmptyState
              icon={Users}
              tone="emerald"
              message="No team members yet"
              subMessage="Invite colleagues above to collaborate on hiring."
            />
          </div>
        )}
      </div>
    </div>
  );
}
