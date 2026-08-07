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
  } = deps;

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

    setBulkEmailRecipients(validCandidates);
    setEmailRecipient(validCandidates[0]);
    setEmailMode('quick');
    setEmailType('interview');
    setCustomMessage('');
    setEmailCC([]);
    setEmailBCC([]);
    setShowQuickPreview(false);
    setShowEmailModal(true);

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
    const selected = candidates.filter(c => selectedIds.includes(c._id));
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
