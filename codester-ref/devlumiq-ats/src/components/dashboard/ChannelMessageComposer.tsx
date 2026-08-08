'use client';

import { useEffect, useState } from 'react';
import { Mail, MessageSquare, Phone, Loader2, ShieldCheck } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { applyTemplateVars, resolveChannelBody } from '@/lib/short-templates';

type Channel = 'EMAIL' | 'SMS' | 'WHATSAPP';

interface CandidateOpt {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

interface Consent {
  smsOptIn: boolean;
  whatsappOptIn: boolean;
  phone: string | null;
}

interface EmailTpl {
  id: string;
  name: string;
  subject: string;
  body: string;
  smsBody?: string | null;
  whatsappBody?: string | null;
}

interface Props {
  candidates?: CandidateOpt[];
  defaultCandidateId?: string;
  onSent?: () => void;
}

export function ChannelMessageComposer({ candidates: externalCandidates, defaultCandidateId, onSent }: Props) {
  const toast = useToast();
  const [candidates, setCandidates] = useState<CandidateOpt[]>(externalCandidates ?? []);
  const [candidateId, setCandidateId] = useState(defaultCandidateId || '');
  const [channel, setChannel] = useState<Channel>('EMAIL');
  const [body, setBody] = useState('');
  const [subject, setSubject] = useState('');
  const [consent, setConsent] = useState<Consent | null>(null);
  const [busy, setBusy] = useState(false);
  const [savingConsent, setSavingConsent] = useState(false);
  const [templates, setTemplates] = useState<EmailTpl[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [phoneVerifiedHint, setPhoneVerifiedHint] = useState<string | null>(null);

  useEffect(() => {
    if (externalCandidates) {
      setCandidates(externalCandidates);
      return;
    }
    fetch('/api/candidates?limit=100', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const list = data?.candidates ?? [];
        setCandidates(
          (Array.isArray(list) ? list : []).map((c: CandidateOpt) => ({
            id: c.id,
            name: c.name,
            email: c.email,
            phone: c.phone,
          })),
        );
      })
      .catch(() => {});
    fetch('/api/email-templates', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setTemplates(Array.isArray(data?.templates) ? data.templates : []))
      .catch(() => {});
  }, [externalCandidates]);

  useEffect(() => {
    if (!templateId) return;
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    const selected = candidates.find((c) => c.id === candidateId);
    const vars = {
      candidateName: selected?.name || '',
      name: selected?.name || '',
      position: '',
      companyName: '',
    };
    const resolved = applyTemplateVars(resolveChannelBody(tpl, channel), vars);
    setBody(resolved);
    if (channel === 'EMAIL') {
      setSubject(applyTemplateVars(tpl.subject, vars));
    }
  }, [templateId, channel, templates, candidateId, candidates]);

  useEffect(() => {
    if (!candidateId) {
      setConsent(null);
      return;
    }
    fetch(`/api/candidates/${candidateId}/messaging-consent`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.candidate) {
          setConsent({
            smsOptIn: !!data.candidate.smsOptIn,
            whatsappOptIn: !!data.candidate.whatsappOptIn,
            phone: data.candidate.phone ?? null,
          });
        }
      })
      .catch(() => setConsent(null));
  }, [candidateId]);

  const selected = candidates.find((c) => c.id === candidateId);

  const sendVerifyCode = async () => {
    if (!candidateId) return;
    setVerifying(true);
    setPhoneVerifiedHint(null);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/verify-phone`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not send code');
      setPhoneVerifiedHint(
        data.mode === 'dev'
          ? 'Dev mode: enter code 000000'
          : 'Verification code sent via SMS',
      );
      toast.success('Code sent');
    } catch (e: unknown) {
      toast.error('Verify phone', e instanceof Error ? e.message : 'Failed');
    } finally {
      setVerifying(false);
    }
  };

  const confirmVerifyCode = async () => {
    if (!candidateId || !verifyCode.trim()) return;
    setVerifying(true);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/verify-phone`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm',
          code: verifyCode.trim(),
          smsOptIn: channel === 'SMS' ? true : undefined,
          whatsappOptIn: channel === 'WHATSAPP' ? true : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Invalid code');
      setPhoneVerifiedHint('Phone verified');
      setVerifyCode('');
      if (data.candidate) {
        setConsent({
          smsOptIn: !!data.candidate.smsOptIn,
          whatsappOptIn: !!data.candidate.whatsappOptIn,
          phone: data.candidate.phone ?? consent?.phone ?? null,
        });
      }
      toast.success('Phone verified');
    } catch (e: unknown) {
      toast.error('Verify phone', e instanceof Error ? e.message : 'Failed');
    } finally {
      setVerifying(false);
    }
  };

  const setOptIn = async (field: 'smsOptIn' | 'whatsappOptIn', value: boolean) => {
    if (!candidateId) return;
    setSavingConsent(true);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/messaging-consent`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value, phoneVerified: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed');
      setConsent({
        smsOptIn: !!data.candidate.smsOptIn,
        whatsappOptIn: !!data.candidate.whatsappOptIn,
        phone: data.candidate.phone ?? null,
      });
      toast.success('Consent updated', value ? 'Opt-in recorded' : 'Opt-out recorded');
    } catch (e: unknown) {
      toast.error('Consent', e instanceof Error ? e.message : 'Failed');
    } finally {
      setSavingConsent(false);
    }
  };

  const send = async () => {
    if (!candidateId || !body.trim()) {
      toast.error('Missing fields', 'Select a candidate and enter a message');
      return;
    }
    setBusy(true);
    try {
      if (channel === 'EMAIL') {
        const res = await fetch('/api/messages', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toEmail: selected?.email,
            subject: subject.trim() || `Message for ${selected?.name || 'candidate'}`,
            body: body.trim(),
            candidateId,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Email send failed');
      } else if (channel === 'SMS') {
        if (!consent?.smsOptIn) {
          toast.error('Consent required', 'Record SMS opt-in before sending');
          return;
        }
        const res = await fetch('/api/messages/sms/send', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ candidateId, message: body.trim() }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'SMS failed');
      } else {
        if (!consent?.whatsappOptIn) {
          toast.error('Consent required', 'Record WhatsApp opt-in before sending');
          return;
        }
        const res = await fetch('/api/messages/whatsapp/send', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ candidateId, message: body.trim() }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'WhatsApp failed');
      }
      toast.success('Sent', `Message sent via ${channel}`);
      setBody('');
      onSent?.();
    } catch (e: unknown) {
      toast.error('Send failed', e instanceof Error ? e.message : 'Could not send');
    } finally {
      setBusy(false);
    }
  };

  const channels: { id: Channel; label: string; icon: typeof Mail }[] = [
    { id: 'EMAIL', label: 'Email', icon: Mail },
    { id: 'SMS', label: 'SMS', icon: Phone },
    { id: 'WHATSAPP', label: 'WhatsApp', icon: MessageSquare },
  ];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 space-y-4 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-stone-900">Message candidate</h3>
        <div className="flex rounded-xl border border-stone-200 p-0.5 bg-stone-50">
          {channels.map((c) => {
            const Icon = c.icon;
            const active = channel === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setChannel(c.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  active ? 'bg-white text-brand-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <label className="block text-sm">
        <span className="text-stone-600 font-medium">Candidate</span>
        <select
          value={candidateId}
          onChange={(e) => setCandidateId(e.target.value)}
          className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
        >
          <option value="">Select candidate…</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}{c.phone ? ` · ${c.phone}` : ''}{c.email ? ` · ${c.email}` : ''}
            </option>
          ))}
        </select>
      </label>

      {templates.length > 0 && (
        <label className="block text-sm">
          <span className="text-stone-600 font-medium">Template (uses SMS/WhatsApp short form when set)</span>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
          >
            <option value="">— freeform —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>
      )}

      {channel === 'EMAIL' && (
        <label className="block text-sm">
          <span className="text-stone-600 font-medium">Subject</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
            placeholder="Subject"
          />
        </label>
      )}

      {(channel === 'SMS' || channel === 'WHATSAPP') && candidateId && (
        <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 text-xs text-amber-900 space-y-2">
          <p className="font-semibold inline-flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            TCPA / messaging consent
          </p>
          <p className="text-amber-800/90">
            Only send if the candidate consented. Phone: {consent?.phone || selected?.phone || 'none'}
          </p>
          <div className="flex flex-wrap gap-3">
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={!!consent?.smsOptIn}
                disabled={savingConsent || channel !== 'SMS'}
                onChange={(e) => void setOptIn('smsOptIn', e.target.checked)}
              />
              SMS opt-in
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={!!consent?.whatsappOptIn}
                disabled={savingConsent || channel !== 'WHATSAPP'}
                onChange={(e) => void setOptIn('whatsappOptIn', e.target.checked)}
              />
              WhatsApp opt-in
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-100">
            <button
              type="button"
              disabled={verifying || !candidateId}
              onClick={() => void sendVerifyCode()}
              className="text-xs font-semibold text-amber-900 underline disabled:opacity-50"
            >
              Send verify code
            </button>
            <input
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value)}
              placeholder="Code"
              className="w-24 rounded-lg border border-amber-200 bg-white px-2 py-1 text-xs"
            />
            <button
              type="button"
              disabled={verifying || !verifyCode.trim()}
              onClick={() => void confirmVerifyCode()}
              className="text-xs font-semibold px-2 py-1 rounded-lg bg-amber-200/80 text-amber-950 disabled:opacity-50"
            >
              Confirm
            </button>
            {phoneVerifiedHint && (
              <span className="text-[11px] text-amber-800">{phoneVerifiedHint}</span>
            )}
          </div>
        </div>
      )}

      <label className="block text-sm">
        <span className="text-stone-600 font-medium">Message</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={channel === 'EMAIL' ? 5 : 3}
          maxLength={channel === 'SMS' ? 1600 : 4096}
          className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 resize-y"
          placeholder={
            channel === 'SMS'
              ? 'Keep it short — SMS has character limits…'
              : channel === 'WHATSAPP'
                ? 'WhatsApp message…'
                : 'Write your email…'
          }
        />
        {channel === 'SMS' && (
          <span className="text-[11px] text-stone-400">{body.length}/1600</span>
        )}
      </label>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={busy || !candidateId || !body.trim()}
          onClick={() => void send()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Send via {channel === 'EMAIL' ? 'Email' : channel === 'SMS' ? 'SMS' : 'WhatsApp'}
        </button>
      </div>
    </div>
  );
}
