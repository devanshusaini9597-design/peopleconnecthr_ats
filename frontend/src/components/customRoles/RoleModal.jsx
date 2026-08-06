import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldPlus, Loader2, Search, LayoutGrid, Zap,
} from 'lucide-react';
import Modal from '../ui/Modal';
import {
  PERMISSION_CATALOG as FALLBACK_CATALOG,
  countModules,
  countActions,
} from '../../config/permissionsCatalog';
import { emptyForm } from './customRolesConstants';

const RoleModal = ({ open, initial, onClose, onSave, saving, catalog }) => {
  const [form, setForm] = useState(initial || emptyForm);
  const [permFilter, setPermFilter] = useState('');
  const permissionCatalog = catalog?.length ? catalog : FALLBACK_CATALOG;

  useEffect(() => {
    if (open) {
      setForm(initial
        ? { name: initial.name || '', description: initial.description || '', permissions: [...(initial.permissions || [])] }
        : emptyForm);
      setPermFilter('');
    }
  }, [open, initial]);

  const togglePermission = (perm) => {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(perm)
        ? f.permissions.filter((p) => p !== perm)
        : [...f.permissions, perm],
    }));
  };

  const toggleGroup = (keys) => {
    setForm((f) => {
      const allOn = keys.every((p) => f.permissions.includes(p));
      if (allOn) {
        return { ...f, permissions: f.permissions.filter((p) => !keys.includes(p)) };
      }
      return { ...f, permissions: [...new Set([...f.permissions, ...keys])] };
    });
  };

  const selectAll = () => {
    const all = permissionCatalog.flatMap((g) => g.items.map((i) => i.key));
    setForm((f) => ({ ...f, permissions: all }));
  };

  const clearAll = () => setForm((f) => ({ ...f, permissions: [] }));

  const selectedCount = form.permissions.length;
  const moduleCount = countModules(form.permissions);
  const actionCount = countActions(form.permissions);

  const filteredCatalog = useMemo(() => {
    const q = permFilter.trim().toLowerCase();
    if (!q) return permissionCatalog;
    return permissionCatalog
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            item.label.toLowerCase().includes(q)
            || item.key.toLowerCase().includes(q)
            || group.label.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [permFilter, permissionCatalog]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit Role' : 'New Custom Role'}
      description="Choose sidebar modules and in-app actions this role can use."
      size="xl"
      footer={
        <>
          <span className="hidden sm:inline text-xs font-medium text-stone-400 mr-auto self-center tabular-nums">
            {moduleCount} modules · {actionCount} actions
          </span>
          <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>Cancel</button>
          <button
            type="button"
            onClick={() => onSave(form)}
            disabled={saving || !form.name.trim()}
            className="btn-primary"
          >
            {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Save Role'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <section className="space-y-3">
          <h3 className="section-title-ats !mb-0">
            <ShieldPlus className="w-4 h-4 text-brand-600" />
            Role details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label-ats">Role name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="input-ats"
                placeholder="e.g. Senior Recruiter"
                autoFocus
              />
            </div>
            <div>
              <label className="label-ats">Description</label>
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="input-ats"
                placeholder="Optional — who this role is for"
              />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h3 className="section-title-ats !mb-0">
                <LayoutGrid className="w-4 h-4 text-brand-600" />
                Permissions
              </h3>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                <span className="font-semibold text-stone-600">Modules</span> = sidebar pages.
                {' '}
                <span className="font-semibold text-stone-600">Actions</span> = create / edit / delete inside them.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={selectAll} className="btn-secondary !text-xs !px-2.5 !py-1.5">
                Select all
              </button>
              <button type="button" onClick={clearAll} className="btn-secondary !text-xs !px-2.5 !py-1.5">
                Clear
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
            <input
              value={permFilter}
              onChange={(e) => setPermFilter(e.target.value)}
              className="input-ats input-ats-icon"
              placeholder="Search modules or actions…"
              aria-label="Search permissions"
            />
          </div>

          <div className="rounded-xl border border-stone-200 overflow-hidden divide-y divide-stone-100 max-h-[min(52vh,480px)] overflow-y-auto">
            {filteredCatalog.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-stone-500">No permissions match your search.</div>
            ) : (
              filteredCatalog.map((group) => {
                const keys = group.items.map((i) => i.key);
                const allOn = keys.every((p) => form.permissions.includes(p));
                const someOn = !allOn && keys.some((p) => form.permissions.includes(p));
                const modules = group.items.filter((i) => i.kind === 'module');
                const actions = group.items.filter((i) => i.kind === 'action');
                return (
                  <div key={group.id} className="bg-white">
                    <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 bg-stone-50/90 border-b border-stone-100/80 sticky top-0 z-[1]">
                      <button
                        type="button"
                        onClick={() => toggleGroup(keys)}
                        className="flex items-start gap-2.5 text-left min-w-0"
                      >
                        <span
                          className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${
                            allOn
                              ? 'bg-brand-600 border-brand-600 text-white'
                              : someOn
                                ? 'bg-brand-100 border-brand-400 text-brand-700'
                                : 'bg-white border-stone-300 text-transparent'
                          }`}
                          aria-hidden
                        >
                          {allOn ? '✓' : someOn ? '–' : ''}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-xs font-bold text-stone-800 uppercase tracking-wide">{group.label}</span>
                          <span className="block text-[11px] text-stone-500 mt-0.5 leading-snug">{group.description}</span>
                        </span>
                      </button>
                      <span className="text-[10px] font-semibold text-stone-400 tabular-nums flex-shrink-0">
                        {keys.filter((p) => form.permissions.includes(p)).length}/{keys.length}
                      </span>
                    </div>

                    {modules.length > 0 && (
                      <div className="px-3 sm:px-4 pt-3 pb-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-stone-400 mb-2">
                          <LayoutGrid size={11} /> Sidebar modules
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                          {modules.map((item) => {
                            const checked = form.permissions.includes(item.key);
                            return (
                              <label
                                key={item.key}
                                className={`flex items-center gap-2 text-sm cursor-pointer rounded-lg px-2.5 py-2 border transition-colors ${
                                  checked
                                    ? 'bg-brand-50/80 border-brand-200 text-brand-900'
                                    : 'border-transparent text-stone-700 hover:bg-stone-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => togglePermission(item.key)}
                                  className="rounded border-stone-300 text-brand-600 focus:ring-brand-500/30 w-3.5 h-3.5 flex-shrink-0"
                                />
                                <span className="font-medium text-[13px] leading-snug">{item.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {actions.length > 0 && (
                      <div className="px-3 sm:px-4 pt-2.5 pb-3">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-stone-400 mb-2">
                          <Zap size={11} /> Actions
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                          {actions.map((item) => {
                            const checked = form.permissions.includes(item.key);
                            return (
                              <label
                                key={item.key}
                                className={`flex items-center gap-2 text-sm cursor-pointer rounded-lg px-2.5 py-2 border transition-colors ${
                                  checked
                                    ? 'bg-teal-50/70 border-teal-200 text-teal-900'
                                    : 'border-transparent text-stone-700 hover:bg-stone-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => togglePermission(item.key)}
                                  className="rounded border-stone-300 text-teal-600 focus:ring-teal-500/30 w-3.5 h-3.5 flex-shrink-0"
                                />
                                <span className="font-medium text-[13px] leading-snug">{item.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <p className="text-[11px] text-stone-400 sm:hidden tabular-nums">
            {selectedCount} selected · {moduleCount} modules · {actionCount} actions
          </p>
        </section>
      </div>
    </Modal>
  );
};

export default RoleModal;
