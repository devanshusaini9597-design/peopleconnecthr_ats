import React, { useMemo, useState } from 'react';
import { X, Mail, Megaphone, FileText, Zap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { resolveOrgLogoSrc } from '../../utils/orgLogo';
import EmailCcBccFields from './candidateEmail/EmailCcBccFields';
import EmailTemplateMode from './candidateEmail/EmailTemplateMode';
import EmailQuickSendMode from './candidateEmail/EmailQuickSendMode';

function orgInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'ORG';
  return parts.slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

function OrgBrandMark({ name, logo }) {
  const [broken, setBroken] = useState(false);
  const src = resolveOrgLogoSrc(logo);
  const showImg = Boolean(src) && !broken;

  return (
    <div className="flex items-center gap-3 min-w-0">
      {showImg ? (
        <img
          src={src}
          alt=""
          onError={() => setBroken(true)}
          className="h-11 w-11 rounded-xl object-contain bg-white border border-white/70 shadow-sm flex-shrink-0"
        />
      ) : (
        <span className="h-11 w-11 rounded-xl bg-white/90 text-brand-800 border border-white/70 shadow-sm flex items-center justify-center text-xs font-bold tracking-wide flex-shrink-0">
          {orgInitials(name)}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-700/80">
          Sending as
        </p>
        <h2 className="text-[17px] sm:text-lg font-bold text-stone-900 tracking-tight leading-snug truncate">
          {name || 'Organization'}
        </h2>
      </div>
    </div>
  );
}

export default function CandidateEmailModal(props) {
  const {
    emailRecipient, setShowEmailModal, bulkEmailRecipients,
    setBulkEmailRecipients, setSelectedIds,
    emailChannel, setEmailChannel, channelsAvailable, emailSenderInfo, emailMode, setEmailMode,
    emailCC, setEmailCC, emailBCC, setEmailBCC, teamMembers, ccInput, setCcInput,
    bccInput, setBccInput, showCCPicker, setShowCCPicker, showBCCPicker, setShowBCCPicker,
    emailTemplates, selectedTemplate, selectEmailTemplate, setSelectedTemplate,
    templateVars, setTemplateVars,
    emailType, setEmailType, quickName, setQuickName, quickPosition, setQuickPosition,
    quickDepartment, setQuickDepartment, quickJoiningDate, setQuickJoiningDate,
    customMessage, setCustomMessage, quickSubject, setQuickSubject,
    showQuickPreview, setShowQuickPreview,
    quickPreviewHtml, setQuickPreviewHtml, quickPreviewSubject, setQuickPreviewSubject,
    loadingPreview, setLoadingPreview, isSendingEmail,
    sendTemplateEmail, sendSingleEmail,
  } = props;

  const { organization } = useAuth();
  const isBulk = (bulkEmailRecipients?.length || 0) > 0;

  const orgMeta = useMemo(() => {
    let fromStorage = {};
    try {
      fromStorage = JSON.parse(localStorage.getItem('orgData') || '{}') || {};
    } catch {
      fromStorage = {};
    }
    const name =
      organization?.name ||
      localStorage.getItem('orgName') ||
      fromStorage.name ||
      '';
    const logo = organization?.logo || fromStorage.logo || '';
    return { name, logo };
  }, [organization?.name, organization?.logo]);

  if (!(props.showEmailModal && emailRecipient)) return null;

  const closeModal = () => {
    setShowEmailModal(false);
    setBulkEmailRecipients?.([]);
    setSelectedIds?.([]);
  };

  const canSend =
    !isSendingEmail &&
    !(emailMode === 'template' && !selectedTemplate) &&
    !(emailMode === 'template' && selectedTemplate && !(props.templateDraftSubject || '').trim()) &&
    !(emailMode === 'template' && selectedTemplate && !(props.templateDraftBody || '').trim()) &&
    !(emailMode === 'quick' && !(quickSubject || '').trim()) &&
    !(emailMode === 'quick' && !customMessage.trim());

  const toLine = isBulk
    ? bulkEmailRecipients.map((c) => c.name || c.email).join(', ')
    : `${emailRecipient.name} <${emailRecipient.email}>`;

  const channelActive =
    'border-brand-500 bg-brand-50/60 shadow-[0_0_0_1px_rgba(15,118,110,0.12)]';
  const channelIdle = 'border-stone-200/90 bg-white hover:border-stone-300 hover:bg-stone-50/60';

  return (
    <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-3 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-2xl border border-stone-200/70 w-full max-w-3xl max-h-[90vh] shadow-[0_24px_64px_-16px_rgba(28,25,23,0.35)] flex flex-col overflow-hidden">
        {/* Brand header */}
        <div className="relative flex-shrink-0 overflow-hidden border-b border-brand-100/80">
          <div
            className="absolute inset-0 bg-gradient-to-br from-brand-50 via-white to-stone-50"
            aria-hidden
          />
          <div
            className="absolute -top-16 -right-10 h-40 w-40 rounded-full bg-brand-200/25 blur-2xl"
            aria-hidden
          />
          <div className="relative px-5 sm:px-6 pt-5 pb-4">
            <div className="flex items-start justify-between gap-3">
              <OrgBrandMark name={orgMeta.name} logo={orgMeta.logo} />
              <button
                type="button"
                onClick={closeModal}
                className="p-2 -mr-1 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-white/80 border border-transparent hover:border-stone-200/80 transition"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 sm:pl-14">
              <h3 className="text-base font-semibold text-stone-900 tracking-tight">
                {isBulk ? `Email ${bulkEmailRecipients.length} candidates` : 'Send email'}
              </h3>
              <p className="text-sm text-stone-600 mt-1 truncate" title={toLine}>
                <span className="text-stone-400 font-medium">To</span>{' '}
                <span className="font-medium text-stone-800">{toLine}</span>
              </p>
              {emailSenderInfo?.fromEmail && (
                <p className="text-xs text-stone-500 mt-1 truncate">
                  <span className="text-stone-400 font-medium">From</span>{' '}
                  {emailSenderInfo.displayName || 'Recruiter'} · {emailSenderInfo.fromEmail}
                  {emailSenderInfo.replyTo && !emailSenderInfo.sendAsUser
                    ? ` · Replies to ${emailSenderInfo.replyTo}`
                    : ''}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0 px-5 sm:px-6 py-5 space-y-6 bg-gradient-to-b from-white to-stone-50/40">
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-stone-900">Email type</h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Choose how this message should be delivered.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setEmailChannel('transactional');
                  setSelectedTemplate?.(null);
                }}
                className={`rounded-2xl border px-4 py-3.5 text-left transition ${
                  emailChannel === 'transactional' ? channelActive : channelIdle
                }`}
              >
                <div className="flex items-center gap-2 text-stone-900">
                  <span
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${
                      emailChannel === 'transactional'
                        ? 'bg-brand-100 text-brand-700'
                        : 'bg-stone-100 text-stone-400'
                    }`}
                  >
                    <Mail size={15} />
                  </span>
                  <span className="text-sm font-semibold">Direct</span>
                </div>
                <p className="text-xs text-stone-500 mt-2 leading-relaxed">
                  Interviews, offers, and documents
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!channelsAvailable.marketing) return;
                  setEmailChannel('marketing');
                  setSelectedTemplate?.(null);
                  setEmailMode('template');
                }}
                disabled={!channelsAvailable.marketing}
                className={`rounded-2xl border px-4 py-3.5 text-left transition ${
                  emailChannel === 'marketing' ? channelActive : channelIdle
                } ${!channelsAvailable.marketing ? 'opacity-45 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-2 text-stone-900">
                  <span
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${
                      emailChannel === 'marketing'
                        ? 'bg-brand-100 text-brand-700'
                        : 'bg-stone-100 text-stone-400'
                    }`}
                  >
                    <Megaphone size={15} />
                  </span>
                  <span className="text-sm font-semibold">Campaign</span>
                </div>
                <p className="text-xs text-stone-500 mt-2 leading-relaxed">
                  Outreach and nurture sequences
                </p>
                {!channelsAvailable.marketing && (
                  <p className="text-[11px] font-medium text-stone-400 mt-2">Unavailable</p>
                )}
              </button>
            </div>
          </section>

          <section className="space-y-4">
            <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-stone-100/80 border border-stone-200/70">
              <button
                type="button"
                onClick={() => {
                  setEmailMode('template');
                  setSelectedTemplate?.(null);
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg transition ${
                  emailMode === 'template'
                    ? 'bg-white text-stone-900 shadow-sm border border-stone-200/80'
                    : 'text-stone-600 hover:text-stone-800 border border-transparent'
                }`}
              >
                <FileText size={14} /> Template
              </button>
              <button
                type="button"
                onClick={() => setEmailMode('quick')}
                disabled={emailChannel === 'marketing'}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg transition ${
                  emailMode === 'quick'
                    ? 'bg-white text-stone-900 shadow-sm border border-stone-200/80'
                    : 'text-stone-600 hover:text-stone-800 border border-transparent'
                } ${emailChannel === 'marketing' ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <Zap size={14} /> Quick send
              </button>
            </div>

            <EmailCcBccFields
              emailCC={emailCC}
              setEmailCC={setEmailCC}
              emailBCC={emailBCC}
              setEmailBCC={setEmailBCC}
              teamMembers={teamMembers}
              ccInput={ccInput}
              setCcInput={setCcInput}
              bccInput={bccInput}
              setBccInput={setBccInput}
              showCCPicker={showCCPicker}
              setShowCCPicker={setShowCCPicker}
              showBCCPicker={showBCCPicker}
              setShowBCCPicker={setShowBCCPicker}
            />
          </section>

          {emailMode === 'template' && (
            <EmailTemplateMode
              emailTemplates={emailTemplates}
              selectedTemplate={selectedTemplate}
              selectEmailTemplate={selectEmailTemplate}
              setSelectedTemplate={setSelectedTemplate}
              templateVars={templateVars}
              setTemplateVars={setTemplateVars}
              orgName={orgMeta.name}
              emailChannel={emailChannel}
              templateDraftSubject={props.templateDraftSubject}
              setTemplateDraftSubject={props.setTemplateDraftSubject}
              templateDraftBody={props.templateDraftBody}
              setTemplateDraftBody={props.setTemplateDraftBody}
              templateDraftDirty={props.templateDraftDirty}
              setTemplateDraftDirty={props.setTemplateDraftDirty}
            />
          )}

          {emailMode === 'quick' && (
            <EmailQuickSendMode
              emailType={emailType}
              setEmailType={setEmailType}
              emailRecipient={emailRecipient}
              quickName={quickName}
              setQuickName={setQuickName}
              quickPosition={quickPosition}
              setQuickPosition={setQuickPosition}
              quickDepartment={quickDepartment}
              setQuickDepartment={setQuickDepartment}
              quickJoiningDate={quickJoiningDate}
              setQuickJoiningDate={setQuickJoiningDate}
              customMessage={customMessage}
              setCustomMessage={setCustomMessage}
              quickSubject={quickSubject}
              setQuickSubject={setQuickSubject}
              showQuickPreview={showQuickPreview}
              setShowQuickPreview={setShowQuickPreview}
              quickPreviewHtml={quickPreviewHtml}
              setQuickPreviewHtml={setQuickPreviewHtml}
              quickPreviewSubject={quickPreviewSubject}
              setQuickPreviewSubject={setQuickPreviewSubject}
              loadingPreview={loadingPreview}
              setLoadingPreview={setLoadingPreview}
              toast={props.toast}
            />
          )}
        </div>

        <div className="px-5 sm:px-6 py-4 border-t border-stone-200/80 flex flex-col-reverse sm:flex-row sm:items-center gap-3 flex-shrink-0 bg-white/95 backdrop-blur-sm">
          <p className="text-xs text-stone-500 sm:mr-auto inline-flex items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                emailChannel === 'marketing' ? 'bg-brand-500' : 'bg-stone-400'
              }`}
            />
            {emailChannel === 'marketing' ? 'Campaign delivery' : 'Direct delivery'}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={closeModal}
              className="btn-secondary flex-1 sm:flex-none justify-center"
              disabled={isSendingEmail}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={emailMode === 'template' ? sendTemplateEmail : sendSingleEmail}
              disabled={!canSend}
              className="btn-primary flex-1 sm:flex-none justify-center min-w-[8.5rem] disabled:opacity-50"
            >
              {isSendingEmail ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Sending…
                </>
              ) : (
                <>
                  <Mail size={15} />
                  {isBulk ? `Send to ${bulkEmailRecipients.length}` : 'Send'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
