/**
 * Deduplicate master data (positions, clients, sources) by name so dropdowns
 * show one option per unique name (case-insensitive). Keeps first occurrence.
 * @param {Array<{ name: string, _id?: string, [key: string]: any }>} list
 * @returns {Array} Deduplicated list
 */
export function dedupeByName(list) {
  if (!Array.isArray(list) || list.length === 0) return list;
  const seen = new Set();
  return list.filter((item) => {
    const name = (item && item.name != null) ? String(item.name).trim() : '';
    const key = name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
