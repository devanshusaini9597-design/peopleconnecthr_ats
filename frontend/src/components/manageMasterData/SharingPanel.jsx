import React, { useState } from 'react';
import Modal from '../ui/Modal';

export default function SharingPanel({ client, members, saving, onClose, onSave }) {
  const [selected, setSelected] = useState(client.restrictedToUsers || []);
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <Modal
      open
      onClose={onClose}
      title={`Sharing — ${client.name}`}
      description="Leave empty for the whole team. Select people to restrict visibility."
      size="sm"
      footer={(
        <>
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="button" disabled={saving} onClick={() => onSave(selected)} className="btn-primary disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      )}
    >
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {members.length === 0 ? (
          <p className="text-sm text-stone-500 py-4 text-center">No teammates found.</p>
        ) : members.map((m) => (
          <label key={m._id} className="flex items-center gap-2.5 text-sm text-stone-700 cursor-pointer px-2 py-2 rounded-lg hover:bg-stone-50">
            <input type="checkbox" checked={selected.includes(m._id)} onChange={() => toggle(m._id)} className="rounded border-stone-300" />
            <span className="font-medium">{m.name || m.email}</span>
            <span className="text-[11px] text-stone-400 uppercase tracking-wide">{m.role}</span>
          </label>
        ))}
      </div>
    </Modal>
  );
}
