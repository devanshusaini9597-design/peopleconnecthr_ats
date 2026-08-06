import React from 'react';
import Modal from '../ui/Modal';
import { formatNameForInput } from '../../utils/textFormatter';

export default function MasterDataEditorModal({
  open,
  saving,
  editing,
  form,
  setForm,
  cfg,
  title,
  onClose,
  onSubmit,
}) {
  return (
    <Modal
      open={open}
      onClose={() => { if (!saving) onClose(); }}
      title={editing ? `Edit ${cfg.singular}` : `Add ${cfg.singular}`}
      description={`Saved to your organization ${cfg.headline.toLowerCase()} list.`}
      size="sm"
      footer={(
        <>
          <button type="button" disabled={saving} onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" form="master-list-form" disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? 'Saving…' : editing ? 'Save' : 'Add'}
          </button>
        </>
      )}
    >
      <form id="master-list-form" onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Name <span className="text-red-500">*</span></label>
          <input
            autoFocus
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: formatNameForInput(e.target.value) }))}
            placeholder={`e.g. ${title === 'Sources' ? 'LinkedIn' : title === 'Clients' ? 'Acme Corp' : 'Java Developer'}`}
            className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm font-medium outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
            required
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: formatNameForInput(e.target.value) }))}
            placeholder="Optional note"
            rows={3}
            className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm font-medium outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 resize-none"
          />
        </div>
      </form>
    </Modal>
  );
}
