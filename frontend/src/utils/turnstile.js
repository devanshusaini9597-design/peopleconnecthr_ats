/**
 * Load Cloudflare Turnstile and execute a challenge token.
 */
let scriptPromise = null;

function loadTurnstileScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const fail = (msg) => {
      scriptPromise = null;
      reject(new Error(msg));
    };

    const existing = document.querySelector('script[data-pch-turnstile]');
    if (existing) {
      if (window.turnstile) {
        resolve(window.turnstile);
        return;
      }
      existing.addEventListener('load', () => {
        if (window.turnstile) resolve(window.turnstile);
        else fail('Turnstile failed to initialize. Please refresh and try again.');
      });
      existing.addEventListener('error', () => {
        fail('Security check blocked. Allow challenges.cloudflare.com or disable blockers, then retry.');
      });
      return;
    }

    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.defer = true;
    s.dataset.pchTurnstile = '1';
    s.onload = () => {
      if (window.turnstile) resolve(window.turnstile);
      else fail('Turnstile failed to initialize. Please refresh and try again.');
    };
    s.onerror = () => {
      fail('Security check blocked. Allow challenges.cloudflare.com or disable blockers, then retry.');
    };
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
 * Widget mode (managed / non-interactive / invisible) is set in the Cloudflare dashboard.
 */
export async function getTurnstileToken(apiUrl) {
  const cfg = await fetchTurnstileConfig(apiUrl);
  if (!cfg.enabled) return '';

  const turnstile = await loadTurnstileScript();
  return new Promise((resolve, reject) => {
    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:fixed;left:0;bottom:0;z-index:2147483646;';
    document.body.appendChild(host);
    let widgetId = null;
    let settled = false;

    const cleanup = () => {
      try {
        if (widgetId != null && turnstile?.remove) turnstile.remove(widgetId);
      } catch { /* ignore */ }
      try { host.remove(); } catch { /* ignore */ }
    };

    const done = (fn, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn(value);
    };

    const timer = window.setTimeout(() => {
      done(reject, new Error('Security check timed out. Please try again.'));
    }, 45000);

    try {
      widgetId = turnstile.render(host, {
        sitekey: cfg.siteKey,
        appearance: 'interaction-only',
        execution: 'execute',
        callback: (token) => {
          window.clearTimeout(timer);
          done(resolve, token || '');
        },
        'error-callback': () => {
          window.clearTimeout(timer);
          done(reject, new Error('Security check failed. Please refresh and try again.'));
        },
        'expired-callback': () => {
          window.clearTimeout(timer);
          done(reject, new Error('Security check expired. Please try again.'));
        },
        'timeout-callback': () => {
          window.clearTimeout(timer);
          done(reject, new Error('Security check timed out. Please try again.'));
        },
      });
      turnstile.execute(widgetId);
    } catch (err) {
      window.clearTimeout(timer);
      done(reject, err instanceof Error ? err : new Error('Security check failed. Please try again.'));
    }
  });
}
