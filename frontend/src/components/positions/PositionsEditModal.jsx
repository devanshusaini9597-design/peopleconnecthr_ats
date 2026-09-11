import React from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';
import { formatNameForInput } from '../../utils/textFormatter';

export default function PositionsEditModal({
  editing,
  editName,
  setEditName,
  savingEdit,
  onClose,
  onSubmit,
}) {
  if (!editing) return null;
  return (
    <Modal
      open={!!editing}
      onClose={onClose}
      title="Rename position"
      description="This name updates in candidate and job dropdowns."
      size="sm"
      footer={(
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={savingEdit}>
            Cancel
          </button>
          <button type="submit" form="position-edit-form" className="btn-primary" disabled={savingEdit || !editName.trim()}>
            {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Save
          </button>
        </>
      )}
    >
      <form id="position-edit-form" onSubmit={onSubmit} className="space-y-3">
        <label className="label-ats" htmlFor="position-edit-name">Position name *</label>
        <input
          id="position-edit-name"
          value={editName}
          onChange={(e) => setEditName(formatNameForInput(e.target.value))}
          className="input-ats uppercase tracking-wide"
          autoFocus
          required
        />
      </form>
    </Modal>
  );
}
