import { useState, useCallback } from 'react';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../../../utils/fetchUtils';
import BASE_API_URL from '../../../config';

/**
 * Bulk actions + single delete + AI dedupe for the Candidates page.
 */
export function useBulkCandidateActions({
  toast,
  candidates,
  selectedIds,
  setSelectedIds,
  API_URL,
  searchQuery,
  filterJob,
  currentPage,
  setCurrentPage,
  fetchData,
  isFreelancer = false,
}) {
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    type: 'warning',
    title: '',
    message: '',
    details: null,
    confirmText: 'Confirm',
    onConfirm: () => {},
    isLoading: false,
  });
  const [dedupeLoading, setDedupeLoading] = useState(false);
  const [dedupeResults, setDedupeResults] = useState(null);
  const [showDedupeModal, setShowDedupeModal] = useState(false);
  const [dedupeMerging, setDedupeMerging] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditLoading, setBulkEditLoading] = useState(false);
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);

  const refreshAfterBulk = useCallback(async () => {
    window.dispatchEvent(new CustomEvent('candidates:changed'));
    setSelectedIds([]);
    const pageToRestore = currentPage;
    await fetchData(1, { search: searchQuery, position: filterJob });
    setCurrentPage(pageToRestore);
  }, [setSelectedIds, currentPage, fetchData, searchQuery, filterJob, setCurrentPage]);

  const sendWhatsApp = useCallback((phone) => {
    if (!phone) return;
    const cleanPhone = String(phone).replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  }, []);

  const handleBulkWhatsApp = useCallback(() => {
    if (selectedIds.length === 0) {
      toast.warning('Please select at least one candidate.');
      return;
    }
    const selected = candidates.filter((c) => selectedIds.includes(c._id));
    const withPhone = selected.filter((c) => c.contact && c.contact.replace(/\D/g, '').length >= 7);
    if (withPhone.length === 0) {
      toast.warning('No valid phone numbers found in selected candidates.');
      return;
    }
    setConfirmModal({
      isOpen: true,
      type: 'info',
      title: 'Open WhatsApp',
      message: `Open WhatsApp for ${withPhone.length} candidate(s)? Each will open in a new tab.`,
      confirmText: 'Open WhatsApp',
      onConfirm: () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        withPhone.forEach((c, i) => {
          setTimeout(() => {
            window.open(`https://wa.me/${c.contact.replace(/\D/g, '')}`, '_blank');
          }, i * 500);
        });
      },
    });
  }, [selectedIds, candidates, toast]);

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.length === 0) {
      toast.warning('Please select at least one candidate.');
      return;
    }
    setConfirmModal({
      isOpen: true,
      type: 'delete',
      title: isFreelancer
        ? `Remove ${selectedIds.length} candidate${selectedIds.length > 1 ? 's' : ''}`
        : `Delete ${selectedIds.length} Candidate${selectedIds.length > 1 ? 's' : ''}`,
      message: isFreelancer
        ? `Remove ${selectedIds.length} selected candidate${selectedIds.length > 1 ? 's' : ''} from your candidate list?`
        : `Are you sure you want to delete ${selectedIds.length} selected candidate(s)? This action cannot be undone.`,
      confirmText: isFreelancer
        ? 'Remove'
        : `Delete ${selectedIds.length} Candidate${selectedIds.length > 1 ? 's' : ''}`,
      isLoading: false,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isLoading: true }));
        try {
          const res = await authenticatedFetch(`${API_URL}/bulk-delete`, {
            method: 'POST',
            body: JSON.stringify({ ids: selectedIds }),
          });
          const dataRes = await res.json();
          if (dataRes.success) {
            toast.success(
              dataRes.message
                || (dataRes.soft
                  ? `${dataRes.deletedCount} candidate${dataRes.deletedCount === 1 ? '' : 's'} removed.`
                  : `Deleted ${dataRes.deletedCount} of ${selectedIds.length} candidates.`)
            );
          } else toast.error(dataRes.message || 'Failed to delete candidates.');
          await refreshAfterBulk();
        } catch (err) {
          console.error('Bulk delete error:', err);
          toast.error('Failed to delete candidates.');
        } finally {
          setConfirmModal((prev) => ({ ...prev, isOpen: false, isLoading: false }));
        }
      },
    });
  }, [selectedIds, toast, API_URL, refreshAfterBulk, isFreelancer]);

  const applyBulkUpdates = useCallback(
    async (updates) => {
      const CHUNK = 2000;
      const ids = Array.isArray(selectedIds) ? selectedIds : [];
      if (!ids.length) throw new Error('No candidates selected');

      let matchedCount = 0;
      let modifiedCount = 0;
      let fields = Object.keys(updates || {});
      let lastError = null;

      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const res = await authenticatedFetch(`${API_URL}/bulk-update`, {
          method: 'POST',
          body: JSON.stringify({ ids: chunk, updates }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          lastError = new Error(data.message || `Bulk update failed on batch ${Math.floor(i / CHUNK) + 1}`);
          // Keep applying remaining batches when partial progress already happened
          if (matchedCount === 0 && modifiedCount === 0) throw lastError;
          break;
        }
        matchedCount += Number(data.matchedCount) || 0;
        modifiedCount += Number(data.modifiedCount) || 0;
        if (Array.isArray(data.fields) && data.fields.length) fields = data.fields;
      }

      if (lastError && matchedCount === 0) throw lastError;

      return {
        success: true,
        matchedCount,
        modifiedCount,
        fields,
        requested: ids.length,
        partial: Boolean(lastError),
        message: lastError
          ? `Updated ${modifiedCount} of ${matchedCount} before an error: ${lastError.message}`
          : `Updated ${modifiedCount} of ${matchedCount} candidates`,
      };
    },
    [API_URL, selectedIds]
  );

  const handleBulkStatusUpdate = useCallback(
    (newStatus) => {
      if (selectedIds.length === 0) return;
      setConfirmModal({
        isOpen: true,
        type: 'edit',
        title: 'Update Status',
        message: `Update status to "${newStatus}" for ${selectedIds.length} candidate(s)?`,
        confirmText: `Update to ${newStatus}`,
        isLoading: false,
        onConfirm: async () => {
          setConfirmModal((prev) => ({ ...prev, isLoading: true }));
          try {
            const data = await applyBulkUpdates({ status: newStatus });
            toast.success(
              `Updated ${data.modifiedCount ?? selectedIds.length} of ${data.matchedCount ?? selectedIds.length} to "${newStatus}".`
            );
            await refreshAfterBulk();
          } catch (err) {
            console.error('Bulk status update error:', err);
            toast.error(err.message || 'Failed to update status.');
          } finally {
            setConfirmModal((prev) => ({ ...prev, isOpen: false, isLoading: false }));
          }
        },
      });
    },
    [selectedIds, toast, applyBulkUpdates, refreshAfterBulk]
  );

  const openBulkEdit = useCallback(() => {
    if (selectedIds.length === 0) {
      toast.warning('Please select at least one candidate.');
      return;
    }
    setBulkStatusOpen(false);
    setBulkEditOpen(true);
  }, [selectedIds, toast]);

  const handleBulkEditSubmit = useCallback(
    async (updates) => {
      if (!updates || !Object.keys(updates).length) {
        toast.warning('Tick at least one field and choose a value.');
        return;
      }
      setBulkEditLoading(true);
      try {
        const data = await applyBulkUpdates(updates);
        const fields = (data.fields || Object.keys(updates)).join(', ');
        const msg = `Updated ${data.modifiedCount ?? 0} of ${data.matchedCount ?? selectedIds.length} candidates (${fields}).`;
        if (data.partial) toast.warning(data.message || msg);
        else toast.success(msg);
        setBulkEditOpen(false);
        await refreshAfterBulk();
      } catch (err) {
        toast.error(err.message || 'Bulk edit failed');
      } finally {
        setBulkEditLoading(false);
      }
    },
    [applyBulkUpdates, toast, selectedIds.length, refreshAfterBulk]
  );

  const handleDelete = useCallback(
    (id) => {
      const candidate = candidates.find((c) => c._id === id);
      setConfirmModal({
        isOpen: true,
        type: 'delete',
        title: isFreelancer ? 'Remove candidate' : 'Delete Candidate',
        message: isFreelancer
          ? `Remove “${candidate?.name || 'this candidate'}” from your candidate list?`
          : `Are you sure you want to delete "${candidate?.name || 'this candidate'}"? This action cannot be undone.`,
        confirmText: isFreelancer ? 'Remove' : 'Delete Candidate',
        isLoading: false,
        onConfirm: async () => {
          setConfirmModal((prev) => ({ ...prev, isLoading: true }));
          try {
            const response = await authenticatedFetch(`${API_URL}/${id}`, { method: 'DELETE' });
            if (isUnauthorized(response)) {
              handleUnauthorized();
              return;
            }
            if (response.ok) {
              const body = await response.json().catch(() => ({}));
              toast.success(
                body.message
                  || (body.soft ? 'Candidate removed.' : 'Deleted successfully!')
              );
              window.dispatchEvent(new CustomEvent('candidates:changed'));
              const pageToRestore = currentPage;
              await fetchData(1, { search: searchQuery, position: filterJob });
              setCurrentPage(pageToRestore);
            } else {
              const errorData = await response.json();
              toast.error(`Error: ${errorData.message}`);
            }
          } catch (err) {
            console.error('Delete Error:', err);
            toast.error('Network error: Could not reach the server.');
          } finally {
            setConfirmModal((prev) => ({ ...prev, isOpen: false, isLoading: false }));
          }
        },
      });
    },
    [candidates, API_URL, toast, currentPage, fetchData, searchQuery, filterJob, setCurrentPage, isFreelancer]
  );

  const handleFindDuplicates = useCallback(async () => {
    setDedupeLoading(true);
    setDedupeResults(null);
    try {
      const res = await authenticatedFetch(`${BASE_API_URL}/api/ai/dedupe`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const dataRes = await res.json();
      if (!res.ok) throw new Error(dataRes.message || 'Dedupe failed');
      setDedupeResults(dataRes.data);
      setShowDedupeModal(true);
      if (!dataRes.data?.groups?.length) toast.info('No likely duplicates found');
    } catch (err) {
      toast.error(err.message || 'Duplicate search failed');
    } finally {
      setDedupeLoading(false);
    }
  }, [toast]);

  const handleMergeDuplicates = useCallback(async ({ keepId, dropIds }) => {
    if (!keepId || !dropIds?.length) return;
    setDedupeMerging(true);
    try {
      const res = await authenticatedFetch(`${BASE_API_URL}/api/ai/dedupe/merge`, {
        method: 'POST',
        body: JSON.stringify({ keepId, dropIds }),
      });
      const dataRes = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(dataRes.message || 'Merge failed');

      toast.success(`Merged ${dropIds.length} duplicate${dropIds.length === 1 ? '' : 's'} into one record`);

      // Refresh groups so merged rows disappear
      const refresh = await authenticatedFetch(`${BASE_API_URL}/api/ai/dedupe`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const refreshData = await refresh.json().catch(() => ({}));
      if (refresh.ok) {
        setDedupeResults(refreshData.data || { groups: [] });
        if (!refreshData.data?.groups?.length) {
          setShowDedupeModal(false);
        }
      }

      window.dispatchEvent(new CustomEvent('candidates:changed'));
      await fetchData(1, { search: searchQuery, position: filterJob });
    } catch (err) {
      toast.error(err.message || 'Could not merge duplicates');
    } finally {
      setDedupeMerging(false);
    }
  }, [toast, fetchData, searchQuery, filterJob]);

  return {
    confirmModal,
    setConfirmModal,
    dedupeLoading,
    dedupeResults,
    showDedupeModal,
    setShowDedupeModal,
    dedupeMerging,
    handleFindDuplicates,
    handleMergeDuplicates,
    bulkEditOpen,
    setBulkEditOpen,
    bulkEditLoading,
    bulkStatusOpen,
    setBulkStatusOpen,
    sendWhatsApp,
    handleBulkWhatsApp,
    handleBulkDelete,
    handleBulkStatusUpdate,
    openBulkEdit,
    handleBulkEditSubmit,
    handleDelete,
  };
}
