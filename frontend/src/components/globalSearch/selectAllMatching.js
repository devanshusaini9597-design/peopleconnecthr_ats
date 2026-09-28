function asId(value) {
  return String(value || '').trim();
}

function normalizeRows(rawRows, mapRows) {
  const rows = typeof mapRows === 'function'
    ? mapRows(rawRows)
    : (rawRows || []).map((row) => ({ ...row, _id: asId(row._id) }));
  return (rows || []).map((row) => ({ ...row, _id: asId(row._id) })).filter((row) => row._id);
}

/**
 * Instant select-all: flag only + current page IDs.
 * Do NOT push every matching id into React state — that freezes the UI on large sets.
 * Full id/row hydrate happens lazily in resolveMatchingPeople when a bulk action runs.
 */
export function selectAllMatching({
  pageIds = [],
  pageRows = [],
  setSelectedIds,
  setMatchPool,
  setAllMatching,
  mapRows,
  toast,
  expectedCount = 0,
  emptyWarning,
  successPrefix = 'Selected',
}) {
  const visible = [...new Set((pageIds || []).map(asId).filter(Boolean))];
  const pageSeed = normalizeRows(pageRows, mapRows).filter((row) => visible.includes(asId(row._id)));
  const expected = Math.max(0, Number(expectedCount) || 0);

  if (!visible.length && expected <= 0) {
    toast.warning(emptyWarning || 'No matching people to select.');
    setAllMatching?.(false);
    return { ids: [], rows: [], pending: Promise.resolve({ ids: [], rows: [] }) };
  }

  setAllMatching?.(true);
  setSelectedIds(visible);
  setMatchPool?.(pageSeed.length ? pageSeed : visible.map((id) => ({ _id: id })));

  const optimisticShown = expected || visible.length;
  if (optimisticShown > 0) {
    toast.success(
      `${successPrefix} all ${optimisticShown.toLocaleString()} matching ${optimisticShown === 1 ? 'result' : 'results'}.`
    );
  }

  return {
    ids: visible,
    rows: pageSeed,
    pending: Promise.resolve({ ids: visible, rows: pageSeed }),
  };
}

export async function loadMatchingRows(fetchMatching, entity, mapRows) {
  const result = await fetchMatching?.(entity);
  const rawRows = (result?.people?.length
    ? result.people
    : null)
    || (result?.rows?.length ? result.rows : null)
    || (result?.candidates?.length ? result.candidates : null)
    || (result?.contacts?.length ? result.contacts : null)
    || [];
  const rows = normalizeRows(rawRows, mapRows);
  const idList = (result?.ids || []).map(asId).filter(Boolean);
  const ids = [...new Set((rows.length ? rows.map((row) => asId(row._id)) : idList).filter(Boolean))];
  const byId = new Map(rows.map((row) => [asId(row._id), row]));
  const mergedIds = [...new Set([...ids, ...idList])];
  const hydrated = mergedIds.map((id) => byId.get(id) || { _id: id });
  return {
    ids: mergedIds,
    rows: hydrated,
    result,
    capped: Boolean(result?.capped),
  };
}

export async function resolveMatchingPeople({
  fetchMatching,
  entity,
  matchPool = [],
  selectedIds = [],
  allMatching = false,
  pageRows = [],
  mapRows,
  expectedCount = 0,
  pendingHydrate = null,
  onHydrated = null,
}) {
  if (pendingHydrate && typeof pendingHydrate.then === 'function') {
    try {
      await Promise.race([
        pendingHydrate.catch(() => null),
        new Promise((resolve) => setTimeout(resolve, 8000)),
      ]);
    } catch { /* ignore */ }
  }

  const selected = [...new Set((selectedIds || []).map(asId))];
  const expected = Number(expectedCount) || 0;
  const want = Math.max(selected.length, allMatching ? expected : 0);
  const pool = (matchPool || []).map((row) => ({ ...row, _id: asId(row._id) }));
  const pageSize = (pageRows || []).length;
  const pageHit = (pageRows || []).filter((row) => selected.includes(asId(row._id)));

  // Explicit page/manual selection only — never treat a partial pool as "all matching"
  // (expectedCount can be a floor / stale UI count and must not cap recipients).
  if (
    !allMatching
    && pool.length
    && selected.length
    && pool.length >= selected.length
    && selected.every((id) => pool.some((r) => asId(r._id) === id))
  ) {
    const allow = new Set(selected);
    return pool.filter((row) => allow.has(asId(row._id)));
  }

  const needsFullLoad =
    allMatching
    || (expected > 0 && selected.length >= expected && expected > pageSize)
    || selected.length > pageSize
    || (expected > pageHit.length && expected > 0);

  if (!needsFullLoad && pageHit.length === selected.length && selected.length) {
    return pageHit;
  }

  const loaded = await loadMatchingRows(fetchMatching, entity, mapRows);
  // Keep React state lean: only notify caller; do not force thousands of ids into selectedIds.
  if (typeof onHydrated === 'function' && loaded.ids.length) {
    try { onHydrated(loaded); } catch { /* ignore */ }
  }

  if (loaded.capped) {
    const err = new Error(
      `Only loaded ${loaded.rows.length.toLocaleString()} matching people so far — the list is still incomplete. Wait a moment and try again.`
    );
    err.code = 'MATCH_POOL_CAPPED';
    err.partialRows = loaded.rows;
    throw err;
  }

  if (allMatching) {
    const rows = loaded.rows.length ? loaded.rows : [];
    // A timed-out id page used to fall back to the visible page (often 50/100)
    // and the email step reported that page size as the whole selection.
    if (expected > pageSize && rows.length > 0 && rows.length <= pageSize && rows.length < expected) {
      const err = new Error('Could not load everyone matching this search. Try again in a moment.');
      err.code = 'MATCH_POOL_SHORT';
      throw err;
    }
    if (!rows.length && expected > pageSize) {
      const err = new Error('Could not load everyone matching this search. Try again in a moment.');
      err.code = 'MATCH_POOL_SHORT';
      throw err;
    }
    return rows.length ? rows : (pool.length ? pool : pageHit);
  }

  if (!selected.length) return loaded.rows;

  const allow = new Set(selected);
  const filtered = loaded.rows.filter((row) => allow.has(asId(row._id)));
  if (filtered.length >= selected.length) return filtered;
  if (loaded.rows.length >= want) return loaded.rows;
  return filtered.length ? filtered : (pageHit.length ? pageHit : loaded.rows);
}
