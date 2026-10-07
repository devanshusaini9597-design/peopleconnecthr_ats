/** node scripts/qa-staging-pack15.js --staging */
const API = process.env.STAGING_API_URL || 'https://peopleconnecthr-ats-production.up.railway.app';

async function req(path, { method = 'GET', cookie, body, timeoutMs = 25000, form } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body && !form) headers['Content-Type'] = 'application/json';
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await Promise.race([
      fetch(`${API}${path}`, {
        method,
        headers,
        body: form || (body ? JSON.stringify(body) : undefined),
        signal: ac.signal,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs + 500)),
    ]);
    const setCookie = res.headers.getSetCookie?.() || [];
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* ignore */ }
    return { status: res.status, json, text: text.slice(0, 220), setCookie };
  } catch (err) {
    return { status: 0, json: null, text: String(err.message || err).slice(0, 220), setCookie: [] };
  } finally {
    clearTimeout(t);
  }
}

function cookieFrom(setCookie) {
  const line = (setCookie || []).find((c) => c.startsWith('ats_token='));
  return line ? line.split(';')[0] : '';
}

async function login(email, password) {
  const start = await req('/api/login', { method: 'POST', body: { email, password } });
  return { cookie: cookieFrom(start.setCookie), status: start.status };
}

(async () => {
  if (!process.argv.includes('--staging')) process.exit(1);
  const owner = await login('skillnix.qa+a.owner@gmail.com', 'TestCompanyA1');
  const rec = await login('skillnix.qa+a.hr_recruiter@gmail.com', 'TestCompanyA1');
  const fl = await login('skillnix.qa+a.freelancer@gmail.com', 'TestCompanyA1');
  const ownerB = await login('skillnix.qa+b.owner@gmail.com', 'TestCompanyB1');
  const out = { logins: { a: owner.status, rec: rec.status, fl: fl.status, b: ownerB.status } };

  out.turnstile = (await req('/api/careers/turnstile-config')).status;
  out.jobsXml = (await req('/api/careers/jobs.xml')).status;
  out.orgXml = (await req('/api/careers/test-company-a/jobs.xml')).status;
  out.sitemap = (await req('/api/careers/sitemap.xml')).status;
  out.robots = (await req('/api/careers/robots.txt')).status;
  const careers = await req('/api/careers/test-company-a');
  const job = (careers.json?.data?.jobs || [])[0];
  const jobId = job?._id || job?.id || job?.publicId;
  out.jobDetail = jobId ? (await req(`/api/careers/test-company-a/jobs/${jobId}`)).status : null;
  const applyEmpty = jobId
    ? await req(`/api/careers/test-company-a/jobs/${jobId}/apply`, { method: 'POST', body: {} })
    : { status: null, json: {} };
  out.applyEmpty = { status: applyEmpty.status, msg: applyEmpty.json?.message };
  out.appStatus = jobId
    ? (await req(`/api/careers/test-company-a/jobs/${jobId}/application-status?email=nobody@example.com`)).status
    : null;

  out.resetBad = (await req('/api/auth/reset-password', { method: 'POST', body: { token: 'x', password: 'short' } })).status;
  out.unsubBad = (await req('/api/public/unsubscribe', { method: 'POST', body: {} })).status;
  out.unsubConfirm = (await req('/api/public/unsubscribe/confirm?token=deadbeef')).status;
  out.subConfirm = (await req('/api/public/subscribe/confirm?token=deadbeef')).status;
  out.campaign = (await req('/api/public/campaign-content/000000000000000000000000')).status;

  out.profile = (await req('/api/profile', { cookie: owner.cookie })).status;
  const me = (await req('/api/profile', { cookie: owner.cookie })).json;
  const name = me?.user?.name || me?.data?.name || me?.name;
  out.profilePut = name
    ? (await req('/api/profile', { method: 'PUT', cookie: owner.cookie, body: { name } })).status
    : null;
  out.cands = (await req('/api/candidates?limit=5&q=java', { cookie: owner.cookie })).status;
  out.candsBleak = (await req('/api/candidates?limit=5&q=qa.seed.stg-b', { cookie: owner.cookie })).status;
  out.emailSend = (await req('/api/email/send', { method: 'POST', cookie: rec.cookie, body: {} })).status;
  out.flMandates = (await req('/api/freelancer/mandates', { cookie: fl.cookie })).status;
  out.referrals = (await req('/api/referrals', { cookie: owner.cookie })).status;
  out.offers = (await req('/api/offer-templates', { cookie: owner.cookie })).status;
  out.companyEmail = (await req('/api/company-email-settings', { cookie: owner.cookie })).status;
  out.export = (await req('/api/export', { cookie: rec.cookie })).status;
  out.exportRo = (await req('/api/export', {
    cookie: (await login('skillnix.qa+a.readonly@gmail.com', 'TestCompanyA1')).cookie,
  })).status;

  console.log(JSON.stringify(out, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
