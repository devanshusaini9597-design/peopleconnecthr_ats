/**
 * Read-only live security probes. No login, no file upload, no XSS/malware payloads.
 * Expects 401/403/400 from protected routes. Never writes application data.
 *
 * Production customer records are not an attack lab: do not upload malware or
 * inject scripts here. Those checks live in Jest (uploadAllowlist, isolation).
 *
 * Usage: node scripts/live-security-readonly.js
 */
const API = process.env.LIVE_API_URL || 'https://peopleconnecthrats-production.up.railway.app';
const WEB = process.env.LIVE_WEB_URL || 'https://www.peopleconnecthr.com';

const results = [];

async function probe(name, url, opts = {}, expectFn) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: opts.method || 'GET',
      headers: { Accept: 'application/json', ...(opts.headers || {}) },
      body: opts.body,
      redirect: 'manual',
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* non-json ok */ }
    const row = {
      name,
      status: res.status,
      ms: Date.now() - started,
      code: json?.code || null,
      hasSetCookie: Boolean(res.headers.get('set-cookie')),
    };
    const ok = expectFn(row, res, text, json);
    results.push({ ...row, ok, snippet: text.slice(0, 80).replace(/\s+/g, ' ') });
  } catch (err) {
    results.push({ name, ok: false, status: 0, error: err.message });
  }
}

function expectStatus(...codes) {
  return (row) => codes.includes(row.status);
}

async function main() {
  await probe('health', `${API}/health`, {}, expectStatus(200));

  const locked = [
    '/api/profile',
    '/api/candidates',
    '/api/candidates/000000000000000000000001',
    '/api/candidates/000000000000000000000001/resume',
    '/api/organization/members',
    '/api/organization/usage',
    '/api/organization',
    '/api/auth/sessions',
    '/api/freelancer/desk',
    '/api/freelancer/submissions',
    '/api/applications',
    '/api/team',
    '/api/analytics/dashboard-stats',
    '/api/security/settings',
    '/api/jobs',
    '/api/export/preview',
  ];
  for (const path of locked) {
    await probe(`unauth GET ${path}`, `${API}${path}`, {}, expectStatus(401, 403));
  }

  await probe('unauth POST import-all-to-mine', `${API}/api/candidates/import-all-to-mine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  }, expectStatus(401, 403));

  await probe('unauth POST bulk-delete', `${API}/api/candidates/bulk-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"ids":[]}',
  }, expectStatus(401, 403));

  await probe('unauth POST login empty', `${API}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  }, (row) => [400, 401].includes(row.status) && !row.hasSetCookie);

  await probe('unauth POST login unknown email', `${API}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'not-a-user@example.invalid', password: 'WrongPass1!' }),
  }, (row) => [400, 401, 404].includes(row.status) && !row.hasSetCookie);

  await probe('unauth POST refresh', `${API}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  }, expectStatus(401, 403));

  await probe('unsigned whatsapp webhook', `${API}/api/whatsapp/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"object":"whatsapp_business_account"}',
  }, expectStatus(401, 403, 400));

  await probe('frontend home', `${WEB}/`, {}, (row, res) => {
    const csp = res.headers.get('content-security-policy') || '';
    row.cspScriptSelf = /script-src[^;]*'self'/.test(csp);
    row.cspNoScriptInline = !/script-src[^;]*unsafe-inline/.test(csp);
    row.cspBlobPreview = /frame-src[^;]*blob:/.test(csp) && /object-src[^;]*blob:/.test(csp);
    return row.status === 200 && row.cspScriptSelf && row.cspNoScriptInline && row.cspBlobPreview;
  });

  const failed = results.filter((r) => !r.ok);
  const passed = results.filter((r) => r.ok);
  console.log(JSON.stringify({
    api: API,
    web: WEB,
    passed: passed.length,
    failed: failed.length,
    total: results.length,
    failures: failed,
    sample: passed.slice(0, 5),
  }, null, 2));
  if (failed.length) process.exit(1);
}

main();
