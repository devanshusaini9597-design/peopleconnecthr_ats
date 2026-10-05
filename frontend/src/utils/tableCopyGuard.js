/**
 * Stop drag-select + Ctrl+C from dumping a whole grid of phones/emails.
 * A single name or a single email/phone may still be copied on directories
 * that opt into shouldBlockBulkPiiCopy. Suggested talent blocks all copy.
 */

export function shouldBlockBulkPiiCopy(text) {
  const raw = String(text || '');
  if (!raw.trim()) return false;
  const lines = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const emails = (raw.match(/[^\s@]+@[^\s@]+\.[^\s@]+/gi) || []).length;
  const phones = (raw.match(/\b\d{8,}\b/g) || []).length;
  return lines.length > 1 || emails + phones > 1;
}

export function guardTableCopy(e) {
  const text = String(window.getSelection?.()?.toString() || '');
  if (!shouldBlockBulkPiiCopy(text)) return;
  e.preventDefault();
  e.stopPropagation();
}

/** Block copy / cut / drag of directory rows (PII). */
export function blockTableExfil(e) {
  e.preventDefault();
  e.stopPropagation();
  if (typeof e.clipboardData?.setData === 'function') {
    e.clipboardData.setData('text/plain', '');
  }
}
