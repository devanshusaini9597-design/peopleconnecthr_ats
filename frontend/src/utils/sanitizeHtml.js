const DANGEROUS_TAGS = /^(script|iframe|object|embed|link|meta|style|form|base|textarea|svg|math)$/i;

function isDangerousUrl(value) {
  return /^\s*(javascript|vbscript|data):/i.test(String(value || ''));
}

function isSafeDataImage(tag, value) {
  return tag === 'IMG' && /^\s*data:image\//i.test(String(value || ''));
}

/**
 * Strip executable markup from recruiter-authored HTML before rendering.
 * Used on public careers pages and in-app JD previews.
 */
export function sanitizeHtml(html) {
  if (!html) return '';
  const raw = String(html);
  if (typeof DOMParser === 'undefined') {
    return raw
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }

  const doc = new DOMParser().parseFromString(raw, 'text/html');
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType !== 1) return;
      if (DANGEROUS_TAGS.test(child.tagName)) {
        child.remove();
        return;
      }
      [...child.attributes].forEach((attr) => {
        const name = attr.name.toLowerCase();
        const value = attr.value || '';
        if (name.startsWith('on') || name === 'srcdoc' || name === 'formaction') {
          child.removeAttribute(attr.name);
          return;
        }
        if ((name === 'href' || name === 'src' || name === 'xlink:href') && isDangerousUrl(value) && !isSafeDataImage(child.tagName, value)) {
          child.removeAttribute(attr.name);
        }
      });
      walk(child);
    });
  };
  walk(doc.body);
  return doc.body.innerHTML;
}
