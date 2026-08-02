import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Loader2, Layout } from 'lucide-react';
import { authenticatedFetch, readApiJson } from '../utils/fetchUtils';
import { useToast } from './Toast';
import FeatureGate from './FeatureGate';

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
    <FeatureGate feature="careers.pageBuilder" fallback={null}>
      <div className="p-5 rounded-2xl border border-stone-200/80 bg-white shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <Layout className="w-4 h-4 text-brand-600" /> Page builder
            </h3>
            <p className="text-xs text-stone-500 mt-1">Custom blocks shown on your public careers page.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={addHero} disabled={saving} className="btn-secondary text-xs !py-1.5">
              <Plus className="w-3 h-3" /> Hero
            </button>
            <button type="button" onClick={addText} disabled={saving} className="btn-secondary text-xs !py-1.5">
              <Plus className="w-3 h-3" /> Text
            </button>
          </div>
        </div>
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
        ) : blocks.length === 0 ? (
          <p className="text-sm text-stone-500">No custom blocks yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {blocks.map((b, i) => (
              <li key={i} className="flex justify-between p-2 rounded-lg bg-stone-50 border border-stone-100">
                <span className="font-medium capitalize">{b.type}</span>
                <span className="text-stone-500 truncate max-w-[200px]">{b.title || b.content?.slice(0, 40) || '—'}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </FeatureGate>
  );
}
