import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, CheckSquare, Columns3, Eye, EyeOff, Loader2, Plus, Save, Settings2, Trash2, X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import PremiumSelect from './ui/PremiumSelect';
import ConfirmationModal from './ConfirmationModal';
import { authenticatedFetch, handleUnauthorized, isUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Select' },
  { value: 'boolean', label: 'Yes / No' },
];

const emptyCustom = () => ({
  key: '',
  label: '',
  type: 'text',
  required: false,
  options: [],
  showInTable: true,
  showInForm: true,
  importAliases: [],
  order: 1000,
});

function slugify(label) {
  return String(label || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

export default function CandidateFieldsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState([]);
  const [editing, setEditing] = useState(null);
  const [optionsText, setOptionsText] = useState('');
  const [aliasesText, setAliasesText] = useState('');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false });

  const coreFields = useMemo(() => fields.filter((f) => f.isCore), [fields]);
  const customFields = useMemo(() => fields.filter((f) => !f.isCore), [fields]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch('/api/organization/candidate-fields');
      if (isUnauthorized(res)) { handleUnauthorized(); return; }
      const data = await res.json().catch(() => ({}));
      if (!data.success) throw new Error(data.message || 'Failed to load fields');
      setFields(data.fields || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const toggleCorePref = (key, prop) => {
    setFields((prev) => prev.map((f) => (
      f.key === key && f.isCore ? { ...f, [prop]: !f[prop] } : f
    )));
  };

  const openNew = () => {
    setEditing(emptyCustom());
    setOptionsText('');
    setAliasesText('');
  };

  const openEdit = (f) => {
    setEditing({ ...f });
    setOptionsText((f.options || []).join(', '));
    setAliasesText((f.importAliases || []).join(', '));
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const coreFieldPrefs = {};
      coreFields.forEach((f) => {
        coreFieldPrefs[f.key] = { showInTable: !!f.showInTable, showInForm: !!f.showInForm };
      });
      const res = await authenticatedFetch('/api/organization/candidate-fields', {
        method: 'PUT',
        body: JSON.stringify({
          customFields: customFields.map((f, i) => ({ ...f, order: f.order ?? 1000 + i })),
          coreFieldPrefs,
        }),
      });
      if (isUnauthorized(res)) { handleUnauthorized(); return; }
      const data = await res.json().catch(() => ({}));
      if (!data.success) throw new Error(data.message || 'Save failed');
      setFields(data.fields || []);
      toast.success('Candidate fields saved');
    } catch (err) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const commitEditing = () => {
    if (!editing) return;
    const label = String(editing.label || '').trim();
    if (!label) {
      toast.warning('Label is required');
      return;
    }
    const key = editing.key || slugify(label);
    if (!key) {
      toast.warning('Could not generate a field key');
      return;
    }
    const coreKeys = new Set(coreFields.map((f) => f.key));
    if (coreKeys.has(key)) {
      toast.warning('That key conflicts with a core field');
      return;
    }
    const payload = {
      ...editing,
      key,
      label,
      options: optionsText.split(',').map((s) => s.trim()).filter(Boolean),
      importAliases: aliasesText.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
      isCore: false,
    };
    setFields((prev) => {
      const exists = prev.some((f) => !f.isCore && f.key === key);
      if (exists) {
        return prev.map((f) => (!f.isCore && f.key === key ? payload : f));
      }
      // new field — reject duplicate label keys among customs being created with different key
      if (prev.some((f) => !f.isCore && f.key === key)) return prev;
      return [...prev, { ...payload, order: 1000 + prev.filter((f) => !f.isCore).length }];
    });
    setEditing(null);
    toast.info('Field staged — click Save to persist');
  };

  const removeCustom = (key) => {
    setConfirmModal({
      isOpen: true,
      type: 'delete',
      title: 'Remove custom field?',
      message: 'Existing candidate values for this key stay in the database but will no longer show in the table/form until you re-add the field.',
      confirmText: 'Remove',
      onConfirm: () => {
        setFields((prev) => prev.filter((f) => f.key !== key || f.isCore));
        setConfirmModal({ isOpen: false });
        toast.info('Removed from list — click Save to persist');
      },
    });
  };

  return (
    <>
      <div className="page-shell-ats animate-page-enter">
        <PageHeader
          icon={Columns3}
          title="Candidate Fields"
          subtitle="Define core visibility and custom columns for your org — used in Candidates and Bulk Import mapping."
          gradientTitle
        >
          <button type="button" className="btn-secondary" onClick={() => navigate('/organization')}>
            <ArrowLeft size={16} /> Organization
          </button>
          <button type="button" className="btn-primary" disabled={saving || loading} onClick={saveAll}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save
          </button>
        </PageHeader>

        {loading ? (
          <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-9 h-9 text-brand-600 animate-spin" />
            <p className="text-sm text-stone-500 font-medium">Loading fields…</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-xl border border-brand-100 bg-brand-50/40 px-4 py-3 text-sm text-stone-600">
              Core fields are shared by every customer. Add <strong className="text-stone-800">custom fields</strong> for
              columns unique to your process (visa status, BU code, etc.). Bulk Import can map Excel headers to both.
            </div>

            {/* Core */}
            <section className="card-ats-bordered overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-2">
                <Settings2 size={16} className="text-brand-600" />
                <h2 className="text-sm font-bold text-stone-900">Core fields</h2>
                <span className="text-xs text-stone-400 ml-auto">{coreFields.length} locked</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-stone-50 text-left text-[10px] font-bold uppercase tracking-wider text-stone-500">
                      <th className="px-4 py-2.5">Field</th>
                      <th className="px-4 py-2.5">Key</th>
                      <th className="px-4 py-2.5 text-center">Table</th>
                      <th className="px-4 py-2.5 text-center">Form</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {coreFields.map((f) => (
                      <tr key={f.key} className="hover:bg-stone-50/50">
                        <td className="px-4 py-3 font-semibold text-stone-800">
                          {f.label}
                          {f.required && <span className="ml-1.5 text-[10px] text-amber-600 font-bold">REQ</span>}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-stone-500">{f.key}</td>
                        <td className="px-4 py-3 text-center">
                          <button type="button" onClick={() => toggleCorePref(f.key, 'showInTable')} className="inline-flex text-brand-700" title="Toggle table">
                            {f.showInTable ? <Eye size={16} /> : <EyeOff size={16} className="text-stone-300" />}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button type="button" onClick={() => toggleCorePref(f.key, 'showInForm')} className="inline-flex text-brand-700" title="Toggle form">
                            {f.showInForm ? <CheckSquare size={16} /> : <EyeOff size={16} className="text-stone-300" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Custom */}
            <section className="card-ats-bordered overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-2 flex-wrap">
                <Columns3 size={16} className="text-brand-600" />
                <h2 className="text-sm font-bold text-stone-900">Custom fields</h2>
                <button type="button" className="btn-primary !h-9 !text-xs ml-auto" onClick={openNew}>
                  <Plus size={14} /> Add field
                </button>
              </div>
              {customFields.length === 0 ? (
                <EmptyState
                  icon={Columns3}
                  tone="sky"
                  compact
                  message="No custom fields yet"
                  subMessage="Add fields your Excel sheets use that aren’t in the core set."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-stone-50 text-left text-[10px] font-bold uppercase tracking-wider text-stone-500">
                        <th className="px-4 py-2.5">Label</th>
                        <th className="px-4 py-2.5">Key</th>
                        <th className="px-4 py-2.5">Type</th>
                        <th className="px-4 py-2.5 text-center">Table</th>
                        <th className="px-4 py-2.5 text-center">Form</th>
                        <th className="px-4 py-2.5">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {customFields.map((f) => (
                        <tr key={f.key} className="hover:bg-stone-50/50">
                          <td className="px-4 py-3 font-semibold text-stone-800">{f.label}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-500">{f.key}</td>
                          <td className="px-4 py-3 text-stone-600 capitalize">{f.type}</td>
                          <td className="px-4 py-3 text-center text-stone-500">{f.showInTable ? 'Yes' : '—'}</td>
                          <td className="px-4 py-3 text-center text-stone-500">{f.showInForm ? 'Yes' : '—'}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1.5">
                              <button type="button" className="btn-secondary !h-8 !px-2.5 !text-xs" onClick={() => openEdit(f)}>Edit</button>
                              <button type="button" className="h-8 w-8 rounded-lg border border-red-200 text-red-600 inline-flex items-center justify-center hover:bg-red-50" onClick={() => removeCustom(f.key)}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center bg-stone-900/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-700">Custom field</p>
                <h3 className="font-bold text-stone-900">{editing.key ? 'Edit field' : 'New field'}</h3>
              </div>
              <button type="button" className="h-9 w-9 rounded-xl border border-stone-200 inline-flex items-center justify-center" onClick={() => setEditing(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="label-ats">Label</label>
                <input
                  className="input-ats"
                  value={editing.label}
                  onChange={(e) => setEditing((p) => ({
                    ...p,
                    label: e.target.value,
                    key: p.key || slugify(e.target.value),
                  }))}
                  placeholder="e.g. Visa status"
                />
              </div>
              <div>
                <label className="label-ats">Key (slug)</label>
                <input
                  className="input-ats font-mono text-sm"
                  value={editing.key}
                  onChange={(e) => setEditing((p) => ({ ...p, key: slugify(e.target.value) }))}
                  disabled={!!customFields.find((f) => f.key === editing.key) && editing.key === customFields.find((f) => f.key === editing.key)?.key && fields.some((f) => f.key === editing.key && !f.isCore)}
                />
                <p className="text-[11px] text-stone-400 mt-1">Stored as customFields.{editing.key || '…'}</p>
              </div>
              <div>
                <label className="label-ats">Type</label>
                <PremiumSelect
                  variant="list"
                  value={editing.type}
                  onChange={(v) => setEditing((p) => ({ ...p, type: v || 'text' }))}
                  options={FIELD_TYPES}
                />
              </div>
              {editing.type === 'select' && (
                <div>
                  <label className="label-ats">Options (comma-separated)</label>
                  <input className="input-ats" value={optionsText} onChange={(e) => setOptionsText(e.target.value)} placeholder="H1B, Green Card, Citizen" />
                </div>
              )}
              <div>
                <label className="label-ats">Import aliases (comma-separated Excel headers)</label>
                <input className="input-ats" value={aliasesText} onChange={(e) => setAliasesText(e.target.value)} placeholder="visa, work authorization" />
              </div>
              <div className="flex flex-wrap gap-4 pt-1">
                <label className="inline-flex items-center gap-2 text-sm text-stone-700">
                  <input type="checkbox" checked={!!editing.showInTable} onChange={(e) => setEditing((p) => ({ ...p, showInTable: e.target.checked }))} />
                  Show in table
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-stone-700">
                  <input type="checkbox" checked={!!editing.showInForm} onChange={(e) => setEditing((p) => ({ ...p, showInForm: e.target.checked }))} />
                  Show in form
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-stone-700">
                  <input type="checkbox" checked={!!editing.required} onChange={(e) => setEditing((p) => ({ ...p, required: e.target.checked }))} />
                  Required
                </label>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-stone-100 flex gap-2 justify-end bg-stone-50/50">
              <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button type="button" className="btn-primary" onClick={commitEditing}>Apply</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false })}
        onConfirm={confirmModal.onConfirm || (() => {})}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        type={confirmModal.type}
      />
    </>
  );
}
