import { useState } from 'react';
import BASE_API_URL from '../../../config';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../../../utils/fetchUtils';

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

  const handleBulkEmail = async () => {
    if (selectedIds.length === 0) {
      toast.warning('Please select at least one candidate.');
      return;
    }

    const selectedCandidates = candidates.filter(c => selectedIds.includes(c._id));
    const validCandidates = selectedCandidates.filter(c => c.email && c.email.includes('@'));

    if (validCandidates.length === 0) {
      toast.warning('No valid email addresses found in selected candidates.');
      return;
    }

    const emailTypeChoice = prompt(
      `📧 Send Bulk Email to ${validCandidates.length} candidates\n\n` +
      `Select email type:\n` +
      `1 - Interview Invitation\n` +
      `2 - Rejection Letter\n` +
      `3 - Document Request\n` +
      `4 - Onboarding\n` +
      `5 - Custom Message\n\n` +
      `Enter number (1-5):`
    );

    if (!emailTypeChoice) return;

    const typeMap = {
      '1': 'interview',
      '2': 'rejection',
      '3': 'document',
      '4': 'onboarding',
      '5': 'custom'
    };

    const selectedType = typeMap[emailTypeChoice];

    if (!selectedType) {
      toast.error('Invalid choice!');
      return;
    }

    let customMsg = '';
    if (selectedType === 'custom') {
      customMsg = prompt('Enter your custom message:');
      if (!customMsg) return;
    }

    const proceedWithBulkEmail = async () => {
      setConfirmModal?.((prev) => ({ ...prev, isOpen: false }));
      try {
        setIsSendingEmail(true);

        const response = await authenticatedFetch(`${BASE_API_URL}/api/email/send-bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidates: validCandidates.map((c) => ({
              email: c.email,
              name: c.name,
              position: c.position,
              department: c.department || 'N/A',
              joiningDate: c.joiningDate || 'TBD',
            })),
            emailType: selectedType,
            customMessage: customMsg,
          }),
        });

        if (isUnauthorized(response)) {
          handleUnauthorized();
          return;
        }

        const data = await response.json();

        if (data.success) {
          toast.success(`Bulk email sent! Total: ${data.data.total}, Sent: ${data.data.sent}, Failed: ${data.data.failed}`);
          setSelectedIds?.([]);
        } else {
          toast.error(`Failed to send bulk emails: ${data.message}`);
        }
      } catch (error) {
        console.error('Bulk email error:', error);
        toast.error('Failed to send bulk emails. Please try again.');
      } finally {
        setIsSendingEmail(false);
      }
    };

    if (typeof setConfirmModal === 'function') {
      setConfirmModal({
        isOpen: true,
        type: 'info',
        title: 'Send Bulk Emails',
        message: `Send ${selectedType} emails to ${validCandidates.length} candidate(s)?`,
        confirmText: `Send ${validCandidates.length} Email${validCandidates.length > 1 ? 's' : ''}`,
        onConfirm: proceedWithBulkEmail,
      });
    } else {
      await proceedWithBulkEmail();
    }
  };

  // ===================== BULK EMAIL WORKFLOW FUNCTIONS =====================
  
  // Start bulk email workflow
  const startBulkEmailFlow = () => {
    if (selectedIds.length === 0) {
      toast.warning('Please select at least one candidate!');
      return;
    }
    
    const selected = candidates.filter(c => selectedIds.includes(c._id));
    const validCandidates = selected.filter(c => c.email);
    
    if (validCandidates.length === 0) {
      toast.warning('No valid email addresses found in selected candidates!');
      return;
    }
    
    // Open single email modal with multiple recipients (bulk mode)
    setBulkEmailRecipients(validCandidates);
    setEmailRecipient(validCandidates[0]); // Set first as primary for UI
    setEmailMode('quick'); // Start in quick send mode
    setEmailType('interview');
    setCustomMessage('');
    setEmailCC([]);
    setEmailBCC([]);
    setShowQuickPreview(false);
    setShowEmailModal(true);
    
    // Fetch templates if needed
    if (emailTemplates.length === 0) {
      (async () => {
        try {
          const res = await authenticatedFetch(`${BASE_API_URL}/api/email-templates`);
          const data = await res.json();
          if (data.success && data.templates.length > 0) {
            setEmailTemplates(data.templates);
          }
        } catch (err) {
          console.error('Failed to load templates:', err);
        }
      })();
    }
  };
  
  // Toggle email selection
  const toggleEmailSelection = (email) => {
    const newSet = new Set(selectedEmails);
    if (newSet.has(email)) {
      newSet.delete(email);
    } else {
      newSet.add(email);
    }
    setSelectedEmails(newSet);
  };
  
  // Select all visible emails
  const selectAllEmails = () => {
    const selected = candidates.filter(c => selectedIds.includes(c._id));
    const validCandidates = selected.filter(c => c.email);
    
    if (selectedEmails.size === validCandidates.length) {
      setSelectedEmails(new Set()); // Deselect all
    } else {
      const emails = new Set(validCandidates.map(c => c.email));
      setSelectedEmails(emails); // Select all
    }
  };
  
  // Confirm and send emails
  const handleConfirmSend = async () => {
    if (selectedEmails.size === 0) {
      toast.warning('No emails selected!');
      return;
    }
    
    setBulkEmailStep('sending');
    setIsSendingEmail(true);
    
    try {
      // Get candidate data for selected emails
      const selectedCandidates = candidates.filter(c => 
        selectedEmails.has(c.email)
      );
      
      const response = await authenticatedFetch(`${BASE_API_URL}/api/email/send-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidates: selectedCandidates.map(c => ({
            email: c.email,
            name: c.name,
            position: c.position,
            department: c.client || 'N/A',
            joiningDate: c.callBackDate || 'TBD'
          })),
          emailType: emailType,
          customMessage: customMessage || ''
        })
      });

      if (isUnauthorized(response)) {
        handleUnauthorized();
        return;
      }

      const data = await response.json();
      
      // Set campaign status
      setCampaignStatus({
        totalEmails: data.data.total,
        completed: data.data.sent,
        failed: data.data.failed,
        waiting: 0,
        processing: 0,
        successRate: data.data.successRate
      });
      
      // Move to results after a brief delay
      setTimeout(() => {
        setBulkEmailStep('results');
        setIsSendingEmail(false);
      }, 1000);
      
    } catch (error) {
      console.error('Bulk email error:', error);
      toast.error('Failed to send bulk emails. Please try again.');
      setBulkEmailStep('select');
      setIsSendingEmail(false);
    }
  };
  
  // Close bulk email flow
  const closeBulkEmailFlow = () => {
    setBulkEmailStep(null);
    setSelectedEmails(new Set());
    setCampaignStatus(null);
    setEmailStatuses({});
    setEmailType('interview');
    setCustomMessage('');
    setEmailCC([]);
    setEmailBCC([]);
    setSelectedIds?.([]);
  };

  const handleSendEmail = async (candidate) => {
    if (!candidate.email || !candidate.email.includes('@')) {
      toast.warning('Invalid email address for this candidate.');
      return;
    }

    // Check if user has email settings configured
    try {
      const configRes = await authenticatedFetch(`${BASE_API_URL}/api/email-settings`);
      const configData = await configRes.json();
      if (!configData.success || !configData.settings?.isConfigured) {
        toast.error(
          'Please configure your email settings first. Go to Email → Email Settings to set up your SMTP credentials.',
          6000
        );
        return;
      }
    } catch (err) {
      toast.error('Please configure your email settings before sending emails.');
      return;
    }

    // Transactional (ZeptoMail): only verified-domain company emails can send
    try {
      const statusRes = await authenticatedFetch(`${BASE_API_URL}/api/email/sender-status`);
      const statusData = await statusRes.json();
      if (statusData.success && statusData.canSend === false) {
        setVerifiedEmailRequiredMessage(statusData.reason || 'Please log in with your company verified email to send emails.');
        setShowVerifiedEmailRequiredModal(true);
        return;
      }
    } catch (_) { /* allow open if status fails */ }

    // Fetch available channels
    try {
      const chRes = await authenticatedFetch(`${BASE_API_URL}/api/email/channels`);
      const chData = await chRes.json();
      if (chData.success && chData.channels) {
        setChannelsAvailable({
          transactional: chData.channels.transactional?.available ?? true,
          marketing: chData.channels.marketing?.available ?? false
        });
      }
    } catch (_) { /* keep defaults */ }

    setEmailRecipient(candidate);
    setEmailChannel('transactional');
    setEmailType('interview');
    setCustomMessage('');
    setEmailCC([]);
    setEmailBCC([]);
    setCcInput('');
    setBccInput('');
    setQuickName(candidate.name || '');
    setQuickPosition(candidate.position || '');
    setQuickDepartment(candidate.department || '');
    setQuickJoiningDate(candidate.joiningDate || '');
    setShowQuickPreview(false);
    setQuickPreviewHtml('');
    setQuickPreviewSubject('');
    setSelectedTemplate(null);
    setTemplateVars({});
    setEmailMode('template');
    setShowEmailModal(true);

    // Fetch templates
    try {
      const res = await authenticatedFetch(`${BASE_API_URL}/api/email-templates`);
      const data = await res.json();
      if (data.success && data.templates.length > 0) {
        setEmailTemplates(data.templates);
      } else {
        // Seed defaults first
        await authenticatedFetch(`${BASE_API_URL}/api/email-templates/seed-defaults`, { method: 'POST' });
        const res2 = await authenticatedFetch(`${BASE_API_URL}/api/email-templates`);
        const data2 = await res2.json();
        if (data2.success) setEmailTemplates(data2.templates);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  const selectEmailTemplate = (template) => {
    setSelectedTemplate(template);
    // Pre-fill variables from candidate data
    const vars = {};
    (template.variables || []).forEach(v => {
      if (v === 'candidateName') vars[v] = emailRecipient?.name || '';
      else if (v === 'position') vars[v] = emailRecipient?.position || '';
      else if (v === 'company') vars[v] = emailRecipient?.client || emailRecipient?.companyName || '';
      else if (v === 'ctc') vars[v] = emailRecipient?.ctc || '';
      else if (v === 'experience') vars[v] = emailRecipient?.experience || '';
      else if (v === 'location') vars[v] = emailRecipient?.location || '';
      else vars[v] = '';
    });
    setTemplateVars(vars);
  };

  const sendTemplateEmail = async () => {
    if (!emailRecipient || !selectedTemplate) return;
    setIsSendingEmail(true);
    try {
      // Build recipient list (supports both single and bulk)
      const recipients = bulkEmailRecipients.length > 0
        ? bulkEmailRecipients.map(c => ({ email: c.email, name: c.name }))
        : [{ email: emailRecipient.email, name: emailRecipient.name }];

      const body = {
        templateId: selectedTemplate._id,
        recipients: recipients,
        variables: templateVars,
        channel: emailChannel,
      };
      if (emailCC.length > 0) body.cc = emailCC;
      if (emailBCC.length > 0) body.bcc = emailBCC;

      const response = await authenticatedFetch(`${BASE_API_URL}/api/email-templates/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      const failedCount = data.data?.failed?.length ?? 0;
      const successCount = data.data?.success?.length ?? 0;
      if (data.success) {
        if (bulkEmailRecipients.length > 0) {
          if (failedCount > 0) {
            toast.error(`Bulk email: ${successCount} sent, ${failedCount} failed. ${data.data.failed?.[0]?.error || ''}`);
            if (data.data?.failed?.length) console.error('[Send email] Failed:', data.data.failed);
          } else {
            toast.success(`Bulk email sent! Sent: ${successCount}`);
          }
          setShowEmailModal(false);
          setBulkEmailRecipients([]);
          setSelectedIds?.([]);
        } else {
          if (failedCount > 0) {
            const first = data.data?.failed?.[0];
            const errMsg = first?.displayMessage || first?.error || 'Send failed';
            toast.error(`Email not sent: ${errMsg}`, 8000);
            console.error('[Send email] Failed:', data.data?.failed);
          } else {
            const via = emailChannel === 'marketing' ? ' (via Marketing)' : ' (via Transactional)';
            toast.success(`Email sent to ${emailRecipient.email}${via}`);
            setShowEmailModal(false);
            setEmailRecipient(null);
          }
        }
        setSelectedTemplate(null);
        if (data.data && failedCount === 0) console.log('[Send email] Success:', data.data);
      } else if (data.message === 'EMAIL_NOT_CONFIGURED') {
        console.error('[Send email] Not configured:', data);
        toast.error('Please configure your email settings first. Go to Email → Email Settings.', 6000);
        setShowEmailModal(false);
      } else if (data.code === 'CAMPAIGNS_NOT_CONFIGURED') {
        toast.error(data.displayMessage || data.message || 'Zoho Campaigns is not configured. Add credentials and ZOHO_CAMPAIGNS_LIST_KEY in backend .env.', 8000);
        setShowEmailModal(false);
      } else if (data.code === 'USE_VERIFIED_DOMAIN') {
        setVerifiedEmailRequiredMessage(data.message || 'Please use your company verified email to send.');
        setShowVerifiedEmailRequiredModal(true);
        setShowEmailModal(false);
      } else {
        console.error('[Send email] API error:', data.message, data);
        toast.error(data.displayMessage || data.message || 'Failed to send email', 6000);
      }
    } catch (err) {
      console.error('[Send email] Error:', err?.message, err);
      toast.error('Failed to send email');
    } finally {
      setIsSendingEmail(false);
    }
  };
  const sendSingleEmail = async () => {
    if (!emailRecipient) return;

    try {
      setIsSendingEmail(true);

      // If bulk mode, send to all recipients
      if (bulkEmailRecipients.length > 0) {
        const response = await authenticatedFetch(`${BASE_API_URL}/api/email/send-bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidates: bulkEmailRecipients.map(c => ({
              email: c.email,
              name: c.name,
              position: c.position,
              department: c.department || 'N/A',
              joiningDate: c.joiningDate || 'TBD'
            })),
            emailType: emailType,
            customMessage: customMessage,
            cc: emailCC,
            bcc: emailBCC
          })
        });

        const data = await response.json();

        if (data.success) {
          toast.success(`Bulk email sent! Total: ${data.data.total}, Sent: ${data.data.sent}, Failed: ${data.data.failed}`);
          setShowEmailModal(false);
          setBulkEmailRecipients([]);
          setSelectedIds?.([]);
          setEmailRecipient(null);
          console.log('[Send bulk email] Success:', data.data);
        } else if (data.message === 'EMAIL_NOT_CONFIGURED') {
          console.error('[Send bulk email] Not configured:', data);
          toast.error('Please configure your email settings first. Go to Email → Email Settings.', 6000);
          setShowEmailModal(false);
        } else if (data.code === 'USE_VERIFIED_DOMAIN') {
          setVerifiedEmailRequiredMessage(data.message || 'Please use your company verified email to send.');
          setShowVerifiedEmailRequiredModal(true);
          setShowEmailModal(false);
        } else {
          console.error('[Send bulk email] API error:', data.message, data);
          toast.error(`Failed to send bulk emails: ${data.message}`);
        }
      } else {
        // Single email mode (existing code)
        const emailBody = {
          email: emailRecipient.email,
          name: quickName || emailRecipient.name,
          position: quickPosition || emailRecipient.position,
          emailType: emailType,
          customMessage: customMessage,
          department: quickDepartment || emailRecipient.department || 'N/A',
          joiningDate: quickJoiningDate || emailRecipient.joiningDate || 'TBD'
        };

        // Add CC if provided
        if (emailCC.length > 0) emailBody.cc = emailCC;

        // Add BCC if provided
        if (emailBCC.length > 0) emailBody.bcc = emailBCC;

        const response = await authenticatedFetch(`${BASE_API_URL}/api/email/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(emailBody)
        });

        const data = await response.json();

        if (data.success) {
          let successMessage = `Email sent to ${emailRecipient.email}`;
          if (emailCC.length > 0) successMessage += ` (CC: ${emailCC.join(', ')})`;
          if (emailBCC.length > 0) successMessage += ` (BCC: ${emailBCC.join(', ')})`;
          toast.success(successMessage);
          setShowEmailModal(false);
          setEmailRecipient(null);
          console.log('[Send email] Success:', data);
        } else if (data.message === 'EMAIL_NOT_CONFIGURED') {
          console.error('[Send email] Not configured:', data);
          toast.error('Please configure your email settings first. Go to Email → Email Settings.', 6000);
          setShowEmailModal(false);
        } else if (data.code === 'USE_VERIFIED_DOMAIN') {
          setVerifiedEmailRequiredMessage(data.message || 'Please use your company verified email to send.');
          setShowVerifiedEmailRequiredModal(true);
          setShowEmailModal(false);
        } else {
          console.error('[Send email] API error:', data.message, data);
          toast.error(`Failed to send email: ${data.message}`);
        }
      }
    } catch (error) {
      console.error('[Send email] Error:', error?.message, error);
      toast.error('Failed to send email. Please try again.');
    } finally {
      setIsSendingEmail(false);
    }
  };

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
