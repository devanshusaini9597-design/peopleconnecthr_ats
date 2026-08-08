export function insertAtCursor(el, value, token) {
  if (!el) {
    const base = String(value || '');
    if (!base) return token;
    const needsSpace = !/\s$/.test(base);
    return `${base}${needsSpace ? ' ' : ''}${token}`;
  }
  const start = el.selectionStart ?? String(value || '').length;
  const end = el.selectionEnd ?? start;
  const before = String(value || '').slice(0, start);
  const after = String(value || '').slice(end);
  const needsSpace = before.length > 0 && !/\s$/.test(before) && !/^\s/.test(token);
  const insert = `${needsSpace ? ' ' : ''}${token}`;
  const next = `${before}${insert}${after}`;
  requestAnimationFrame(() => {
    try {
      const pos = before.length + insert.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    } catch {
      /* ignore */
    }
  });
  return next;
}

export function stripToken(text, key) {
  const re = new RegExp(`\\s*\\{\\{${key}\\}\\}`, 'g');
  return String(text || '').replace(re, '').replace(/\s{2,}/g, ' ').trim();
}
