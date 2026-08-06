import React from 'react';
import { Pencil, Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';

export default function SkillsEditModal({
  editing,
  editName,
  setEditName,
  editCategory,
  setEditCategory,
  categories,
  savingEdit,
  onClose,
  onSubmit,
}) {
  return (
    <Modal
      open={!!editing}
      onClose={onClose}
      title="Edit custom skill"
      description="Rename or recategorize this org skill. System catalog skills stay locked."
      size="md"
      closeOnBackdrop={!savingEdit}
      footer={(
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={savingEdit}>
            Cancel
          </button>
          <button type="submit" form="edit-skill-form" className="btn-primary" disabled={savingEdit}>
            {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
            Save changes
          </button>
        </>
      )}
    >
      <form id="edit-skill-form" onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label-ats" htmlFor="edit-skill-name">Skill name *</label>
          <input
            id="edit-skill-name"
            className="input-ats"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label-ats" htmlFor="edit-skill-category">Category</label>
          <input
            id="edit-skill-category"
            className="input-ats"
            value={editCategory}
            onChange={(e) => setEditCategory(e.target.value)}
            list="edit-skill-categories"
          />
          <datalist id="edit-skill-categories">
            {categories.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
      </form>
    </Modal>
  );
}
