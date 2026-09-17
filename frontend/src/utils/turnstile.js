/**
 * Load Cloudflare Turnstile and execute a challenge token.
 */
let scriptPromise = null;

function loadTurnstileScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-pch-turnstile]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.turnstile));
      existing.addEventListener('error', () => reject(new Error('Turnstile script failed')));
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.defer = true;
    s.dataset.pchTurnstile = '1';
    s.onload = () => resolve(window.turnstile);
    s.onerror = () => reject(new Error('Turnstile script failed'));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * @returns {Promise<{ enabled: boolean, siteKey: string }>}
 */
export async function fetchTurnstileConfig(apiUrl) {
  try {
    const res = await fetch(`${apiUrl}/api/careers/turnstile-config`);
    const data = await res.json().catch(() => ({}));
    return {
      enabled: Boolean(data.enabled && data.siteKey),
      siteKey: data.siteKey || '',
    };
  } catch {
    return { enabled: false, siteKey: '' };
  }
}

/**
 * Execute Turnstile and return a token, or '' when CAPTCHA is not enabled.
 */
export async function getTurnstileToken(apiUrl) {
  const cfg = await fetchTurnstileConfig(apiUrl);
  if (!cfg.enabled) return '';

  const turnstile = await loadTurnstileScript();
  return new Promise((resolve, reject) => {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;';
    document.body.appendChild(host);
    let widgetId = null;
    const cleanup = () => {
      try {
        if (widgetId != null && turnstile?.remove) turnstile.remove(widgetId);
      } catch { /* ignore */ }
      host.remove();
    };
    try {
      widgetId = turnstile.render(host, {
        sitekey: cfg.siteKey,
        size: 'invisible',
        callback: (token) => {
          cleanup();
          resolve(token || '');
        },
        'error-callback': () => {
          cleanup();
          reject(new Error('Security check failed. Please try again.'));
        },
        'expired-callback': () => {
          cleanup();
          reject(new Error('Security check expired. Please try again.'));
        },
      });
      turnstile.execute(widgetId);
    } catch (err) {
      cleanup();
      reject(err);
    }
  });
}
