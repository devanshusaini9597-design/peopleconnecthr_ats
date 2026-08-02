import React, { useState, useEffect, useCallback } from 'react';
import {
  Mail, Plus, Edit3, Trash2, Eye, Copy, Search, Save,
  Briefcase, Phone, XCircle, UserCheck, FileCheck, Sparkles, Check, Megaphone, Loader2
} from 'lucide-react';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import { formatByFieldName } from '../utils/textFormatter';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import Modal from './ui/Modal';
import PremiumSelect from './ui/PremiumSelect';
import ConfirmationModal from './ConfirmationModal';

import API_URL from '../config';
const BASE = API_URL;

const CATEGORY_META = {
  hiring:     { label: 'Hiring Drive', icon: Briefcase, bg: 'bg-brand-50',  text: 'text-brand-700',  badge: 'bg-brand-100 text-brand-700 border-brand-200' },
  interview:  { label: 'Interview',    icon: Phone,     bg: 'bg-cyan-50',    text: 'text-cyan-700',   badge: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  rejection:  { label: 'Rejection',    icon: XCircle,   bg: 'bg-red-50',     text: 'text-red-700',    badge: 'bg-red-100 text-red-700 border-red-200' },
  onboarding: { label: 'Onboarding',   icon: UserCheck, bg: 'bg-emerald-50', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  document:   { label: 'Document',     icon: FileCheck, bg: 'bg-amber-50',   text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  marketing:  { label: 'Marketing',    icon: Megaphone, bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', badge: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200' },
  custom:     { label: 'Custom',       icon: Sparkles,  bg: 'bg-violet-50',  text: 'text-violet-700', badge: 'bg-violet-100 text-violet-700 border-violet-200' },
};

const CATEGORY_OPTIONS = Object.entries(CATEGORY_META).map(([value, meta]) => ({
  value,
  label: meta.label,
  icon: meta.icon,
}));

const VARIABLE_OPTIONS = [
  { key: 'candidateName', label: 'Candidate Name', example: 'Devanshu Saini' },
  { key: 'position', label: 'Position / Role', example: 'Full Stack Developer' },
  { key: 'company', label: 'Company Name', example: 'Skillnix Recruitment Services' },
  { key: 'ctc', label: 'CTC / Salary', example: 'Up to 4 LPA' },
  { key: 'experience', label: 'Experience Required', example: 'Minimum 1 year' },
  { key: 'location', label: 'Location', example: 'Delhi, Gurgaon' },
  { key: 'date', label: 'Date', example: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) },
  { key: 'time', label: 'Time', example: '10:00 AM', isTime: true },
  { key: 'venue', label: 'Venue / Address', example: 'Shyampur, Rishikesh' },
  { key: 'spoc', label: 'SPOC Name', example: 'Mr. XYZ' },
  { key: 'subscribeLink', label: 'Subscribe URL (Marketing)', example: 'https://yoursite.com/subscribe' },
  { key: 'unsubscribeLink', label: 'Unsubscribe Link (Marketing)', example: '#unsubscribe' },
];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? '00' : '30';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return { value: `${String(h).padStart(2, '0')}:${m}`, label: `${h12}:${m} ${ampm}` };
});

const EmailTemplatesPage = () => {
  const toast = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [form, setForm] = useState({ name: '', category: 'custom', subject: '', body: '', variables: [] });
  const [saving, setSaving] = useState(false);

  const [showPreview, setShowPreview] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [previewVars, setPreviewVars] = useState({});

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await authenticatedFetch(`${BASE}/api/email-templates`);
      if (isUnauthorized(res)) { handleUnauthorized(); return; }
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates);
      } else {
        await authenticatedFetch(`${BASE}/api/email-templates/seed-defaults`, { method: 'POST' });
        const res2 = await authenticatedFetch(`${BASE}/api/email-templates`);
        const data2 = await res2.json();
        if (data2.success) setTemplates(data2.templates);
      }
    } catch (_err) {
      console.error('Fetch templates error:', _err);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  useEffect(() => {
    if (!loading && templates.length === 0) {
      (async () => {
        try {
          await authenticatedFetch(`${BASE}/api/email-templates/seed-defaults`, { method: 'POST' });
          fetchTemplates();
        } catch { /* silent */ }
      })();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, templates.length]);

  const filtered = templates.filter((t) => {
    if (filterCategory !== 'all' && t.category !== filterCategory) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      if (!t.name.toLowerCase().includes(q) && !t.subject.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const openNewTemplate = () => {
    setEditingTemplate(null);
    setForm({ name: '', category: 'custom', subject: '', body: '', variables: [] });
    setShowEditor(true);
  };

  const openEditTemplate = (t) => {
    setEditingTemplate(t);
    setForm({ name: t.name, category: t.category, subject: t.subject, body: t.body, variables: t.variables || [] });
    setShowEditor(true);
  };

  const duplicateTemplate = (t) => {
    setEditingTemplate(null);
    setForm({ name: `${t.name} (Copy)`, category: t.category, subject: t.subject, body: t.body, variables: t.variables || [] });
    setShowEditor(true);
  };

  const insertVariable = (key) => {
    const tag = `{{${key}}}`;
    setForm((prev) => ({
      ...prev,
      body: prev.body + tag,
      variables: prev.variables.includes(key) ? prev.variables : [...prev.variables, key],
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.subject.trim() || !form.body.trim()) {
      toast.warning('Please fill in name, subject, and body');
      return;
    }
    setSaving(true);
    try {
      const usedVars = VARIABLE_OPTIONS
        .filter((v) => form.body.includes(`{{${v.key}}}`) || form.subject.includes(`{{${v.key}}}`))
        .map((v) => v.key);
      const payload = { ...form, variables: usedVars };

      let res;
      if (editingTemplate) {
        res = await authenticatedFetch(`${BASE}/api/email-templates/${editingTemplate._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await authenticatedFetch(`${BASE}/api/email-templates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      const data = await res.json();
      if (data.success) {
        toast.success(editingTemplate ? 'Template updated' : 'Template created');
        setShowEditor(false);
        fetchTemplates();
      } else {
        toast.error(data.message || 'Save failed');
      }
    } catch {
      toast.error('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await authenticatedFetch(`${BASE}/api/email-templates/${deleteTarget._id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Template deleted');
        setDeleteTarget(null);
        fetchTemplates();
      } else {
        toast.error(data.message || 'Delete failed');
      }
    } catch {
      toast.error('Failed to delete template');
    } finally {
      setDeleting(false);
    }
  };

  const openPreview = (t) => {
    setPreviewTemplate(t);
    const vars = {};
    (t.variables || []).forEach((v) => {
      const opt = VARIABLE_OPTIONS.find((o) => o.key === v);
      vars[v] = opt?.example || '';
    });
    setPreviewVars(vars);
    setShowPreview(true);
  };

  const renderPreviewText = (text) => {
    let result = text;
    Object.entries(previewVars).forEach(([key, val]) => {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val || `{{${key}}}`);
    });
    return result;
  };

  const detectedVars = VARIABLE_OPTIONS.filter(
    (v) => form.body.includes(`{{${v.key}}}`) || form.subject.includes(`{{${v.key}}}`)
  );

  if (loading) {
    return (
      <div className="page-shell-ats animate-page-enter">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl skeleton-ats flex-shrink-0" />
          <div className="space-y-2 flex-1 pt-1">
            <div className="h-7 w-52 skeleton-ats rounded-lg" />
            <div className="h-4 w-72 max-w-full skeleton-ats rounded-lg" />
          </div>
        </div>
        <div className="h-12 skeleton-ats rounded-xl mt-2" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card-ats-bordered p-5 space-y-3">
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-xl skeleton-ats" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 skeleton-ats rounded-lg" />
                  <div className="h-3 w-48 skeleton-ats rounded-lg" />
                </div>
              </div>
              <div className="h-20 skeleton-ats rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell-ats animate-page-enter">
      <PageHeader
        icon={Mail}
        title="Email Templates"
        subtitle="Create and manage professional email templates for hiring workflows."
        gradientTitle
      >
        <button type="button" onClick={openNewTemplate} className="btn-primary flex-1 sm:flex-none">
          <Plus size={16} /> Create Template
        </button>
      </PageHeader>

      <div className="toolbar-ats flex flex-col gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search templates…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-ats !pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setFilterCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              filterCategory === 'all'
                ? 'bg-stone-900 text-white border-stone-900'
                : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300 hover:bg-stone-50'
            }`}
          >
            All
          </button>
          {Object.entries(CATEGORY_META).map(([key, meta]) => (
            <button
              type="button"
              key={key}
              onClick={() => setFilterCategory(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                filterCategory === key
                  ? 'bg-stone-900 text-white border-stone-900'
                  : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300 hover:bg-stone-50'
              }`}
            >
              {meta.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card-ats-bordered">
          <EmptyState
            icon={Mail}
            tone="emerald"
            message="No templates found"
            subMessage="Create your first email template to get started"
            action={
              <button type="button" onClick={openNewTemplate} className="btn-primary">
                <Plus size={14} /> Create Template
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((t) => {
            const meta = CATEGORY_META[t.category] || CATEGORY_META.custom;
            const Icon = meta.icon;
            return (
              <div
                key={t._id}
                className="card-ats-bordered hover:border-stone-300 flex flex-col relative overflow-hidden group"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="p-4 pb-3 flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl ${meta.bg} flex items-center justify-center flex-shrink-0 border border-white/60`}>
                    <Icon size={16} className={meta.text} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <h3 className="text-sm font-bold text-stone-900 truncate tracking-tight">{t.name}</h3>
                      {t.isDefault && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-stone-100 text-stone-500 rounded border border-stone-200">DEFAULT</span>
                      )}
                    </div>
                    <span className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.badge}`}>
                      {meta.label}
                    </span>
                    <p className="text-[11px] text-stone-500 truncate mt-1.5">{t.subject}</p>
                  </div>
                </div>

                <div className="px-4 pb-3 flex-1">
                  <div className="bg-stone-50 rounded-xl p-3 border border-stone-100">
                    <p className="text-[11px] text-stone-500 line-clamp-4 leading-relaxed whitespace-pre-line">
                      {t.body.substring(0, 200)}{t.body.length > 200 ? '…' : ''}
                    </p>
                  </div>
                </div>

                {t.variables?.length > 0 && (
                  <div className="px-4 pb-3">
                    <div className="flex flex-wrap gap-1">
                      {t.variables.slice(0, 5).map((v) => (
                        <span key={v} className="text-[9px] font-semibold px-1.5 py-0.5 bg-brand-50 text-brand-600 rounded border border-brand-100">{`{{${v}}}`}</span>
                      ))}
                      {t.variables.length > 5 && (
                        <span className="text-[9px] text-stone-400 font-medium">+{t.variables.length - 5} more</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="px-4 py-3 border-t border-stone-100 flex items-center gap-1">
                  <button type="button" onClick={() => openPreview(t)} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-stone-600 hover:bg-stone-100 rounded-lg transition-all">
                    <Eye size={12} /> Preview
                  </button>
                  <button type="button" onClick={() => openEditTemplate(t)} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-brand-600 hover:bg-brand-50 rounded-lg transition-all">
                    <Edit3 size={12} /> Edit
                  </button>
                  <button type="button" onClick={() => duplicateTemplate(t)} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-stone-600 hover:bg-stone-100 rounded-lg transition-all">
                    <Copy size={12} /> Duplicate
                  </button>
                  {!t.isDefault && (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(t)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all ml-auto"
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={showEditor}
        onClose={() => setShowEditor(false)}
        title={editingTemplate ? 'Edit Template' : 'Create New Template'}
        description="Use {{variableName}} placeholders for dynamic content."
        size="xl"
        footer={
          <>
            <button type="button" onClick={() => setShowEditor(false)} className="btn-secondary" disabled={saving}>Cancel</button>
            <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : <><Save size={16} /> {editingTemplate ? 'Update Template' : 'Save Template'}</>}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label-ats">Template Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: formatByFieldName('templateName', e.target.value) }))}
                placeholder="e.g. Hiring Drive Invitation"
                className="input-ats"
                autoFocus
              />
            </div>
            <div>
              <label className="label-ats">Category</label>
              <PremiumSelect
                value={form.category}
                onChange={(v) => setForm((prev) => ({ ...prev, category: v || 'custom' }))}
                options={CATEGORY_OPTIONS}
                placeholder="Category"
                compact
              />
            </div>
          </div>

          <div>
            <label className="label-ats">Email Subject *</label>
            <input
              type="text"
              value={form.subject}
              onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
              placeholder="e.g. Hiring Drive – {{position}} | {{company}}"
              className="input-ats"
            />
          </div>

          <div>
            <label className="label-ats">Insert Variable</label>
            <div className="flex flex-wrap gap-1.5">
              {VARIABLE_OPTIONS.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => insertVariable(v.key)}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-brand-50 text-brand-700 hover:bg-brand-100 rounded-lg transition-all border border-brand-100"
                  title={`Example: ${v.example}`}
                >
                  {`{{${v.key}}}`} <span className="text-brand-400 ml-1 font-medium">{v.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label-ats">Email Body *</label>
            <textarea
              value={form.body}
              onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
              placeholder={`Dear {{candidateName}},\n\nGreetings!\n\nWe are hiring for the profile of {{position}} with {{company}}.\n\nCTC: {{ctc}}\nLocation: {{location}}\n\nBest regards,\nHR Team`}
              rows={12}
              className="input-ats resize-none font-mono text-sm leading-relaxed"
            />
          </div>

          {detectedVars.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <p className="text-[11px] font-bold text-emerald-700 mb-1.5 flex items-center gap-1">
                <Check size={12} /> Detected Variables
              </p>
              <div className="flex flex-wrap gap-1.5">
                {detectedVars.map((v) => (
                  <span key={v.key} className="text-[10px] font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded border border-emerald-200">
                    {`{{${v.key}}}`} = {v.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={showPreview && !!previewTemplate}
        onClose={() => setShowPreview(false)}
        title="Template Preview"
        description="Fill sample values to see how the email will look."
        size="lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => { setShowPreview(false); openEditTemplate(previewTemplate); }}
              className="btn-secondary"
            >
              <Edit3 size={14} /> Edit Template
            </button>
            <button type="button" onClick={() => setShowPreview(false)} className="btn-primary">Close</button>
          </>
        }
      >
        {previewTemplate && (
          <div className="space-y-4">
            {previewTemplate.variables?.length > 0 && (
              <div>
                <label className="label-ats">Sample Variable Values</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {previewTemplate.variables.map((v) => {
                    const opt = VARIABLE_OPTIONS.find((o) => o.key === v);
                    if (opt?.isTime) {
                      const current = previewVars[v];
                      let timeVal = '';
                      if (current) {
                        const m = current.match(/(\d+):(\d+)\s*(AM|PM)/i);
                        if (m) {
                          let h = parseInt(m[1], 10);
                          const ampm = m[3].toUpperCase();
                          if (ampm === 'PM' && h !== 12) h += 12;
                          if (ampm === 'AM' && h === 12) h = 0;
                          timeVal = `${String(h).padStart(2, '0')}:${m[2]}`;
                        }
                      }
                      return (
                        <div key={v}>
                          <label className="block text-[10px] font-semibold text-stone-500 mb-1">{opt?.label || v}</label>
                          <PremiumSelect
                            value={timeVal}
                            onChange={(val) => {
                              if (!val) return;
                              const [h, m] = val.split(':');
                              const hr = parseInt(h, 10);
                              const ampm = hr >= 12 ? 'PM' : 'AM';
                              const hr12 = hr % 12 || 12;
                              setPreviewVars((prev) => ({ ...prev, [v]: `${hr12}:${m} ${ampm}` }));
                            }}
                            options={TIME_OPTIONS}
                            placeholder="Select time"
                            compact
                          />
                        </div>
                      );
                    }
                    return (
                      <div key={v}>
                        <label className="block text-[10px] font-semibold text-stone-500 mb-1">{opt?.label || v}</label>
                        <input
                          type={v === 'date' ? 'date' : 'text'}
                          value={previewVars[v] || ''}
                          onChange={(e) => setPreviewVars((prev) => ({ ...prev, [v]: e.target.value }))}
                          placeholder={opt?.example || ''}
                          className="input-ats !py-1.5"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="border border-stone-200 rounded-xl overflow-hidden">
              <div className="bg-gradient-to-r from-brand-600 to-teal-600 px-5 py-3">
                <p className="text-white text-sm font-semibold">{renderPreviewText(previewTemplate.subject)}</p>
              </div>
              <div className="p-5 bg-white">
                <div className="text-sm text-stone-700 leading-relaxed whitespace-pre-line">
                  {previewTemplate.name === 'Subscribe for Updates' && previewTemplate.category === 'marketing'
                    ? renderPreviewText(previewTemplate.body.replace(/\n?Subscribe now:\s*\{\{subscribeLink\}\}\s*\n?/gi, '\n'))
                    : renderPreviewText(previewTemplate.body)}
                </div>
                {previewTemplate.name === 'Subscribe for Updates' && previewTemplate.category === 'marketing' && (
                  <div className="mt-5 text-center">
                    <a
                      href={previewVars.subscribeLink?.startsWith('http') ? previewVars.subscribeLink : '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block px-6 py-3 bg-gradient-to-r from-brand-600 to-teal-600 text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
                    >
                      Subscribe for updates
                    </a>
                  </div>
                )}
              </div>
              <div className="px-5 py-3 bg-stone-50 border-t border-stone-100 text-center">
                <p className="text-[10px] text-stone-400 font-medium">Skillnix Recruitment Services</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete template?"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmText="Delete"
        type="delete"
        isLoading={deleting}
      />
    </div>
  );
};

export default EmailTemplatesPage;
