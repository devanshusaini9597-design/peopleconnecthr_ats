import React from 'react';
import {
  Loader2, BookOpen, Briefcase, UserCheck, Check, Plus,
} from 'lucide-react';
import Modal from '../ui/Modal';
import PremiumSelect from '../ui/PremiumSelect';
import { STATUS_OPTIONS } from './jobsConstants';

export default function JobFormModal({
  open,
  onClose,
  editingJob,
  formData,
  setFormData,
  skillsInput,
  setSkillsInput,
  saving,
  onSubmit,
  toggleManager,
  managerOptions = [],
  loadingMembers = false,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingJob ? 'Edit Job Requisition' : 'Create New Job Requisition'}
      description={editingJob ? 'Update role details and hiring assignments.' : 'Fill in the role details and assign hiring managers.'}
      size="lg"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="job-form" className="btn-primary" disabled={saving}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : editingJob ? <Check size={16} /> : <Plus size={16} />}
            {saving ? 'Saving…' : editingJob ? 'Save Changes' : 'Create & Post Job'}
          </button>
        </>
      }
    >
      <form id="job-form" onSubmit={onSubmit} className="space-y-5">
        <section className="rounded-xl border border-stone-200/90 bg-white shadow-sm p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="h-7 w-7 rounded-lg bg-brand-50 text-brand-700 border border-brand-100 inline-flex items-center justify-center">
              <Briefcase size={13} />
            </span>
            <div>
              <p className="text-xs font-bold text-stone-800">Role details</p>
              <p className="text-[11px] text-stone-400">Title, location, compensation</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label-ats">Job Role *</label>
              <input
                type="text"
                required
                placeholder="e.g. Senior Frontend Developer"
                className="input-ats field-premium"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              />
            </div>
            <div>
              <label className="label-ats">Location *</label>
              <input
                type="text"
                required
                placeholder="e.g. Pune / Remote"
                className="input-ats field-premium"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>
            <div>
              <label className="label-ats">Experience Required</label>
              <input
                type="text"
                placeholder="e.g. 3-5 Years"
                className="input-ats field-premium"
                value={formData.experience}
                onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
              />
            </div>
            <div>
              <label className="label-ats">CTC / Salary Range</label>
              <input
                type="text"
                placeholder="e.g. 12 - 15 LPA"
                className="input-ats field-premium"
                value={formData.ctc}
                onChange={(e) => setFormData({ ...formData, ctc: e.target.value })}
              />
            </div>
            <div>
              <label className="label-ats">Status</label>
              <PremiumSelect
                variant="list"
                value={formData.status}
                onChange={(v) => setFormData({ ...formData, status: v })}
                options={STATUS_OPTIONS}
                placeholder="Select status"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label-ats">Skills (comma separated)</label>
              <input
                type="text"
                placeholder="e.g. React, Node.js, TypeScript"
                className="input-ats field-premium"
                value={skillsInput}
                onChange={(e) => setSkillsInput(e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-stone-200/90 bg-white shadow-sm p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="h-7 w-7 rounded-lg bg-teal-50 text-teal-700 border border-teal-100 inline-flex items-center justify-center">
              <UserCheck size={13} />
            </span>
            <div>
              <p className="text-xs font-bold text-stone-800">Hiring managers</p>
              <p className="text-[11px] text-stone-400">Select teammates to assign this role</p>
            </div>
          </div>
          {loadingMembers ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={18} className="animate-spin text-stone-400" />
            </div>
          ) : (
            <div className="space-y-1 max-h-44 overflow-y-auto border border-stone-200 rounded-xl p-2 bg-stone-50/60">
              {managerOptions.map((m) => {
                const checked = formData.hiringManagers.includes(m.email);
                return (
                  <label
                    key={m.email}
                    className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${
                      checked ? 'bg-brand-50 border border-brand-200' : 'hover:bg-white border border-transparent'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleManager(m.email)}
                      className="w-4 h-4 text-brand-600 rounded focus:ring-2 focus:ring-brand-500"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-stone-900 truncate">{m.name}</p>
                      <p className="text-xs text-stone-500 truncate">{m.email}</p>
                    </div>
                    {checked && <Check size={14} className="text-brand-600 flex-shrink-0" />}
                  </label>
                );
              })}
            </div>
          )}
          {formData.hiringManagers.length > 0 && (
            <p className="text-[11px] font-semibold text-brand-700 mt-2">
              {formData.hiringManagers.length} manager{formData.hiringManagers.length === 1 ? '' : 's'} selected
            </p>
          )}
        </section>

        <section className="rounded-xl border border-stone-200/90 bg-white shadow-sm p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-7 w-7 rounded-lg bg-sky-50 text-sky-700 border border-sky-100 inline-flex items-center justify-center">
              <BookOpen size={13} />
            </span>
            <div>
              <p className="text-xs font-bold text-stone-800">Job description</p>
              <p className="text-[11px] text-stone-400">Full JD for candidates and boards</p>
            </div>
          </div>
          <textarea
            placeholder="Paste detailed JD here…"
            className="textarea-ats field-premium h-32"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </section>
      </form>
    </Modal>
  );
}
