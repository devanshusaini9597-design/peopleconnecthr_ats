import { useEffect, useMemo, useState } from 'react';
import { fetchPicklist, PICKLIST_DROPDOWN_LIMIT } from './orgListFetch';
import { FLS_OPTIONS } from './deskDefaults';

function toOptions(rows) {
  return (rows || [])
    .map((row) => {
      const name = String(row?.name || row?.label || row || '').trim();
      if (!name) return null;
      const value = name.toUpperCase();
      return { value, label: value };
    })
    .filter(Boolean);
}

function dedupeOptions(options) {
  const seen = new Set();
  const out = [];
  for (const opt of options || []) {
    const key = String(opt?.value || '').toUpperCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ value: key, label: opt.label || key });
  }
  return out;
}

/**
 * Live org picklists for desk-default fields (same catalogs as Add Candidate).
 */
export default function useDeskDefaultOptions() {
  const [clientOptions, setClientOptions] = useState([]);
  const [sourceOptions, setSourceOptions] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [clients, sources, products] = await Promise.all([
          fetchPicklist('/api/clients', { limit: PICKLIST_DROPDOWN_LIMIT }).catch(() => []),
          fetchPicklist('/api/sources', { limit: PICKLIST_DROPDOWN_LIMIT }).catch(() => []),
          fetchPicklist('/api/org-lists/product', { limit: PICKLIST_DROPDOWN_LIMIT }).catch(() => []),
        ]);
        if (cancelled) return;
        setClientOptions(dedupeOptions(toOptions(clients)));
        setSourceOptions(dedupeOptions(toOptions(sources)));
        setProductOptions(dedupeOptions(toOptions(products)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const flsOptions = useMemo(() => FLS_OPTIONS, []);

  return {
    loading,
    flsOptions,
    clientOptions,
    sourceOptions,
    productOptions,
  };
}
