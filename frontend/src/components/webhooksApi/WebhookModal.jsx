import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';

export default function WebhookModal({ open, availableEvents, onClose, onSave, saving }) {
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (open) {
      setUrl('');
      setDescription('');
      setEvents([]);
    }
  }, [open]);

  const toggle = (evt) => setEvents((e) => (e.includes(evt) ? e.filter((x) => x !== evt) : [...e, evt]));
  const allOn = availableEvents.length > 0 && availableEvents.every((e) => events.includes(e));
  const toggleAll = () => {
    setEvents(allOn ? [] : [...availableEvents]);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Webhook Endpoint"
      description="Receive ATS events at your HTTPS endpoint."
      size="md"
      footer={
        <>
          <span className="hidden sm:inline text-xs font-medium text-stone-400 mr-auto self-center">
            {events.length} event{events.length !== 1 ? 's' : ''} selected
          </span>
          <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>Cancel</button>
          <button
            type="button"
            onClick={() => onSave({ url, description, events })}
            disabled={saving || !url.trim() || events.length === 0}
            className="btn-primary"
          >
            {saving ? <><Loader2 size={16} className="animate-spin" /> Creating…</> : 'Create Endpoint'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="label-ats">Endpoint URL *</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/webhooks/ats" className="input-ats" autoFocus />
        </div>
        <div>
          <label className="label-ats">Description</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" className="input-ats" />
        </div>
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <label className="label-ats !mb-0">Events</label>
            <button type="button" onClick={toggleAll} className="text-[11px] font-bold text-brand-600 hover:text-brand-700">
              {allOn ? 'Clear all' : 'Select all'}
            </button>
          </div>
          <div className="rounded-xl border border-stone-200 overflow-hidden divide-y divide-stone-100 max-h-52 overflow-y-auto overscroll-contain">
            {availableEvents.map((evt) => {
              const checked = events.includes(evt);
              return (
                <label
                  key={evt}
                  className={`flex items-center gap-2.5 text-[13px] cursor-pointer px-3 py-2 transition-colors ${
                    checked ? 'bg-brand-50/70 text-brand-800' : 'text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(evt)}
                    className="rounded border-stone-300 text-brand-600 focus:ring-brand-500/30 w-3.5 h-3.5"
                  />
                  <span className="font-mono font-medium truncate">{evt}</span>
                </label>
              );
            })}
            {availableEvents.length === 0 && (
              <p className="text-xs text-stone-400 p-3">No events available.</p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
