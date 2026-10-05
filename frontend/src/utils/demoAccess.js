const DEMO_KEY_STORAGE = 'pc-demo-access-key';

export function getDemoAccessKey() {
  try {
    return String(sessionStorage.getItem(DEMO_KEY_STORAGE) || '').trim();
  } catch {
    return '';
  }
}

export function storeDemoAccessKey(key) {
  try {
    const k = String(key || '').trim();
    if (k) sessionStorage.setItem(DEMO_KEY_STORAGE, k);
  } catch {
    /* ignore */
  }
}

export function clearDemoAccessKey() {
  try {
    sessionStorage.removeItem(DEMO_KEY_STORAGE);
  } catch {
    /* ignore */
  }
}

export function demoKeyHeaders(extra = {}) {
  const k = getDemoAccessKey();
  return k ? { ...extra, 'X-Demo-Key': k } : { ...extra };
}

export function demoRolesHref() {
  const k = getDemoAccessKey();
  return k ? `/demo?k=${encodeURIComponent(k)}` : '/demo';
}
