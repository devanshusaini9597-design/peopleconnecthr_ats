import { useState } from 'react';
import { useCandidateEmailBulk } from './candidateEmailBulk';
import { useCandidateEmailSend } from './candidateEmailSend';

export function useCandidateEmail({
  toast, candidates, selectedIds, setSelectedIds, setConfirmModal, navigate,
} = {}) {
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState(null);
  const [bulkEmailRecipients, setBulkEmailRecipients] = useState([]);
  const [emailType, setEmailType] = useState('interview');
  const [customMessage, setCustomMessage] = useState('');
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
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateVars, setTemplateVars] = useState({});
  const [emailMode, setEmailMode] = useState('template');
  const [emailChannel, setEmailChannel] = useState('transactional');
  const [channelsAvailable, setChannelsAvailable] = useState({ transactional: true, marketing: false });
  const [showVerifiedEmailRequiredModal, setShowVerifiedEmailRequiredModal] = useState(false);
  const [verifiedEmailRequiredMessage, setVerifiedEmailRequiredMessage] = useState('');
  const [bulkEmailStep, setBulkEmailStep] = useState(null);
  const [selectedEmails, setSelectedEmails] = useState(new Set());
  const [campaignStatus, setCampaignStatus] = useState(null);
  const [emailStatuses, setEmailStatuses] = useState({});

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
    setEmailType,
    setCustomMessage,
    setEmailCC,
    setEmailBCC,
    setShowQuickPreview,
    setShowEmailModal,
    emailTemplates,
    setEmailTemplates,
    selectedEmails,
    setSelectedEmails,
    setBulkEmailStep,
    emailType,
    customMessage,
    setCampaignStatus,
    setEmailStatuses,
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
    setEmailRecipient,
    setEmailChannel,
    setEmailType,
    setCustomMessage,
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
    setEmailMode,
    setShowEmailModal,
    setEmailTemplates,
    emailRecipient,
    selectedTemplate,
    setIsSendingEmail,
    bulkEmailRecipients,
    templateVars,
    emailChannel,
    emailCC,
    emailBCC,
    setBulkEmailRecipients,
    setSelectedIds,
    emailType,
    customMessage,
    quickName,
    quickPosition,
    quickDepartment,
    quickJoiningDate,
  });

  return {
    showEmailModal, setShowEmailModal, emailRecipient, setEmailRecipient,
    bulkEmailRecipients, setBulkEmailRecipients, emailType, setEmailType,
    customMessage, setCustomMessage, isSendingEmail, emailCC, setEmailCC, emailBCC, setEmailBCC,
    ccInput, setCcInput, bccInput, setBccInput, showCCPicker, setShowCCPicker, showBCCPicker, setShowBCCPicker,
    quickName, setQuickName, quickPosition, setQuickPosition, quickDepartment, setQuickDepartment,
    quickJoiningDate, setQuickJoiningDate, showQuickPreview, setShowQuickPreview,
    quickPreviewHtml, setQuickPreviewHtml, quickPreviewSubject, setQuickPreviewSubject,
    loadingPreview, setLoadingPreview,
    emailTemplates, selectedTemplate, setSelectedTemplate, templateVars, setTemplateVars, emailMode, setEmailMode,
    emailChannel, setEmailChannel, channelsAvailable, setChannelsAvailable,
    showVerifiedEmailRequiredModal, setShowVerifiedEmailRequiredModal,
    verifiedEmailRequiredMessage, setVerifiedEmailRequiredMessage,
    bulkEmailStep, setBulkEmailStep, selectedEmails, setSelectedEmails, campaignStatus, emailStatuses,
    handleBulkEmail, startBulkEmailFlow, toggleEmailSelection, selectAllEmails,
    handleConfirmSend, closeBulkEmailFlow, handleSendEmail, selectEmailTemplate,
    sendTemplateEmail, sendSingleEmail,
  };
}
