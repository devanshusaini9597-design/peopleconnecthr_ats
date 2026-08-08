interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

// Create reusable transporter
const createTransporter = async () => {
  // Dynamic import to avoid webpack issues
  const nodemailer = await import('nodemailer');
  
  // Use SMTP credentials from environment variables
  return nodemailer.default.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const transporter = await createTransporter();

    const info = await transporter.sendMail({
      from: options.from || `"${process.env.FROM_NAME || 'Recruitment Team'}" <${process.env.SMTP_USER}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || '',
    });

    console.log('Email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

// Template for application confirmation to candidate
export function generateApplicationConfirmationEmail(
  candidateName: string,
  jobTitle: string
): { subject: string; html: string; text: string } {
  const subject = `Application Received - ${jobTitle}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Application Received</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #0d9488, #14b8a6); padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        .button { display: inline-block; background: #0d9488; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px; }
        .job-title { background: #e0f2fe; color: #0369a1; padding: 8px 16px; border-radius: 20px; display: inline-block; font-weight: 600; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>ðŸŽ‰ Application Received!</h1>
        </div>
        <div class="content">
          <p>Hi <strong>${candidateName}</strong>,</p>
          <p>Thank you for applying for the position:</p>
          <div class="job-title">${jobTitle}</div>
          <p>We have received your application and our team is reviewing it carefully. We aim to get back to all applicants within <strong>5 business days</strong>.</p>
          <p>In the meantime, feel free to explore more about our company and culture.</p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://devlumiq.vercel.app'}" class="button">Visit Our Website</a>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
          <p>&copy; ${new Date().getFullYear()} Recruitment Team. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Hi ${candidateName},

Thank you for applying for the ${jobTitle} position.

We have received your application and our team is reviewing it carefully. We aim to get back to all applicants within 5 business days.

Best regards,
Recruitment Team
  `;

  return { subject, html, text };
}

// Template for notification to hiring team
export function generateNewApplicationNotificationEmail(
  candidateName: string,
  candidateEmail: string,
  jobTitle: string,
  jobId: string
): { subject: string; html: string; text: string } {
  const subject = `New Application: ${candidateName} for ${jobTitle}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Application</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #0d9488, #14b8a6); padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
        .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .details h3 { margin-top: 0; color: #0d9488; }
        .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
        .detail-row:last-child { border-bottom: none; }
        .button { display: inline-block; background: #0d9488; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>ðŸ“¨ New Application Received</h1>
        </div>
        <div class="content">
          <p>A new candidate has applied for a position.</p>
          <div class="details">
            <h3>Candidate Details</h3>
            <div class="detail-row">
              <span><strong>Name:</strong></span>
              <span>${candidateName}</span>
            </div>
            <div class="detail-row">
              <span><strong>Email:</strong></span>
              <span>${candidateEmail}</span>
            </div>
            <div class="detail-row">
              <span><strong>Position:</strong></span>
              <span>${jobTitle}</span>
            </div>
            <div class="detail-row">
              <span><strong>Applied:</strong></span>
              <span>${new Date().toLocaleString()}</span>
            </div>
          </div>
          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://devlumiq.vercel.app'}/dashboard/candidates/${jobId}" class="button">View in Dashboard</a>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
New Application Received

Candidate: ${candidateName}
Email: ${candidateEmail}
Position: ${jobTitle}
Applied: ${new Date().toLocaleString()}

View in Dashboard: ${process.env.NEXT_PUBLIC_APP_URL || 'https://devlumiq.vercel.app'}/dashboard/candidates/${jobId}
  `;

  return { subject, html, text };
}

// ─── Invite email (sent when admin creates a user) ────────────────────────────
export function generateInviteEmail(
  recipientName: string,
  inviterName: string,
  orgName: string,
  setupUrl: string
): { subject: string; html: string; text: string } {
  const subject = `You've been invited to join ${orgName} on Devlumiq ATS`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #0d9488, #14b8a6); padding: 36px 30px; border-radius: 12px 12px 0 0; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 26px; font-weight: 800; }
        .header p { color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 15px; }
        .content { background: #f9fafb; padding: 32px 30px; border-radius: 0 0 12px 12px; }
        .org-badge { display: inline-block; background: #e0f2fe; color: #0369a1; padding: 6px 14px; border-radius: 20px; font-weight: 700; font-size: 14px; margin-bottom: 18px; }
        .button { display: inline-block; background: linear-gradient(135deg, #0d9488, #14b8a6); color: white !important; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 16px; margin: 20px 0; }
        .expiry-note { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #92400e; margin-top: 20px; }
        .footer { text-align: center; margin-top: 28px; color: #9ca3af; font-size: 13px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>You're invited!</h1>
          <p>Join your team on Devlumiq ATS</p>
        </div>
        <div class="content">
          <p>Hi <strong>${recipientName}</strong>,</p>
          <p><strong>${inviterName}</strong> has invited you to join their organisation on Devlumiq ATS:</p>
          <div class="org-badge">${orgName}</div>
          <p>Click the button below to set up your account and choose your password:</p>
          <div style="text-align: center;">
            <a href="${setupUrl}" class="button">Set Up My Account</a>
          </div>
          <div class="expiry-note">
            This invitation link expires in <strong>7 days</strong>. If you did not expect this invitation, you can safely ignore this email.
          </div>
        </div>
        <div class="footer">
          <p>This is an automated message from Devlumiq ATS. Please do not reply.</p>
          <p>&copy; ${new Date().getFullYear()} Devlumiq ATS. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `Hi ${recipientName},\n\n${inviterName} has invited you to join ${orgName} on Devlumiq ATS.\n\nSet up your account: ${setupUrl}\n\nThis link expires in 7 days.`;

  return { subject, html, text };
}

// ─── Password reset email ─────────────────────────────────────────────────────
export function generatePasswordResetEmail(
  recipientName: string,
  resetUrl: string
): { subject: string; html: string; text: string } {
  const subject = 'Reset your Devlumiq ATS password';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #1e293b, #334155); padding: 36px 30px; border-radius: 12px 12px 0 0; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 26px; font-weight: 800; }
        .header p { color: rgba(255,255,255,0.7); margin: 8px 0 0; font-size: 15px; }
        .content { background: #f9fafb; padding: 32px 30px; border-radius: 0 0 12px 12px; }
        .button { display: inline-block; background: linear-gradient(135deg, #0d9488, #14b8a6); color: white !important; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 16px; margin: 20px 0; }
        .expiry-note { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #92400e; margin-top: 20px; }
        .security-note { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #166534; margin-top: 12px; }
        .footer { text-align: center; margin-top: 28px; color: #9ca3af; font-size: 13px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset Request</h1>
          <p>We received a request to reset your password</p>
        </div>
        <div class="content">
          <p>Hi <strong>${recipientName}</strong>,</p>
          <p>Someone (hopefully you) requested a password reset for your Devlumiq ATS account. Click the button below to choose a new password:</p>
          <div style="text-align: center;">
            <a href="${resetUrl}" class="button">Reset My Password</a>
          </div>
          <div class="expiry-note">
            This link expires in <strong>1 hour</strong>.
          </div>
          <div class="security-note">
            If you did not request this, your account is safe — your password will not change.
          </div>
        </div>
        <div class="footer">
          <p>This is an automated message from Devlumiq ATS. Please do not reply.</p>
          <p>&copy; ${new Date().getFullYear()} Devlumiq ATS. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `Hi ${recipientName},\n\nReset your Devlumiq ATS password:\n${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you did not request this, ignore this email.`;

  return { subject, html, text };
}

// ─── Email verification email ─────────────────────────────────────────────────
export function generateEmailVerificationEmail(
  recipientName: string,
  verifyUrl: string
): { subject: string; html: string; text: string } {
  const subject = 'Verify your Devlumiq ATS email address';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #0d9488, #14b8a6); padding: 36px 30px; border-radius: 12px 12px 0 0; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 26px; font-weight: 800; }
        .header p { color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 15px; }
        .content { background: #f9fafb; padding: 32px 30px; border-radius: 0 0 12px 12px; }
        .button { display: inline-block; background: linear-gradient(135deg, #0d9488, #14b8a6); color: white !important; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 16px; margin: 20px 0; }
        .expiry-note { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #92400e; margin-top: 20px; }
        .footer { text-align: center; margin-top: 28px; color: #9ca3af; font-size: 13px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Verify Your Email</h1>
          <p>One quick step to activate your account</p>
        </div>
        <div class="content">
          <p>Hi <strong>${recipientName}</strong>,</p>
          <p>Thanks for signing up for Devlumiq ATS! Please verify your email address to activate your account:</p>
          <div style="text-align: center;">
            <a href="${verifyUrl}" class="button">Verify Email Address</a>
          </div>
          <div class="expiry-note">
            This link expires in <strong>24 hours</strong>.
          </div>
        </div>
        <div class="footer">
          <p>This is an automated message from Devlumiq ATS. Please do not reply.</p>
          <p>&copy; ${new Date().getFullYear()} Devlumiq ATS. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `Hi ${recipientName},\n\nVerify your Devlumiq ATS email address:\n${verifyUrl}\n\nThis link expires in 24 hours.`;

  return { subject, html, text };
}

// ─── Assessment invite ────────────────────────────────────────────────────────
export function generateAssessmentInviteEmail(opts: {
  candidateName: string;
  templateName: string;
  duration: number | null;
  expiresAt: Date | null;
  takeUrl: string;
}): { subject: string; html: string; text: string } {
  const { candidateName, templateName, duration, expiresAt, takeUrl } = opts;
  const subject = `Assessment invitation: ${templateName}`;
  const expiresLabel = expiresAt
    ? expiresAt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : 'soon';
  const durationLabel = duration ? `${duration} minutes` : 'Untimed';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #0d9488, #14b8a6); padding: 36px 30px; border-radius: 12px 12px 0 0; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; font-weight: 800; }
        .content { background: #f9fafb; padding: 32px 30px; border-radius: 0 0 12px 12px; }
        .meta { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; margin: 16px 0; font-size: 14px; }
        .button { display: inline-block; background: linear-gradient(135deg, #0d9488, #14b8a6); color: white !important; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 16px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 28px; color: #9ca3af; font-size: 13px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header"><h1>You're invited to take an assessment</h1></div>
        <div class="content">
          <p>Hi <strong>${candidateName}</strong>,</p>
          <p>Please complete the following assessment as part of your application:</p>
          <div class="meta">
            <div><strong>${templateName}</strong></div>
            <div>Duration: ${durationLabel}</div>
            <div>Expires: ${expiresLabel}</div>
          </div>
          <p>Use the secure link below. Do not share it — it is unique to you.</p>
          <div style="text-align:center"><a href="${takeUrl}" class="button">Start Assessment</a></div>
          <p style="font-size:13px;color:#6b7280;word-break:break-all">${takeUrl}</p>
        </div>
        <div class="footer"><p>&copy; ${new Date().getFullYear()} Devlumiq ATS</p></div>
      </div>
    </body>
    </html>
  `;

  const text = `Hi ${candidateName},\n\nPlease complete "${templateName}" (${durationLabel}). Expires: ${expiresLabel}.\n\nStart: ${takeUrl}\n`;

  return { subject, html, text };
}

// ─── Assessment reminder ──────────────────────────────────────────────────────
export function generateAssessmentReminderEmail(opts: {
  candidateName: string;
  templateName: string;
  expiresAt: Date;
  takeUrl: string;
}): { subject: string; html: string; text: string } {
  const { candidateName, templateName, expiresAt, takeUrl } = opts;
  const subject = `Reminder: "${templateName}" expires soon`;
  const expiresLabel = expiresAt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f59e0b; padding: 28px 30px; border-radius: 12px 12px 0 0; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 22px; font-weight: 800; }
        .content { background: #fffbeb; padding: 28px 30px; border-radius: 0 0 12px 12px; border: 1px solid #fde68a; border-top: none; }
        .button { display: inline-block; background: #0d9488; color: white !important; padding: 12px 28px; text-decoration: none; border-radius: 10px; font-weight: 700; margin: 16px 0; }
        .footer { text-align: center; margin-top: 24px; color: #9ca3af; font-size: 13px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header"><h1>Assessment reminder</h1></div>
        <div class="content">
          <p>Hi <strong>${candidateName}</strong>,</p>
          <p>Your assessment <strong>${templateName}</strong> expires on <strong>${expiresLabel}</strong>.</p>
          <p>Please finish and submit before then.</p>
          <div style="text-align:center"><a href="${takeUrl}" class="button">Continue Assessment</a></div>
        </div>
        <div class="footer"><p>&copy; ${new Date().getFullYear()} Devlumiq ATS</p></div>
      </div>
    </body>
    </html>
  `;

  const text = `Hi ${candidateName},\n\nReminder: "${templateName}" expires ${expiresLabel}.\nContinue: ${takeUrl}\n`;

  return { subject, html, text };
}

