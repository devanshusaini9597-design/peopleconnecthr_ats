import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Plus, RefreshCw } from 'lucide-react';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import PageHeader from './ui/PageHeader';
import ConfirmationModal from './ConfirmationModal';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';
import { toEditorHtml, stripHtml } from './ui/EmailBodyEditor';
import {
  BASE, TPL_TOUR_KEY, TPL_TOUR_STEPS, VARIABLE_OPTIONS,
} from './emailTemplates/emailTemplatesConstants';
import { insertAtCursor, stripToken } from './emailTemplates/emailTemplatesHelpers';
import EmailTemplateList from './emailTemplates/EmailTemplateList';
import EmailTemplateEditor from './emailTemplates/EmailTemplateEditor';
import EmailTemplatePreview from './emailTemplates/EmailTemplatePreview';

const EmailTemplatesPage = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const [tourOpen, setTourOpen] = usePageTour(TPL_TOUR_KEY);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [form, setForm] = useState({ name: '', category: 'custom', subject: '', body: '', variables: [] });
  const [saving, setSaving] = useState(false);
  const subjectRef = useRef(null);
  const bodyEditorRef = useRef(null);

  const [showPreview, setShowPreview] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [previewVars, setPreviewVars] = useState({});

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [insertTarget, setInsertTarget] = useState('body');

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
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
    setForm({ name: '', category: 'custom', subject: '', body: '<p></p>', variables: [] });
    setInsertTarget('body');
    setShowEditor(true);
  };

  const openEditTemplate = (t) => {
    setEditingTemplate(t);
    setForm({
      name: t.name,
      category: t.category,
      subject: t.subject,
      body: toEditorHtml(t.body),
      variables: t.variables || [],
    });
    setInsertTarget('body');
    setShowEditor(true);
  };

  const duplicateTemplate = (t) => {
    setEditingTemplate(null);
    setForm({
      name: `${t.name} (Copy)`,
      category: t.category,
      subject: t.subject,
      body: toEditorHtml(t.body),
      variables: t.variables || [],
    });
    setInsertTarget('body');
    setShowEditor(true);
  };

  const insertVariable = (key, field = 'body') => {
    const tag = `{{${key}}}`;
    if (field === 'subject') {
      setForm((prev) => ({
        ...prev,
        subject: insertAtCursor(subjectRef.current, prev.subject, tag),
        variables: prev.variables.includes(key) ? prev.variables : [...prev.variables, key],
      }));
      return;
    }
    bodyEditorRef.current?.insertField(tag);
    setForm((prev) => ({
      ...prev,
      variables: prev.variables.includes(key) ? prev.variables : [...prev.variables, key],
    }));
  };

  const removeVariable = (key) => {
    setForm((prev) => {
      const subject = stripToken(prev.subject, key);
      const body = stripToken(prev.body, key);
      const stillUsed =
        subject.includes(`{{${key}}}`) || body.includes(`{{${key}}}`);
      return {
        ...prev,
        subject,
        body,
        variables: stillUsed
          ? prev.variables
          : prev.variables.filter((v) => v !== key),
      };
    });
  };

  const handleSave = async () => {
    const bodyText = stripHtml(form.body || '');
    if (!form.name.trim() || !form.subject.trim() || !bodyText) {
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
        title={t('pages.emailTemplates.title')}
        subtitle="Reusable emails for hiring workflows — personalize with one click."
        gradientTitle
      >
        <button type="button" onClick={fetchTemplates} className="btn-secondary w-full sm:w-auto">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
        <button type="button" data-tour="tpl-create" onClick={openNewTemplate} className="btn-primary w-full sm:w-auto">
          <Plus size={16} /> Create template
        </button>
      </PageHeader>

      <div className="rounded-xl border border-brand-200/60 bg-gradient-to-r from-brand-50/70 via-white to-teal-50/40 px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed">
        Click tags like <span className="font-semibold text-stone-800">Candidate name</span> while writing —
        we fill them in when you send. No coding. Press <span className="font-semibold text-stone-800">?</span> for a tour.
      </div>

      <EmailTemplateList
        filtered={filtered}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filterCategory={filterCategory}
        setFilterCategory={setFilterCategory}
        onCreate={openNewTemplate}
        onPreview={openPreview}
        onEdit={openEditTemplate}
        onDuplicate={duplicateTemplate}
        onDelete={setDeleteTarget}
      />

      <EmailTemplateEditor
        open={showEditor}
        onClose={() => setShowEditor(false)}
        editingTemplate={editingTemplate}
        form={form}
        setForm={setForm}
        saving={saving}
        onSave={handleSave}
        subjectRef={subjectRef}
        bodyEditorRef={bodyEditorRef}
        insertTarget={insertTarget}
        setInsertTarget={setInsertTarget}
        removeVariable={removeVariable}
        insertVariable={insertVariable}
        detectedVars={detectedVars}
      />

      <EmailTemplatePreview
        open={showPreview}
        onClose={() => setShowPreview(false)}
        previewTemplate={previewTemplate}
        previewVars={previewVars}
        setPreviewVars={setPreviewVars}
        renderPreviewText={renderPreviewText}
        onEdit={openEditTemplate}
      />

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

      <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of Email Templates" />
      <ProductTour
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        steps={TPL_TOUR_STEPS}
        storageKey={TPL_TOUR_KEY}
      />
    </div>
  );
};

export default EmailTemplatesPage;
