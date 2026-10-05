import BASE_API_URL from '../../../config';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../../../utils/fetchUtils';

export function useCandidateEmailBulk(deps) {
  const {
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
  } = deps;

  const handleBulkEmail = async () => {
    if (selectedIds.length === 0) {
      toast.warning('Please select at least one candidate.');
      return;
    }

    const selectedCandidates = candidates.filter(c => selectedIds.map(String).includes(String(c._id)));
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

  const openComposer = (recipients, sample, opts = {}) => {
    setBulkEmailRecipients(recipients);
    setEmailRecipient(sample || recipients[0]);
    setEmailChannel?.(deps.emailChannelDefault || 'transactional');
    setEmailMode('template');
    setEmailType('interview');
    setCustomMessage('');
    setEmailCC([]);
    setEmailBCC([]);
    setShowQuickPreview(false);
    if (!emailTemplates?.length) setEmailTemplatesLoading?.(true);
    setShowEmailModal(true);
    // Optional jobTag keeps requisition merge fields (job title, code, apply link)
    // when opening from Suggested talent. It does not add people to the job.
    const jobTag = String(opts.jobTag || '').trim();
    setCampaignJobId?.(jobTag);
    setCampaignJobMeta?.(null);
  };

  const refreshSender = async () => {
    const tasks = [
      authenticatedFetch(`${BASE_API_URL}/api/email/sender-status`)
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
        })
        .catch(() => {
          setEmailSenderInfo?.(null);
        }),
      authenticatedFetch(`${BASE_API_URL}/api/email/channels`)
        .then((res) => res.json())
        .then((chData) => {
          if (chData.success && chData.channels) {
            setChannelsAvailable?.({
              transactional: chData.channels.transactional?.available ?? true,
              marketing: chData.channels.marketing?.available ?? false,
            });
          }
        })
        .catch(() => { /* keep previous / defaults */ }),
    ];

    if (!emailTemplates?.length) {
      setEmailTemplatesLoading?.(true);
      tasks.push(
        authenticatedFetch(`${BASE_API_URL}/api/email-templates`)
          .then((res) => res.json())
          .then((data) => {
            if (data.success && Array.isArray(data.templates) && data.templates.length > 0) {
              setEmailTemplates(data.templates);
            }
          })
          .catch((err) => {
            console.error('Failed to load templates:', err);
          })
          .finally(() => {
            setEmailTemplatesLoading?.(false);
          })
      );
    }

    await Promise.all(tasks);
  };

  const startBulkEmailFlow = async (opts = {}) => {
    if (selectedIds.length === 0) {
      toast.warning('Please select at least one candidate!');
      return;
    }

    const audience = typeof getBulkAudience === 'function' ? getBulkAudience() : null;
    if (audience?.active) {
      const sample = (candidates || []).find((c) => String(c.email || '').includes('@'))
        || (candidates || [])[0]
        || { _id: 'audience-preview', name: 'Candidate', email: 'name@example.com' };
      setBulkAudience?.(audience);
      const count = Number(audience.count) || 0;
      setEmailSendSkipped?.(0);
      toast.success(
        count > 0
          ? `Ready to email all ${count.toLocaleString()} matching people. Send delivers to the full list.`
          : 'Ready to email everyone matching this search.'
      );
      openComposer([sample], sample, opts);
      if (audience.channel) setEmailChannel?.(audience.channel);
      await refreshSender();
      return;
    }
    setBulkAudience?.(null);

    let selected = (candidates || []).filter((c) => selectedIds.map(String).includes(String(c._id)));
    if (typeof resolveSelectedPeople === 'function') {
      try {
        toast.info('Loading all selected people (this can take a minute for large lists)…');
        const extra = await resolveSelectedPeople();
        if (Array.isArray(extra) && extra.length) {
          selected = extra;
        } else if (selectedIds.length > selected.length) {
          toast.error('Could not load all selected people. Try Select all again.');
          return;
        }
      } catch (err) {
        toast.error(err?.message || 'Could not load all selected people.');
        return;
      }
    } else if (selectedIds.length > selected.length) {
      toast.error('Only the current page is loaded. Use Select all matching, then try again.');
      return;
    }

    const validCandidates = selected.filter((c) => String(c.email || '').includes('@'));

    if (validCandidates.length === 0) {
      toast.warning('No valid email addresses found in selected candidates!');
      return;
    }

    const skipped = selected.length - validCandidates.length;
    setEmailSendSkipped?.(Math.max(0, skipped));

    if (skipped > 0) {
      toast.info(
        `${validCandidates.length.toLocaleString()} of ${selected.length.toLocaleString()} have a valid email — sending to those.`
      );
    } else {
      toast.success(`Ready to email ${validCandidates.length.toLocaleString()} people.`);
    }

    openComposer(validCandidates, validCandidates[0], opts);
    await refreshSender();
  };

  const toggleEmailSelection = (email) => {
    const newSet = new Set(selectedEmails);
    if (newSet.has(email)) {
      newSet.delete(email);
    } else {
      newSet.add(email);
    }
    setSelectedEmails(newSet);
  };

  const selectAllEmails = () => {
    const selected = candidates.filter(c => selectedIds.map(String).includes(String(c._id)));
    const validCandidates = selected.filter(c => c.email);

    if (selectedEmails.size === validCandidates.length) {
      setSelectedEmails(new Set());
    } else {
      const emails = new Set(validCandidates.map(c => c.email));
      setSelectedEmails(emails);
    }
  };

  const handleConfirmSend = async () => {
    if (selectedEmails.size === 0) {
      toast.warning('No emails selected!');
      return;
    }

    setBulkEmailStep('sending');
    setIsSendingEmail(true);

    try {
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

      setCampaignStatus({
        totalEmails: data.data.total,
        completed: data.data.sent,
        failed: data.data.failed,
        waiting: 0,
        processing: 0,
        successRate: data.data.successRate
      });

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

  return {
    handleBulkEmail,
    startBulkEmailFlow,
    toggleEmailSelection,
    selectAllEmails,
    handleConfirmSend,
    closeBulkEmailFlow,
  };
}
