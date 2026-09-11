import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, RotateCcw } from 'lucide-react';
import PremiumSelect from '../../ui/PremiumSelect';
import { EMAIL_TYPE_OPTIONS } from '../atsConstants';
import { buildQuickDraft, buildQuickDraftHtml } from './quickEmailDraft';
import EmailPreviewModal from './EmailPreviewModal';

export default function EmailQuickSendMode({
  emailType, setEmailType, emailRecipient,
  quickName, setQuickName, quickPosition, setQuickPosition,
  quickDepartment, setQuickDepartment, quickJoiningDate, setQuickJoiningDate,
  customMessage, setCustomMessage,
  quickSubject, setQuickSubject,
  showQuickPreview, setShowQuickPreview,
  quickPreviewHtml, setQuickPreviewHtml,
  quickPreviewSubject, setQuickPreviewSubject,
  loadingPreview, setLoadingPreview, toast,
}) {
  const sectionRef = useRef(null);
  const [draftDirty, setDraftDirty] = useState(false);

  const orgName = useMemo(() => {
    try {
      return (
        localStorage.getItem('orgName') ||
        JSON.parse(localStorage.getItem('orgData') || '{}')?.name ||
        ''
      );
    } catch {
      return '';
    }
  }, []);

  const orgLogoUrl = useMemo(() => {
    try {
      const data = JSON.parse(localStorage.getItem('orgData') || '{}');
      return String(data?.logo || '').trim();
    } catch {
      /* ignore */
    }
    return '';
  }, []);

  const orgBrandColor = useMemo(() => {
    try {
      const data = JSON.parse(localStorage.getItem('orgData') || '{}');
      return data?.atsSettings?.brandColor || '#0f766e';
    } catch {
      return '#0f766e';
    }
  }, []);

  const senderName = useMemo(() => {
    try {
      return (
        localStorage.getItem('userName') ||
        JSON.parse(localStorage.getItem('userData') || '{}')?.name ||
        'HR Team'
      );
    } catch {
      return localStorage.getItem('userName') || 'HR Team';
    }
  }, []);

  useEffect(() => {
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  useEffect(() => {
    if (draftDirty) return;
    const draft = buildQuickDraft({
      emailType,
      name: quickName || emailRecipient?.name || 'Candidate',
      position: quickPosition || emailRecipient?.position || '',
      department: quickDepartment || '',
      joiningDate: quickJoiningDate || '',
      senderName,
    });
    setQuickSubject?.(draft.subject);
    setCustomMessage?.(draft.body);
  }, [
    emailType,
    quickName,
    quickPosition,
    quickDepartment,
    quickJoiningDate,
    emailRecipient?.name,
    emailRecipient?.position,
    senderName,
    draftDirty,
    setQuickSubject,
    setCustomMessage,
  ]);

  const applyStarter = (nextType = emailType) => {
    const draft = buildQuickDraft({
      emailType: nextType,
      name: quickName || emailRecipient?.name || 'Candidate',
      position: quickPosition || emailRecipient?.position || '',
      department: quickDepartment || '',
      joiningDate: quickJoiningDate || '',
      senderName,
    });
    setDraftDirty(false);
    setQuickSubject?.(draft.subject);
    setCustomMessage?.(draft.body);
    setShowQuickPreview(false);
  };

  const openPreview = () => {
    setLoadingPreview(true);
    try {
      const subject = (quickSubject || '').trim() || 'Message';
      const html = buildQuickDraftHtml({
        subject,
        body: customMessage || '',
        brand: orgName,
        logoUrl: orgLogoUrl,
        brandColor: orgBrandColor,
        senderName,
      });
      setQuickPreviewSubject(subject);
      setQuickPreviewHtml(html);
      setShowQuickPreview(true);
    } catch (err) {
      console.error('Preview error:', err);
      toast?.error?.('Failed to generate preview');
    } finally {
      setLoadingPreview(false);
    }
  };

  const toLine = emailRecipient?.email
    ? `${emailRecipient?.name || quickName || ''} <${emailRecipient.email}>`.trim()
    : '';

  return (
    <section ref={sectionRef} className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-stone-800">Quick send</h3>
        <p className="text-xs text-stone-500 mt-0.5">
          Pick a starter, then edit the full subject and body before sending.
        </p>
      </div>

      <div>
        <label className="label-ats mb-1.5 block">Email type</label>
        <PremiumSelect
          compact
          value={emailType}
          onChange={(v) => {
            setEmailType(v);
            setDraftDirty(false);
            setShowQuickPreview(false);
            applyStarter(v);
          }}
          options={EMAIL_TYPE_OPTIONS}
          placeholder="Select email type"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label-ats mb-1.5 block">Candidate name</label>
          <input
            type="text"
            value={quickName}
            onChange={(e) => { setQuickName(e.target.value); setShowQuickPreview(false); }}
            placeholder={emailRecipient?.name || 'Candidate name'}
            className="input-ats w-full"
          />
        </div>
        <div>
          <label className="label-ats mb-1.5 block">Position / role</label>
          <input
            type="text"
            value={quickPosition}
            onChange={(e) => { setQuickPosition(e.target.value); setShowQuickPreview(false); }}
            placeholder={emailRecipient?.position || 'Position applied for'}
            className="input-ats w-full"
          />
        </div>
      </div>

      {emailType === 'onboarding' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label-ats mb-1.5 block">Department</label>
            <input
              type="text"
              value={quickDepartment}
              onChange={(e) => { setQuickDepartment(e.target.value); setShowQuickPreview(false); }}
              placeholder="e.g. Engineering"
              className="input-ats w-full"
            />
          </div>
          <div>
            <label className="label-ats mb-1.5 block">Joining date</label>
            <input
              type="date"
              value={quickJoiningDate}
              onChange={(e) => { setQuickJoiningDate(e.target.value); setShowQuickPreview(false); }}
              className="input-ats w-full"
            />
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-stone-800">Message</h4>
          {draftDirty && (
            <button
              type="button"
              onClick={() => applyStarter()}
              className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-stone-800"
            >
              <RotateCcw size={12} />
              Reset starter
            </button>
          )}
        </div>

        <div>
          <label className="label-ats mb-1.5 block">Subject</label>
          <input
            type="text"
            value={quickSubject || ''}
            onChange={(e) => {
              setDraftDirty(true);
              setQuickSubject?.(e.target.value);
              setShowQuickPreview(false);
            }}
            placeholder="Email subject"
            className="input-ats w-full"
          />
        </div>

        <div>
          <label className="label-ats mb-1.5 block">Body</label>
          <textarea
            value={customMessage}
            onChange={(e) => {
              setDraftDirty(true);
              setCustomMessage(e.target.value);
              setShowQuickPreview(false);
            }}
            placeholder="Write the full email body…"
            rows={10}
            className="input-ats w-full resize-y min-h-[12rem] !h-auto py-2.5 leading-relaxed"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={openPreview}
        className="btn-secondary !text-sm"
        disabled={loadingPreview || !(customMessage || '').trim()}
      >
        {loadingPreview ? (
          <>
            <div className="animate-spin h-3.5 w-3.5 border-2 border-brand-500 border-t-transparent rounded-full" />
            Generating…
          </>
        ) : (
          <>
            <Eye size={14} /> Preview
          </>
        )}
      </button>

      <EmailPreviewModal
        open={Boolean(showQuickPreview && quickPreviewHtml)}
        onClose={() => setShowQuickPreview(false)}
        subject={quickPreviewSubject}
        html={quickPreviewHtml}
        to={toLine}
        brand={orgName}
      />
    </section>
  );
}
