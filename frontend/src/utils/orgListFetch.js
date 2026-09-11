import { authenticatedFetch, isUnauthorized, handleUnauthorized } from './fetchUtils';

export const PICKLIST_DROPDOWN_LIMIT = 40;
export const PICKLIST_SEARCH_LIMIT = 40;
export const PICKLIST_MIN_SEARCH = 2;

export function unwrapPicklist(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function picklistQuery(params = {}) {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', String(params.q).trim());
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  const suffix = qs.toString();
  return suffix ? `/all?${suffix}` : '/all';
}

/** Load an org picklist. Starter values are added only via "Load starter set". */
export async function fetchPicklist(apiEndpoint, params = {}) {
  if (!apiEndpoint) return [];
  const res = await authenticatedFetch(`${apiEndpoint}${picklistQuery(params)}`);
  if (isUnauthorized(res)) {
    handleUnauthorized();
    return [];
  }
  if (!res.ok) {
    const err = new Error(res.status === 404 ? 'not_found' : 'load_failed');
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return unwrapPicklist(data);
}

export async function fetchPicklistPage(apiEndpoint, { q = '', page = 1, limit = 20 } = {}) {
  if (!apiEndpoint) return { items: [], total: 0, page: 1, limit };
  const res = await authenticatedFetch(`${apiEndpoint}${picklistQuery({ q, page, limit })}`);
  if (isUnauthorized(res)) {
    handleUnauthorized();
    return { items: [], total: 0, page, limit };
  }
  if (!res.ok) {
    const err = new Error(res.status === 404 ? 'not_found' : 'load_failed');
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  if (Array.isArray(data)) {
    return { items: data, total: data.length, page: 1, limit: data.length || limit };
  }
  return {
    items: Array.isArray(data.items) ? data.items : [],
    total: Number(data.total) || 0,
    page: Number(data.page) || page,
    limit: Number(data.limit) || limit,
  };
}

export function namesToSelectOptions(items) {
  const seen = new Set();
  const out = [];
  for (const item of items || []) {
    const name = String(item?.name || item?.label || item?.value || item || '').trim().toUpperCase();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({ value: name, label: name });
  }
  return out;
}

export async function searchPicklistOptions(apiEndpoint, q, limit = PICKLIST_SEARCH_LIMIT) {
  const items = await fetchPicklist(apiEndpoint, { q, page: 1, limit });
  return namesToSelectOptions(items);
}
