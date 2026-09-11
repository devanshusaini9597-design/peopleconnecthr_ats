/**
 * Scheduled report runner — Enterprise 'reports.custom' feature.
 *
 * No job queue exists in this codebase (no Redis/Bull), so this is a plain
 * in-process interval, same pattern as services/notificationService.js's
 * startNotificationScheduler(). Fine at this scale; if this ever needs to
 * run across multiple server instances, move to a real job queue so two
 * instances don't double-send the same scheduled report.
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const mongoose = require('mongoose');

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // check every 15 minutes
const REPORTS_DIR = path.join(__dirname, '..', 'uploads', 'reports');
const REPORT_FILE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // download links valid for 7 days

const ensureReportsDir = () => {
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
};

const runDueReports = async () => {
  try {
    const ScheduledReport = mongoose.model('ScheduledReport');
    const Organization = mongoose.model('Organization');
    const { generateReportBuffer } = require('../controller/exportController');
    const { sendEmailQueued } = require('./emailService');
    const { planHasFeature } = require('../config/planFeatures');

    const due = await ScheduledReport.find({ isActive: true, nextRunAt: { $lte: new Date() } });
    if (due.length === 0) return;

    ensureReportsDir();

    for (const schedule of due) {
      try {
        const org = await Organization.findById(schedule.organizationId).select('plan name slug');
        if (!org || !planHasFeature(org.plan, 'reports.custom')) {
          // Org downgraded since this was scheduled — skip silently and push
          // the next run out rather than deleting the schedule (its owner
          // might upgrade again before then).
          schedule.nextRunAt = schedule.computeNextRun();
          await schedule.save();
          continue;
        }

        const { buffer, filename, contentType } = await generateReportBuffer({
          reportType: schedule.reportType,
          format: schedule.format === 'pdf' ? 'pdf' : 'xlsx',
          organizationId: schedule.organizationId,
          dateRange: schedule.dateRange
        });

        const token = crypto.randomBytes(24).toString('hex');
        const storedFilename = `${token}__${filename}`;
        fs.writeFileSync(path.join(REPORTS_DIR, storedFilename), buffer);

        const backendUrl = (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, '');
        const downloadUrl = `${backendUrl}/api/report-schedules/download/${token}`;

        if (schedule.recipients.length > 0) {
          const { wrapBrandedEmailHtml, brandButtonHtml, loadOrgEmailBrand, escapeHtml } = require('./emailBrandLayout');
          const brand = await loadOrgEmailBrand(schedule.organizationId);
          const html = wrapBrandedEmailHtml({
            title: schedule.name,
            eyebrow: 'Scheduled report',
            orgName: brand.name,
            logoUrl: brand.logoUrl,
            brandColor: brand.brandColor,
            wordmark: brand.wordmark,
            bodyHtml: `
              <p style="margin:0 0 12px 0;color:#57534e;line-height:1.65;">Your scheduled <strong style="color:#1c1917;">${escapeHtml(schedule.reportType.replace(/-/g, ' '))}</strong> report for <strong style="color:#1c1917;">${escapeHtml(org.name)}</strong> is ready to download.</p>
              <div style="text-align:center;">
                ${brandButtonHtml({ href: downloadUrl, label: 'Download report', brandColor: brand.brandColor })}
              </div>
              <p style="margin:24px 0 0 0;color:#a8a29e;font-size:12px;text-align:center;line-height:1.6;">This link expires in 7 days. Manage this schedule from Organization &rarr; Scheduled Reports.</p>`,
          });
          await sendEmailQueued(schedule.recipients, `Scheduled report: ${schedule.name}`, html, `Download your report: ${downloadUrl}`).catch((err) => {
            console.error(`[reportScheduler] Failed to email schedule ${schedule._id}:`, err.message);
          });
        }

        schedule.lastRunAt = new Date();
        schedule.lastRunStatus = 'success';
        schedule.lastRunError = '';
        schedule.nextRunAt = schedule.computeNextRun();
        await schedule.save();
      } catch (err) {
        console.error(`[reportScheduler] Failed to run schedule ${schedule._id}:`, err.message);
        schedule.lastRunAt = new Date();
        schedule.lastRunStatus = 'failed';
        schedule.lastRunError = err.message;
        schedule.nextRunAt = schedule.computeNextRun();
        await schedule.save().catch(() => {});
      }
    }
  } catch (err) {
    console.error('[reportScheduler] Error checking due reports:', err.message);
  }
};

const cleanupExpiredFiles = () => {
  try {
    ensureReportsDir();
    const now = Date.now();
    for (const file of fs.readdirSync(REPORTS_DIR)) {
      const filePath = path.join(REPORTS_DIR, file);
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > REPORT_FILE_TTL_MS) fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error('[reportScheduler] Cleanup error:', err.message);
  }
};

const startReportScheduler = () => {
  ensureReportsDir();
  setInterval(runDueReports, CHECK_INTERVAL_MS);
  setInterval(cleanupExpiredFiles, 60 * 60 * 1000);
  // Run once shortly after boot too, so a schedule due while the server was down isn't stuck for 15 minutes.
  setTimeout(runDueReports, 30 * 1000);
};

module.exports = { startReportScheduler, REPORTS_DIR };
