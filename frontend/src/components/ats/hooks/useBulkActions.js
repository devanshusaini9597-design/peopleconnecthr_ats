import { useCallback, useState } from 'react';

/**
 * Bulk selection helpers for candidate tables.
 */
export function useBulkActions(items = [], getId = (item) => item._id) {
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const toggle = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map(getId).filter(Boolean)));
  }, [items, getId]);

  const clear = useCallback(() => setSelectedIds(new Set()), []);

  const isSelected = useCallback((id) => selectedIds.has(id), [selectedIds]);

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    toggle,
    selectAll,
    clear,
    isSelected,
  };
}
