import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Loader2, Layout, Lock } from 'lucide-react';
import { authenticatedFetch, readApiJson } from '../utils/fetchUtils';
import { useToast } from './Toast';
import FeatureGate from './FeatureGate';
import EmptyState from './ui/EmptyState';

const UpgradeFallback = () => (
  <div className="card-ats-bordered border-amber-200/80 bg-amber-50/40 p-6 sm:p-8 text-center relative overflow-hidden">
    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600" />
    <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-3 ring-4 ring-amber-100/60">
      <Lock className="w-6 h-6 text-amber-600" />
    </div>
    <h3 className="text-base font-bold text-stone-900 tracking-tight">Page builder</h3>
    <p className="text-stone-500 mt-1.5 text-sm leading-relaxed max-w-sm mx-auto">
      Upgrade to add custom hero and text blocks to your public careers page.
    </p>
    <a href="/billing" className="btn-primary inline-flex mt-4 w-full sm:w-auto">View Plans</a>
  </div>
);

export default function CareerPageBuilderSection() {
  const toast = useToast();
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch('/api/career-page/config');
      const data = await readApiJson(res);
      if (data.success) setBlocks(data.data?.blocks || []);
    } catch {
      toast.error('Failed to load page builder');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const save = async (nextBlocks) => {
    setSaving(true);
    try {
      const res = await authenticatedFetch('/api/career-page/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks: nextBlocks })
      });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      setBlocks(nextBlocks);
      toast.success('Careers page updated');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const addHero = () => {
    const next = [...blocks, { type: 'hero', title: 'Join our team', subtitle: 'We are hiring across multiple roles.' }];
    save(next);
  };

  const addText = () => {
    const next = [...blocks, { type: 'text', content: '<p>Tell your story here.</p>' }];
    save(next);
  };

  return (
    <FeatureGate feature="careers.pageBuilder" fallback={<UpgradeFallback />}>
      <div className="rounded-xl border border-stone-200/90 bg-white shadow-sm p-5 sm:p-6 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4 mt-1">
          <div>
            <h3 className="section-title-ats !mb-0 !pb-0 !border-0">
              <Layout className="w-4 h-4 text-brand-600" />
              Page builder
            </h3>
            <p className="text-xs text-stone-500 mt-1">Custom blocks shown on your public careers page.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button type="button" onClick={addHero} disabled={saving} className="btn-secondary text-xs !py-2 w-full sm:w-auto">
              <Plus className="w-3 h-3" /> Hero
            </button>
            <button type="button" onClick={addText} disabled={saving} className="btn-secondary text-xs !py-2 w-full sm:w-auto">
              <Plus className="w-3 h-3" /> Text
            </button>
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-brand-600" />
          </div>
        ) : blocks.length === 0 ? (
          <EmptyState
            icon={Layout}
            message="No custom blocks yet"
            subMessage="Add a hero or text block to customize your careers page."
            tone="brand"
            compact
          />
        ) : (
          <ul className="space-y-2 text-sm">
            {blocks.map((b, i) => (
              <li key={i} className="flex justify-between p-3 rounded-xl bg-stone-50/50 border border-stone-100">
                <span className="font-medium capitalize text-stone-900">{b.type}</span>
                <span className="text-stone-500 truncate max-w-[200px]">{b.title || b.content?.slice(0, 40) || '—'}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </FeatureGate>
  );
}
