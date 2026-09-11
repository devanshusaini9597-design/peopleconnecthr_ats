/**
 * 🔔 Callback Reminder Notification Service
 * 
 * Enterprise-grade scheduler that:
 * - Scans all candidates with callBackDate set
 * - Generates notifications starting 7 days before callback
 * - Creates 2-4 reminders per day as the date approaches
 * - Sends email to each recruiter's own login address (User.email) the working day before and on the due date
 * - Auto-manages notification lifecycle (dedup, expiry, cleanup)
 * 
 * Schedule:
 *   7 days before  → 1 notification (morning)
 *   6 days before  → 1 notification (morning)
 *   5 days before  → 1 notification (morning)
 *   4 days before  → 2 notifications (morning + evening)
 *   3 days before  → 2 notifications (morning + evening)
 *   2 days before  → 3 notifications (morning + afternoon + evening)
 *   1 day before   → 3 notifications (morning + afternoon + evening)
 *   Day of callback → 4 notifications (every 4 hours)
 *   Overdue / missed → 1 daily in-app notice for 7 days, plus a “you missed” email the next morning
 */

const Notification = require('../models/Notification');
const Candidate = require('../models/Candidate');
const { sendEmail, checkUserEmailConfigured } = require('./emailService');
const { wrapBrandedEmailHtml, loadPlatformEmailBrand, escapeHtml } = require('./emailBrandLayout');
const { isCallbackEmailNotifyDay, toYmd } = require('../utils/workingDays');
const prefsSvc = require('./notificationPreferencesService');
const logger = require('../utils/logger');

// ─── SCHEDULE CONFIG ─────────────────────────────────────────────
const REMINDER_SCHEDULE = {
  7: ['09:00'],
  6: ['09:00'],
  5: ['09:00'],
  4: ['09:00'],
  3: ['09:00'],
  2: ['09:00', '17:00'],
  1: ['09:00', '17:00'],
  0: ['09:00', '13:00', '17:00'],
};

// ─── HELPER: Parse callBackDate string to Date ──────────────────
function parseCallbackDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  
  // Try multiple formats: dd-mm-yyyy, yyyy-mm-dd, dd/mm/yyyy, mm/dd/yyyy
  let date = null;
  
  // dd-mm-yyyy or dd/mm/yyyy
  const ddmmyyyy = dateStr.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    date = new Date(year, month - 1, day);
  }
  
  // yyyy-mm-dd
  if (!date) {
    const yyyymmdd = dateStr.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
    if (yyyymmdd) {
      const [, year, month, day] = yyyymmdd;
      date = new Date(year, month - 1, day);
    }
  }
  
  // Fallback: let JS try
  if (!date) {
    date = new Date(dateStr);
  }
  
  return date && !isNaN(date.getTime()) ? date : null;
}

// ─── HELPER: Calculate days remaining ───────────────────────────
function getDaysRemaining(callbackDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cb = new Date(callbackDate);
  cb.setHours(0, 0, 0, 0);
  return Math.ceil((cb - today) / (1000 * 60 * 60 * 24));
}

// ─── HELPER: Get priority based on days remaining ───────────────
function getPriority(daysRemaining) {
  if (daysRemaining <= 0) return 'urgent';
  if (daysRemaining <= 2) return 'high';
  if (daysRemaining <= 5) return 'medium';
  return 'low';
}

// ─── HELPER: Build notification title & message ─────────────────
function buildNotification(candidate, daysRemaining) {
  const name = candidate.name || 'Unknown';
  const position = candidate.position || 'N/A';
  const contact = candidate.contact || '';
  
  let title, message;
  
  if (daysRemaining < 0) {
    const overdueDays = Math.abs(daysRemaining);
    title = `Overdue callback: ${name}`;
    message = `Callback for ${name} (${position}) was due ${overdueDays} day${overdueDays > 1 ? 's' : ''} ago. Contact: ${contact}. Please follow up now.`;
  } else if (daysRemaining === 0) {
    title = `Callback due today: ${name}`;
    message = `Today is the callback date for ${name} (${position}). Contact: ${contact}.`;
  } else if (daysRemaining === 1) {
    title = `Callback tomorrow: ${name}`;
    message = `Callback for ${name} (${position}) is tomorrow. Contact: ${contact}.`;
  } else if (daysRemaining <= 3) {
    title = `Callback in ${daysRemaining} days: ${name}`;
    message = `Callback for ${name} (${position}) is in ${daysRemaining} days. Contact: ${contact}.`;
  } else {
    title = `Upcoming callback: ${name}`;
    message = `Callback for ${name} (${position}) is in ${daysRemaining} days. Contact: ${contact}.`;
  }
  
  return { title, message };
}

// ─── HELPER: Build email reminder HTML ──────────────────────────
function buildReminderEmailHTML(notifications, userName, { dayBefore = false, dueToday = false, missed = false } = {}) {
  const priorityColors = {
    urgent: '#dc2626',
    high: '#ea580c',
    medium: '#ca8a04',
    low: '#2563eb',
  };

  const rows = notifications.map((n) => {
    const color = priorityColors[n.priority] || '#71717a';
    const daysText =
      n.daysRemaining < 0
        ? `<strong style="color:#dc2626;">Missed · ${Math.abs(n.daysRemaining)}d</strong>`
        : n.daysRemaining === 0
          ? '<strong style="color:#dc2626;">TODAY</strong>'
          : n.daysRemaining === 1
            ? '<strong style="color:#ea580c;">TOMORROW</strong>'
            : `<strong style="color:#292524;">${n.daysRemaining} day(s)</strong>`;

    return `
      <tr style="border-bottom:1px solid #f0eeee;">
        <td style="padding:14px 14px 14px 0;font-size:14px;">
          <strong style="color:#18181b;">${escapeHtml(n.candidateName)}</strong><br/>
          <span style="color:#a1a1aa;font-size:12px;">${escapeHtml(n.candidatePosition || 'N/A')}</span>
        </td>
        <td style="padding:14px;font-size:13.5px;color:#57534e;">${escapeHtml(n.candidateContact || '—')}</td>
        <td style="padding:14px;font-size:13.5px;color:#57534e;white-space:nowrap;">${escapeHtml(n.callBackDate)}</td>
        <td style="padding:14px;font-size:13.5px;">${daysText}</td>
        <td style="padding:14px 0 14px 14px;"><span style="display:inline-block;background:${color}1a;color:${color};padding:3px 10px;border-radius:999px;font-size:10.5px;font-weight:700;letter-spacing:0.04em;">${n.priority.toUpperCase()}</span></td>
      </tr>`;
  }).join('');

  const brand = loadPlatformEmailBrand();
  const intro = missed
    ? `Hi <strong style="color:#18181b;">${escapeHtml(userName)}</strong>, you
      <strong style="color:#dc2626;">missed</strong> ${notifications.length} callback${notifications.length > 1 ? 's' : ''}
      that were due. Please follow up today.`
    : dueToday
    ? `Hi <strong style="color:#18181b;">${escapeHtml(userName)}</strong>, this is your
      <strong style="color:#18181b;">due-today</strong> callback reminder
      (${notifications.length} candidate${notifications.length > 1 ? 's' : ''}).
      Please follow up today.`
    : dayBefore
    ? `Hi <strong style="color:#18181b;">${escapeHtml(userName)}</strong>, this is your
      <strong style="color:#18181b;">one-day-before</strong> callback reminder
      (${notifications.length} candidate${notifications.length > 1 ? 's' : ''}).
      If the day before falls on a Sunday or holiday, we send this one working day earlier.`
    : `Hi <strong style="color:#18181b;">${escapeHtml(userName)}</strong>, you have
      <strong style="color:#18181b;">${notifications.length}</strong> upcoming callback reminder${notifications.length > 1 ? 's' : ''}
      that need your attention:`;

  const bodyHtml = `
    <p style="margin:0 0 20px 0;font-size:15px;color:#3f3f46;line-height:1.65;">
      ${intro}
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <thead>
        <tr style="border-bottom:2px solid #f0eeee;">
          <th style="padding:0 14px 10px 0;text-align:left;font-size:11px;font-weight:700;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.04em;">Candidate</th>
          <th style="padding:0 14px 10px;text-align:left;font-size:11px;font-weight:700;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.04em;">Contact</th>
          <th style="padding:0 14px 10px;text-align:left;font-size:11px;font-weight:700;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.04em;">Callback</th>
          <th style="padding:0 14px 10px;text-align:left;font-size:11px;font-weight:700;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.04em;">Due in</th>
          <th style="padding:0 0 10px 14px;text-align:left;font-size:11px;font-weight:700;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.04em;">Priority</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
    <p style="margin:22px 0 0 0;color:#78716c;font-size:13px;line-height:1.6;">Log in to ATS to view full details and take action on these callbacks.</p>`;

  return wrapBrandedEmailHtml({
    title: missed ? 'You missed these callbacks' : dueToday ? 'Callbacks due today' : dayBefore ? 'Callback tomorrow — reminder' : 'Callback reminders',
    eyebrow: missed ? 'Missed' : dueToday ? 'Due today' : dayBefore ? 'One day before' : 'Daily digest',
    orgName: brand.name,
    logoUrl: brand.logoUrl,
    brandColor: brand.brandColor,
    wordmark: brand.wordmark,
    bodyHtml,
  });
}

/**
 * Send callback digest emails to each recruiter's own login email (User.email).
 * kind: 'dayBefore' | 'dueToday' | 'missed'
 */
async function sendCallbackDigestEmails(byUser, todayStr, currentHour, { kind }) {
  if (currentHour < 7 || currentHour > 11) return 0;

  const meta = {
    dueToday: {
      prefix: 'email_cb0d_',
      subject: (n) => `${n} Callback Due Today — ATS`,
      title: 'Due-today callback email sent',
      label: 'Due-today',
      text: (n) => `You have ${n} callback(s) due today. Log in to ATS to review.`,
    },
    missed: {
      prefix: 'email_cbmiss_',
      subject: (n) => `${n} Missed Callback — ATS`,
      title: 'Missed callback email sent',
      label: 'Missed',
      text: (n) => `You missed ${n} callback(s). Log in to ATS to follow up.`,
    },
    dayBefore: {
      prefix: 'email_cb1d_',
      subject: (n) => `${n} Callback Tomorrow Reminder — ATS`,
      title: 'Day-before callback email sent',
      label: 'Day-before',
      text: (n) => `You have ${n} callback(s) coming up (one-day-before reminder). Log in to ATS to review.`,
    },
  }[kind] || null;
  if (!meta) return 0;

  let totalEmails = 0;

  for (const [userId, list] of Object.entries(byUser || {})) {
    if (!list.length) continue;

    try {
      const emailDedupKey = `${meta.prefix}${userId}_${todayStr}`;
      const existingEmail = await Notification.findOne({ dedupKey: emailDedupKey }).lean();
      if (existingEmail) continue;

      const User = require('mongoose').model('User');
      const user = await User.findById(userId).select('name email role organizationId').lean();
      if (!user?.email) continue;

      const isFreelancerUser = String(user.role || '') === 'freelancer';
      // Freelancers receive system/platform mail (not company Zepto send-as).
      if (!isFreelancerUser) {
        const isConfigured = await checkUserEmailConfigured(userId);
        if (!isConfigured) {
          logger.info(`   ⏭ Skip ${kind} email for ${user.email} — outbound email not configured`);
          continue;
        }
      }

      const emailAllowed = await prefsSvc.shouldDeliver(userId, 'callback_reminder', 'email');
      if (!emailAllowed) {
        logger.info(`   ⏭ Skip ${kind} email for ${user.email} — disabled in notification preferences`);
        continue;
      }

      const payload = list.map((candidate) => {
        const days = candidate._daysRemaining;
        return {
          candidateName: candidate.name,
          candidatePosition: candidate.position || '',
          candidateContact: candidate.contact || '',
          callBackDate: candidate.callBackDate,
          priority: getPriority(days),
          daysRemaining: days,
        };
      });

      const html = buildReminderEmailHTML(payload, user.name || 'Team Member', {
        dayBefore: kind === 'dayBefore',
        dueToday: kind === 'dueToday',
        missed: kind === 'missed',
      });

      await sendEmail(
        user.email,
        meta.subject(payload.length),
        html,
        meta.text(payload.length),
        isFreelancerUser
          ? {
              system: true,
              senderName: 'Skillnix Recruitment',
              organizationId: user.organizationId,
            }
          : { userId, senderName: 'Skillnix Recruitment' }
      );

      await Notification.create({
        userId,
        type: 'system',
        title: meta.title,
        message: `${meta.label} callback email sent to ${user.email} (${payload.length} candidate(s))`,
        priority: 'low',
        isRead: true,
        dedupKey: emailDedupKey,
        emailSent: true,
        emailSentAt: new Date(),
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      }).catch(() => {});

      totalEmails += 1;
      logger.info(`   📧 ${meta.label} callback email sent to ${user.email} (${payload.length})`);
    } catch (emailErr) {
      logger.error(`   ${kind} email failed for user ${userId}: ${emailErr.message}`);
    }
  }

  return totalEmails;
}

// ─── MAIN: Scan and generate notifications ──────────────────────
async function scanAndNotify() {
  try {
    const now = new Date();
    const currentHour = now.getHours();
    const todayStr = toYmd(now) || now.toISOString().split('T')[0];
    
    logger.info(`\n🔔 [${now.toLocaleString()}] Callback Reminder Scan Started...`);
    
    // ATS candidates with callBackDate set
    const candidates = await Candidate.find({
      callBackDate: { $ne: '', $exists: true }
    }).lean();
    
    if (!candidates.length) {
      logger.info('   No candidates with callback dates found.');
      return;
    }
    
    logger.info(`   Found ${candidates.length} candidates with callback dates.`);
    
    // Group by recipient (owner, SPOC, manager per enterprise routing)
    const userCandidates = {};
    const dayBeforeCandidates = {};
    const dueTodayCandidates = {};
    const missedCandidates = {};
    for (const c of candidates) {
      const cbDate = parseCallbackDate(c.callBackDate);
      if (!cbDate) continue;

      const daysRemaining = getDaysRemaining(cbDate);
      const enriched = { ...c, _parsedDate: cbDate, _daysRemaining: daysRemaining };
      const recipientIds = await prefsSvc.resolveCallbackRecipientIds(c);

      for (const userId of recipientIds) {
        // Day-before email window (allow holiday shift up to ~2 weeks out)
        if (daysRemaining >= 0 && daysRemaining <= 14 && isCallbackEmailNotifyDay(cbDate, now)) {
          if (!dayBeforeCandidates[userId]) dayBeforeCandidates[userId] = [];
          dayBeforeCandidates[userId].push(enriched);
        }

        if (daysRemaining === 0) {
          if (!dueTodayCandidates[userId]) dueTodayCandidates[userId] = [];
          dueTodayCandidates[userId].push(enriched);
        }

        if (daysRemaining === -1) {
          if (!missedCandidates[userId]) missedCandidates[userId] = [];
          missedCandidates[userId].push(enriched);
        }

        if (daysRemaining < -7 || daysRemaining > 7) continue;

        if (!userCandidates[userId]) userCandidates[userId] = [];
        userCandidates[userId].push(enriched);
      }
    }
    
    let totalCreated = 0;
    
    for (const [userId, candidateList] of Object.entries(userCandidates)) {
      const notificationsToCreate = [];
      
      for (const candidate of candidateList) {
        const days = candidate._daysRemaining;
        const absDays = Math.max(0, days);
        
        // Determine how many notifications per day based on schedule
        let schedule;
        if (days < 0) {
          schedule = ['09:00']; // Overdue: 1 daily
        } else {
          schedule = REMINDER_SCHEDULE[absDays] || [];
        }
        
        // Check which scheduled time slot we're closest to
        const shouldNotifyNow = schedule.some(time => {
          const [h] = time.split(':').map(Number);
          // Allow within a 2-hour window of the scheduled time
          return Math.abs(currentHour - h) <= 1;
        });
        
        if (!shouldNotifyNow && schedule.length > 0) continue;

        const priority = getPriority(days);
        const inAppOk = await prefsSvc.shouldCreateCallbackInApp(userId, {
          daysRemaining: days,
          currentHour,
        });
        if (!inAppOk) continue;

        const quietBlocked = !(await prefsSvc.shouldDeliver(
          userId,
          days < 0 ? 'callback_overdue' : days === 0 ? 'callback_today' : 'callback_reminder',
          'inApp',
          { priority }
        ));
        if (quietBlocked) continue;
        
        // Dedup key: userId_candidateId_date_timeSlot
        const timeSlot = `${Math.floor(currentHour / 3)}`; // Group by 3-hour blocks
        const dedupKey = `${userId}_${candidate._id}_${todayStr}_${timeSlot}`;
        
        const { title, message } = buildNotification(candidate, days);
        
        notificationsToCreate.push({
          userId,
          type: days < 0 ? 'callback_overdue' : days === 0 ? 'callback_today' : 'callback_reminder',
          title,
          message,
          candidateId: candidate._id,
          candidateName: candidate.name,
          candidatePosition: candidate.position || '',
          candidateContact: candidate.contact || '',
          callBackDate: candidate.callBackDate,
          priority: getPriority(days),
          daysRemaining: days,
          dedupKey,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        });
      }
      
      // Bulk insert with dedup (skip duplicates)
      for (const notif of notificationsToCreate) {
        try {
          await Notification.create(notif);
          totalCreated++;
        } catch (err) {
          // Duplicate key error (11000) means already sent for this slot — skip
          if (err.code !== 11000) {
            logger.error(`   Error creating notification: ${err.message}`);
          }
        }
      }
    }

    const dayBeforeEmails = await sendCallbackDigestEmails(dayBeforeCandidates, todayStr, currentHour, { kind: 'dayBefore' });
    const dueTodayEmails = await sendCallbackDigestEmails(dueTodayCandidates, todayStr, currentHour, { kind: 'dueToday' });
    const missedEmails = await sendCallbackDigestEmails(missedCandidates, todayStr, currentHour, { kind: 'missed' });
    
    logger.info(`   ✅ Scan complete: ${totalCreated} in-app, ${dayBeforeEmails} day-before emails, ${dueTodayEmails} due-today emails, ${missedEmails} missed emails.\n`);
    
  } catch (error) {
    logger.error('❌ Notification scan error:', error);
  }
}

// ─── CLEANUP: Remove old dismissed/expired notifications ────────
async function cleanupOldNotifications() {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await Notification.deleteMany({
      $or: [
        { isDismissed: true, createdAt: { $lt: thirtyDaysAgo } },
        { isRead: true, createdAt: { $lt: thirtyDaysAgo } }
      ]
    });
    if (result.deletedCount > 0) {
      logger.info(`🧹 Cleaned up ${result.deletedCount} old notifications.`);
    }
  } catch (err) {
    logger.error('Cleanup error:', err.message);
  }
}

// ─── SCHEDULER: Start the cron-like interval ────────────────────
let scanInterval = null;
let cleanupInterval = null;

function startNotificationScheduler() {
  logger.info('🔔 Callback Reminder Scheduler started.');
  
  // Run initial scan after 10 seconds (let server fully boot)
  setTimeout(() => {
    scanAndNotify();
  }, 10000);
  
  // Run scan every 1 hour
  scanInterval = setInterval(() => {
    scanAndNotify();
  }, 60 * 60 * 1000);
  
  // Run cleanup once a day (every 24 hours)
  cleanupInterval = setInterval(() => {
    cleanupOldNotifications();
  }, 24 * 60 * 60 * 1000);
}

function stopNotificationScheduler() {
  if (scanInterval) clearInterval(scanInterval);
  if (cleanupInterval) clearInterval(cleanupInterval);
  logger.info('🔔 Callback Reminder Scheduler stopped.');
}

// ─── HTTP route helpers (notificationRoutes) ────────────────────
function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

async function listNotifications(userId, { status, channel, limit = 50, page = 1, sort = 'latest' } = {}) {
  try {
    await syncCallbackNotificationsForUser(userId);
    await syncJobOpeningNotificationsForUser(userId);

    const { notificationChannelFilter } = require('../utils/reportingScope');
    const channelFilter = notificationChannelFilter(channel);
    const filter = {
      userId,
      isDismissed: false,
      ...channelFilter,
    };
    if (!channelFilter.type) {
      filter.type = { $ne: 'system' };
    } else if (channelFilter.type.$nin) {
      filter.type = { $nin: [...new Set([...channelFilter.type.$nin, 'system'])] };
    }
    if (status === 'unread') filter.isRead = false;
    else if (status === 'read') filter.isRead = true;

    const limitNum = parseInt(limit);
    const pageNum = parseInt(page);
    const skip = (pageNum - 1) * limitNum;
    const newestFirst = sort !== 'oldest';

    const [notifications, totalCount, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort(newestFirst ? { createdAt: -1 } : { createdAt: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({
        userId,
        isRead: false,
        isDismissed: false,
        type: { $ne: 'system' },
      }),
    ]);

    // "Latest" / "Oldest" are chronological — do not re-rank by priority
    // (that buried brand-new report shares under older high-priority callbacks).

    return {
      notifications,
      unreadCount,
      totalCount,
      page: pageNum,
      totalPages: Math.ceil(totalCount / limitNum),
      sort: newestFirst ? 'latest' : 'oldest',
    };
  } catch (error) {
    if (error.statusCode) throw error;
    console.error('Fetch notifications error:', error);
    throw httpError('Failed to fetch notifications', 500);
  }
}

async function getNotificationCounts(userId) {
  try {
    await syncCallbackNotificationsForUser(userId);
    await syncJobOpeningNotificationsForUser(userId);

    const unreadCount = await Notification.countDocuments({
      userId,
      isRead: false,
      isDismissed: false,
      type: { $ne: 'system' },
    });

    const urgentCount = await Notification.countDocuments({
      userId,
      isRead: false,
      isDismissed: false,
      type: { $ne: 'system' },
      priority: { $in: ['urgent', 'high'] },
    });

    return { unreadCount, urgentCount };
  } catch (error) {
    if (error.statusCode) throw error;
    throw httpError('Failed to get count', 500);
  }
}

const CALLBACK_NOTIF_TYPES = ['callback_reminder', 'callback_today', 'callback_overdue'];

function liveCallbackTitle(candidateName, daysRemaining) {
  const name = candidateName || 'Unknown';
  if (daysRemaining < 0) return `Missed callback: ${name}`;
  if (daysRemaining === 0) return `Callback due today: ${name}`;
  if (daysRemaining === 1) return `Callback tomorrow: ${name}`;
  return `Callback in ${daysRemaining} days: ${name}`;
}

/**
 * Collapse duplicate callback notifications (one per candidate) and refresh live due state.
 * Dismisses reminders when the candidate callback date was cleared.
 */
async function syncJobOpeningNotificationsForUser(userId) {
  if (!userId) return;
  const Job = require('../models/Job');
  const rows = await Notification.find({
    userId,
    isDismissed: false,
    type: 'job_opening',
  })
    .select('_id relatedJobId title')
    .lean();
  if (!rows.length) return;

  const withJob = rows.filter((r) => r.relatedJobId);
  const dismissIds = [];

  if (withJob.length) {
    const ids = withJob.map((r) => r.relatedJobId);
    const existing = await Job.find({ _id: { $in: ids } }).select('_id').lean();
    const alive = new Set(existing.map((j) => String(j._id)));
    for (const r of withJob) {
      if (!alive.has(String(r.relatedJobId))) dismissIds.push(r._id);
    }
  }

  // Legacy rows without relatedJobId: drop if title no longer matches any open job
  const legacy = rows.filter((r) => !r.relatedJobId);
  if (legacy.length) {
    const titles = [...new Set(legacy.map((r) => {
      const m = String(r.title || '').match(/^New opening:\s*(.+)$/i);
      return m ? m[1].trim() : '';
    }).filter(Boolean))];
    if (titles.length) {
      const aliveJobs = await Job.find({
        $or: [{ title: { $in: titles } }, { role: { $in: titles } }],
      })
        .select('title role')
        .lean();
      const aliveTitles = new Set(
        aliveJobs.flatMap((j) => [j.title, j.role].filter(Boolean).map((t) => String(t).trim()))
      );
      for (const r of legacy) {
        const m = String(r.title || '').match(/^New opening:\s*(.+)$/i);
        const t = m ? m[1].trim() : '';
        if (!t || !aliveTitles.has(t)) dismissIds.push(r._id);
      }
    } else {
      dismissIds.push(...legacy.map((r) => r._id));
    }
  }

  if (dismissIds.length) {
    await Notification.updateMany(
      { _id: { $in: dismissIds } },
      { $set: { isDismissed: true, isRead: true } }
    );
  }
}

async function syncCallbackNotificationsForUser(userId) {
  if (!userId) return;
  const callbacks = await Notification.find({
    userId,
    isDismissed: false,
    type: { $in: CALLBACK_NOTIF_TYPES },
  })
    .select('_id candidateId candidateName callBackDate createdAt isRead')
    .lean();

  if (!callbacks.length) return;

  const byCandidate = new Map();
  const orphanIds = [];
  for (const n of callbacks) {
    const cid = n.candidateId?.toString();
    if (!cid) {
      orphanIds.push(n._id);
      continue;
    }
    if (!byCandidate.has(cid)) byCandidate.set(cid, []);
    byCandidate.get(cid).push(n);
  }

  const candidateIds = [...byCandidate.keys()];
  const candidates = await Candidate.find({ _id: { $in: candidateIds } })
    .select('_id callBackDate name contact position')
    .lean();
  const candMap = new Map(candidates.map((c) => [c._id.toString(), c]));

  const dismissIds = [...orphanIds];
  const refreshOps = [];

  for (const [cid, list] of byCandidate.entries()) {
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const cand = candMap.get(cid);
    const callBackDate = cand?.callBackDate || '';
    if (!callBackDate) {
      dismissIds.push(...list.map((n) => n._id));
      continue;
    }

    const [keep, ...dupes] = list;
    dismissIds.push(...dupes.map((n) => n._id));

    const parsed = parseCallbackDate(callBackDate);
    if (!parsed) {
      dismissIds.push(keep._id);
      continue;
    }
    const days = getDaysRemaining(parsed);
    const type = days < 0 ? 'callback_overdue' : days === 0 ? 'callback_today' : 'callback_reminder';
    const name = cand.name || keep.candidateName || 'Unknown';
    refreshOps.push({
      updateOne: {
        filter: { _id: keep._id },
        update: {
          $set: {
            type,
            title: liveCallbackTitle(name, days),
            message: days < 0
              ? `Callback for ${name} was due ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago.`
              : days === 0
                ? `Today is the callback date for ${name}.`
                : `Callback for ${name} is in ${days} day${days === 1 ? '' : 's'}.`,
            candidateName: name,
            candidatePosition: cand.position || '',
            candidateContact: cand.contact || '',
            callBackDate,
            daysRemaining: days,
            priority: getPriority(days),
          },
        },
      },
    });
  }

  if (dismissIds.length) {
    await Notification.updateMany(
      { _id: { $in: dismissIds } },
      { $set: { isDismissed: true, isRead: true } }
    );
  }
  if (refreshOps.length) {
    await Notification.bulkWrite(refreshOps, { ordered: false }).catch(() => {});
  }
}

async function dismissCallbackNotificationsForCandidate(userId, candidateId) {
  if (!userId || !candidateId) return;
  await Notification.updateMany(
    {
      userId,
      candidateId,
      type: { $in: CALLBACK_NOTIF_TYPES },
      isDismissed: false,
    },
    { $set: { isDismissed: true, isRead: true } }
  );
}

function formatCallbackYmd(date) {
  return toYmd(date) || '';
}

function mapCandidateToCallbackRow(candidate) {
  const cbDate = parseCallbackDate(candidate.callBackDate);
  if (!cbDate) return null;
  const daysRemaining = getDaysRemaining(cbDate);
  // Live queue: keep overdue up to 90 days; upcoming within 14 days
  if (daysRemaining < -90 || daysRemaining > 14) return null;
  return {
    _id: candidate._id,
    candidateId: candidate._id,
    candidateName: candidate.name || 'Unknown',
    candidatePosition: candidate.position || '',
    candidateContact: candidate.contact || candidate.phone || '',
    callBackDate: candidate.callBackDate,
    daysRemaining,
    priority: getPriority(daysRemaining),
  };
}

/**
 * Live callback queue from candidates.callBackDate (desk-scoped), not notification cache.
 */
async function getUpcomingCallbacks(user) {
  try {
    const { candidateListFilter } = require('../utils/dataScope');
    const deskFilter = candidateListFilter({ user }, 'mine');
    const candidates = await Candidate.find({
      ...deskFilter,
      callBackDate: { $ne: '', $exists: true },
    })
      .select('name position contact phone callBackDate')
      .lean();

    const callbacks = candidates
      .map(mapCandidateToCallbackRow)
      .filter(Boolean)
      .sort((a, b) => (a.daysRemaining || 0) - (b.daysRemaining || 0));

    return { callbacks: callbacks.slice(0, 10), total: callbacks.length };
  } catch (error) {
    if (error.statusCode) throw error;
    throw httpError('Failed to fetch callbacks', 500);
  }
}

async function completeCallback(req, candidateId) {
  try {
    const { candidateWriteScope } = require('../utils/dataScope');
    const userId = req.user?.id || req.user?._id;
    const candidate = await Candidate.findOneAndUpdate(
      { _id: candidateId, ...candidateWriteScope(req) },
      { $set: { callBackDate: '' } },
      { new: true }
    ).select('_id name callBackDate');
    if (!candidate) throw httpError('Candidate not found or not editable', 404);
    await dismissCallbackNotificationsForCandidate(userId, candidateId);
    return { candidateId: candidate._id, callBackDate: '' };
  } catch (error) {
    if (error.statusCode) throw error;
    throw httpError('Failed to complete callback', 500);
  }
}

async function snoozeCallback(req, candidateId, daysInput) {
  try {
    const days = Number(daysInput);
    if (![1, 3, 7].includes(days)) {
      throw httpError('Snooze days must be 1, 3, or 7', 400);
    }
    const { candidateWriteScope } = require('../utils/dataScope');
    const userId = req.user?.id || req.user?._id;
    const existing = await Candidate.findOne({
      _id: candidateId,
      ...candidateWriteScope(req),
    })
      .select('_id name callBackDate')
      .lean();
    if (!existing) throw httpError('Candidate not found or not editable', 404);

    const base = parseCallbackDate(existing.callBackDate) || new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Snooze from max(today, current callback) so overdue moves forward from today
    const from = base > today ? base : today;
    const next = new Date(from);
    next.setDate(next.getDate() + days);
    const callBackDate = formatCallbackYmd(next);

    const candidate = await Candidate.findOneAndUpdate(
      { _id: candidateId, ...candidateWriteScope(req) },
      { $set: { callBackDate } },
      { new: true }
    ).select('_id name callBackDate');

    await dismissCallbackNotificationsForCandidate(userId, candidateId);
    const row = mapCandidateToCallbackRow(candidate.toObject ? candidate.toObject() : candidate);
    return { candidateId: candidate._id, callBackDate, callback: row };
  } catch (error) {
    if (error.statusCode) throw error;
    throw httpError('Failed to snooze callback', 500);
  }
}

async function markNotificationRead(userId, id) {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId },
      { isRead: true },
      { new: true }
    );
    if (!notification) throw httpError('Not found', 404);
    return notification;
  } catch (error) {
    if (error.statusCode) throw error;
    throw httpError('Failed to update', 500);
  }
}

async function markAllNotificationsRead(userId) {
  try {
    await Notification.updateMany({ userId, isRead: false }, { isRead: true });
  } catch (error) {
    if (error.statusCode) throw error;
    throw httpError('Failed to update', 500);
  }
}

async function dismissNotification(userId, id) {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId },
      { isDismissed: true },
      { new: true }
    );
    if (!notification) throw httpError('Not found', 404);
    return notification;
  } catch (error) {
    if (error.statusCode) throw error;
    throw httpError('Failed to dismiss', 500);
  }
}

async function clearReadNotifications(userId) {
  try {
    await Notification.updateMany({ userId, isRead: true }, { isDismissed: true });
  } catch (error) {
    if (error.statusCode) throw error;
    throw httpError('Failed to clear', 500);
  }
}

async function triggerNotificationScan() {
  try {
    await scanAndNotify();
  } catch (error) {
    if (error.statusCode) throw error;
    throw httpError('Scan failed', 500);
  }
}

async function getReportShareUnreadCount(userId) {
  const count = await Notification.countDocuments({
    userId,
    type: 'report_shared',
    isRead: false,
    isDismissed: false,
  });
  return { count };
}

async function markReportSharesSeen(userId) {
  const result = await Notification.updateMany(
    {
      userId,
      type: 'report_shared',
      isRead: false,
      isDismissed: false,
    },
    { $set: { isRead: true } }
  );
  return { modified: result.modifiedCount || 0 };
}

module.exports = {
  startNotificationScheduler,
  stopNotificationScheduler,
  scanAndNotify,
  cleanupOldNotifications,
  listNotifications,
  getNotificationCounts,
  getUpcomingCallbacks,
  completeCallback,
  snoozeCallback,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
  clearReadNotifications,
  triggerNotificationScan,
  getReportShareUnreadCount,
  markReportSharesSeen,
};
