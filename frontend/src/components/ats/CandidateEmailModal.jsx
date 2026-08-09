import React from 'react';
import { X, Mail, Megaphone } from 'lucide-react';
import EmailCcBccFields from './candidateEmail/EmailCcBccFields';
import EmailTemplateMode from './candidateEmail/EmailTemplateMode';
import EmailQuickSendMode from './candidateEmail/EmailQuickSendMode';

export default function CandidateEmailModal(props) {
  if (!(props.showEmailModal && props.emailRecipient)) return null;
  const {
    showEmailModal, emailRecipient, setShowEmailModal, bulkEmailRecipients,
    setBulkEmailRecipients, setSelectedIds,
    emailChannel, setEmailChannel, channelsAvailable, emailSenderInfo, emailMode, setEmailMode,
    emailCC, setEmailCC, emailBCC, setEmailBCC, teamMembers, ccInput, setCcInput,
    bccInput, setBccInput, showCCPicker, setShowCCPicker, showBCCPicker, setShowBCCPicker,
    emailTemplates, selectedTemplate, selectEmailTemplate, setSelectedTemplate,
    templateVars, setTemplateVars,
    emailType, setEmailType, quickName, setQuickName, quickPosition, setQuickPosition,
    quickDepartment, setQuickDepartment, quickJoiningDate, setQuickJoiningDate,
    customMessage, setCustomMessage, showQuickPreview, setShowQuickPreview,
    quickPreviewHtml, setQuickPreviewHtml, quickPreviewSubject, setQuickPreviewSubject,
    loadingPreview, setLoadingPreview, isSendingEmail,
    sendTemplateEmail, sendSingleEmail, toast,
  } = props;

  return (
    <div className="fixed inset-0 bg-stone-900/55 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-stone-200/60 w-full max-w-3xl max-h-[90vh] shadow-2xl flex flex-col modal-panel-ats">
        <div className="flex justify-between items-center px-6 py-4 border-b border-stone-100 flex-shrink-0">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center">
              <Mail className="text-brand-600" size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 tracking-tight">
                {bulkEmailRecipients.length > 0 ? `Bulk Email (${bulkEmailRecipients.length} recipients)` : 'Send Email'}
              </h2>
              <p className="text-xs text-stone-500">
                {bulkEmailRecipients.length > 0
                  ? `To: ${bulkEmailRecipients.map(c => c.name).join(', ')}`
                  : `To: ${emailRecipient.name} (${emailRecipient.email})`
                }
              </p>
              {emailSenderInfo?.fromEmail && (
                <p className="text-[11px] text-stone-500 mt-0.5">
                  From: <span className="font-medium text-stone-700">{emailSenderInfo.displayName || 'Recruiter'}</span>
                  {' '}&lt;{emailSenderInfo.fromEmail}&gt;
                  {emailSenderInfo.replyTo ? (
                    <> · Replies → <span className="font-medium text-stone-700">{emailSenderInfo.replyTo}</span></>
                  ) : null}
                </p>
              )}
            </div>
          </div>
          <button onClick={() => {
            setShowEmailModal(false);
            setBulkEmailRecipients?.([]);
            setSelectedIds?.([]);
          }} className="p-2 hover:bg-stone-200 rounded-lg transition">
            <X size={18} className="text-stone-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex gap-1 p-1 bg-stone-100 rounded-lg">
                <button
                  onClick={() => setEmailChannel('transactional')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${emailChannel === 'transactional' ? 'bg-brand-600 text-white shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                >
                  <Mail size={12} /> Transactional
                </button>
                <button
                  onClick={() => setEmailChannel('marketing')}
                  disabled={!channelsAvailable.marketing}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${emailChannel === 'marketing' ? 'bg-purple-600 text-white shadow-sm' : 'text-stone-500 hover:text-stone-700'} ${!channelsAvailable.marketing ? 'opacity-40 cursor-not-allowed' : ''}`}
                  title={!channelsAvailable.marketing ? 'Zoho Campaigns not configured' : 'Send via Zoho Campaigns (marketing)'}
                >
                  <Megaphone size={12} /> Marketing
                </button>
              </div>
              <span className="text-[10px] text-stone-400">
                via {emailChannel === 'marketing' ? 'Zoho Campaigns' : 'ZeptoMail'}
              </span>
            </div>

            <div className="flex gap-2 p-1 bg-stone-100 rounded-lg w-fit">
              <button
                onClick={() => { setEmailMode('template'); setSelectedTemplate?.(null); }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${emailMode === 'template' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
              >Use Template</button>
              <button
                onClick={() => setEmailMode('quick')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${emailMode === 'quick' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
              >Quick Send</button>
            </div>

            <EmailCcBccFields
              emailCC={emailCC} setEmailCC={setEmailCC}
              emailBCC={emailBCC} setEmailBCC={setEmailBCC}
              teamMembers={teamMembers}
              ccInput={ccInput} setCcInput={setCcInput}
              bccInput={bccInput} setBccInput={setBccInput}
              showCCPicker={showCCPicker} setShowCCPicker={setShowCCPicker}
              showBCCPicker={showBCCPicker} setShowBCCPicker={setShowBCCPicker}
            />

            {emailMode === 'template' && (
              <EmailTemplateMode
                emailTemplates={emailTemplates}
                selectedTemplate={selectedTemplate}
                selectEmailTemplate={selectEmailTemplate}
                setSelectedTemplate={setSelectedTemplate}
                templateVars={templateVars}
                setTemplateVars={setTemplateVars}
              />
            )}

            {emailMode === 'quick' && (
              <EmailQuickSendMode
                emailType={emailType} setEmailType={setEmailType}
                emailRecipient={emailRecipient}
                quickName={quickName} setQuickName={setQuickName}
                quickPosition={quickPosition} setQuickPosition={setQuickPosition}
                quickDepartment={quickDepartment} setQuickDepartment={setQuickDepartment}
                quickJoiningDate={quickJoiningDate} setQuickJoiningDate={setQuickJoiningDate}
                customMessage={customMessage} setCustomMessage={setCustomMessage}
                showQuickPreview={showQuickPreview} setShowQuickPreview={setShowQuickPreview}
                quickPreviewHtml={quickPreviewHtml} setQuickPreviewHtml={setQuickPreviewHtml}
                quickPreviewSubject={quickPreviewSubject} setQuickPreviewSubject={setQuickPreviewSubject}
                loadingPreview={loadingPreview} setLoadingPreview={setLoadingPreview}
                toast={toast}
              />
            )}
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-stone-100 bg-stone-50/80 flex-shrink-0">
          <button
            type="button"
            onClick={() => setShowEmailModal(false)}
            className="btn-secondary flex-1 justify-center"
            disabled={isSendingEmail}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={emailMode === 'template' ? sendTemplateEmail : sendSingleEmail}
            disabled={isSendingEmail || (emailMode === 'template' && !selectedTemplate) || (emailMode === 'quick' && emailType === 'custom' && !customMessage.trim())}
            className="btn-primary flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSendingEmail ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                Sending...
              </>
            ) : (
              <>
                <Mail size={16} />
                Send Email
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
