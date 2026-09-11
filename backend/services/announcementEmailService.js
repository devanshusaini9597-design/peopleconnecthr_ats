const logger = require('../utils/logger');

const SEVERITY_LABEL = {
  info: 'Info',
  success: 'Update',
  warning: 'Important',
  critical: 'Urgent',
};

/**
 * Email active employees in the announcement audience (skips publisher + freelancers).
 * Freelancer-targeted notices never call this (in-app only).
 * Fire-and-forget safe — never throws to the HTTP handler.
 */
async function emailAnnouncementToAudience({
  organizationId,
  announcement,
  actorId,
  actorName,
}) {
  if (!organizationId || !announcement?.title || !announcement?.body) {
    return { sent: 0, skipped: true };
  }
    if (announcement.audience === 'public' || announcement.audience === 'freelancers') {
      return { sent: 0, skipped: true };
    }

  try {
    const User = require('../models/User');
    const { listAudienceUserIds } = require('../utils/reportingScope');
    const { sendEmailQueued } = require('./emailService');
    const {
      wrapBrandedEmailHtml,
      brandButtonHtml,
      loadSendingEmailBrand,
      escapeHtml,
      publicSiteBase,
    } = require('./emailBrandLayout');

    const ids = await listAudienceUserIds(organizationId, announcement.audience || 'all');
    const skip = String(actorId || '');
    const unique = [...new Set((ids || []).map((id) => String(id)).filter(Boolean))]
      .filter((id) => id !== skip);
    if (!unique.length) return { sent: 0 };

    const users = await User.find({
      _id: { $in: unique },
      email: { $exists: true, $ne: '' },
      isActive: { $ne: false },
    }).select('_id name email').lean();

    if (!users.length) return { sent: 0 };

    const brand = await loadSendingEmailBrand({ organizationId, system: true });
    const appUrl = String(publicSiteBase() || process.env.FRONTEND_URL || 'https://www.peopleconnecthr.com')
      .replace(/\/$/, '');
    const boardUrl = `${appUrl}/announcements`;
    const severity = SEVERITY_LABEL[announcement.severity] || 'Notice';
    const publisher = String(actorName || brand.name || 'Leadership').trim();
    const title = String(announcement.title).trim();
    const bodyHtml = escapeHtml(announcement.body)
      .replace(/\r\n/g, '\n')
      .replace(/\n/g, '<br/>');

    let sent = 0;
    for (const user of users) {
      try {
        const firstName = String(user.name || '').trim().split(/\s+/)[0] || 'there';
        const html = wrapBrandedEmailHtml({
          title,
          eyebrow: `Company notice · ${severity}`,
          category: 'announcement',
          orgName: brand.name,
          logoUrl: brand.logoUrl,
          brandColor: brand.brandColor || '#0d9488',
          wordmark: brand.wordmark,
          senderName: brand.name,
          senderEmail: brand.fromEmail,
          websiteUrl: brand.websiteUrl,
          supportEmail: brand.supportEmail,
          socialLinks: brand.socialLinks,
          footerReason: `You received this because you are a teammate at ${brand.name}.`,
          bodyHtml: `
            <p style="margin:0 0 14px 0;font-size:16px;color:#0f172a;">Hi ${escapeHtml(firstName)},</p>
            <p style="margin:0 0 18px 0;color:#475569;line-height:1.7;">
              <strong style="color:#0f172a;">${escapeHtml(publisher)}</strong> published a company notice for your team.
            </p>
            <div style="margin:0 0 20px 0;padding:16px 18px;border:1px solid #e5e7eb;border-radius:12px;background:#f8fafc;">
              <p style="margin:0 0 8px 0;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#0d9488;">
                ${escapeHtml(severity)}
              </p>
              <p style="margin:0 0 10px 0;font-size:17px;font-weight:700;color:#0f172a;letter-spacing:-0.01em;">
                ${escapeHtml(title)}
              </p>
              <p style="margin:0;color:#475569;line-height:1.7;font-size:14px;">
                ${bodyHtml}
              </p>
            </div>
            <div style="text-align:center;">
              ${brandButtonHtml({
                href: boardUrl,
                label: 'Open noticeboard',
                brandColor: brand.brandColor || '#0d9488',
              })}
            </div>
            <p style="margin:20px 0 0 0;color:#94a3b8;font-size:12px;line-height:1.6;">
              You can also read this notice in the app under Announcements.
            </p>
          `,
        });

        const text = [
          `Hi ${firstName},`,
          '',
          `${publisher} published a company notice: ${title}`,
          '',
          String(announcement.body || '').trim(),
          '',
          `Open noticeboard: ${boardUrl}`,
        ].join('\n');

        await sendEmailQueued(
          user.email,
          `Company notice: ${title} – ${brand.name}`,
          html,
          text,
          {
            userId: user._id,
            organizationId,
            system: true,
            senderName: brand.name,
            senderEmail: brand.fromEmail,
          }
        );
        sent += 1;
      } catch (err) {
        logger.warn(
          `[announcementEmail] Failed for ${user.email}: ${err.message}`
        );
      }
    }

    logger.info(`[announcementEmail] Sent ${sent}/${users.length} for org ${organizationId}`);
    return { sent, total: users.length };
  } catch (err) {
    logger.warn(`[announcementEmail] ${err.message}`);
    return { sent: 0, error: err.message };
  }
}

module.exports = {
  emailAnnouncementToAudience,
};
