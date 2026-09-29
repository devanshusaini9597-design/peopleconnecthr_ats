/**
 * Turn recruiter plain-text drafts into premium, Outlook-safe HTML.
 * Keep in sync with frontend/src/utils/emailBodyHtml.js
 */

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cleanHref(url) {
  return String(url || '').trim().replace(/[?&]+$/g, '');
}

const DETAIL_LABELS = new Set([
  'role',
  'job title',
  'position',
  'job id',
  'job code',
  'employer',
  'company',
  'organization',
  'ctc',
  'compensation',
  'salary',
  'experience',
  'location',
  'locations',
  'department',
  'date',
  'time',
  'venue',
  'mode',
  'spoc',
]);

const TITLE_LABELS = new Set(['role', 'job title', 'position', 'location', 'locations', 'department', 'employer']);

function displayLabel(key) {
  const k = String(key || '').trim();
  if (/^ctc$/i.test(k)) return 'Compensation';
  if (/^job id$/i.test(k) || /^job code$/i.test(k)) return 'Job ID';
  return k;
}

function titleCasePhrase(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^a leading\b/i.test(raw)) return raw.charAt(0).toLowerCase() + raw.slice(1);
  if (/https?:\/\//i.test(raw)) return raw;
  if (/^[A-Z0-9]+-\d{4}-\d+/i.test(raw)) return raw.toUpperCase();
  let s = raw.replace(/\s+/g, ' ');
  s = s.replace(/\bYEARS?\b/gi, 'years');
  s = s.replace(/\bLPA\b/gi, 'LPA');
  s = s.replace(/(\d)\s*-\s*(\d)/g, '$1–$2');
  if (/^\d/.test(s) && /lpa|l\b|ctc/i.test(s)) return s;
  if (/^\d/.test(s) && /year/i.test(s)) return s;
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\b(Of|And|The|For|In|At|To)\b/g, (m) => m.toLowerCase())
    .replace(/^./, (m) => m.toUpperCase());
}

function formatDetailValue(label, value) {
  const key = String(label || '').trim().toLowerCase();
  const v = String(value || '').trim();
  if (!v) return '';
  if (TITLE_LABELS.has(key)) return titleCasePhrase(v);
  if (key === 'experience') return titleCasePhrase(v);
  if (key === 'ctc' || key === 'compensation' || key === 'salary') return v.replace(/-/g, '–');
  return v;
}

function isDetailLine(line) {
  const m = String(line || '').trim().match(/^[•●\-]?\s*([A-Za-z][A-Za-z0-9\s/&]{0,28}):\s+(.+)$/);
  if (!m) return null;
  const label = m[1].trim();
  const value = m[2].trim();
  if (!value || /^[–—\-.]+$/.test(value)) return null;
  if (/subscribe/i.test(label)) return null;
  if (!DETAIL_LABELS.has(label.toLowerCase()) && !/^[A-Z][A-Za-z\s]{1,24}$/.test(label)) return null;
  if (/^https?:\/\//i.test(value) && /apply|subscribe|link|url/i.test(label)) return null;
  if (/^https?:\/\//i.test(value) && !DETAIL_LABELS.has(label.toLowerCase())) return null;
  return { label, value };
}

function isApplyCue(line) {
  return /^(apply here|apply using the link below|apply now|view (this )?role|apply using this link)\s*:?\s*$/i.test(
    String(line || '').trim()
  );
}

function extractUrl(line) {
  const m = String(line || '').trim().match(/https?:\/\/[^\s<]+/i);
  if (!m) return '';
  return cleanHref(m[0].replace(/[),.;]+$/g, ''));
}

function normalizeGreeting(line) {
  let t = String(line || '').trim();
  t = t.replace(/^Dear\s*(there|candidate)?\s*,?\s*$/i, 'Dear Candidate,');
  t = t.replace(/^Dear\s+there\s*,?/i, 'Dear Candidate,');
  t = t.replace(/^Hi\s+there\s*,?/i, 'Hello,');
  if (!/,\s*$/.test(t) && /^Dear\b/i.test(t)) t = `${t.replace(/[,.\s]+$/, '')},`;
  return t;
}

/**
 * Solid CTA — full-width on narrow clients via .em-btn class.
 */
function ctaButtonHtml(href, accent) {
  const url = cleanHref(href);
  if (!/^https?:\/\//i.test(url)) return '';
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  return `<table role="presentation" class="em-btn" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 8px 0;">
  <tr>
    <td align="center" style="padding:0;">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escapeHtml(url)}" style="height:48px;v-text-anchor:middle;width:280px;" arcsize="12%" stroke="f" fillcolor="${accent}">
        <w:anchorlock/>
        <center style="color:#ffffff;font-family:Segoe UI,sans-serif;font-size:15px;font-weight:600;">View role &amp; apply</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-- -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:320px;margin:0 auto;">
        <tr>
          <td align="center" bgcolor="${accent}" style="background-color:${accent};border-radius:8px;mso-padding-alt:14px 28px;">
            <a class="em-btn-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="display:block;padding:15px 28px;font-family:${font};font-size:15px;font-weight:600;letter-spacing:0.01em;color:#ffffff !important;text-decoration:none;text-align:center;line-height:1.3;">View role &amp; apply</a>
          </td>
        </tr>
      </table>
      <!--<![endif]-->
    </td>
  </tr>
</table>
<p style="margin:0 0 18px 0;text-align:center;font-family:${font};font-size:12px;line-height:1.55;color:#94a3b8;">Prefer email? Reply to this message to be considered.</p>`;
}

/**
 * Enterprise role / details card — accent rail, clear hierarchy, mobile-safe stacks.
 */
function detailsCardHtml(rows, accent, roleTitle) {
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const role = String(roleTitle || '').trim();
  const rest = (rows || []).filter((r) => !/^role$|^job title$|^position$/i.test(r.label));
  if (!role && !rest.length) return '';

  const detailRows = rest
    .map((r, idx) => {
      const border = idx < rest.length - 1 ? 'border-bottom:1px solid #eef2f6;' : '';
      return `<tr>
        <td class="em-detail-row" style="padding:12px 0;${border}">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td class="em-detail-label" width="34%" valign="top" style="width:34%;padding:0 12px 0 0;font-family:${font};font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;line-height:1.45;">
                ${escapeHtml(displayLabel(r.label))}
              </td>
              <td class="em-detail-value" valign="top" style="padding:0;font-family:${font};font-size:14px;font-weight:600;color:#0f172a;line-height:1.45;word-break:break-word;">
                ${escapeHtml(formatDetailValue(r.label, r.value))}
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
    })
    .join('');

  const headerBlock = role
    ? `<tr>
        <td style="padding:0 0 16px 0;${rest.length ? 'border-bottom:1px solid #eef2f6;' : ''}">
          <p style="margin:0 0 6px 0;font-family:${font};font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${accent};">Open role</p>
          <p class="em-role-title" style="margin:0;font-family:${font};font-size:20px;font-weight:700;line-height:1.3;letter-spacing:-0.02em;color:#0f172a;">${escapeHtml(titleCasePhrase(role))}</p>
        </td>
      </tr>`
    : `<tr>
        <td style="padding:0 0 12px 0;${rest.length ? 'border-bottom:1px solid #eef2f6;' : ''}">
          <p style="margin:0;font-family:${font};font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${accent};">Role details</p>
        </td>
      </tr>`;

  return `<table role="presentation" class="em-card" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 22px 0;border:1px solid #e5e7eb;border-radius:10px;border-collapse:separate !important;overflow:hidden;">
  <tr>
    <td style="border-left:4px solid ${accent};background-color:#ffffff;padding:0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:20px 20px 18px 18px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              ${headerBlock}
              ${detailRows ? `<tr><td style="padding:${role ? '4px' : '2px'} 0 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${detailRows}</table></td></tr>` : ''}
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

/**
 * @param {string} emailBody
 * @param {{ brandColor?: string, subscribeUrl?: string, sampleName?: string }} [opts]
 */
function convertPlainEmailBody(emailBody, opts = {}) {
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(String(opts.brandColor || '').trim())
    ? String(opts.brandColor).trim()
    : '#0f766e';
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  let raw = String(emailBody || '');
  if (opts.sampleName) {
    raw = raw.replace(/\{\{\s*candidateName\s*\}\}/g, String(opts.sampleName));
  }
  if (/<[a-z][\s\S]*>/i.test(raw)) return raw;

  const lines = raw.split(/\r?\n/);
  const html = [];
  let i = 0;
  let inSignOff = false;

  const flushProse = (text) => {
    const t = String(text || '').trim();
    if (!t) return;
    html.push(
      `<p style="margin:0 0 14px 0;font-family:${font};font-size:15px;line-height:1.75;color:#334155;">${escapeHtml(t)}</p>`
    );
  };

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      i += 1;
      continue;
    }

    if (/^(job details|role details|drive details|details|key details)\s*:?\s*$/i.test(trimmed)) {
      i += 1;
      continue;
    }

    if (isApplyCue(trimmed) || /apply using the link below:?$/i.test(trimmed)) {
      if (!isApplyCue(trimmed)) {
        const cleaned = trimmed
          .replace(/\s*(,|\.)?\s*(or\s+)?apply using the link below:?$/i, '.')
          .replace(/\s+or\s*$/i, '.')
          .replace(/\.\s*\.$/, '.');
        if (cleaned && !/^[\s.]*$/.test(cleaned)) flushProse(cleaned);
      }
      let href = extractUrl(trimmed);
      i += 1;
      if (!href) {
        while (i < lines.length && !lines[i].trim()) i += 1;
        href = extractUrl(lines[i] || '');
        if (href) i += 1;
      }
      if (href) html.push(ctaButtonHtml(href, accent));
      continue;
    }

    const loneUrl = extractUrl(trimmed);
    if (loneUrl && /^https?:\/\/\S+$/i.test(trimmed.replace(/[?&]+$/g, ''))) {
      html.push(ctaButtonHtml(loneUrl, accent));
      i += 1;
      continue;
    }

    const firstDetail = isDetailLine(trimmed);
    if (firstDetail) {
      const rows = [];
      while (i < lines.length) {
        const d = isDetailLine(lines[i]);
        if (!d) break;
        rows.push(d);
        i += 1;
      }
      const roleRow = rows.find((r) => /^role$|^job title$|^position$/i.test(r.label));
      html.push(detailsCardHtml(rows, accent, roleRow?.value || ''));
      continue;
    }

    if (/^dear\b/i.test(trimmed)) {
      html.push(
        `<p style="margin:0 0 18px 0;font-family:${font};font-size:16px;font-weight:600;color:#0f172a;letter-spacing:-0.01em;">${escapeHtml(normalizeGreeting(trimmed))}</p>`
      );
      i += 1;
      continue;
    }

    if (/^(best regards|warm regards|regards|sincerely|thank you)\b/i.test(trimmed)) {
      inSignOff = true;
      html.push(
        `<p style="margin:28px 0 4px 0;font-family:${font};font-size:14px;line-height:1.5;color:#64748b;">${escapeHtml(trimmed.replace(/,?\s*$/, ''))},</p>`
      );
      i += 1;
      continue;
    }

    if (inSignOff) {
      html.push(
        `<p style="margin:0 0 2px 0;font-family:${font};font-size:14px;font-weight:700;color:#0f172a;line-height:1.45;">${escapeHtml(trimmed)}</p>`
      );
      i += 1;
      continue;
    }

    if (/^[-•●]\s/.test(trimmed) || /^\d+[\.)]\s/.test(trimmed)) {
      const items = [];
      while (i < lines.length && (/^[-•●]\s/.test(lines[i].trim()) || /^\d+[\.)]\s/.test(lines[i].trim()))) {
        items.push(lines[i].trim().replace(/^([•●\-]|\d+[\.)])\s*/, ''));
        i += 1;
      }
      html.push(
        `<ul style="margin:4px 0 16px 0;padding:0 0 0 18px;font-family:${font};font-size:15px;line-height:1.75;color:#334155;">${items
          .map((item) => `<li style="margin:0 0 6px 0;">${escapeHtml(item)}</li>`)
          .join('')}</ul>`
      );
      continue;
    }

    flushProse(trimmed);
    i += 1;
  }

  return html.join('\n');
}

module.exports = {
  convertPlainEmailBody,
  escapeHtml,
  titleCasePhrase,
  formatDetailValue,
};
