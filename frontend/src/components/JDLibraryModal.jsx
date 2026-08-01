import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, BookOpen, Sparkles, Briefcase, Plus, Loader2, Trash2,
  X, Check, BookmarkPlus, Pencil
} from 'lucide-react';
import Modal from './ui/Modal';
import BASE_API_URL from '../config';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';

/** Built-in starters — always available; not stored in DB */
const STARTER_TEMPLATES = [
  {
    id: 'starter-1',
    role: 'Full Stack Developer',
    experience: '3-5 Years',
    location: 'Hybrid',
    ctc: '12 - 18 LPA',
    skills: ['React', 'Node.js', 'MongoDB', 'Express'],
    description:
      'Build and maintain scalable web applications end-to-end. Own API design, frontend architecture, and deployment collaboration with DevOps.',
    isStarter: true,
  },
  {
    id: 'starter-2',
    role: 'Frontend Developer',
    experience: '2+ Years',
    location: 'Remote',
    ctc: '8 - 14 LPA',
    skills: ['React', 'Tailwind CSS', 'TypeScript'],
    description:
      'Craft responsive, accessible interfaces with a strong focus on performance, design systems, and polished interaction details.',
    isStarter: true,
  },
  {
    id: 'starter-3',
    role: 'Backend Engineer',
    experience: '3-6 Years',
    location: 'Bangalore / Hybrid',
    ctc: '15 - 22 LPA',
    skills: ['Node.js', 'PostgreSQL', 'Redis', 'AWS'],
    description:
      'Design reliable services, optimize data models, and improve system observability across production workloads.',
    isStarter: true,
  },
  {
    id: 'starter-4',
    role: 'HR Manager',
    experience: '5+ Years',
    location: 'On-site',
    ctc: '10 - 16 LPA',
    skills: ['Recruitment', 'Employee Relations', 'Payroll'],
    description:
      'Own end-to-end HR operations including hiring strategy, employee engagement, policy compliance, and people analytics.',
    isStarter: true,
  },
  {
    id: 'starter-5',
    role: 'Product Designer',
    experience: '2-4 Years',
    location: 'Remote / Hybrid',
    ctc: '10 - 18 LPA',
    skills: ['Figma', 'Prototyping', 'User Research', 'Design Systems'],
    description:
      'Lead discovery-to-delivery design for product surfaces. Partner with engineering to ship clear, usable experiences.',
    isStarter: true,
  },
];

const emptyForm = {
  role: '',
  experience: '',
  location: '',
  ctc: '',
  skills: '',
  description: '',
};

const mapJobToTemplate = (job) => ({
  id: job._id,
  _id: job._id,
  role: job.role || job.title || 'Untitled',
  experience: job.experience || '',
  location: job.location || '',
  ctc: job.ctc || '',
  skills: Array.isArray(job.skills) ? job.skills : [],
  description: job.description || '',
  isStarter: false,
});

const JDLibraryModal = ({ isOpen, onClose, onSelectTemplate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [tab, setTab] = useState('all'); // all | saved | starters
  const [saved, setSaved] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('list'); // list | create | edit
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  };

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch(`${BASE_API_URL}/jobs?isTemplate=true`);
      if (isUnauthorized(res)) return handleUnauthorized();
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data?.data || []);
        setSaved(list.map(mapJobToTemplate));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setSearchTerm('');
    setTab('all');
    setView('list');
    setForm(emptyForm);
    setEditingId(null);
    fetchTemplates();
  }, [isOpen, fetchTemplates]);

  const allTemplates = useMemo(() => {
    if (tab === 'saved') return saved;
    if (tab === 'starters') return STARTER_TEMPLATES;
    return [...saved, ...STARTER_TEMPLATES];
  }, [tab, saved]);

  const filteredTemplates = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return allTemplates;
    return allTemplates.filter(
      (t) =>
        t.role.toLowerCase().includes(q) ||
        (t.skills || []).some((s) => String(s).toLowerCase().includes(q)) ||
        (t.description || '').toLowerCase().includes(q)
    );
  }, [allTemplates, searchTerm]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setView('create');
  };

  const openEdit = (t, e) => {
    e?.stopPropagation();
    if (t.isStarter) return;
    setEditingId(t._id || t.id);
    setForm({
      role: t.role || '',
      experience: t.experience || '',
      location: t.location || '',
      ctc: t.ctc || '',
      skills: (t.skills || []).join(', '),
      description: t.description || '',
    });
    setView('edit');
  };

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    if (!form.role.trim()) {
      showToast('Role name is required', 'error');
      return;
    }
    setSaving(true);
    const skills = form.skills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      role: form.role.trim(),
      title: form.role.trim(),
      experience: form.experience.trim(),
      location: form.location.trim() || 'TBD',
      ctc: form.ctc.trim(),
      skills,
      description: form.description.trim(),
      isTemplate: true,
      status: 'Draft',
      hiringManagers: [],
    };

    try {
      const url = editingId ? `${BASE_API_URL}/jobs/${editingId}` : `${BASE_API_URL}/jobs`;
      const method = editingId ? 'PUT' : 'POST';
      const res = await authenticatedFetch(url, {
        method,
        body: JSON.stringify(payload),
      });
      if (isUnauthorized(res)) return handleUnauthorized();
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to save template');
      }
      showToast(editingId ? 'Template updated' : 'Template saved');
      setView('list');
      setForm(emptyForm);
      setEditingId(null);
      setTab('saved');
      fetchTemplates();
    } catch (err) {
      showToast(err.message || 'Failed to save template', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (t, e) => {
    e?.stopPropagation();
    if (t.isStarter || !t._id) return;
    if (!window.confirm(`Delete template “${t.role}”?`)) return;
    setDeletingId(t._id);
    try {
      const res = await authenticatedFetch(`${BASE_API_URL}/jobs/${t._id}`, { method: 'DELETE' });
      if (isUnauthorized(res)) return handleUnauthorized();
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to delete');
      }
      showToast('Template deleted');
      setSaved((prev) => prev.filter((x) => x._id !== t._id));
    } catch (err) {
      showToast(err.message || 'Failed to delete', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const closeAll = () => {
    setSearchTerm('');
    setView('list');
    setForm(emptyForm);
    onClose?.();
  };

  return (
    <Modal
      open={isOpen}
      onClose={closeAll}
      title={view === 'list' ? 'JD Library' : view === 'edit' ? 'Edit Template' : 'Create Template'}
      description={
        view === 'list'
          ? 'Use a starter or your saved templates to pre-fill a job — or create your own.'
          : 'Saved templates can be reused anytime when posting a new job.'
      }
      size="lg"
      footer={
        view !== 'list' ? (
          <>
            <button
              type="button"
              className="btn-secondary"
              disabled={saving}
              onClick={() => { setView('list'); setForm(emptyForm); setEditingId(null); }}
            >
              Back
            </button>
            <button type="submit" form="jd-template-form" className="btn-primary" disabled={saving}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {saving ? 'Saving…' : editingId ? 'Update Template' : 'Save Template'}
            </button>
          </>
        ) : null
      }
    >
      {view === 'list' ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search roles, skills…"
                className="input-ats !pl-10"
                autoFocus
              />
            </div>
            <button type="button" onClick={openCreate} className="btn-primary !py-2.5 flex-shrink-0 w-full sm:w-auto">
              <Plus size={16} /> New Template
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-stone-100/80 w-fit max-w-full">
            {[
              { id: 'all', label: 'All' },
              { id: 'saved', label: `Saved (${saved.length})` },
              { id: 'starters', label: 'Starters' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  tab === t.id
                    ? 'bg-white text-brand-700 shadow-sm'
                    : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-brand-100 bg-brand-50/50 px-3.5 py-2.5 text-xs text-brand-800 leading-relaxed">
            <span className="font-bold">How to save a template:</span>{' '}
            Click <strong>New Template</strong> here, or open any job → ⋮ menu → <strong>Save as Template</strong>.
          </div>

          <div className="space-y-2.5 max-h-[46vh] overflow-y-auto pr-1 -mr-1">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-14 text-stone-400 text-sm">
                <Loader2 className="w-5 h-5 animate-spin text-brand-600" /> Loading templates…
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center py-12 text-stone-500">
                <BookOpen className="w-10 h-10 mx-auto mb-3 text-stone-300" />
                <p className="font-semibold text-stone-700">
                  {tab === 'saved' ? 'No saved templates yet' : 'No templates match'}
                </p>
                <p className="text-sm mt-1 max-w-xs mx-auto">
                  {tab === 'saved'
                    ? 'Create one with New Template, or save an existing job as a template.'
                    : 'Try a different keyword.'}
                </p>
                {tab === 'saved' && (
                  <button type="button" onClick={openCreate} className="btn-primary mt-4 !py-2">
                    <Plus size={16} /> Create Template
                  </button>
                )}
              </div>
            ) : (
              filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className="group relative rounded-2xl border border-stone-200/80 bg-white hover:border-brand-300 hover:bg-brand-50/30 hover:shadow-[var(--shadow-card)] transition-all duration-200"
                >
                  <button
                    type="button"
                    onClick={() => onSelectTemplate(template)}
                    className="w-full text-left p-4 focus-ring rounded-2xl"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 border border-brand-200/60 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                        <Briefcase size={18} className="text-brand-600" />
                      </div>
                      <div className="min-w-0 flex-1 pr-16 sm:pr-20">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-bold text-stone-900 tracking-tight group-hover:text-brand-700 transition-colors">
                            {template.role}
                          </h3>
                          {template.experience && (
                            <span className="badge-neutral">{template.experience}</span>
                          )}
                          {template.isStarter ? (
                            <span className="badge-info !text-[10px]">Starter</span>
                          ) : (
                            <span className="badge-brand !text-[10px]">
                              <BookmarkPlus size={10} className="mr-0.5" /> Saved
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-stone-500 leading-relaxed line-clamp-2">
                          {template.description || 'No description'}
                        </p>
                        {template.skills?.length > 0 && (
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {template.skills.slice(0, 6).map((skill) => (
                              <span key={skill} className="badge-brand !py-0.5 !text-[10px]">
                                {skill}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1 absolute right-4 top-4">
                        <Sparkles size={12} /> Use
                      </span>
                    </div>
                  </button>

                  {!template.isStarter && (
                    <div className="absolute right-2 bottom-2 sm:top-2 sm:bottom-auto flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        title="Edit template"
                        onClick={(e) => openEdit(template, e)}
                        className="p-2 rounded-lg text-stone-400 hover:text-brand-700 hover:bg-white border border-transparent hover:border-stone-200"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        title="Delete template"
                        disabled={deletingId === template._id}
                        onClick={(e) => handleDelete(template, e)}
                        className="p-2 rounded-lg text-stone-400 hover:text-red-600 hover:bg-white border border-transparent hover:border-stone-200 disabled:opacity-50"
                      >
                        {deletingId === template._id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <form id="jd-template-form" onSubmit={handleSaveTemplate} className="space-y-4">
          <div>
            <label className="label-ats">Role / Title *</label>
            <input
              required
              type="text"
              className="input-ats"
              placeholder="e.g. Senior React Developer"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-ats">Experience</label>
              <input
                type="text"
                className="input-ats"
                placeholder="e.g. 3-5 Years"
                value={form.experience}
                onChange={(e) => setForm({ ...form, experience: e.target.value })}
              />
            </div>
            <div>
              <label className="label-ats">Location</label>
              <input
                type="text"
                className="input-ats"
                placeholder="e.g. Remote / Pune"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
            <div>
              <label className="label-ats">CTC / Salary</label>
              <input
                type="text"
                className="input-ats"
                placeholder="e.g. 12 - 18 LPA"
                value={form.ctc}
                onChange={(e) => setForm({ ...form, ctc: e.target.value })}
              />
            </div>
            <div>
              <label className="label-ats">Skills (comma separated)</label>
              <input
                type="text"
                className="input-ats"
                placeholder="React, Node.js, TypeScript"
                value={form.skills}
                onChange={(e) => setForm({ ...form, skills: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label-ats">Job Description</label>
            <textarea
              className="textarea-ats h-32"
              placeholder="Paste or write the JD template…"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
        </form>
      )}

      {toast && (
        <div className={`mt-3 px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-2 ${
          toast.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
        }`}>
          {toast.type === 'error' ? <X size={14} /> : <Check size={14} />}
          {toast.message}
        </div>
      )}
    </Modal>
  );
};

export default JDLibraryModal;
