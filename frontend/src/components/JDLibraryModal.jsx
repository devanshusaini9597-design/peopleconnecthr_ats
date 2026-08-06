import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Check, Loader2, Trash2 } from 'lucide-react';
import Modal from './ui/Modal';
import { useToast } from './Toast';
import BASE_API_URL from '../config';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import {
  STARTER_TEMPLATES, emptyForm, mapJobToTemplate,
} from './jdLibrary/jdLibraryConstants';
import JDLibraryList from './jdLibrary/JDLibraryList';
import JDLibraryForm from './jdLibrary/JDLibraryForm';

const JDLibraryModal = ({ isOpen, onClose, onSelectTemplate }) => {
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [tab, setTab] = useState('all'); // all | saved | starters
  const [saved, setSaved] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('list'); // list | create | edit
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

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
    setConfirmDelete(null);
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
    return allTemplates.filter((t) => {
      const hay = [
        t.role,
        t.experience,
        t.location,
        t.ctc,
        t.description,
        ...(t.skills || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
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
      toast.error('Role name is required');
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
      toast.success(editingId ? 'Template updated' : 'Template saved');
      setView('list');
      setForm(emptyForm);
      setEditingId(null);
      setTab('saved');
      fetchTemplates();
    } catch (err) {
      toast.error(err.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const t = confirmDelete;
    if (!t || t.isStarter || !t._id) return;
    setDeletingId(t._id);
    try {
      const res = await authenticatedFetch(`${BASE_API_URL}/jobs/${t._id}`, { method: 'DELETE' });
      if (isUnauthorized(res)) return handleUnauthorized();
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to delete');
      }
      toast.success('Template deleted');
      setSaved((prev) => prev.filter((x) => x._id !== t._id));
      setConfirmDelete(null);
    } catch (err) {
      toast.error(err.message || 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  const closeAll = () => {
    setSearchTerm('');
    setView('list');
    setForm(emptyForm);
    setConfirmDelete(null);
    onClose?.();
  };

  return (
    <>
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
          <JDLibraryList
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            tab={tab}
            setTab={setTab}
            saved={saved}
            loading={loading}
            filteredTemplates={filteredTemplates}
            deletingId={deletingId}
            onOpenCreate={openCreate}
            onSelectTemplate={onSelectTemplate}
            onOpenEdit={openEdit}
            onConfirmDelete={setConfirmDelete}
          />
        ) : (
          <JDLibraryForm form={form} setForm={setForm} onSubmit={handleSaveTemplate} />
        )}
      </Modal>

      <Modal
        open={!!confirmDelete}
        onClose={() => !deletingId && setConfirmDelete(null)}
        title="Delete template?"
        description={confirmDelete ? `“${confirmDelete.role}” will be removed from your JD Library.` : ''}
        size="sm"
        footer={
          <>
            <button type="button" className="btn-secondary" disabled={!!deletingId} onClick={() => setConfirmDelete(null)}>
              Cancel
            </button>
            <button type="button" className="btn-danger" disabled={!!deletingId} onClick={handleDelete}>
              {deletingId ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              {deletingId ? 'Deleting…' : 'Delete'}
            </button>
          </>
        }
      >
        <p className="text-sm text-stone-600">This cannot be undone. Starter templates are never deleted.</p>
      </Modal>
    </>
  );
};

export default JDLibraryModal;
