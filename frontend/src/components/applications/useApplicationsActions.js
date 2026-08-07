import API_URL from '../../config';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../../utils/fetchUtils';
import { emptyAddForm, normalizeApp } from './constants';

export function useApplicationsActions({
  applications,
  setApplications,
  selectedApp,
  setSelectedApp,
  setIsPanelOpen,
  noteDraft,
  setNoteDraft,
  setSavingNote,
  selectedJobId,
  setSelectedJobId,
  addForm,
  setAddForm,
  setIsAddModalOpen,
  setAdding,
  rejectReason,
  setRejectReason,
  setIsRejectModalOpen,
  setRejecting,
  scheduleForm,
  setScheduleForm,
  setIsScheduleOpen,
  setScheduling,
  deleteTarget,
  setDeleteTarget,
  setDeleting,
  fetchStats,
  showToast,
  setSearchQuery,
  setStageFilter,
}) {
  const openPanel = (app) => {
    setSelectedApp(normalizeApp(app));
    setIsPanelOpen(true);
  };

  const closePanel = () => {
    setIsPanelOpen(false);
    setSelectedApp(null);
  };

  const handleStageChange = async (appId, newStage) => {
    const previousApps = [...applications];
    setApplications((prev) => prev.map((app) => (app._id === appId ? { ...app, stage: newStage } : app)));
    if (selectedApp?._id === appId) setSelectedApp((s) => ({ ...s, stage: newStage }));

    try {
      const res = await authenticatedFetch(`${API_URL}/api/applications/${appId}/stage`, {
        method: 'PUT',
        body: JSON.stringify({ stage: newStage }),
      });
      if (isUnauthorized(res)) return handleUnauthorized();
      if (!res.ok) throw new Error('Failed to update stage');
      showToast(`Moved to ${newStage}`);
      fetchStats(selectedJobId);
    } catch (err) {
      console.error(err);
      setApplications(previousApps);
      showToast('Failed to move application', 'error');
    }
  };

  const handleRatingChange = async (appId, rating) => {
    const previousApps = [...applications];
    setApplications((prev) => prev.map((app) => (app._id === appId ? { ...app, rating } : app)));
    if (selectedApp?._id === appId) setSelectedApp((s) => ({ ...s, rating }));

    try {
      const res = await authenticatedFetch(`${API_URL}/api/applications/${appId}/rating`, {
        method: 'PUT',
        body: JSON.stringify({ rating }),
      });
      if (isUnauthorized(res)) return handleUnauthorized();
      if (!res.ok) throw new Error('Failed to update rating');
    } catch (err) {
      console.error(err);
      setApplications(previousApps);
      showToast('Failed to update rating', 'error');
    }
  };

  const handleSaveNote = async () => {
    if (!selectedApp) return;
    setSavingNote(true);
    try {
      const res = await authenticatedFetch(`${API_URL}/api/applications/${selectedApp._id}/notes`, {
        method: 'PUT',
        body: JSON.stringify({ notes: noteDraft }),
      });
      if (isUnauthorized(res)) return handleUnauthorized();
      if (!res.ok) throw new Error('Failed to save note');
      const json = await res.json();
      const updated = normalizeApp(json.data || { ...selectedApp, notes: noteDraft });
      setSelectedApp(updated);
      setApplications((prev) => prev.map((a) => (a._id === updated._id ? { ...a, notes: updated.notes } : a)));
      showToast('Note saved');
    } catch (err) {
      showToast(err.message || 'Failed to save note', 'error');
    } finally {
      setSavingNote(false);
    }
  };

  const handleReject = async () => {
    if (!selectedApp) return;
    setRejecting(true);
    try {
      const res = await authenticatedFetch(`${API_URL}/api/applications/${selectedApp._id}/reject`, {
        method: 'PUT',
        body: JSON.stringify({ reason: rejectReason.trim() || 'Not a fit' }),
      });
      if (isUnauthorized(res)) return handleUnauthorized();
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to reject');
      }
      setApplications((prev) => prev.filter((a) => a._id !== selectedApp._id));
      setIsRejectModalOpen(false);
      setRejectReason('');
      closePanel();
      showToast('Application rejected');
      fetchStats(selectedJobId);
    } catch (err) {
      showToast(err.message || 'Failed to reject', 'error');
    } finally {
      setRejecting(false);
    }
  };

  const handleSchedule = async (e) => {
    e.preventDefault();
    if (!selectedApp) return;
    if (!scheduleForm.scheduledDate || !scheduleForm.scheduledTime) {
      showToast('Pick a date and time', 'error');
      return;
    }
    setScheduling(true);
    try {
      const scheduledAt = `${scheduleForm.scheduledDate}T${scheduleForm.scheduledTime}`;
      const res = await authenticatedFetch(`${API_URL}/api/applications/${selectedApp._id}/schedule`, {
        method: 'PUT',
        body: JSON.stringify({
          scheduledAt,
          mode: scheduleForm.mode,
          location: scheduleForm.location,
          remark: scheduleForm.remark,
        }),
      });
      if (isUnauthorized(res)) return handleUnauthorized();
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to schedule');
      const updated = normalizeApp(json.data);
      setSelectedApp(updated);
      setApplications((prev) => prev.map((a) => (a._id === updated._id ? updated : a)));
      setNoteDraft(updated.notes || '');
      setIsScheduleOpen(false);
      showToast('Interview scheduled');
      fetchStats(selectedJobId);
    } catch (err) {
      showToast(err.message || 'Failed to schedule', 'error');
    } finally {
      setScheduling(false);
    }
  };

  const handleAddApplication = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      const jobId = addForm.jobId || selectedJobId;
      if (!jobId) throw new Error('Please select a job');
      if (!addForm.name.trim() || !addForm.email.trim()) throw new Error('Name and email are required');

      const res = await authenticatedFetch(`${API_URL}/api/applications`, {
        method: 'POST',
        body: JSON.stringify({
          jobId,
          source: addForm.source || 'Direct',
          candidate: {
            name: addForm.name.trim(),
            email: addForm.email.trim(),
            contact: addForm.phone.trim() || undefined,
            phone: addForm.phone.trim() || undefined,
          },
        }),
      });
      if (isUnauthorized(res)) return handleUnauthorized();
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to add application');

      const created = normalizeApp(json.data);
      if (jobId === selectedJobId) {
        setApplications((prev) => [created, ...prev]);
        fetchStats(selectedJobId);
      } else {
        setSelectedJobId(jobId);
      }
      setIsAddModalOpen(false);
      setAddForm(emptyAddForm);
      showToast('Application added');
    } catch (err) {
      showToast(err.message || 'Failed to add application', 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteApp = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await authenticatedFetch(`${API_URL}/api/applications/${deleteTarget._id}`, { method: 'DELETE' });
      if (isUnauthorized(res)) return handleUnauthorized();
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to delete');
      }
      setApplications((prev) => prev.filter((a) => a._id !== deleteTarget._id));
      if (selectedApp?._id === deleteTarget._id) closePanel();
      setDeleteTarget(null);
      showToast('Application deleted');
      fetchStats(selectedJobId);
    } catch (err) {
      showToast(err.message || 'Failed to delete', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const openAddModal = () => {
    setAddForm({ ...emptyAddForm, jobId: selectedJobId || '' });
    setIsAddModalOpen(true);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStageFilter('all');
  };

  return {
    openPanel,
    closePanel,
    handleStageChange,
    handleRatingChange,
    handleSaveNote,
    handleReject,
    handleSchedule,
    handleAddApplication,
    handleDeleteApp,
    openAddModal,
    clearFilters,
  };
}
