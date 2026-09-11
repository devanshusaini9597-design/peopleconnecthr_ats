/** Clipboard + mail + WhatsApp share helpers (user-gesture safe). */

export async function copyToClipboard(text) {
  const value = String(text || '');
  if (!value) return false;
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      /* fall through to execCommand */
    }
  }
  try {
    const el = document.createElement('textarea');
    el.value = value;
    el.setAttribute('readonly', '');
    el.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(el);
    el.select();
    el.setSelectionRange(0, value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

function clickHref(href, { newTab = true } = {}) {
  const a = document.createElement('a');
  a.href = href;
  if (newTab) {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  }
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function openEmailShare({ to, subject, body }) {
  const email = String(to || '').trim();
  if (!email) return false;

  const buildHref = (includeBody) => {
    const params = new URLSearchParams();
    if (subject) params.set('subject', String(subject));
    if (includeBody && body) params.set('body', String(body));
    const qs = params.toString();
    return qs ? `mailto:${email}?${qs}` : `mailto:${email}`;
  };

  let href = buildHref(true);
  if (href.length > 2000) href = buildHref(false);

  try {
    window.location.href = href;
    return true;
  } catch {
    try {
      const a = document.createElement('a');
      a.href = href;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return true;
    } catch {
      return false;
    }
  }
}

export function openWhatsAppShare(text) {
  const value = String(text || '').trim();
  if (!value) return false;
  const href = `https://wa.me/?text=${encodeURIComponent(value)}`;
  clickHref(href);
  return true;
}
