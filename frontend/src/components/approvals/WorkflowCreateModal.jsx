import React from 'react';
import { Plus, Loader2, Type, Briefcase } from 'lucide-react';
import Modal from '../ui/Modal';
import PremiumSelect from '../ui/PremiumSelect';
import { ENTITY_TYPE_OPTIONS } from './approvalsConstants';

export default function WorkflowCreateModal({
  open,
  saving,
  wfForm,
  setWfForm,
  onClose,
  onSubmit,
}) {
  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose()}
      title="New approval workflow"
      description="Choose what this workflow applies to."
      size="md"
      closeOnBackdrop={!saving}
      footer={(
        <>
          <button type="button" onClick={onClose} disabled={saving} className="btn-secondary">Cancel</button>
          <button type="submit" form="appr-wf-form" disabled={saving || !wfForm.name.trim()} className="btn-primary">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus className="w-4 h-4" />}
            Create
          </button>
        </>
      )}
    >
      <form id="appr-wf-form" onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label-ats">Name</label>
          <div className="relative">
            <Type className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
            <input
              className="input-ats !pl-10"
              value={wfForm.name}
              onChange={(e) => setWfForm({ ...wfForm, name: e.target.value })}
              placeholder="e.g. Offer letter approval"
              required
            />
          </div>
        </div>
        <div>
          <label className="label-ats">Entity type</label>
          <PremiumSelect
            value={wfForm.entityType}
            onChange={(v) => setWfForm({ ...wfForm, entityType: v || 'job_req' })}
            options={ENTITY_TYPE_OPTIONS}
            icon={Briefcase}
            compact
          />
        </div>
      </form>
    </Modal>
  );
}
