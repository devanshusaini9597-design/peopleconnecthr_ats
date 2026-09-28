import BASE_API_URL from '../../../config';
import { authenticatedFetch } from '../../../utils/fetchUtils';
import { withJobApplyFooter } from '../../../utils/careersApplyUrl';
import { mergeAndPolish, polishMergedBody, polishMergedSubject } from '../../../utils/emailMergePolish';
import { veiledEmployer, cleanApplyUrl, outboundCompany } from '../../../utils/employerVeil';
import { buildSendReportPayload } from '../../../utils/emailSendReport';

const SEND_CHUNK = 400;

function chunkList(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Keep {{candidateName}} in bulk drafts so each recipient gets their own name. */
function ensureCandidateNameToken(text, bakedNames = []) {
  let out = String(text ?? '');
  if (/\{\{\s*candidateName\s*\}\}/i.test(out)) return out;
  for (const sample of bakedNames) {
    const s = String(sample || '').trim();
    if (s.length < 2) continue;
    out = out.replace(new RegExp(escapeRegExp(s), 'g'), '{{candidateName}}');
  }
  return out;
}

function jobVarsFromMeta(jobMeta, extra = {}) {
  const apply = cleanApplyUrl(jobMeta?.applyUrl || extra.applyLink || extra.applyUrl || '');
  return {
    ...extra,
    jobTitle: jobMeta?.jobTitle || extra.jobTitle || '',
    jobCode: jobMeta?.jobCode || extra.jobCode || '',
    applyLink: apply,
    applyUrl: apply,
    jobLocation: jobMeta?.jobLocation || extra.jobLocation || '',
    jobDepartment: jobMeta?.jobDepartment || extra.jobDepartment || '',
    jobClient: jobMeta?.jobClient || extra.jobClient || '',
    jobEmployer: extra.jobEmployer || jobMeta?.jobEmployer || jobMeta?.jobClient || extra.jobClient || '',
    jobExperience: jobMeta?.jobExperience || extra.jobExperience || '',
    jobSummary: jobMeta?.jobSummary || extra.jobSummary || '',
    jobCtc: jobMeta?.jobCtc || extra.jobCtc || extra.ctc || '',
    ctc: extra.ctc || jobMeta?.jobCtc || '',
    position: extra.position || jobMeta?.jobTitle || '',
  };
}

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
    emailSendSkipped = 0,
    setEmailSendSkipped,
  } = deps;

  const resolveAudienceRecipients = async () => {
    const res = await authenticatedFetch(`${BASE_API_URL}/api/search/audience`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bulkAudience?.query || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Could not load everyone matching this search.');
    }
    const recipients = Array.isArray(data.data?.recipients) ? data.data.recipients : [];
    if (!recipients.length) {
      throw new Error('None of the matching people have a valid email address.');
    }
    const expected = Number(bulkAudience?.count) || 0;
    if (expected > recipients.length) {
      toast.info(
        `${recipients.length.toLocaleString()} of ${expected.toLocaleString()} have a valid email — sending to those.`
      );
    } else {
      toast.info(`Sending to all ${recipients.length.toLocaleString()} matching people.`);
    }
    if (data.data?.capped) {
      toast.warning('This list is very large. Sending is capped at 25,000 people with a valid email.');
    }
    return recipients;
  };

  const showCampaignResult = (payload) => {
    if (typeof setEmailCampaignResult === 'function') {
      setEmailCampaignResult(payload);
      setShowEmailCampaignResult?.(true);
    }
  };

  const clearJobTag = () => {
    setCampaignJobId?.('');
    setCampaignJobMeta?.(null);
  };

  const loadJobMetaForEmail = async () => {
    const jobKey = String(campaignJobId || '').trim();
    if (!jobKey) return campaignJobMeta || null;
    if (campaignJobMeta?.applyUrl || campaignJobMeta?.jobTitle || campaignJobMeta?.jobCode) {
      return campaignJobMeta;
    }
    const response = await authenticatedFetch(`${BASE_API_URL}/api/applications/bulk-tag-job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: jobKey, preview: true }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Could not load job details for this email');
    }
    const meta = data.data || {};
    setCampaignJobMeta?.(meta);
    return meta;
  };

  const handleSendEmail = async (candidate) => {
    if (!candidate.email || !candidate.email.includes('@')) {
      toast.warning('This candidate does not have a valid email address.');
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
            'Email delivery is not configured. Open Email → Email Settings to connect your mailbox.',
            6000
          );
          return;
        }
      }
    } catch (err) {
      toast.error('Email delivery is not configured. Please set up Email Settings before sending.');
      return;
    }

    // Open composer immediately; hydrate sender + templates in parallel behind the modal.
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
    setEmailSendSkipped?.(0);
    setShowEmailModal(true);
    clearJobTag();

    const needTemplates = !emailTemplates?.length;
    if (needTemplates) setEmailTemplatesLoading?.(true);

    const loadSender = authenticatedFetch(`${BASE_API_URL}/api/email/sender-status`)
      .then((res) => res.json())
      .then((statusData) => {
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
          setVerifiedEmailRequiredMessage(statusData.reason || 'Please sign in with your company verified email to send mail.');
          setShowVerifiedEmailRequiredModal(true);
          setShowEmailModal(false);
          return false;
        }
        return true;
      })
      .catch(() => {
        setEmailSenderInfo?.(null);
        return true;
      });

    const loadChannels = authenticatedFetch(`${BASE_API_URL}/api/email/channels`)
      .then((res) => res.json())
      .then((chData) => {
        if (chData.success && chData.channels) {
          setChannelsAvailable({
            transactional: chData.channels.transactional?.available ?? true,
            marketing: chData.channels.marketing?.available ?? false,
          });
        }
      })
      .catch(() => { /* keep defaults */ });

    const loadTemplates = needTemplates
      ? authenticatedFetch(`${BASE_API_URL}/api/email-templates`)
          .then((res) => res.json())
          .then(async (data) => {
            if (data.success && data.templates?.length > 0) {
              setEmailTemplates(data.templates);
              return;
            }
            await authenticatedFetch(`${BASE_API_URL}/api/email-templates/seed-defaults`, { method: 'POST' });
            const res2 = await authenticatedFetch(`${BASE_API_URL}/api/email-templates`);
            const data2 = await res2.json();
            if (data2.success) setEmailTemplates(data2.templates || []);
          })
          .catch((err) => {
            console.error('Failed to load templates:', err);
          })
          .finally(() => {
            setEmailTemplatesLoading?.(false);
          })
      : Promise.resolve();

    await Promise.all([loadSender, loadChannels, loadTemplates]);
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
    const isBulk = (bulkEmailRecipients?.length || 0) > 0;
    const vars = {};
    const jobMeta = campaignJobMeta || {};
    (template.variables || []).forEach((v) => {
      // Bulk: leave candidateName empty so {{candidateName}} stays in the draft
      // and each recipient gets their own name at send time.
      if (v === 'candidateName') vars[v] = isBulk ? '' : (emailRecipient?.name || '');
      else if (v === 'position') vars[v] = jobMeta.jobTitle || emailRecipient?.position || '';
      else if (v === 'company' || v === 'orgName') {
        vars[v] = outboundCompany({ company: orgCompany }, orgCompany);
      } else if (v === 'jobEmployer') {
        vars[v] = jobMeta.jobEmployer || jobMeta.jobClient
          || veiledEmployer(jobMeta.jobIndustry || '', '');
      } else if (v === 'ctc') vars[v] = jobMeta.jobCtc || jobMeta.ctc || '';
      else if (v === 'experience') vars[v] = jobMeta.jobExperience || emailRecipient?.experience || '';
      else if (v === 'location') vars[v] = jobMeta.jobLocation || emailRecipient?.location || '';
      else if (v === 'jobTitle') vars[v] = jobMeta.jobTitle || '';
      else if (v === 'jobCode') vars[v] = jobMeta.jobCode || '';
      else if (v === 'applyLink' || v === 'applyUrl') vars[v] = cleanApplyUrl(jobMeta.applyUrl || jobMeta.applyLink || '');
      else if (v === 'jobLocation') vars[v] = jobMeta.jobLocation || '';
      else if (v === 'jobDepartment') vars[v] = jobMeta.jobDepartment || '';
      else if (v === 'jobClient') vars[v] = jobMeta.jobClient || '';
      else if (v === 'jobExperience') vars[v] = jobMeta.jobExperience || '';
      else if (v === 'jobSummary') vars[v] = jobMeta.jobSummary || '';
      else if (v === 'jobCtc') vars[v] = jobMeta.jobCtc || '';
      else vars[v] = '';
    });
    if (orgCompany) {
      vars.company = orgCompany;
      vars.orgName = orgCompany;
    }
    setTemplateVars(vars);
    // Seed draft immediately — empty fields are omitted, not left blank
    const isBulkPreserve = isBulk ? ['candidateName'] : [];
    setTemplateDraftSubject?.(
      mergeAndPolish(template.subject, vars, { kind: 'subject', preserveTokens: isBulkPreserve })
    );
    setTemplateDraftBody?.(
      mergeAndPolish(template.body, vars, { kind: 'body', preserveTokens: isBulkPreserve })
    );
  };

  const sendTemplateEmail = async () => {
    if (!emailRecipient || !selectedTemplate) return;
    setIsSendingEmail(true);
    try {
      let audiencePeople = null;
      if (bulkAudience?.active) {
        audiencePeople = await resolveAudienceRecipients();
      }
      const jobMeta = await loadJobMetaForEmail();
      const isBulk = Boolean(audiencePeople) || bulkEmailRecipients.length > 0;
      const vars = jobVarsFromMeta(jobMeta, templateVars || {});
      if (isBulk) {
        // Never pin one person's name into the shared variable bag
        vars.candidateName = '';
      }
      const sendPeople = audiencePeople || bulkEmailRecipients;
      const recipients = isBulk
        ? sendPeople.map(c => ({ email: c.email, name: c.name }))
        : [{ email: emailRecipient.email, name: emailRecipient.name }];

      const bakedNames = [];
      if (isBulk) {
        const fromField = String(templateVars?.candidateName || '').trim();
        const fromFirst = String(
          sendPeople[0]?.name || emailRecipient?.name || ''
        ).trim();
        const previewName = String(emailRecipient?.name || '').trim();
        if (fromField) bakedNames.push(fromField);
        if (fromFirst && fromFirst !== fromField) bakedNames.push(fromFirst);
        if (previewName && previewName !== fromField && previewName !== fromFirst && previewName !== 'Candidate') {
          bakedNames.push(previewName);
        }
      }

      let subjectOverride = String(templateDraftSubject || selectedTemplate.subject || '');
      let bodyOverride = withJobApplyFooter(
        String(templateDraftBody || selectedTemplate.body || ''),
        jobMeta || vars
      );
      const preserve = isBulk ? ['candidateName'] : [];
      if (isBulk && bakedNames.length) {
        subjectOverride = ensureCandidateNameToken(subjectOverride, bakedNames);
        bodyOverride = ensureCandidateNameToken(bodyOverride, bakedNames);
      }
      subjectOverride = polishMergedSubject(subjectOverride, { preserveTokens: preserve });
      bodyOverride = polishMergedBody(bodyOverride, { preserveTokens: preserve });

      const bodyBase = {
        templateId: selectedTemplate._id,
        variables: vars,
        channel: emailChannel,
        subjectOverride,
        bodyOverride,
      };
      if (emailCC.length > 0) bodyBase.cc = emailCC;
      if (emailBCC.length > 0) bodyBase.bcc = emailBCC;

      const failedList = [];
      const successList = [];
      let lastError = null;
      let anySuccess = false;
      const recipientChunks = chunkList(recipients, SEND_CHUNK);
      for (let chunkIndex = 0; chunkIndex < recipientChunks.length; chunkIndex += 1) {
        const part = recipientChunks[chunkIndex];
        if (recipientChunks.length > 1) {
          toast.info(`Sending batch ${chunkIndex + 1} of ${recipientChunks.length} (${recipients.length.toLocaleString()} people)…`);
        }
        const response = await authenticatedFetch(`${BASE_API_URL}/api/email-templates/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...bodyBase, recipients: part }),
        });
        const data = await response.json().catch(() => ({}));
        if (data.success) {
          anySuccess = true;
          failedList.push(...(data.data?.failed || []));
          successList.push(...(data.data?.success || []));
        } else {
          lastError = data;
          if (data.message === 'EMAIL_NOT_CONFIGURED' || data.code === 'CAMPAIGNS_NOT_CONFIGURED' || data.code === 'USE_VERIFIED_DOMAIN') {
            break;
          }
          failedList.push(...part.map((r) => ({ email: r.email, error: data.displayMessage || data.message || 'Failed to send' })));
        }
      }
      const data = anySuccess
        ? { success: true, data: { failed: failedList, success: successList } }
        : (lastError || { success: false, message: 'Failed to send email' });
      const failedCount = failedList.length;
      const successCount = successList.length;
      if (data.success) {
        const isBulk = bulkEmailRecipients.length > 0 || Boolean(bulkAudience?.active);
        if (isBulk || failedCount > 0 || successCount > 1) {
          const skippedFromAudience =
            Number(bulkAudience?.count) > 0
              ? Math.max(0, Number(bulkAudience.count) - (successCount + failedCount))
              : 0;
          const skipped = Math.max(Number(emailSendSkipped) || 0, skippedFromAudience);
          showCampaignResult(
            buildSendReportPayload({
              title: emailChannel === 'marketing' ? 'Campaign delivery report' : 'Bulk email delivery report',
              channel: emailChannel === 'marketing' ? 'marketing' : 'transactional',
              successList,
              failedList,
              skipped,
              selectedTotal:
                Number(bulkAudience?.count) ||
                successCount + failedCount + skipped,
            })
          );
          if (failedCount > 0) {
            toast.error(`${successCount} accepted, ${failedCount} failed — see delivery report`, 6000);
          } else {
            toast.success(
              emailChannel === 'marketing'
                ? `Campaign accepted for ${successCount} recipient${successCount === 1 ? '' : 's'}`
                : `Emails accepted for ${successCount} recipient${successCount === 1 ? '' : 's'}`
            );
          }
          setShowEmailModal(false);
          setBulkEmailRecipients([]);
          setBulkAudience?.(null);
          setSelectedIds?.([]);
          setEmailRecipient(null);
          setEmailSendSkipped?.(0);
          clearJobTag();
        } else if (failedCount > 0) {
          const first = failedList[0];
          const errMsg = first?.displayMessage || first?.error || 'Send failed';
          if (emailChannel === 'marketing' && /not verified|sender|Manage Senders/i.test(errMsg)) {
            toast.error(errMsg, 12000);
          } else {
            toast.error(`Email not sent: ${errMsg}`, 10000);
          }
        } else {
          const via = emailChannel === 'marketing' ? ' (campaign)' : '';
          toast.success(`Email sent to ${emailRecipient.email}${via}`);
          setShowEmailModal(false);
          setEmailRecipient(null);
          clearJobTag();
        }
        setSelectedTemplate(null);
        setTemplateDraftSubject?.('');
        setTemplateDraftBody?.('');
        setTemplateDraftDirty?.(false);
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
      toast.error(err?.message || 'Failed to send email');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const sendSingleEmail = async () => {
    if (!emailRecipient) return;

    try {
      setIsSendingEmail(true);
      let audiencePeople = null;
      if (bulkAudience?.active) {
        audiencePeople = await resolveAudienceRecipients();
      }
      const jobMeta = await loadJobMetaForEmail();
      const messageWithApply = withJobApplyFooter(customMessage, jobMeta);

      if (audiencePeople || bulkEmailRecipients.length > 0) {
        let sent = 0;
        let failed = 0;
        const failedEmails = [];
        const successEmails = [];
        let lastError = null;
        let anySuccess = false;
        const mapped = (audiencePeople || bulkEmailRecipients).map((c) => ({
          email: c.email,
          // Always use each person's own name — never the preview/quickName field
          name: c.name,
          position: quickPosition || c.position || jobMeta?.jobTitle,
          department: quickDepartment || c.department || jobMeta?.jobDepartment || '',
          joiningDate: quickJoiningDate || c.joiningDate || '',
        }));
        // Prefer {{candidateName}} token; also pass first preview name so backend can un-bake it
        let bulkSubject = (quickSubject || '').trim() || 'Message from recruiting team';
        let bulkBody = messageWithApply;
        const previewName = String(quickName || (audiencePeople || bulkEmailRecipients)[0]?.name || '').trim();
        if (previewName) {
          bulkSubject = ensureCandidateNameToken(bulkSubject, [previewName]);
          bulkBody = ensureCandidateNameToken(bulkBody, [previewName]);
        }
        bulkSubject = polishMergedSubject(bulkSubject, { preserveTokens: ['candidateName'] });
        bulkBody = polishMergedBody(bulkBody, { preserveTokens: ['candidateName'] });
        const mappedChunks = chunkList(mapped, SEND_CHUNK);
        for (let chunkIndex = 0; chunkIndex < mappedChunks.length; chunkIndex += 1) {
          const part = mappedChunks[chunkIndex];
          if (mappedChunks.length > 1) {
            toast.info(`Sending batch ${chunkIndex + 1} of ${mappedChunks.length} (${mapped.length.toLocaleString()} people)…`);
          }
          const response = await authenticatedFetch(`${BASE_API_URL}/api/email/send-bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              candidates: part,
              emailType: 'custom',
              subject: bulkSubject,
              customMessage: bulkBody,
              cc: emailCC,
              bcc: emailBCC,
            }),
          });
          const data = await response.json().catch(() => ({}));
          if (data.success) {
            anySuccess = true;
            sent += data.data?.sent ?? 0;
            failed += data.data?.failed ?? 0;
            failedEmails.push(...(data.data?.failedEmails || []));
            successEmails.push(...(data.data?.successEmails || []));
          } else {
            lastError = data;
            if (data.message === 'EMAIL_NOT_CONFIGURED' || data.code === 'USE_VERIFIED_DOMAIN') break;
            failed += part.length;
            failedEmails.push(...part.map((r) => ({ email: r.email, error: data.displayMessage || data.message || 'Failed to send' })));
          }
        }
        const data = anySuccess
          ? { success: true, data: { sent, failed, total: sent + failed, failedEmails, successEmails } }
          : (lastError || { success: false, message: 'Failed to send emails' });

        if (data.success) {
          const skippedFromAudience =
            Number(bulkAudience?.count) > 0
              ? Math.max(0, Number(bulkAudience.count) - (sent + failed))
              : 0;
          const skipped = Math.max(Number(emailSendSkipped) || 0, skippedFromAudience);
          showCampaignResult(
            buildSendReportPayload({
              title: 'Bulk email delivery report',
              channel: 'transactional',
              successList: successEmails,
              failedList: failedEmails,
              skipped,
              selectedTotal: Number(bulkAudience?.count) || sent + failed + skipped,
            })
          );
          if (failed > 0) {
            toast.error(`${sent} accepted, ${failed} failed — see delivery report`, 6000);
          } else {
            toast.success(sent === 1 ? 'Email accepted for delivery' : `Emails accepted for ${sent} recipients`);
          }
          setShowEmailModal(false);
          setBulkEmailRecipients([]);
          setBulkAudience?.(null);
          setSelectedIds?.([]);
          setEmailRecipient(null);
          setEmailSendSkipped?.(0);
          clearJobTag();
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
          department: quickDepartment || emailRecipient.department || '',
          joiningDate: quickJoiningDate || emailRecipient.joiningDate || '',
          emailType: 'custom',
          subject: polishMergedSubject((quickSubject || '').trim() || 'Message from recruiting team'),
          customMessage: polishMergedBody(messageWithApply),
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
          clearJobTag();
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
      toast.error(error?.message || 'Failed to send email. Please try again.');
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
