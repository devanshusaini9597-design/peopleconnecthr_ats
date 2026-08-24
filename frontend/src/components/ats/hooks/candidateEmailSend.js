import BASE_API_URL from '../../../config';
import { authenticatedFetch } from '../../../utils/fetchUtils';

export function useCandidateEmailSend(deps) {
  const {
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
  } = deps;

  const handleSendEmail = async (candidate) => {
    if (!candidate.email || !candidate.email.includes('@')) {
      toast.warning('Invalid email address for this candidate.');
      return;
    }

    try {
      const configRes = await authenticatedFetch(`${BASE_API_URL}/api/email-settings`);
      const configData = await configRes.json();
      const personalConfigured = !!(configData.success && configData.settings?.isConfigured);
      // Env / company Zepto may still allow sending without personal SMTP
      if (!personalConfigured) {
        const statusRes = await authenticatedFetch(`${BASE_API_URL}/api/email/sender-status`);
        const statusData = await statusRes.json().catch(() => ({}));
        if (!(statusData.success && statusData.canSend)) {
          toast.error(
            'Please configure your email settings first. Go to Email → Email Settings to set up your SMTP credentials.',
            6000
          );
          return;
        }
      }
    } catch (err) {
      toast.error('Please configure your email settings before sending emails.');
      return;
    }

    try {
      const statusRes = await authenticatedFetch(`${BASE_API_URL}/api/email/sender-status`);
      const statusData = await statusRes.json();
      if (statusData.success) {
        setEmailSenderInfo?.({
          fromEmail: statusData.fromEmail || statusData.agentFrom || '',
          replyTo: statusData.replyTo || '',
          displayName: statusData.displayName || '',
          verifiedDomain: statusData.verifiedDomain || '',
          sendAsUser: Boolean(statusData.sendAsUser),
          agentFrom: statusData.agentFrom || '',
          hint: statusData.hint || '',
        });
      }
      if (statusData.success && statusData.canSend === false) {
        setVerifiedEmailRequiredMessage(statusData.reason || 'Please log in with your company verified email to send emails.');
        setShowVerifiedEmailRequiredModal(true);
        return;
      }
    } catch (_) {
      setEmailSenderInfo?.(null);
    }

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
    setQuickSubject?.('');
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
    setTemplateDraftSubject?.('');
    setTemplateDraftBody?.('');
    setTemplateDraftDirty?.(false);
    setEmailMode('template');
    setShowEmailModal(true);

    try {
      const res = await authenticatedFetch(`${BASE_API_URL}/api/email-templates`);
      const data = await res.json();
      if (data.success && data.templates.length > 0) {
        setEmailTemplates(data.templates);
      } else {
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
    setTemplateDraftDirty?.(false);
    let orgCompany = '';
    try {
      orgCompany =
        localStorage.getItem('orgName') ||
        JSON.parse(localStorage.getItem('orgData') || '{}')?.name ||
        '';
    } catch {
      orgCompany = '';
    }
    const vars = {};
    (template.variables || []).forEach((v) => {
      if (v === 'candidateName') vars[v] = emailRecipient?.name || '';
      else if (v === 'position') vars[v] = emailRecipient?.position || '';
      else if (v === 'company') {
        vars[v] =
          emailRecipient?.client ||
          emailRecipient?.companyName ||
          orgCompany ||
          '';
      } else if (v === 'ctc') vars[v] = emailRecipient?.ctc || '';
      else if (v === 'experience') vars[v] = emailRecipient?.experience || '';
      else if (v === 'location') vars[v] = emailRecipient?.location || '';
      else vars[v] = '';
    });
    setTemplateVars(vars);
    // Seed draft immediately (effect also keeps it in sync while not dirty)
    let subject = String(template.subject || '');
    let bodyText = String(template.body || '');
    Object.entries(vars).forEach(([k, v]) => {
      const re = new RegExp(`\\{\\{${k}\\}\\}`, 'g');
      subject = subject.replace(re, v || `{{${k}}}`);
      bodyText = bodyText.replace(re, v || `{{${k}}}`);
    });
    setTemplateDraftSubject?.(subject);
    setTemplateDraftBody?.(bodyText);
  };

  const sendTemplateEmail = async () => {
    if (!emailRecipient || !selectedTemplate) return;
    setIsSendingEmail(true);
    try {
      const recipients = bulkEmailRecipients.length > 0
        ? bulkEmailRecipients.map(c => ({ email: c.email, name: c.name }))
        : [{ email: emailRecipient.email, name: emailRecipient.name }];

      const body = {
        templateId: selectedTemplate._id,
        recipients: recipients,
        variables: templateVars,
        channel: emailChannel,
        subjectOverride: templateDraftSubject || selectedTemplate.subject,
        bodyOverride: templateDraftBody || selectedTemplate.body,
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
            toast.error(`Bulk email: ${successCount} sent, ${failedCount} failed. ${data.data.failed?.[0]?.displayMessage || data.data.failed?.[0]?.error || ''}`, 8000);
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
            // Show user-friendly message for campaign sender issues
            if (emailChannel === 'marketing' && /not verified|sender/i.test(errMsg)) {
              toast.error('Campaign email could not be sent. Your sender address is not verified for campaigns. Please contact your admin.', 10000);
            } else {
              toast.error(`Email not sent: ${errMsg}`, 10000);
            }
            console.error('[Send email] Failed:', JSON.stringify(data.data?.failed, null, 2));
          } else {
            const via = emailChannel === 'marketing' ? ' (campaign)' : '';
            toast.success(`Email sent to ${emailRecipient.email}${via}`);
            setShowEmailModal(false);
            setEmailRecipient(null);
          }
        }
        setSelectedTemplate(null);
        setTemplateDraftSubject?.('');
        setTemplateDraftBody?.('');
        setTemplateDraftDirty?.(false);
        if (data.data && failedCount === 0) console.log('[Send email] Success:', data.data);
      } else if (data.message === 'EMAIL_NOT_CONFIGURED') {
        console.error('[Send email] Not configured:', data);
        toast.error('Please configure your email settings first. Go to Email → Email Settings.', 6000);
        setShowEmailModal(false);
      } else if (data.code === 'CAMPAIGNS_NOT_CONFIGURED') {
        toast.error(data.displayMessage || 'Marketing campaigns are not configured. Please contact your admin.', 8000);
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

      if (bulkEmailRecipients.length > 0) {
        const response = await authenticatedFetch(`${BASE_API_URL}/api/email/send-bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidates: bulkEmailRecipients.map((c) => ({
              email: c.email,
              name: quickName || c.name,
              position: quickPosition || c.position,
              department: quickDepartment || c.department || 'N/A',
              joiningDate: quickJoiningDate || c.joiningDate || 'TBD',
            })),
            // Quick send always uses the edited subject + body.
            emailType: 'custom',
            subject: (quickSubject || '').trim() || 'Message from recruiting team',
            customMessage: customMessage,
            cc: emailCC,
            bcc: emailBCC,
          }),
        });

        const data = await response.json();

        if (data.success) {
          const sent = data.data?.sent ?? 0;
          const failed = data.data?.failed ?? 0;
          if (failed > 0) {
            toast.error(`Sent ${sent}, failed ${failed}. ${data.data?.failedEmails?.[0]?.error || ''}`);
          } else {
            toast.success(sent === 1 ? `Email sent` : `Emails sent to ${sent} candidates`);
          }
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
          toast.error(`Failed to send emails: ${data.displayMessage || data.message || 'Unknown error'}`);
        }
      } else {
        const emailBody = {
          email: emailRecipient.email,
          name: quickName || emailRecipient.name,
          position: quickPosition || emailRecipient.position,
          // Always send the edited subject + body (type is only a starter).
          emailType: 'custom',
          subject: (quickSubject || '').trim() || 'Message from recruiting team',
          customMessage: customMessage,
          department: quickDepartment || emailRecipient.department || 'N/A',
          joiningDate: quickJoiningDate || emailRecipient.joiningDate || 'TBD'
        };

        if (emailCC.length > 0) emailBody.cc = emailCC;
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
    handleSendEmail,
    selectEmailTemplate,
    sendTemplateEmail,
    sendSingleEmail,
  };
}
