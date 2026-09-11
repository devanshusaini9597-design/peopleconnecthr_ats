const logger = require('../utils/logger');

/**
 * Email recruiting team when a new job opening is posted (skips publisher; includes freelancers).
 */
async function emailJobOpeningToTeam({
  organizationId,
  job,
  actorId,
  actorName,
}) {
  if (!organizationId || !job?.title) {
    return { sent: 0, skipped: true };
  }
  if (job.isTemplate || job.status === 'Draft') {
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

    const ids = await listAudienceUserIds(organizationId, 'recruiters');
    const freelancerIds = await listAudienceUserIds(organizationId, 'freelancers');
    const skip = String(actorId || '');
    const unique = [...new Set([...ids, ...freelancerIds].map((id) => String(id)).filter(Boolean))]
      .filter((id) => id !== skip);
    if (!unique.length) return { sent: 0 };

    const users = await User.find({
      _id: { $in: unique },
      email: { $exists: true, $ne: '' },
      isActive: { $ne: false },
    }).select('_id name email role').lean();

    if (!users.length) return { sent: 0 };

    const brand = await loadSendingEmailBrand({ organizationId, system: true });
    const appUrl = String(publicSiteBase() || process.env.FRONTEND_URL || 'https://www.peopleconnecthr.com')
      .replace(/\/$/, '');
    const jobsUrl = `${appUrl}/jobs`;
    const mandatesUrl = `${appUrl}/mandates`;
    const publisher = String(actorName || brand.name || 'Recruiting').trim();
    const title = String(job.title || job.role || 'New role').trim();
    const location = String(job.location || '').trim() || 'Location TBD';
    const experience = String(job.experience || '').trim();
    const client = String(job.clientName || '').trim();
    const skills = Array.isArray(job.skills) ? job.skills.slice(0, 6) : [];

    let sent = 0;
    const prefsSvc = require('./notificationPreferencesService');
    for (const user of users) {
      try {
        const emailOk = await prefsSvc.shouldDeliver(user._id, 'job_opening', 'email');
        if (!emailOk) continue;

        const firstName = String(user.name || '').trim().split(/\s+/)[0] || 'there';
        const isFreelancerUser = String(user.role || '') === 'freelancer';
        const openUrl = isFreelancerUser ? mandatesUrl : jobsUrl;
        const openLabel = isFreelancerUser ? 'View open mandates' : 'View job openings';
        const skillTags = skills.length
          ? skills.map((s) => (
            `<span style="display:inline-block;margin:0 6px 6px 0;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;background:#f0fdfa;color:#0f766e;border:1px solid #99f6e4;">${escapeHtml(s)}</span>`
          )).join('')
          : '';

        const html = wrapBrandedEmailHtml({
          title: `New opening: ${title}`,
          eyebrow: 'Job opening · Hiring team',
          category: 'job',
          orgName: brand.name,
          logoUrl: brand.logoUrl,
          brandColor: brand.brandColor || '#0d9488',
          wordmark: brand.wordmark,
          senderName: brand.name,
          senderEmail: brand.fromEmail,
          websiteUrl: brand.websiteUrl,
          supportEmail: brand.supportEmail,
          socialLinks: brand.socialLinks,
          footerReason: isFreelancerUser
            ? `You received this because you can work open mandates at ${brand.name}.`
            : `You received this because you are on the hiring team at ${brand.name}.`,
          bodyHtml: `
            <p style="margin:0 0 14px 0;font-size:16px;color:#0f172a;">Hi ${escapeHtml(firstName)},</p>
            <p style="margin:0 0 18px 0;color:#475569;line-height:1.7;">
              <strong style="color:#0f172a;">${escapeHtml(publisher)}</strong> posted a new job opening for your team.
            </p>
            <div style="margin:0 0 20px 0;padding:16px 18px;border:1px solid #e5e7eb;border-radius:12px;background:#f8fafc;">
              <p style="margin:0 0 8px 0;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#0d9488;">
                ${escapeHtml(String(job.status || 'Open'))}
              </p>
              <p style="margin:0 0 10px 0;font-size:17px;font-weight:700;color:#0f172a;letter-spacing:-0.01em;text-transform:uppercase;">
                ${escapeHtml(title)}
              </p>
              <p style="margin:0 0 6px 0;color:#475569;font-size:13px;line-height:1.6;">
                <strong>Location:</strong> ${escapeHtml(location)}
                ${experience ? `<br/><strong>Experience:</strong> ${escapeHtml(experience)}` : ''}
                ${client ? `<br/><strong>Client:</strong> ${escapeHtml(client)}` : ''}
                ${job.jobCode ? `<br/><strong>Job ID:</strong> ${escapeHtml(job.jobCode)}` : ''}
              </p>
              ${skillTags ? `<div style="margin-top:12px;">${skillTags}</div>` : ''}
            </div>
            <div style="text-align:center;">
              ${brandButtonHtml({
                href: openUrl,
                label: openLabel,
                brandColor: brand.brandColor || '#0d9488',
              })}
            </div>
          `,
        });

        const text = [
          `Hi ${firstName},`,
          '',
          `${publisher} posted a new job opening: ${title}`,
          `Location: ${location}`,
          experience ? `Experience: ${experience}` : '',
          client ? `Client: ${client}` : '',
          '',
          skills.length ? `Skills: ${skills.join(', ')}` : '',
          '',
          `${openLabel}: ${openUrl}`,
        ].filter(Boolean).join('\n');

        await sendEmailQueued(
          user.email,
          `New job opening: ${title} – ${brand.name}`,
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
        logger.warn(`[jobEmail] Failed for ${user.email}: ${err.message}`);
      }
    }

    logger.info(`[jobEmail] Sent ${sent}/${users.length} for org ${organizationId}`);
    return { sent, total: users.length };
  } catch (err) {
    logger.warn(`[jobEmail] ${err.message}`);
    return { sent: 0, error: err.message };
  }
}

module.exports = {
  emailJobOpeningToTeam,
};
