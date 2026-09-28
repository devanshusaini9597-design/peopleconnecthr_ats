import React, { useMemo, useState, useEffect } from 'react';
import { X, Mail, Megaphone, FileText, Zap, Briefcase } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { resolveOrgLogoSrc } from '../../utils/orgLogo';
import EmailCcBccFields from './candidateEmail/EmailCcBccFields';
import EmailTemplateMode from './candidateEmail/EmailTemplateMode';
import EmailQuickSendMode from './candidateEmail/EmailQuickSendMode';
import PremiumSelect from '../ui/PremiumSelect';
import { authenticatedFetch } from '../../utils/fetchUtils';
import BASE_API_URL from '../../config';

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
          className="h-10 w-10 rounded-lg object-contain bg-white border border-stone-200/80 shadow-sm flex-shrink-0"
        />
      ) : (
        <span className="h-10 w-10 rounded-lg bg-stone-900 text-white border border-stone-800 shadow-sm flex items-center justify-center text-[11px] font-semibold tracking-wide flex-shrink-0">
          {orgInitials(name)}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">
          Sender organization
        </p>
        <h2 className="text-[16px] sm:text-[17px] font-semibold text-stone-900 tracking-tight leading-snug truncate">
          {name || 'Organization'}
        </h2>
      </div>
    </div>
  );
}

export default function CandidateEmailModal(props) {
  const {
    emailRecipient, setShowEmailModal, bulkEmailRecipients,
    setBulkEmailRecipients, bulkAudience, setBulkAudience, setSelectedIds,
    emailChannel, setEmailChannel, channelsAvailable, emailSenderInfo, emailMode, setEmailMode,
    emailCC, setEmailCC, emailBCC, setEmailBCC, teamMembers, ccInput, setCcInput,
    bccInput, setBccInput, showCCPicker, setShowCCPicker, showBCCPicker, setShowBCCPicker,
    emailTemplates, emailTemplatesLoading, selectedTemplate, selectEmailTemplate, setSelectedTemplate,
    templateVars, setTemplateVars,
    emailType, setEmailType, quickName, setQuickName, quickPosition, setQuickPosition,
    quickDepartment, setQuickDepartment, quickJoiningDate, setQuickJoiningDate,
    customMessage, setCustomMessage, quickSubject, setQuickSubject,
    showQuickPreview, setShowQuickPreview,
    quickPreviewHtml, setQuickPreviewHtml, quickPreviewSubject, setQuickPreviewSubject,
    loadingPreview, setLoadingPreview, isSendingEmail,
    sendTemplateEmail, sendSingleEmail,
    campaignOnly = false,
    recipientNoun = 'candidates',
    jobs = [],
    campaignJobId = '',
    setCampaignJobId,
    campaignJobMeta,
    setCampaignJobMeta,
  } = props;

  const { organization } = useAuth();
  const audienceCount = Number(bulkAudience?.count) || 0;
  const usingAudience = Boolean(bulkAudience?.active);
  const isBulk = usingAudience || (bulkEmailRecipients?.length || 0) > 0;
  const sendLabel = usingAudience
    ? (audienceCount > 0 ? audienceCount.toLocaleString() : 'all matching')
    : String(bulkEmailRecipients?.length || 0);
  const showJobTag = Array.isArray(jobs) && jobs.length > 0;

  useEffect(() => {
    const key = String(campaignJobId || '').trim();
    if (!key) {
      setCampaignJobMeta?.(null);
      return undefined;
    }
    let cancelled = false;
    authenticatedFetch(`${BASE_API_URL}/api/applications/bulk-tag-job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: key, preview: true }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled || !json?.success) return;
        const meta = json.data || {};
        setCampaignJobMeta?.(meta);
        setTemplateVars?.((prev) => ({
          ...prev,
          jobTitle: meta.jobTitle || '',
          jobCode: meta.jobCode || '',
          applyLink: String(meta.applyUrl || '').replace(/[?&]+$/g, ''),
          jobLocation: meta.jobLocation || '',
          jobDepartment: meta.jobDepartment || '',
          jobClient: meta.jobClient || '',
          jobEmployer: meta.jobClient || prev?.jobEmployer || '',
          jobExperience: meta.jobExperience || '',
          jobSummary: meta.jobSummary || '',
          ctc: meta.jobCtc || prev?.ctc || '',
          position: meta.jobTitle || prev?.position || '',
          location: meta.jobLocation || prev?.location || '',
          experience: meta.jobExperience || prev?.experience || '',
          company: prev?.company || '',
        }));
        if (meta.jobTitle) setQuickPosition?.(meta.jobTitle);
        if (meta.jobDepartment) setQuickDepartment?.(meta.jobDepartment);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [campaignJobId]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setBulkAudience?.(null);
    setSelectedIds?.([]);
    setCampaignJobId?.('');
    setCampaignJobMeta?.(null);
  };

  const canSend =
    !isSendingEmail &&
    !(emailMode === 'template' && !selectedTemplate) &&
    !(emailMode === 'template' && selectedTemplate && !(props.templateDraftSubject || '').trim()) &&
    !(emailMode === 'template' && selectedTemplate && !(props.templateDraftBody || '').trim()) &&
    !(emailMode === 'quick' && !(quickSubject || '').trim()) &&
    !(emailMode === 'quick' && !customMessage.trim());

  const toLine = usingAudience
    ? (audienceCount > 0 ? `All ${audienceCount.toLocaleString()} matching contacts` : 'Everyone matching this search')
    : (isBulk
      ? bulkEmailRecipients.map((c) => c.name || c.email).join(', ')
      : `${emailRecipient.name} <${emailRecipient.email}>`);

  const channelActive =
    'border-brand-600 bg-brand-50/50 ring-1 ring-brand-600/20 shadow-sm';
  const channelIdle = 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/80';

  return (
    <div className="fixed inset-0 bg-stone-950/45 backdrop-blur-[2px] flex items-center justify-center z-50 p-3 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-2xl border border-stone-200/80 w-full max-w-3xl max-h-[90vh] shadow-[0_28px_80px_-24px_rgba(28,25,23,0.42)] flex flex-col overflow-hidden">
        <div className="relative flex-shrink-0 border-b border-stone-200/80">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand-700 via-teal-500 to-brand-600" aria-hidden />
          <div className="px-5 sm:px-6 pt-5 pb-4 bg-gradient-to-b from-stone-50/90 to-white">
            <div className="flex items-start justify-between gap-3">
              <OrgBrandMark name={orgMeta.name} logo={orgMeta.logo} />
              <button
                type="button"
                onClick={closeModal}
                className="p-2 -mr-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 border border-transparent hover:border-stone-200 transition"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 sm:pl-[3.25rem]">
              <h3 className="text-[15px] sm:text-base font-semibold text-stone-900 tracking-tight">
                {isBulk
                  ? `Compose ${campaignOnly ? 'campaign' : 'message'} · ${sendLabel} ${recipientNoun}`
                  : (campaignOnly ? 'Compose campaign message' : 'Compose message')}
              </h3>
              <p className="text-sm text-stone-600 mt-1.5 truncate" title={toLine}>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-400 mr-1.5">To</span>
                <span className="font-medium text-stone-800">{toLine}</span>
              </p>
              {usingAudience ? (
                <p className="text-xs text-stone-500 mt-1.5 leading-relaxed">
                  The full matching list is delivered in one action. Contacts without an email address are skipped automatically.
                </p>
              ) : null}
              {emailSenderInfo?.fromEmail && (
                <p className="text-xs text-stone-500 mt-1 truncate">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-400 mr-1.5">From</span>
                  {emailSenderInfo.displayName || 'Recruiter'} · {emailSenderInfo.fromEmail}
                  {emailSenderInfo.replyTo && !emailSenderInfo.sendAsUser
                    ? ` · Replies to ${emailSenderInfo.replyTo}`
                    : ''}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0 px-5 sm:px-6 py-5 space-y-6 bg-white">
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-stone-900">Delivery channel</h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Select the appropriate channel for this communication.
              </p>
            </div>
            <div className={`grid gap-3 ${campaignOnly ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {!campaignOnly ? (
              <button
                type="button"
                onClick={() => {
                  setEmailChannel('transactional');
                  setSelectedTemplate?.(null);
                }}
                className={`rounded-xl border px-4 py-3.5 text-left transition ${
                  emailChannel === 'transactional' ? channelActive : channelIdle
                }`}
              >
                <div className="flex items-center gap-2.5 text-stone-900">
                  <span
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${
                      emailChannel === 'transactional'
                        ? 'bg-brand-600 text-white'
                        : 'bg-stone-100 text-stone-500'
                    }`}
                  >
                    <Mail size={15} />
                  </span>
                  <span className="text-sm font-semibold">Transactional</span>
                </div>
                <p className="text-xs text-stone-500 mt-2.5 leading-relaxed">
                  Interviews, offers, documents, and one-to-one follow-ups
                </p>
              </button>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  if (!channelsAvailable.marketing) return;
                  setEmailChannel('marketing');
                  setSelectedTemplate?.(null);
                  setEmailMode('template');
                }}
                disabled={!channelsAvailable.marketing}
                className={`rounded-xl border px-4 py-3.5 text-left transition ${
                  emailChannel === 'marketing' ? channelActive : channelIdle
                } ${!channelsAvailable.marketing ? 'opacity-45 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-2.5 text-stone-900">
                  <span
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${
                      emailChannel === 'marketing'
                        ? 'bg-brand-600 text-white'
                        : 'bg-stone-100 text-stone-500'
                    }`}
                  >
                    <Megaphone size={15} />
                  </span>
                  <span className="text-sm font-semibold">Campaign</span>
                </div>
                <p className="text-xs text-stone-500 mt-2.5 leading-relaxed">
                  {campaignOnly
                    ? 'Marketing templates via Zoho Campaigns · consent-checked audience'
                    : 'Outreach, nurture sequences, and talent-pool campaigns'}
                </p>
                {!channelsAvailable.marketing && (
                  <p className="text-[11px] font-medium text-stone-400 mt-2">Channel unavailable</p>
                )}
              </button>
            </div>
          </section>

          {showJobTag ? (
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-stone-900 inline-flex items-center gap-2">
                  <Briefcase size={14} className="text-brand-700" />
                  Job merge fields
                </h3>
                <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">
                  Populates role, Job ID, compensation, location, and apply link in this message.
                  Recipients are not added to the job unless they apply or you assign them.
                </p>
              </div>
              <PremiumSelect
                variant="list"
                value={campaignJobId || ''}
                onChange={(v) => setCampaignJobId?.(v || '')}
                options={[
                  { value: '', label: 'Do not include job details' },
                  ...jobs.map((job) => {
                    const code = String(job.jobCode || '').trim();
                    const title = String(job.title || job.role || 'Untitled').trim();
                    return {
                      value: code || String(job._id),
                      label: code || 'Job ID pending',
                      description: title,
                      searchText: `${code} ${title} ${job.location || ''}`,
                    };
                  }),
                ]}
                placeholder="Select Job ID / JNS"
                searchable
                searchPlaceholder="Search Job ID or title…"
                allowClear={Boolean(campaignJobId)}
              />
              {campaignJobMeta?.jobTitle || campaignJobMeta?.applyUrl ? (
                <div className="rounded-lg border border-stone-200 bg-stone-50/70 px-3 py-2.5 text-[11px] text-stone-600 leading-snug space-y-0.5">
                  {campaignJobMeta.jobTitle ? (
                    <p className="font-medium text-stone-800">
                      {campaignJobMeta.jobTitle}
                      {campaignJobMeta.jobCode ? ` · ${campaignJobMeta.jobCode}` : ''}
                    </p>
                  ) : null}
                  {campaignJobMeta.jobLocation ? <p>{campaignJobMeta.jobLocation}</p> : null}
                  {campaignJobMeta.jobCtc ? <p>CTC: {campaignJobMeta.jobCtc}</p> : null}
                  {campaignJobMeta.jobClient ? <p>{campaignJobMeta.jobClient}</p> : null}
                  {campaignJobMeta.applyUrl ? (
                    <p className="break-all">Apply link: {campaignJobMeta.applyUrl}</p>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="space-y-4">
            {!campaignOnly ? (
            <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-stone-100 border border-stone-200/80">
              <button
                type="button"
                onClick={() => {
                  setEmailMode('template');
                  setSelectedTemplate?.(null);
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-md transition ${
                  emailMode === 'template'
                    ? 'bg-white text-stone-900 shadow-sm border border-stone-200/90'
                    : 'text-stone-600 hover:text-stone-800 border border-transparent'
                }`}
              >
                <FileText size={14} /> Template library
              </button>
              <button
                type="button"
                onClick={() => setEmailMode('quick')}
                disabled={emailChannel === 'marketing'}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-md transition ${
                  emailMode === 'quick'
                    ? 'bg-white text-stone-900 shadow-sm border border-stone-200/90'
                    : 'text-stone-600 hover:text-stone-800 border border-transparent'
                } ${emailChannel === 'marketing' ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <Zap size={14} /> Custom draft
              </button>
            </div>
            ) : null}

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
              templatesLoading={emailTemplatesLoading}
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
              isBulk={isBulk}
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
              isBulk={isBulk}
            />
          )}
        </div>

        <div className="px-5 sm:px-6 py-3.5 border-t border-stone-200/80 flex flex-col-reverse sm:flex-row sm:items-center gap-3 flex-shrink-0 bg-stone-50/80">
          <p className="text-xs text-stone-500 sm:mr-auto inline-flex items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                emailChannel === 'marketing' ? 'bg-brand-600' : 'bg-stone-400'
              }`}
            />
            {emailChannel === 'marketing' ? 'Campaign channel' : 'Transactional channel'}
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
              className="btn-primary flex-1 sm:flex-none justify-center min-w-[9rem] disabled:opacity-50"
            >
              {isSendingEmail ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Sending…
                </>
              ) : (
                <>
                  <Mail size={15} />
                  {isBulk ? `Send to ${sendLabel}` : 'Send message'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
