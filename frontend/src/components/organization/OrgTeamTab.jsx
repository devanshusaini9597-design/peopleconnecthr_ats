import React from 'react';
import { Users, ExternalLink, UserPlus, Shield, ShieldPlus, Loader2, Columns3,
  Copy, Link2, Mail, MessageCircle, X, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import PremiumSelect from '../ui/PremiumSelect';
import OrgTeamRoster from './OrgTeamRoster';
import { INVITE_ROLE_OPTIONS } from './constants';
import { copyToClipboard, openEmailShare, openWhatsAppShare } from '../../utils/shareChannels';

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
  inviteReportsTo,
  setInviteReportsTo,
  customRolesLoading,
  members,
  handleChangeMemberRole,
  handleChangeMemberCustomRole,
  handleChangeMemberReportsTo,
  roleUpdatingId,
  customRoleUpdatingId,
  reportsToUpdatingId,
  setRemoveTarget,
  lastInviteShare,
  setLastInviteShare,
  copyInviteLink,
  handleGetMemberInviteLink,
  inviteLinkLoadingId,
  setResetTarget,
}) {
  const share = lastInviteShare;
  const managerOptions = [
    { value: '', label: 'Unassigned', description: 'Does not report to anyone' },
    ...members
      .filter((m) => m.isActive !== false)
      .map((m) => ({
        value: m._id,
        label: m.name || m.email,
        description: m.email,
      })),
  ];
  const shareUrl = (share?.inviteUrl || '').trim();
  const inviteeEmail = (share?.email || '').trim().toLowerCase();

  const openEmailApp = () => {
    if (!shareUrl || !inviteeEmail) return;
    const body = [
      'You have been invited to the hiring workspace.',
      '',
      `Sign in with this email: ${inviteeEmail}`,
      'Do not create a new organization.',
      '',
      `Accept invitation (expires in 7 days): ${shareUrl}`,
    ].join('\n');
    const opened = openEmailShare({
      to: inviteeEmail,
      subject: 'Workspace invitation',
      body,
    });
    copyToClipboard(body).then((copiedOk) => {
      if (opened && copiedOk) {
        // toast handled by parent if needed
      }
    });
  };

  const openWhatsApp = () => {
    if (!shareUrl) return;
    const text = [
      'You have been invited to the hiring workspace.',
      `Sign in with: ${inviteeEmail || 'your work email'}`,
      `Accept invitation: ${shareUrl}`,
    ].join('\n');
    openWhatsAppShare(text);
    copyToClipboard(text);
  };

  const openInvitePage = () => {
    if (!shareUrl) return;
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  };
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="section-title-ats !mb-0">
            <Users className="w-4 h-4 text-brand-600" />
            Team access
          </h3>
          <p className="text-sm text-stone-500 mt-1">Invite colleagues, set who they report to, or remove members.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate('/my-team')}
            className="btn-secondary whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4" />
            My Team
          </button>
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
                <label className="label-ats">
                  {inviteRole === 'freelancer' ? 'Email (personal email allowed)' : 'Work email (same company domain)'}
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder={inviteRole === 'freelancer' ? 'recruiter@gmail.com' : 'colleague@yourcompany.com'}
                  className="input-ats"
                  disabled={inviting}
                />
              </div>
              <div className="sm:w-48 flex-shrink-0">
                <label className="label-ats">System role</label>
                <PremiumSelect
                  value={inviteRole}
                  onChange={(v) => setInviteRole(v || 'hr_recruiter')}
                  options={INVITE_ROLE_OPTIONS}
                  placeholder="Select role"
                  icon={Shield}
                  compact
                />
              </div>
              {inviteRole !== 'freelancer' && (
                <div className="sm:w-56 flex-shrink-0">
                  <label className="label-ats">Reports to</label>
                  <PremiumSelect
                    value={inviteReportsTo}
                    onChange={(v) => setInviteReportsTo(v || '')}
                    options={managerOptions}
                    placeholder="Optional manager"
                    icon={Users}
                    compact
                  />
                </div>
              )}
              {customRoles.length > 0 && (
                <div className="sm:w-56 flex-shrink-0">
                  <label className="label-ats">Custom role</label>
                  <PremiumSelect
                    value={inviteCustomRoleId}
                    onChange={(v) => setInviteCustomRoleId(v || '')}
                    options={[
                      { value: '', label: 'No custom role', description: 'Uses only the system role' },
                      ...customRoles.map((r) => ({
                        value: r._id,
                        label: r.name,
                        description: r.description || `${r.permissions?.length || 0} extra permissions`,
                      })),
                    ]}
                    placeholder="No custom role"
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
            <p className="text-[11px] text-stone-500 leading-relaxed">
              {inviteRole === 'freelancer'
                ? 'Freelance recruiters can join with a personal email. They only see their own candidates and open mandates — never company desk data. Internal roles still require your company domain.'
                : 'Internal teammates must use your company domain. Switch the role to Freelance Recruiter to invite an external sourcer with a personal email.'}
            </p>
          </form>

          {share?.inviteUrl && (
            <div
              id="org-invite-share-panel"
              className={`mt-4 rounded-xl border p-4 sm:p-5 ${
                share.emailSent
                  ? 'border-emerald-200 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/30'
                  : 'border-amber-200 bg-gradient-to-br from-amber-50/90 via-white to-orange-50/20'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <span
                    className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
                      share.emailSent
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {share.emailSent ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-stone-900 tracking-tight">
                      {share.emailSent ? 'Invitation sent' : 'Invite created — share the link'}
                    </p>
                    <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">
                      {share.emailSent
                        ? 'Email was sent. You can still share the link below as a backup.'
                        : 'Email could not be delivered. Share this secure link with the teammate instead.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setLastInviteShare?.(null)}
                  className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-white/80"
                  aria-label="Dismiss"
                >
                  <X size={16} />
                </button>
              </div>

              {inviteeEmail && (
                <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50/50 px-3 py-2.5 flex items-center gap-2">
                  <Mail size={14} className="text-brand-700 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand-700/80">Invitee email (read only)</p>
                    <p className="text-sm font-semibold text-stone-900 truncate">{inviteeEmail}</p>
                  </div>
                </div>
              )}

              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <div className="flex-1 min-w-0 flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2.5">
                  <Link2 size={14} className="text-brand-600 flex-shrink-0" />
                  <input
                    readOnly
                    value={shareUrl}
                    className="flex-1 min-w-0 bg-transparent text-[12px] font-medium text-stone-700 outline-none truncate"
                    onFocus={(e) => e.target.select()}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => copyInviteLink?.(shareUrl)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-brand-600 to-teal-600 shadow-md shadow-brand-500/20 hover:shadow-lg transition-all"
                >
                  <Copy size={15} />
                  Copy link
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={openEmailApp}
                  disabled={!shareUrl || !inviteeEmail}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:border-brand-300 hover:text-brand-800 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Mail size={13} />
                  Email {inviteeEmail ? inviteeEmail.split('@')[0] : 'invitee'}
                </button>
                <button
                  type="button"
                  onClick={openWhatsApp}
                  disabled={!shareUrl}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:border-emerald-300 hover:text-emerald-800 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  <MessageCircle size={13} />
                  Share on WhatsApp
                </button>
                <button
                  type="button"
                  onClick={openInvitePage}
                  disabled={!shareUrl}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:border-brand-300 hover:text-brand-800 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  <ExternalLink size={13} />
                  Open invite page
                </button>
              </div>
              <p className="mt-3 text-[11px] text-stone-500">
                Link expires in 7 days. They must join with <span className="font-semibold text-stone-700">{inviteeEmail || 'the invited email'}</span> — not a new signup.
              </p>
            </div>
          )}
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
              <span className="font-medium text-stone-700">System roles</span> (Admin, HR Recruiter, etc.) define the seat type.
              <span className="font-medium text-stone-700"> Custom roles</span> add extra permissions on top — e.g. &ldquo;HR Intern&rdquo; or &ldquo;HR Senior Executive&rdquo; are permission packs you create, not job titles.
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

      <OrgTeamRoster
        members={members}
        customRoles={customRoles}
        handleChangeMemberRole={handleChangeMemberRole}
        handleChangeMemberCustomRole={handleChangeMemberCustomRole}
        handleChangeMemberReportsTo={handleChangeMemberReportsTo}
        roleUpdatingId={roleUpdatingId}
        customRoleUpdatingId={customRoleUpdatingId}
        reportsToUpdatingId={reportsToUpdatingId}
        setRemoveTarget={setRemoveTarget}
        handleGetMemberInviteLink={handleGetMemberInviteLink}
        inviteLinkLoadingId={inviteLinkLoadingId}
        setResetTarget={setResetTarget}
      />
    </div>
  );
}
