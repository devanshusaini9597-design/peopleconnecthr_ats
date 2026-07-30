import React, { useState, useEffect, useCallback } from 'react';
import { Mail, Plus, Edit3, Trash2, Eye, Copy, Search, X, Save, FileText, Send, ChevronDown, Briefcase, Phone, XCircle, UserCheck, FileCheck, Sparkles, Check, AlertCircle, Megaphone } from 'lucide-react';
import Layout from './Layout';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import { formatByFieldName } from '../utils/textFormatter';

import API_URL from '../config';
const BASE = API_URL;

const CATEGORY_META = {
  hiring:     { label: 'Hiring Drive',   icon: Briefcase, color: 'indigo', bg: 'bg-indigo-50',  text: 'text-indigo-700', ring: 'ring-indigo-400', badge: 'bg-indigo-100 text-indigo-700' },
  interview:  { label: 'Interview',      icon: Phone,     color: 'cyan',   bg: 'bg-cyan-50',    text: 'text-cyan-700',   ring: 'ring-cyan-400',   badge: 'bg-cyan-100 text-cyan-700' },
  rejection:  { label: 'Rejection',      icon: XCircle,   color: 'red',    bg: 'bg-red-50',     text: 'text-red-700',    ring: 'ring-red-400',    badge: 'bg-red-100 text-red-700' },
  onboarding: { label: 'Onboarding',     icon: UserCheck,  color: 'green',  bg: 'bg-green-50',   text: 'text-green-700',  ring: 'ring-green-400',  badge: 'bg-green-100 text-green-700' },
  document:   { label: 'Document',       icon: FileCheck, color: 'amber',  bg: 'bg-amber-50',   text: 'text-amber-700',  ring: 'ring-amber-400',  badge: 'bg-amber-100 text-amber-700' },
  marketing:  { label: 'Marketing',      icon: Megaphone, color: 'fuchsia', bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', ring: 'ring-fuchsia-400', badge: 'bg-fuchsia-100 text-fuchsia-700' },
  custom:     { label: 'Custom',         icon: Sparkles,  color: 'purple', bg: 'bg-purple-50',  text: 'text-purple-700', ring: 'ring-purple-400', badge: 'bg-purple-100 text-purple-700' },
};

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

const EmailTemplatesPage = () => {
  const toast = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  // Editor state
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [form, setForm] = useState({ name: '', category: 'custom', subject: '', body: '', variables: [] });
  const [saving, setSaving] = useState(false);

  // Preview state
  const [showPreview, setShowPreview] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [previewVars, setPreviewVars] = useState({});

  // Delete state
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await authenticatedFetch(`${BASE}/api/email-templates`);
      if (isUnauthorized(res)) { handleUnauthorized(); return; }
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates);
      } else {
        // Seed defaults if none exist
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

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Auto-seed on first load if empty
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

  const filtered = templates.filter(t => {
    if (filterCategory !== 'all' && t.category !== filterCategory) return false;
    if (searchTerm && !t.name.toLowerCase().includes(searchTerm.toLowerCase()) && !t.subject.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  // ─── Editor ───
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
    setForm(prev => ({
      ...prev,
      body: prev.body + tag,
      variables: prev.variables.includes(key) ? prev.variables : [...prev.variables, key]
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.subject.trim() || !form.body.trim()) {
      toast.warning('Please fill in name, subject, and body');
      return;
    }
    setSaving(true);
    try {
      // Detect variables used in body/subject
      const usedVars = VARIABLE_OPTIONS.filter(v => form.body.includes(`{{${v.key}}}`) || form.subject.includes(`{{${v.key}}}`)).map(v => v.key);
      const payload = { ...form, variables: usedVars };

      let res;
      if (editingTemplate) {
        res = await authenticatedFetch(`${BASE}/api/email-templates/${editingTemplate._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await authenticatedFetch(`${BASE}/api/email-templates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
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

  const handleDelete = async (id) => {
    try {
      const res = await authenticatedFetch(`${BASE}/api/email-templates/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Template deleted');
        setDeleteConfirm(null);
        fetchTemplates();
      } else {
        toast.error(data.message || 'Delete failed');
      }
    } catch {
      toast.error('Failed to delete template');
    }
  };

  // ─── Preview ───
  const openPreview = (t) => {
    setPreviewTemplate(t);
    const vars = {};
    (t.variables || []).forEach(v => {
      const opt = VARIABLE_OPTIONS.find(o => o.key === v);
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

  // ─── Render ───
  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-600 border-t-transparent mx-auto mb-3"></div>
            <p className="text-sm text-gray-500 font-medium">Loading templates...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Mail size={20} className="text-indigo-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Email Templates</h1>
              <p className="text-xs text-gray-500">Create, manage and send professional email templates</p>
            </div>
          </div>
          <button
            onClick={openNewTemplate}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-all"
          >
            <Plus size={16} />
            Create Template
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilterCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterCategory === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >All</button>
            {Object.entries(CATEGORY_META).map(([key, meta]) => (
              <button
                key={key}
                onClick={() => setFilterCategory(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterCategory === key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >{meta.label}</button>
            ))}
          </div>
        </div>

        {/* Templates Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <Mail size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-600">No templates found</p>
            <p className="text-xs text-gray-400 mt-1">Create your first email template to get started</p>
            <button onClick={openNewTemplate} className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-all">
              <Plus size={14} className="inline mr-1" /> Create Template
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((t) => {
              const meta = CATEGORY_META[t.category] || CATEGORY_META.custom;
              const Icon = meta.icon;
              return (
                <div
                  key={t._id}
                  className="bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all flex flex-col"
                >
                  {/* Card Header */}
                  <div className="p-4 pb-3 flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-lg ${meta.bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon size={16} className={meta.text} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-sm font-bold text-gray-900 truncate">{t.name}</h3>
                        {t.isDefault && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">DEFAULT</span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 truncate">{t.subject}</p>
                    </div>
                  </div>

                  {/* Body preview */}
                  <div className="px-4 pb-3 flex-1">
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <p className="text-[11px] text-gray-500 line-clamp-4 leading-relaxed whitespace-pre-line">{t.body.substring(0, 200)}{t.body.length > 200 ? '...' : ''}</p>
                    </div>
                  </div>

                  {/* Variables */}
                  {t.variables && t.variables.length > 0 && (
                    <div className="px-4 pb-3">
                      <div className="flex flex-wrap gap-1">
                        {t.variables.slice(0, 5).map(v => (
                          <span key={v} className="text-[9px] font-semibold px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded">{`{{${v}}}`}</span>
                        ))}
                        {t.variables.length > 5 && (
                          <span className="text-[9px] text-gray-400">+{t.variables.length - 5} more</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-1.5">
                    <button
                      onClick={() => openPreview(t)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                    >
                      <Eye size={12} /> Preview
                    </button>
                    <button
                      onClick={() => openEditTemplate(t)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                    >
                      <Edit3 size={12} /> Edit
                    </button>
                    <button
                      onClick={() => duplicateTemplate(t)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                    >
                      <Copy size={12} /> Duplicate
                    </button>
                    {!t.isDefault && (
                      <button
                        onClick={() => setDeleteConfirm(t._id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-red-500 hover:bg-red-50 rounded-lg transition-all ml-auto"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>

                  {/* Delete confirm */}
                  {deleteConfirm === t._id && (
                    <div className="px-4 py-2.5 bg-red-50 border-t border-red-200 flex items-center justify-between">
                      <p className="text-xs text-red-700 font-medium">Delete this template?</p>
                      <div className="flex gap-2">
                        <button onClick={() => setDeleteConfirm(null)} className="text-xs text-gray-500 hover:text-gray-700 font-medium">Cancel</button>
                        <button onClick={() => handleDelete(t._id)} className="text-xs text-red-600 hover:text-red-800 font-bold">Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══════ TEMPLATE EDITOR MODAL ═══════ */}
      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/80 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <FileText size={18} className="text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">{editingTemplate ? 'Edit Template' : 'Create New Template'}</h3>
                  <p className="text-xs text-gray-500">Use {'{{variableName}}'} placeholders for dynamic content</p>
                </div>
              </div>
              <button onClick={() => setShowEditor(false)} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 p-6 space-y-5">
              {/* Row 1: Name + Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Template Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm(prev => ({ ...prev, name: formatByFieldName('templateName', e.target.value) }))}
                    placeholder="e.g. Hiring Drive Invitation"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  >
                    {Object.entries(CATEGORY_META).map(([key, meta]) => (
                      <option key={key} value={key}>{meta.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email Subject *</label>
                <input
                  type="text"
                  value={form.subject}
                  onChange={(e) => setForm(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="e.g. Hiring Drive – {{position}} | {{company}}"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>

              {/* Variables quick-insert */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Insert Variable (click to add to body)</label>
                <div className="flex flex-wrap gap-1.5">
                  {VARIABLE_OPTIONS.map(v => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => insertVariable(v.key)}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg transition-all border border-indigo-100"
                      title={`Example: ${v.example}`}
                    >
                      {`{{${v.key}}}`} <span className="text-indigo-400 ml-1">{v.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Body */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email Body *</label>
                <textarea
                  value={form.body}
                  onChange={(e) => setForm(prev => ({ ...prev, body: e.target.value }))}
                  placeholder={`Dear {{candidateName}},\n\nGreetings!\n\nWe are hiring for the profile of {{position}} with {{company}}.\n\nCTC: {{ctc}}\nLocation: {{location}}\n\nBest regards,\nHR Team`}
                  rows={14}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none font-mono leading-relaxed"
                />
              </div>

              {/* Detected variables */}
              {(() => {
                const detected = VARIABLE_OPTIONS.filter(v => form.body.includes(`{{${v.key}}}`) || form.subject.includes(`{{${v.key}}}`));
                if (detected.length === 0) return null;
                return (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-[11px] font-bold text-green-700 mb-1.5 flex items-center gap-1"><Check size={12} /> Detected Variables</p>
                    <div className="flex flex-wrap gap-1.5">
                      {detected.map(v => (
                        <span key={v.key} className="text-[10px] font-semibold px-2 py-0.5 bg-green-100 text-green-700 rounded">{`{{${v.key}}}`} = {v.label}</span>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50/80 flex-shrink-0">
              <button onClick={() => setShowEditor(false)} className="px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition-all">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50"
              >
                {saving ? (
                  <><div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> Saving...</>
                ) : (
                  <><Save size={16} /> {editingTemplate ? 'Update Template' : 'Save Template'}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ PREVIEW MODAL ═══════ */}
      {showPreview && previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/80 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Eye size={18} className="text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Template Preview</h3>
                  <p className="text-xs text-gray-500">Fill sample values to see how the email will look</p>
                </div>
              </div>
              <button onClick={() => setShowPreview(false)} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-5">
              {/* Variable inputs */}
              {previewTemplate.variables && previewTemplate.variables.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-2">Sample Variable Values</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {previewTemplate.variables.map(v => {
                      const opt = VARIABLE_OPTIONS.find(o => o.key === v);
                      return (
                        <div key={v}>
                          <label className="block text-[10px] font-semibold text-gray-500 mb-1">{opt?.label || v}</label>
                          {opt?.isTime ? (
                            <div className="flex gap-2">
                              <select
                                value={(() => { const t = previewVars[v]; if (!t) return ''; const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i); if (!m) return ''; let h = parseInt(m[1]); const ampm = m[3].toUpperCase(); if (ampm === 'PM' && h !== 12) h += 12; if (ampm === 'AM' && h === 12) h = 0; return `${String(h).padStart(2,'0')}:${m[2]}`; })()}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val) {
                                    const [h, m] = val.split(':');
                                    const hr = parseInt(h);
                                    const ampm = hr >= 12 ? 'PM' : 'AM';
                                    const hr12 = hr % 12 || 12;
                                    setPreviewVars(prev => ({ ...prev, [v]: `${hr12}:${m} ${ampm}` }));
                                  }
                                }}
                                className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                              >
                                <option value="">Select time</option>
                                {Array.from({ length: 48 }, (_, i) => { const h = Math.floor(i / 2); const m = i % 2 === 0 ? '00' : '30'; const ampm = h >= 12 ? 'PM' : 'AM'; const h12 = h % 12 || 12; return <option key={i} value={`${String(h).padStart(2,'0')}:${m}`}>{`${h12}:${m} ${ampm}`}</option>; })}
                              </select>
                            </div>
                          ) : (
                            <input
                              type={v === 'date' ? 'date' : 'text'}
                              value={previewVars[v] || ''}
                              onChange={(e) => setPreviewVars(prev => ({ ...prev, [v]: e.target.value }))}
                              placeholder={opt?.example || ''}
                              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-400"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Email preview */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                {/* Subject bar */}
                <div className="bg-indigo-600 px-5 py-3">
                  <p className="text-white text-sm font-semibold">{renderPreviewText(previewTemplate.subject)}</p>
                </div>
                {/* Body */}
                <div className="p-6 bg-white">
                  <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                    {previewTemplate.name === 'Subscribe for Updates' && previewTemplate.category === 'marketing'
                      ? renderPreviewText(previewTemplate.body.replace(/\n?Subscribe now:\s*\{\{subscribeLink\}\}\s*\n?/gi, '\n'))
                      : renderPreviewText(previewTemplate.body)}
                  </div>
                  {previewTemplate.name === 'Subscribe for Updates' && previewTemplate.category === 'marketing' && (
                    <div className="mt-5 text-center">
                      <a
                        href={previewVars.subscribeLink && previewVars.subscribeLink.startsWith('http') ? previewVars.subscribeLink : '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
                      >
                        Subscribe for updates
                      </a>
                    </div>
                  )}
                </div>
                {/* Footer */}
                <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-center">
                  <p className="text-[10px] text-gray-400">Skillnix Recruitment Services</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50/80 flex-shrink-0">
              <button onClick={() => { setShowPreview(false); openEditTemplate(previewTemplate); }} className="px-4 py-2.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all flex items-center gap-1.5">
                <Edit3 size={14} /> Edit Template
              </button>
              <button onClick={() => setShowPreview(false)} className="px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition-all">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default EmailTemplatesPage;
