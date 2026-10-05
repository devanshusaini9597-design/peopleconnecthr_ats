import { useState } from 'react';
import { useCandidateEmailBulk } from './candidateEmailBulk';
import { useCandidateEmailSend } from './candidateEmailSend';

export function useCandidateEmail({
  toast, candidates, selectedIds, setSelectedIds, setConfirmModal, navigate,
  resolveSelectedPeople,
  getBulkAudience,
} = {}) {
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState(null);
  const [bulkEmailRecipients, setBulkEmailRecipients] = useState([]);
  const [bulkAudience, setBulkAudience] = useState(null);
  const [emailType, setEmailType] = useState('interview');
  const [customMessage, setCustomMessage] = useState('');
  const [quickSubject, setQuickSubject] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailCC, setEmailCC] = useState([]);
  const [emailBCC, setEmailBCC] = useState([]);
  const [ccInput, setCcInput] = useState('');
  const [bccInput, setBccInput] = useState('');
  const [showCCPicker, setShowCCPicker] = useState(false);
  const [showBCCPicker, setShowBCCPicker] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickPosition, setQuickPosition] = useState('');
  const [quickDepartment, setQuickDepartment] = useState('');
  const [quickJoiningDate, setQuickJoiningDate] = useState('');
  const [showQuickPreview, setShowQuickPreview] = useState(false);
  const [quickPreviewHtml, setQuickPreviewHtml] = useState('');
  const [quickPreviewSubject, setQuickPreviewSubject] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [emailTemplates, setEmailTemplates] = useState([]);
  const [emailTemplatesLoading, setEmailTemplatesLoading] = useState(false);
  const [emailSendSkipped, setEmailSendSkipped] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateVars, setTemplateVars] = useState({});
  const [templateDraftSubject, setTemplateDraftSubject] = useState('');
  const [templateDraftBody, setTemplateDraftBody] = useState('');
  const [templateDraftDirty, setTemplateDraftDirty] = useState(false);
  const [emailMode, setEmailMode] = useState('template');
  const [emailChannel, setEmailChannel] = useState('transactional');
  const [channelsAvailable, setChannelsAvailable] = useState({ transactional: true, marketing: false });
  const [emailSenderInfo, setEmailSenderInfo] = useState(null);
  const [showVerifiedEmailRequiredModal, setShowVerifiedEmailRequiredModal] = useState(false);
  const [verifiedEmailRequiredMessage, setVerifiedEmailRequiredMessage] = useState('');
  const [bulkEmailStep, setBulkEmailStep] = useState(null);
  const [selectedEmails, setSelectedEmails] = useState(new Set());
  const [campaignStatus, setCampaignStatus] = useState(null);
  const [emailStatuses, setEmailStatuses] = useState({});
  const [emailCampaignResult, setEmailCampaignResult] = useState(null);
  const [showEmailCampaignResult, setShowEmailCampaignResult] = useState(false);
  const [campaignJobId, setCampaignJobId] = useState('');
  const [campaignJobMeta, setCampaignJobMeta] = useState(null);

  const {
    handleBulkEmail,
    startBulkEmailFlow,
    toggleEmailSelection,
    selectAllEmails,
    handleConfirmSend,
    closeBulkEmailFlow,
  } = useCandidateEmailBulk({
    toast,
    candidates,
    selectedIds,
    setSelectedIds,
    setConfirmModal,
    setIsSendingEmail,
    setBulkEmailRecipients,
    setEmailRecipient,
    setEmailMode,
    setEmailChannel,
    setChannelsAvailable,
    setEmailSenderInfo,
    setEmailType,
    setCustomMessage,
    setEmailCC,
    setEmailBCC,
    setShowQuickPreview,
    setShowEmailModal,
    setCampaignJobId,
    setCampaignJobMeta,
    emailTemplates,
    setEmailTemplates,
    setEmailTemplatesLoading,
    setEmailSendSkipped,
    selectedEmails,
    setSelectedEmails,
    setBulkEmailStep,
    emailType,
    customMessage,
    setCampaignStatus,
    setEmailStatuses,
    resolveSelectedPeople,
    getBulkAudience,
    setBulkAudience,
  });

  const {
    handleSendEmail,
    selectEmailTemplate,
    sendTemplateEmail,
    sendSingleEmail,
  } = useCandidateEmailSend({
    toast,
    setVerifiedEmailRequiredMessage,
    setShowVerifiedEmailRequiredModal,
    setChannelsAvailable,
    setEmailSenderInfo,
    setEmailRecipient,
    setEmailChannel,
    setEmailType,
    setCustomMessage,
    setQuickSubject,
    setEmailCC,
    setEmailBCC,
    setCcInput,
    setBccInput,
    setQuickName,
    setQuickPosition,
    setQuickDepartment,
    setQuickJoiningDate,
    setShowQuickPreview,
    setQuickPreviewHtml,
    setQuickPreviewSubject,
    setSelectedTemplate,
    setTemplateVars,
    setTemplateDraftSubject,
    setTemplateDraftBody,
    setTemplateDraftDirty,
    setEmailMode,
    setShowEmailModal,
    setEmailTemplates,
    emailTemplates,
    setEmailTemplatesLoading,
    emailRecipient,
    selectedTemplate,
    setIsSendingEmail,
    bulkEmailRecipients,
    templateVars,
    templateDraftSubject,
    templateDraftBody,
    emailChannel,
    emailCC,
    emailBCC,
    setBulkEmailRecipients,
    setSelectedIds,
    emailType,
    customMessage,
    quickSubject,
    quickName,
    quickPosition,
    quickDepartment,
    quickJoiningDate,
    setEmailCampaignResult,
    setShowEmailCampaignResult,
    campaignJobId,
    campaignJobMeta,
    setCampaignJobId,
    setCampaignJobMeta,
    bulkAudience,
    setBulkAudience,
    emailSendSkipped,
    setEmailSendSkipped,
  });

  return {
    showEmailModal, setShowEmailModal, emailRecipient, setEmailRecipient,
    bulkEmailRecipients, setBulkEmailRecipients, bulkAudience, setBulkAudience, emailType, setEmailType,
    customMessage, setCustomMessage, quickSubject, setQuickSubject, isSendingEmail, emailCC, setEmailCC, emailBCC, setEmailBCC,
    ccInput, setCcInput, bccInput, setBccInput, showCCPicker, setShowCCPicker, showBCCPicker, setShowBCCPicker,
    quickName, setQuickName, quickPosition, setQuickPosition, quickDepartment, setQuickDepartment,
    quickJoiningDate, setQuickJoiningDate, showQuickPreview, setShowQuickPreview,
    quickPreviewHtml, setQuickPreviewHtml, quickPreviewSubject, setQuickPreviewSubject,
    loadingPreview, setLoadingPreview,
    emailTemplates, emailTemplatesLoading, selectedTemplate, setSelectedTemplate, templateVars, setTemplateVars,
    templateDraftSubject, setTemplateDraftSubject, templateDraftBody, setTemplateDraftBody,
    templateDraftDirty, setTemplateDraftDirty,
    emailMode, setEmailMode,
    emailChannel, setEmailChannel, channelsAvailable, setChannelsAvailable,
    emailSenderInfo, setEmailSenderInfo,
    showVerifiedEmailRequiredModal, setShowVerifiedEmailRequiredModal,
    verifiedEmailRequiredMessage, setVerifiedEmailRequiredMessage,
    bulkEmailStep, setBulkEmailStep, selectedEmails, setSelectedEmails, campaignStatus, emailStatuses,
    emailCampaignResult, setEmailCampaignResult,
    showEmailCampaignResult, setShowEmailCampaignResult,
    handleBulkEmail, startBulkEmailFlow, toggleEmailSelection, selectAllEmails,
    handleConfirmSend, closeBulkEmailFlow, handleSendEmail, selectEmailTemplate,
    sendTemplateEmail, sendSingleEmail,
    campaignJobId, setCampaignJobId, campaignJobMeta, setCampaignJobMeta,
    setEmailTemplates, emailSendSkipped, setEmailSendSkipped,
  };
}
