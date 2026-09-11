import React from 'react';
import { Users, Mail, Phone, Briefcase, Building2, Save, Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';
import PremiumSelect from '../ui/PremiumSelect';
import { ROLE_OPTIONS } from './teamConstants';

export default function TeamMemberModal({
  open,
  onClose,
  editingId,
  formData,
  setFormData,
  emailError,
  setEmailError,
  onSave,
  isSaving,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingId ? 'Edit stakeholder' : 'Add stakeholder'}
      description="No Skillnix login. They show up as CC/BCC suggestions when you email candidates."
      size="lg"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="button" onClick={onSave} disabled={isSaving} className="btn-primary">
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {isSaving ? 'Saving…' : editingId ? 'Update' : 'Add stakeholder'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label-ats">Full name *</label>
            <div className="relative">
              <Users size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value.replace(/^\s+/, '').replace(/\s{2,}/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }))}
                onBlur={() => setFormData((p) => ({ ...p, name: p.name.trim() }))}
                className="input-ats input-ats-icon"
                placeholder="Priya Sharma"
              />
            </div>
          </div>
          <div>
            <label className="label-ats">Email *</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => {
                  setFormData((p) => ({ ...p, email: e.target.value.trim().toLowerCase() }));
                  if (emailError) setEmailError('');
                }}
                className={`input-ats input-ats-icon ${emailError ? 'input-ats-error' : ''}`}
                placeholder="hiring.manager@client.com"
                disabled={Boolean(editingId)}
              />
            </div>
            {emailError && <p className="field-error">{emailError}</p>}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label-ats">Directory role</label>
            <PremiumSelect
              value={formData.role}
              onChange={(v) => setFormData((p) => ({ ...p, role: v || 'Hiring Manager' }))}
              options={ROLE_OPTIONS}
              placeholder="Select role"
              icon={Briefcase}
              searchable
              searchPlaceholder="Search roles…"
            />
          </div>
          <div>
            <label className="label-ats">Department</label>
            <div className="relative">
              <Building2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
              <input
                type="text"
                value={formData.department}
                onChange={(e) => setFormData((p) => ({ ...p, department: e.target.value.replace(/^\s+/, '').replace(/\s{2,}/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }))}
                onBlur={() => setFormData((p) => ({ ...p, department: p.department.trim() }))}
                className="input-ats input-ats-icon"
                placeholder="e.g. Engineering"
              />
            </div>
          </div>
        </div>
        <div>
          <label className="label-ats">Phone (optional)</label>
          <div className="relative">
            <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
              className="input-ats input-ats-icon"
              placeholder="+91-XXXXXXXXXX"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
