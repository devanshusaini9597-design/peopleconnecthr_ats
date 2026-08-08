'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Tags, Plus, Search, Loader2, RefreshCw, CheckCircle2, Sparkles, Upload, Download, ChevronDown,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import PageShell from '@/components/ui/PageShell';
import { useToast } from '@/components/ui/Toast';
import { PermissionGate } from '@/components/PermissionGate';

interface SkillRow {
  id: string;
  name: string;
  slug: string;
  category: string;
  isSystem: boolean;
  organizationId: string | null;
  _count?: { candidateSkills: number; jobSkills: number };
}

export default function SkillsTaxonomyPage() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Custom');
  const [lastImport, setLastImport] = useState<{
    created: number;
    skipped: number;
    total: number;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (q.trim()) params.set('q', q.trim());
      if (category) params.set('category', category);
      const res = await fetch(`/api/skills?${params}`, { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed');
      setSkills(data.skills ?? []);
      setCategories(data.categories ?? []);
      setTotal(typeof data.total === 'number' ? data.total : (data.skills?.length ?? 0));
    } catch {
      toast.error('Error', 'Failed to load skills');
    } finally {
      setLoading(false);
    }
  }, [q, category, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, SkillRow[]>();
    for (const s of skills) {
      const list = map.get(s.category) ?? [];
      list.push(s);
      map.set(s.category, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [skills]);

  const seedSystem = async () => {
    setSeeding(true);
    try {
      const res = await fetch('/api/skills', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Taxonomy ready', `Added ${data.created} skills (${data.totalSystem} system total)`);
      setLastImport({
        created: data.created ?? 0,
        skipped: data.skipped ?? 0,
        total: data.totalSystem ?? 0,
      });
      await load();
    } catch (e: unknown) {
      toast.error('Seed failed', e instanceof Error ? e.message : 'Could not seed skills');
    } finally {
      setSeeding(false);
    }
  };

  const importBundled = async () => {
    setImporting(true);
    try {
      const res = await fetch('/api/skills/import', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'bundled' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed');
      setLastImport({
        created: data.created ?? 0,
        skipped: data.skipped ?? 0,
        total: data.total ?? 0,
      });
      toast.success(
        'Catalog imported',
        `Created ${data.created}, skipped ${data.skipped} · ${data.total} system skills total`,
      );
      await load();
    } catch (e: unknown) {
      toast.error('Import failed', e instanceof Error ? e.message : 'Could not import catalog');
    } finally {
      setImporting(false);
    }
  };

  const importJsonFile = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const skillsArr = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object' && Array.isArray((parsed as { skills?: unknown }).skills)
          ? (parsed as { skills: unknown[] }).skills
          : null;
      if (!skillsArr) {
        throw new Error('JSON must be an array of { name, category } (or { skills: [...] })');
      }
      const res = await fetch('/api/skills/import', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'json', skills: skillsArr }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed');
      setLastImport({
        created: data.created ?? 0,
        skipped: data.skipped ?? 0,
        total: data.total ?? 0,
      });
      toast.success(
        'JSON imported',
        `Created ${data.created}, skipped ${data.skipped} · ${data.total} system skills total`,
      );
      await load();
    } catch (e: unknown) {
      toast.error('Upload failed', e instanceof Error ? e.message : 'Invalid JSON file');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const createCustom = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/skills', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), category: newCategory.trim() || 'Custom' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(data.existed ? 'Already exists' : 'Skill created', data.skill?.name ?? newName);
      setNewName('');
      await load();
    } catch (e: unknown) {
      toast.error('Create failed', e instanceof Error ? e.message : 'Could not create skill');
    } finally {
      setCreating(false);
    }
  };

  const busy = seeding || importing;

  return (
    <PageShell>
      <PageHeader
        icon={Tags}
        title="Skills taxonomy"
        subtitle="Standardized skills for search, job requirements, and match %"
      >
        <PermissionGate permission="MANAGE_SETTINGS">
          <div className="flex flex-wrap items-center gap-2">
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={busy}
              onClick={() => void importBundled()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Import full catalog
            </motion.button>
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={busy}
              onClick={() => void seedSystem()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-stone-200 bg-white text-sm font-semibold text-stone-700 hover:border-brand-300 disabled:opacity-50"
            >
              {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-brand-600" />}
              Seed system skills
            </motion.button>
          </div>
        </PermissionGate>
      </PageHeader>

      <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-[var(--shadow-card)] space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search skills…"
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-stone-200 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
            />
          </div>
          <div className="relative">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="appearance-none rounded-xl border border-stone-200 bg-stone-50 pl-3 pr-9 py-2.5 text-sm text-stone-700 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 outline-none cursor-pointer"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400 pointer-events-none" />
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <PermissionGate permission="MANAGE_SETTINGS">
          <div className="flex flex-col gap-3 p-3 rounded-xl bg-stone-50 border border-stone-100">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Add org-custom skill name"
                className="flex-1 rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Category"
                className="sm:w-40 rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
              <button
                type="button"
                disabled={creating || !newName.trim()}
                onClick={() => void createCustom()}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add skill
              </button>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 border-t border-stone-200/80 pt-3">
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void importJsonFile(file);
                }}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-stone-200 bg-white text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                Upload JSON catalog
              </button>
              <p className="text-xs text-stone-500">
                Upload a skill list (name + category), up to 5,000 rows — or import our ready-made catalog below.
              </p>
            </div>
            {lastImport && (
              <p className="text-sm text-stone-600">
                Last import: <span className="font-semibold text-stone-800">{lastImport.created}</span> created,{' '}
                <span className="font-semibold text-stone-800">{lastImport.skipped}</span> skipped ·{' '}
                <span className="font-semibold text-stone-800">{lastImport.total}</span> system skills in taxonomy
              </p>
            )}
          </div>
        </PermissionGate>

        {!loading && total > 0 && (
          <p className="text-xs text-stone-500">
            Showing {skills.length} of {total} matching skills
          </p>
        )}

        {loading && skills.length === 0 ? (
          <div className="py-16 text-center text-stone-500 text-sm flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading skills…
          </div>
        ) : skills.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <p className="text-stone-600 text-sm">No skills yet. Import the full catalog to get started.</p>
            <PermissionGate permission="MANAGE_SETTINGS">
              <button
                type="button"
                disabled={busy}
                onClick={() => void importBundled()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold disabled:opacity-50"
              >
                <Download className="w-4 h-4" /> Import full catalog
              </button>
            </PermissionGate>
          </div>
        ) : (
          <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-1">
            {grouped.map(([cat, list]) => (
              <div key={cat}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">{cat}</h3>
                <div className="flex flex-wrap gap-2">
                  {list.map((s) => (
                    <span
                      key={s.id}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border ${
                        s.isSystem
                          ? 'bg-white border-stone-200 text-stone-700'
                          : 'bg-brand-50 border-brand-100 text-brand-800'
                      }`}
                      title={`${s.slug}${s._count ? ` · ${s._count.candidateSkills} candidates · ${s._count.jobSkills} jobs` : ''}`}
                    >
                      {s.isSystem && <CheckCircle2 className="w-3.5 h-3.5 text-stone-400" />}
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-stone-500 border-t border-stone-100 pt-3">
          Skills already on candidate profiles still work. Tag candidates and jobs from this list to see match scores.
        </p>
      </div>
    </PageShell>
  );
}
