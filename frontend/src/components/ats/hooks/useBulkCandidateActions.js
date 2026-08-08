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
      title: `Delete ${selectedIds.length} Candidate${selectedIds.length > 1 ? 's' : ''}`,
      message: `Are you sure you want to delete ${selectedIds.length} selected candidate(s)? This action cannot be undone.`,
      confirmText: `Delete ${selectedIds.length} Candidate${selectedIds.length > 1 ? 's' : ''}`,
      isLoading: false,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isLoading: true }));
        try {
          const res = await authenticatedFetch(`${API_URL}/bulk-delete`, {
            method: 'POST',
            body: JSON.stringify({ ids: selectedIds }),
          });
          const dataRes = await res.json();
          if (dataRes.success) toast.success(`Deleted ${dataRes.deletedCount} of ${selectedIds.length} candidates.`);
          else toast.error(dataRes.message || 'Failed to delete candidates.');
          setSelectedIds([]);
          const pageToRestore = currentPage;
          await fetchData(1, { search: searchQuery, position: filterJob });
          setCurrentPage(pageToRestore);
        } catch (err) {
          console.error('Bulk delete error:', err);
          toast.error('Failed to delete candidates.');
        } finally {
          setConfirmModal((prev) => ({ ...prev, isOpen: false, isLoading: false }));
        }
      },
    });
  }, [selectedIds, toast, API_URL, setSelectedIds, currentPage, fetchData, searchQuery, filterJob, setCurrentPage]);

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
            let updated = 0;
            for (const id of selectedIds) {
              const res = await authenticatedFetch(`${API_URL}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
              });
              if (res.ok) updated++;
            }
            toast.success(`Updated ${updated} of ${selectedIds.length} candidates to "${newStatus}".`);
            setSelectedIds([]);
            const pageToRestore = currentPage;
            await fetchData(1, { search: searchQuery, position: filterJob });
            setCurrentPage(pageToRestore);
          } catch (err) {
            console.error('Bulk status update error:', err);
            toast.error('Failed to update some candidates.');
          } finally {
            setConfirmModal((prev) => ({ ...prev, isOpen: false, isLoading: false }));
          }
        },
      });
    },
    [selectedIds, toast, API_URL, setSelectedIds, currentPage, fetchData, searchQuery, filterJob, setCurrentPage]
  );

  const handleDelete = useCallback(
    (id) => {
      const candidate = candidates.find((c) => c._id === id);
      setConfirmModal({
        isOpen: true,
        type: 'delete',
        title: 'Delete Candidate',
        message: `Are you sure you want to delete "${candidate?.name || 'this candidate'}"? This action cannot be undone.`,
        confirmText: 'Delete Candidate',
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
              toast.success('Deleted successfully!');
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
    [candidates, API_URL, toast, currentPage, fetchData, searchQuery, filterJob, setCurrentPage]
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

  return {
    confirmModal,
    setConfirmModal,
    dedupeLoading,
    dedupeResults,
    showDedupeModal,
    setShowDedupeModal,
    sendWhatsApp,
    handleBulkWhatsApp,
    handleBulkDelete,
    handleBulkStatusUpdate,
    handleDelete,
    handleFindDuplicates,
  };
}
