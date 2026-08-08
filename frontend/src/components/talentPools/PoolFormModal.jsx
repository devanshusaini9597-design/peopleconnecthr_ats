import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';
import { POOL_COLORS } from './talentPoolsConstants';

export const PoolFormModal = ({ open, onClose, onSave, saving, initial }) => {
  const isEdit = !!initial?._id;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(POOL_COLORS[0]);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name || '');
    setDescription(initial?.description || '');
    setColor(initial?.color || POOL_COLORS[0]);
  }, [open, initial]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Manage talent pool' : 'New talent pool'}
      description={isEdit ? 'Update name, description, or color.' : 'Group strong candidates for future roles.'}
      size="md"
      footer={(
        <>
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            type="button"
            onClick={() => onSave({ name, description, color })}
            disabled={saving || !name.trim()}
            className="btn-primary"
          >
            {saving
              ? <><Loader2 size={16} className="animate-spin" /> Saving…</>
              : (isEdit ? 'Save changes' : 'Create pool')}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <div>
          <label className="label-ats">Pool name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-ats"
            placeholder="e.g. Frontend Bench, Referrals 2026"
            autoFocus
          />
        </div>
        <div>
          <label className="label-ats">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input-ats"
            placeholder="Optional"
          />
        </div>
        <div>
          <label className="label-ats mb-2">Color</label>
          <div className="flex flex-wrap gap-2.5">
            {POOL_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-9 h-9 rounded-full border-2 transition-all duration-200 ${
                  color === c ? 'border-stone-900 scale-110 shadow-md' : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Select color ${c}`}
              />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};
