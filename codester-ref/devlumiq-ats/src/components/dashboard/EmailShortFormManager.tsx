'use client';

import { useEffect, useState } from 'react';
import { Loader2, MessageSquare, Phone, Save } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

interface Tpl {
  id: string;
  name: string;
  subject: string;
  body: string;
  smsBody?: string | null;
  whatsappBody?: string | null;
  category?: string;
}

/** Create / edit SMS & WhatsApp short-form copies on email templates. */
export function EmailShortFormManager() {
  const toast = useToast();
  const [templates, setTemplates] = useState<Tpl[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [smsBody, setSmsBody] = useState('');
  const [whatsappBody, setWhatsappBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/email-templates', { credentials: 'include' });
      const data = await res.json();
      const list: Tpl[] = Array.isArray(data?.templates) ? data.templates : [];
      setTemplates(list);
      if (list.length && !selectedId) {
        applyTpl(list[0]);
      }
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyTpl = (t: Tpl) => {
    setSelectedId(t.id);
    setName(t.name);
    setSubject(t.subject);
    setBody(t.body);
    setSmsBody(t.smsBody || '');
    setWhatsappBody(t.whatsappBody || '');
  };

  const save = async () => {
    if (!name.trim() || !subject.trim() || !body.trim()) {
      toast.error('Name, subject, and email body are required');
      return;
    }
    setBusy(true);
    try {
      if (selectedId) {
        const res = await fetch('/api/email-templates', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: selectedId,
            name: name.trim(),
            subject: subject.trim(),
            body: body.trim(),
            smsBody: smsBody.trim() || null,
            whatsappBody: whatsappBody.trim() || null,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Update failed');
        toast.success('Template updated');
      } else {
        const res = await fetch('/api/email-templates', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            subject: subject.trim(),
            body: body.trim(),
            smsBody: smsBody.trim() || null,
            whatsappBody: whatsappBody.trim() || null,
            category: 'general',
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Create failed');
        toast.success('Template created');
        if (data.template?.id) setSelectedId(data.template.id);
      }
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-stone-500 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading templates…
      </div>
    );
  }

  return (
    <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-bold text-stone-900 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-brand-600" />
            SMS & WhatsApp short forms
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Saved copies are used when messaging via SMS/WhatsApp (Messages page).
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSelectedId('');
            setName('');
            setSubject('');
            setBody('');
            setSmsBody('');
            setWhatsappBody('');
          }}
          className="text-xs font-semibold text-brand-700 hover:underline"
        >
          + New template
        </button>
      </div>

      {templates.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => applyTpl(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                selectedId === t.id
                  ? 'border-brand-500 bg-brand-50 text-brand-800'
                  : 'border-stone-200 text-stone-600 hover:border-brand-300'
              }`}
            >
              {t.name}
              {(t.smsBody || t.whatsappBody) && (
                <span className="ml-1 text-emerald-600">•</span>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-sm sm:col-span-2">
          <span className="text-xs font-semibold text-stone-600">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
            placeholder="e.g. Interview invite"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-xs font-semibold text-stone-600">Email subject</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-xs font-semibold text-stone-600">Email body</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand-500 resize-y font-mono"
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs font-semibold text-stone-600 inline-flex items-center gap-1">
            <Phone className="w-3.5 h-3.5" /> SMS body (≤320 chars recommended)
          </span>
          <textarea
            value={smsBody}
            onChange={(e) => setSmsBody(e.target.value)}
            rows={3}
            maxLength={1600}
            className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand-500 resize-y"
            placeholder="Hi {{candidateName}}, quick note about {{position}}…"
          />
          <span className="text-[11px] text-stone-400">{smsBody.length}/1600</span>
        </label>
        <label className="block text-sm">
          <span className="text-xs font-semibold text-stone-600 inline-flex items-center gap-1">
            <MessageSquare className="w-3.5 h-3.5" /> WhatsApp body
          </span>
          <textarea
            value={whatsappBody}
            onChange={(e) => setWhatsappBody(e.target.value)}
            rows={3}
            maxLength={4096}
            className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand-500 resize-y"
            placeholder="Hello {{candidateName}} — …"
          />
        </label>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save template
        </button>
      </div>
    </div>
  );
}
