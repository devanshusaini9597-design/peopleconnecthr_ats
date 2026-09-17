/**
 * Load Cloudflare Turnstile and obtain a challenge token (Managed-friendly).
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
 * Show a visible Managed Turnstile challenge and return the token.
 * (Invisible/off-screen execute fails when Cloudflare requires interaction.)
 */
export async function getTurnstileToken(apiUrl) {
  const cfg = await fetchTurnstileConfig(apiUrl);
  if (!cfg.enabled) return '';

  const turnstile = await loadTurnstileScript();

  return new Promise((resolve, reject) => {
    let widgetId = null;
    let settled = false;

    const overlay = document.createElement('div');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Security check');
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:2147483646',
      'background:rgba(28,25,23,0.45)',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'padding:16px',
    ].join(';');

    const card = document.createElement('div');
    card.style.cssText = [
      'background:#fff',
      'border-radius:16px',
      'padding:20px',
      'width:min(380px,100%)',
      'box-shadow:0 24px 60px rgba(0,0,0,0.25)',
      'font-family:ui-sans-serif,system-ui,sans-serif',
    ].join(';');

    const title = document.createElement('p');
    title.textContent = 'Security check';
    title.style.cssText = 'margin:0 0 6px;font-size:15px;font-weight:700;color:#1c1917;';

    const hint = document.createElement('p');
    hint.textContent = 'Complete the check below to send your verification code.';
    hint.style.cssText = 'margin:0 0 14px;font-size:13px;line-height:1.4;color:#78716c;';

    const host = document.createElement('div');
    host.style.cssText = 'min-height:65px;display:flex;justify-content:center;';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    cancel.style.cssText = [
      'margin-top:14px',
      'width:100%',
      'border:1px solid #e7e5e4',
      'background:#fff',
      'border-radius:10px',
      'padding:10px 12px',
      'font-size:13px',
      'font-weight:600',
      'color:#44403c',
      'cursor:pointer',
    ].join(';');

    card.appendChild(title);
    card.appendChild(hint);
    card.appendChild(host);
    card.appendChild(cancel);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const cleanup = () => {
      try {
        if (widgetId != null && turnstile?.remove) turnstile.remove(widgetId);
      } catch { /* ignore */ }
      try { overlay.remove(); } catch { /* ignore */ }
    };

    const done = (fn, value) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      cleanup();
      fn(value);
    };

    const timer = window.setTimeout(() => {
      done(reject, new Error('Security check timed out. Please try again.'));
    }, 90000);

    cancel.addEventListener('click', () => {
      done(reject, new Error('Security check cancelled.'));
    });

    try {
      widgetId = turnstile.render(host, {
        sitekey: cfg.siteKey,
        theme: 'light',
        size: 'flexible',
        callback: (token) => {
          done(resolve, token || '');
        },
        'error-callback': (code) => {
          const codeStr = code != null ? String(code) : '';
          done(
            reject,
            new Error(
              codeStr
                ? `Security check failed (${codeStr}). Please refresh and try again.`
                : 'Security check failed. Please refresh and try again.',
            ),
          );
          return true;
        },
        'expired-callback': () => {
          done(reject, new Error('Security check expired. Please try again.'));
        },
        'timeout-callback': () => {
          done(reject, new Error('Security check timed out. Please try again.'));
        },
      });
    } catch (err) {
      done(reject, err instanceof Error ? err : new Error('Security check failed. Please try again.'));
    }
  });
}
