import React, { createContext, useContext, useCallback, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch, handleUnauthorized, isUnauthorized } from '../../../utils/fetchUtils';
import { PAGE_SIZE } from '../pendingReviewConstants';

const PendingReviewContext = createContext(null);

export const usePendingReview = () => {
  const context = useContext(PendingReviewContext);
  if (!context) {
    throw new Error('usePendingReview must be used within PendingReviewProvider');
  }
  return context;
};

export const PendingReviewProvider = ({ children }) => {
  const queryClient = useQueryClient();
  
  // Local UI state
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bucket, setBucket] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [showOriginals, setShowOriginals] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editErrors, setEditErrors] = useState({});
  const [confirmModal, setConfirmModal] = useState({ isOpen: false });

  // Query key factory
  const queryKeys = {
    pending: (category, search, pageNum) => ['pending', category, search, pageNum],
    stats: () => ['pending-stats'],
    master: () => ['pending-master'],
  };

  // Fetch pending records
  const fetchPendingRecords = useCallback(async ({ queryKey }) => {
    const [, category, search, pageNum] = queryKey;
    const params = new URLSearchParams({
      page: String(pageNum),
      limit: String(PAGE_SIZE),
      ...(category !== 'all' ? { category } : {}),
      ...(search ? { search } : {}),
    });
    const res = await authenticatedFetch(`/candidates/pending?${params}`);
    if (isUnauthorized(res)) {
      handleUnauthorized();
      throw new Error('Unauthorized');
    }
    const data = await res.json().catch(() => ({}));
    if (!data.success) throw new Error(data.message || 'Failed to load');
    return data;
  }, []);

  const pendingQuery = useQuery({
    queryKey: queryKeys.pending(bucket, query, page),
    queryFn: fetchPendingRecords,
    keepPreviousData: true,
    staleTime: 30000, // 30 seconds
  });

  // Fetch master data (positions, clients, sources)
  const fetchMasterData = useCallback(async () => {
    const [p, c, s] = await Promise.all([
      authenticatedFetch('/api/positions'),
      authenticatedFetch('/api/clients'),
      authenticatedFetch('/api/sources'),
    ]);
    const positions = p.ok ? await p.json().catch(() => []) : [];
    const clients = c.ok ? await c.json().catch(() => []) : [];
    const sources = s.ok ? await s.json().catch(() => []) : [];
    return { positions, clients, sources };
  }, []);

  const masterQuery = useQuery({
    queryKey: queryKeys.master(),
    queryFn: fetchMasterData,
    staleTime: 300000, // 5 minutes
  });

  // Update record mutation
  const updateRecordMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await authenticatedFetch(`/candidates/pending/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to save');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(queryKeys.pending(bucket, query, page));
    },
  });

  // Delete records mutation
  const deleteRecordsMutation = useMutation({
    mutationFn: async (ids) => {
      const res = await authenticatedFetch('/candidates/pending/delete', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.success) throw new Error(data.message || 'Delete failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(queryKeys.pending(bucket, query, page));
      setSelectedIds(new Set());
    },
  });

  // Import records mutation
  const importRecordsMutation = useMutation({
    mutationFn: async (ids) => {
      const res = await authenticatedFetch('/candidates/pending/import', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.success) throw new Error(data.message || 'Import failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(queryKeys.pending(bucket, query, page));
      setSelectedIds(new Set());
      setEditing(null);
    },
  });

  // Clear all mutation
  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const res = await authenticatedFetch('/candidates/pending/clear-all', {
        method: 'POST',
        body: '{}',
      });
      const data = await res.json().catch(() => ({}));
      if (!data.success) throw new Error(data.message || 'Clear failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(queryKeys.pending(bucket, query, page));
      setSelectedIds(new Set());
      setPage(1);
    },
  });

  // Actions
  const changeBucket = useCallback((newBucket) => {
    setBucket(newBucket);
    setPage(1);
    setSelectedIds(new Set());
  }, []);

  const changeSearch = useCallback((newQuery) => {
    setQuery(newQuery);
    setPage(1);
    setSelectedIds(new Set());
  }, []);

  const changePage = useCallback((newPage) => {
    setPage(newPage);
    setSelectedIds(new Set());
  }, []);

  const toggleRow = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const togglePage = useCallback((allRows) => {
    const allSelected = allRows.length > 0 && allRows.every((r) => selectedIds.has(r._id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allRows.map((r) => r._id)));
    }
  }, [selectedIds]);

  const selectImportReady = useCallback((rows, isImportReady) => {
    setSelectedIds(new Set(rows.filter(isImportReady).map((r) => r._id)));
  }, []);

  const openEdit = useCallback((row) => {
    setEditing({ ...row });
    setEditErrors({});
  }, []);

  const updateEdit = useCallback((field, value) => {
    setEditing((prev) => ({ ...prev, [field]: value }));
    setEditErrors((prev) => ({ ...prev, [field]: '' }));
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editing?._id) return;
    await updateRecordMutation.mutateAsync({ id: editing._id, data: editing });
    setEditing(null);
  }, [editing, updateRecordMutation]);

  const runDelete = useCallback((ids) => {
    const list = Array.isArray(ids) ? ids : [ids];
    setConfirmModal({
      isOpen: true,
      type: 'delete',
      title: `Delete ${list.length} record${list.length > 1 ? 's' : ''}?`,
      message: 'This removes them from Pending Review only. Candidates already in ATS are not affected.',
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await deleteRecordsMutation.mutateAsync(list);
          setConfirmModal({ isOpen: false });
        } catch (err) {
          console.error(err);
        }
      },
    });
  }, [deleteRecordsMutation]);

  const runImport = useCallback((ids) => {
    const list = Array.isArray(ids) ? ids : [ids];
    if (!list.length) return;
    setConfirmModal({
      isOpen: true,
      type: 'success',
      title: `Import ${list.length} to Candidates?`,
      message: 'Selected pending rows move into your Candidates list. Same email updates the existing record (no duplicates).',
      confirmText: `Import ${list.length}`,
      onConfirm: async () => {
        setConfirmModal({ isOpen: false });
        try {
          await importRecordsMutation.mutateAsync(list);
        } catch (err) {
          console.error(err);
        }
      },
    });
  }, [importRecordsMutation]);

  const clearAll = useCallback((total) => {
    setConfirmModal({
      isOpen: true,
      type: 'delete',
      title: 'Clear entire pending queue?',
      message: `This permanently removes all ${total.toLocaleString()} pending records for your account.`,
      confirmText: 'Clear all',
      onConfirm: async () => {
        try {
          await clearAllMutation.mutateAsync();
          setConfirmModal({ isOpen: false });
        } catch (err) {
          console.error(err);
        }
      },
    });
  }, [clearAllMutation]);

  const importFromEdit = useCallback(async () => {
    if (!editing?._id) return;
    await saveEdit();
    runImport([editing._id]);
  }, [editing, saveEdit, runImport]);

  const value = useMemo(() => ({
    // Data
    rows: pendingQuery.data?.candidates || [],
    total: pendingQuery.data?.total || 0,
    stats: pendingQuery.data?.stats || { review: 0, blocked: 0, total: 0 },
    isLoading: pendingQuery.isLoading,
    isError: pendingQuery.isError,
    error: pendingQuery.error,
    
    // Master data
    positions: masterQuery.data?.positions || [],
    clients: masterQuery.data?.clients || [],
    sources: masterQuery.data?.sources || [],
    
    // UI state
    selectedIds,
    bucket,
    query,
    page,
    showOriginals,
    editing,
    editErrors,
    confirmModal,
    
    // Mutation states
    isSaving: updateRecordMutation.isLoading,
    isDeleting: deleteRecordsMutation.isLoading,
    isImporting: importRecordsMutation.isLoading,
    isClearing: clearAllMutation.isLoading,
    
    // Actions
    setBucket: changeBucket,
    setQuery: changeSearch,
    setPage: changePage,
    setShowOriginals,
    setSelectedIds,
    toggleRow,
    togglePage,
    selectImportReady,
    openEdit,
    updateEdit,
    saveEdit,
    runDelete,
    runImport,
    clearAll,
    importFromEdit,
    setEditing,
    setEditErrors,
    setConfirmModal,
    
    // Refetch
    refetch: () => queryClient.invalidateQueries(queryKeys.pending(bucket, query, page)),
  }), [
    pendingQuery,
    masterQuery,
    selectedIds,
    bucket,
    query,
    page,
    showOriginals,
    editing,
    editErrors,
    confirmModal,
    updateRecordMutation,
    deleteRecordsMutation,
    importRecordsMutation,
    clearAllMutation,
    changeBucket,
    changeSearch,
    changePage,
    toggleRow,
    togglePage,
    selectImportReady,
    openEdit,
    updateEdit,
    saveEdit,
    runDelete,
    runImport,
    clearAll,
    importFromEdit,
    queryClient,
  ]);

  return (
    <PendingReviewContext.Provider value={value}>
      {children}
    </PendingReviewContext.Provider>
  );
};
