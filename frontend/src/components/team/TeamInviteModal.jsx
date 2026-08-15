import React from 'react';
import { Mail, Shield, ShieldPlus, Loader2, UserPlus } from 'lucide-react';
import Modal from '../ui/Modal';
import PremiumSelect from '../ui/PremiumSelect';
import { INVITE_ROLE_OPTIONS } from '../organization/constants';

export default function TeamInviteModal({
  open,
  onClose,
  inviteEmail,
  setInviteEmail,
  inviteRole,
  setInviteRole,
  customRoles,
  inviteCustomRoleId,
  setInviteCustomRoleId,
  onSubmit,
  inviting,
}) {
  const freelancer = inviteRole === 'freelancer';
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite teammate"
      description="They get a Skillnix seat: login, ATS access, and notifications on their own email."
      size="md"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary" disabled={inviting}>Cancel</button>
          <button type="button" onClick={onSubmit} disabled={inviting} className="btn-primary">
            {inviting ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
            {inviting ? 'Sending…' : 'Send invite'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label-ats">
            {freelancer ? 'Email (personal email allowed)' : 'Work email (company domain)'}
          </label>
          <div className="relative">
            <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value.trim().toLowerCase())}
              className="input-ats input-ats-icon"
              placeholder={freelancer ? 'recruiter@gmail.com' : 'colleague@yourcompany.com'}
              disabled={inviting}
            />
          </div>
        </div>
        <div>
          <label className="label-ats">System role</label>
          <PremiumSelect
            value={inviteRole}
            onChange={(v) => setInviteRole(v || 'hr_recruiter')}
            options={INVITE_ROLE_OPTIONS}
            placeholder="Select role"
            icon={Shield}
          />
        </div>
        {customRoles.length > 0 && (
          <div>
            <label className="label-ats">Permission pack (optional)</label>
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
            />
          </div>
        )}
        <p className="text-[12px] text-stone-500 leading-relaxed">
          {freelancer
            ? 'Freelance recruiters join with a personal email. They only see their own desk and open mandates.'
            : 'Internal teammates must use your company domain. They appear here as soon as the invite is created.'}
        </p>
      </div>
    </Modal>
  );
}
