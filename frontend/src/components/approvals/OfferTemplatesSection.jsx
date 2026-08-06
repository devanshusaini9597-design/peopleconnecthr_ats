import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Loader2, FileText, Mail, Type } from 'lucide-react';
import { authenticatedFetch, readApiJson } from '../../utils/fetchUtils';
import { useToast } from '../Toast';
import EmptyState from '../ui/EmptyState';
import Modal from '../ui/Modal';
import MergeTagPicker from './MergeTagPicker';
import { insertAtCursor } from './approvalsConstants';

export default function OfferTemplatesSection() {
  const toast = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', subject: '', body: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch('/api/offer-templates');
      const data = await readApiJson(res);
      if (data.success) setTemplates(data.data || []);
    } catch {
      toast.error('Failed to load offer templates');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (e) => {
    e?.preventDefault?.();
    setSaving(true);
    try {
      const res = await authenticatedFetch('/api/offer-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      toast.success('Template created');
      setModalOpen(false);
      setForm({ name: '', subject: '', body: '' });
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card-ats-bordered relative overflow-hidden min-h-[14rem] flex flex-col">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
      <div className="relative px-4 sm:px-5 pt-4 pb-3 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-stone-900 tracking-tight inline-flex items-center gap-2">
            <FileText className="w-4 h-4 text-brand-600" /> Offer templates
          </h2>
          <p className="text-[11px] text-stone-400 mt-0.5">
            Click tags to personalize — no coding needed
          </p>
        </div>
        <button type="button" onClick={() => setModalOpen(true)} className="btn-secondary !text-xs w-full sm:w-auto">
          <Plus className="w-3.5 h-3.5" /> New template
        </button>
      </div>
      <div className="relative flex-1 p-4 sm:p-5">
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <div key={i} className="h-14 skeleton-ats rounded-xl" />)}
          </div>
        ) : templates.length === 0 ? (
          <EmptyState
            icon={FileText}
            message="No offer templates yet"
            subMessage="Create a template for offer letters and emails."
            tone="brand"
            compact
          />
        ) : (
          <ul className="space-y-2">
            {templates.map((t) => (
              <li key={t._id} className="p-3.5 rounded-2xl border border-stone-200/80 bg-white hover:border-stone-300/90 transition-colors">
                <p className="font-semibold text-stone-900 text-sm">{t.name}</p>
                <p className="text-xs text-stone-500 truncate mt-0.5">{t.subject}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title="New offer template"
        description="Use Insert tags for candidate, job, and salary."
        size="md"
        closeOnBackdrop={!saving}
        footer={(
          <>
            <button type="button" onClick={() => setModalOpen(false)} disabled={saving} className="btn-secondary">Cancel</button>
            <button type="submit" form="offer-tpl-form" disabled={saving || !form.name.trim()} className="btn-primary">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus className="w-4 h-4" />}
              Create
            </button>
          </>
        )}
      >
        <form id="offer-tpl-form" onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label-ats">Name</label>
            <div className="relative">
              <Type className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
              <input className="input-ats !pl-10" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
              <label className="label-ats !mb-0">Email subject</label>
              <MergeTagPicker
                onInsert={(token) => {
                  const el = document.getElementById('offer-subject');
                  setForm((f) => ({ ...f, subject: insertAtCursor(el, f.subject, token) }));
                }}
              />
            </div>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
              <input
                id="offer-subject"
                className="input-ats !pl-10"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
              <label className="label-ats !mb-0">Body</label>
              <MergeTagPicker
                onInsert={(token) => {
                  const el = document.getElementById('offer-body');
                  setForm((f) => ({ ...f, body: insertAtCursor(el, f.body, token) }));
                }}
              />
            </div>
            <textarea
              id="offer-body"
              className="textarea-ats min-h-[120px]"
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Write the offer email…"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
