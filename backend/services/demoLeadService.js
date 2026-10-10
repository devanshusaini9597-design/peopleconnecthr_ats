/**
 * Public homepage / contact demo requests. Emails the sales inbox — no mailbox passwords.
 */
const { sendEmail } = require('./emailService');
const { escapeHtml } = require('./emailBrandLayout');
const { SALES_INBOX } = require('./trialRequestService');
const DemoLead = require('../models/DemoLead');
const logger = require('../utils/logger');

const TEAM_SIZES = new Set(['1-10', '11-50', '51-200', '201-1000', '1000+']);
const KINDS = new Set(['demo', 'sales', 'support', 'other']);

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

function clean(value, max) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Homepage / contact demo mail goes only to sales@ — never Skillnix or SUPPORT_TEAM_EMAIL. */
function demoLeadRecipients() {
  return [SALES_INBOX];
}

function parseLead(body = {}) {
  // Only treat an obscure honeypot as spam. Do not use "website" — browsers
  // autofill it with the current origin (peopleconnecthr.com) and drop real leads.
  if (String(body.hp_field || body.companyUrl || '').trim()) {
    throw httpError('Request rejected.', 400, { code: 'SPAM' });
  }
  const name = clean(body.name, 80);
  const email = clean(body.email, 120).toLowerCase();
  const company = clean(body.company, 120);
  const teamSize = clean(body.teamSize, 20) || '1-10';
  const message = clean(body.message, 2000);
  const kind = KINDS.has(String(body.kind || '').trim()) ? String(body.kind).trim() : 'demo';

  if (name.length < 2) throw httpError('Enter your name.', 400);
  if (!isEmail(email)) throw httpError('Enter a valid work email.', 400);
  if (company.length < 2) throw httpError('Enter your company.', 400);
  if (!TEAM_SIZES.has(teamSize)) throw httpError('Choose a team size.', 400);

  return { name, email, company, teamSize, message, kind };
}

function isRetryableMailError(err) {
  const msg = String(err?.message || err?.displayMessage || '');
  return (
    err?.response?.status === 429
    || err?.reasonCode === 'provider_error'
    || /rate-limited|429|timed out|timeout|ECONNABORTED/i.test(msg)
  );
}

async function sendSalesMailOnce({ to, subject, html, text, senderName, replyTo }) {
  await sendEmail(to, subject, html, text, {
    senderName,
    system: true,
    replyTo,
    productMailboxOnly: true,
  });
}

function salesRequestHtml(lead) {
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const icon = 'https://www.peopleconnecthr.com/app-icon.png?v=5';
  const site = 'https://www.peopleconnecthr.com';
  const year = new Date().getFullYear();
  const rows = [
    ['Name', lead.name],
    ['Work email', lead.email],
    ['Company', lead.company],
    ['Team size', lead.teamSize],
    lead.message ? ['Message', lead.message] : null,
  ].filter(Boolean);
  const details = rows.map(([label, value], index) => `
            <tr>
              <td style="padding:14px 18px;${index < rows.length - 1 ? 'border-bottom:1px solid #e7eeec;' : ''}font-family:${font};">
                <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">${escapeHtml(label)}</p>
                <p style="margin:5px 0 0 0;font-size:15px;line-height:1.5;font-weight:600;color:#0c1f1c;word-break:break-word;">${escapeHtml(value)}</p>
              </td>
            </tr>`).join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light only" />
  <title>Walkthrough request</title>
</head>
<body style="margin:0;padding:0;background:#f3f7f6;width:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f7f6;width:100%;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
          <tr>
            <td style="background:#ffffff;border:1px solid #e3ecea;border-radius:16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:22px 20px 8px 20px;font-family:${font};">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding:0 12px 0 0;" valign="middle">
                          <img src="${icon}" alt="" width="40" height="40" style="display:block;width:40px;height:40px;border:0;border-radius:10px;background:#ffffff;" />
                        </td>
                        <td valign="middle" style="font-family:${font};font-size:15px;font-weight:700;color:#0c1f1c;">People Connect HR</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 20px 0 20px;font-family:${font};">
                    <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#0f766e;">Sales</p>
                    <h1 style="margin:8px 0 0 0;font-size:22px;line-height:1.3;font-weight:700;color:#0c1f1c;">Walkthrough request</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 20px 8px 20px;font-family:${font};font-size:15px;line-height:1.6;color:#3f4f4c;">
                    A visitor asked for a product walkthrough on peopleconnecthr.com. Reply to the work email below.
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 16px 20px 16px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e3ecea;border-radius:12px;">
                      ${details}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:22px 12px 8px 12px;font-family:${font};">
              <img src="${icon}" alt="" width="28" height="28" style="display:block;margin:0 auto 12px auto;width:28px;height:28px;border:0;" />
              <p style="margin:0 auto;max-width:420px;font-size:13px;line-height:1.6;color:#5c6b68;">This message was sent to the People Connect HR sales team because a walkthrough was requested on peopleconnecthr.com.</p>
              <p style="margin:14px 0 0 0;font-size:13px;line-height:1.6;">
                <a href="${site}" style="color:#0f766e;font-weight:600;text-decoration:none;">Website</a>
                <span style="color:#c5d0cd;">&nbsp;&nbsp;·&nbsp;&nbsp;</span>
                <a href="${site}/privacy" style="color:#0f766e;font-weight:600;text-decoration:none;">Privacy</a>
                <span style="color:#c5d0cd;">&nbsp;&nbsp;·&nbsp;&nbsp;</span>
                <a href="${site}/contact" style="color:#0f766e;font-weight:600;text-decoration:none;">Contact</a>
              </p>
              <p style="margin:12px 0 0 0;font-size:12px;color:#8a9895;">&copy; ${year} People Connect HR</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function submitDemoLead(body) {
  const lead = parseLead(body);
  const to = SALES_INBOX;

  const label = lead.kind === 'demo' ? 'Walkthrough request' : 'Sales inquiry';
  const html = salesRequestHtml(lead);

  const text = [
    `${label} from ${lead.name}`,
    `Email: ${lead.email}`,
    `Company: ${lead.company}`,
    `Team size: ${lead.teamSize}`,
    lead.message ? `Message: ${lead.message}` : null,
  ].filter(Boolean).join('\n');

  let saved = null;
  try {
    saved = await DemoLead.create(lead);
  } catch (err) {
    logger.warn({ err: err.message }, 'Demo lead persist failed');
  }

  const mail = {
    to,
    subject: `${label} — ${lead.company}`,
    html,
    text,
    senderName: 'People Connect HR',
  };

  try {
    await sendSalesMailOnce({ ...mail, replyTo: lead.email });
    if (saved) {
      saved.emailSent = true;
      await saved.save().catch(() => {});
    }
    logger.info({ to, company: lead.company, kind: lead.kind }, 'Demo lead emailed sales via ZeptoMail');
    return {
      success: true,
      emailSent: true,
      message: `Email sent to ${to}. We will reply within one business day.`,
    };
  } catch (err) {
    logger.warn({ err: err.message, to }, 'Demo lead ZeptoMail send failed');
    if (saved) {
      saved.emailError = String(err.message || '').slice(0, 300);
      await saved.save().catch(() => {});
    }
    if (isRetryableMailError(err)) {
      throw httpError(
        `We could not send this request just now. Please email ${to}, and the sales team will reply within one business day.`,
        429
      );
    }
    throw httpError(
      `We could not deliver this request to ${to}. Please write to that address, and sales will reply within one business day.`,
      502
    );
  }
}

module.exports = {
  TEAM_SIZES,
  demoLeadRecipients,
  parseLead,
  submitDemoLead,
};
