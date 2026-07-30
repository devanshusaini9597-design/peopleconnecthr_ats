/**
 * 🔔 Callback Reminder Notification Service
 * 
 * Enterprise-grade scheduler that:
 * - Scans all candidates with callBackDate set
 * - Generates notifications starting 7 days before callback
 * - Creates 2-4 reminders per day as the date approaches
 * - Sends email reminders to users (if email settings configured)
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
 *   Overdue         → 1 daily notification until 7 days past
 */

const Notification = require('../models/Notification');
const Candidate = require('../models/Candidate');
const { sendEmail, checkUserEmailConfigured, getUserTransporter } = require('./emailService');

// ─── SCHEDULE CONFIG ─────────────────────────────────────────────
const REMINDER_SCHEDULE = {
  7: ['08:00'],                              // 7 days: 1x morning
  6: ['08:00'],                              // 6 days: 1x morning
  5: ['09:00'],                              // 5 days: 1x morning
  4: ['08:00', '17:00'],                     // 4 days: 2x
  3: ['08:00', '17:00'],                     // 3 days: 2x
  2: ['08:00', '13:00', '17:00'],            // 2 days: 3x
  1: ['08:00', '12:00', '17:00'],            // 1 day: 3x
  0: ['08:00', '11:00', '14:00', '17:00'],   // Day of: 4x
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
    title = `⚠️ Overdue Callback: ${name}`;
    message = `Callback for ${name} (${position}) was due ${overdueDays} day${overdueDays > 1 ? 's' : ''} ago. Contact: ${contact}. Please follow up immediately.`;
  } else if (daysRemaining === 0) {
    title = `🔴 Callback TODAY: ${name}`;
    message = `Today is the callback date for ${name} (${position}). Contact: ${contact}. Don't forget to reach out!`;
  } else if (daysRemaining === 1) {
    title = `🟠 Callback Tomorrow: ${name}`;
    message = `Callback for ${name} (${position}) is tomorrow. Contact: ${contact}. Prepare for the follow-up.`;
  } else if (daysRemaining <= 3) {
    title = `🟡 Callback in ${daysRemaining} days: ${name}`;
    message = `Callback for ${name} (${position}) is in ${daysRemaining} days. Contact: ${contact}. Plan your outreach.`;
  } else {
    title = `📅 Upcoming Callback: ${name}`;
    message = `Callback for ${name} (${position}) is scheduled in ${daysRemaining} days. Contact: ${contact}.`;
  }
  
  return { title, message };
}

// ─── HELPER: Build email reminder HTML ──────────────────────────
function buildReminderEmailHTML(notifications, userName) {
  const rows = notifications.map(n => {
    const priorityBadge = {
      urgent: '<span style="background:#dc2626;color:#fff;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">URGENT</span>',
      high: '<span style="background:#ea580c;color:#fff;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">HIGH</span>',
      medium: '<span style="background:#ca8a04;color:#fff;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">MEDIUM</span>',
      low: '<span style="background:#2563eb;color:#fff;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">LOW</span>'
    };
    
    const daysText = n.daysRemaining < 0 
      ? `<strong style="color:#dc2626;">${Math.abs(n.daysRemaining)} day(s) overdue</strong>`
      : n.daysRemaining === 0 
        ? '<strong style="color:#dc2626;">TODAY</strong>'
        : `<strong>${n.daysRemaining} day(s)</strong>`;
    
    return `
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:12px 16px;font-size:14px;">
          <strong style="color:#111827;">${n.candidateName}</strong><br/>
          <span style="color:#6b7280;font-size:12px;">${n.candidatePosition || 'N/A'}</span>
        </td>
        <td style="padding:12px 16px;font-size:14px;color:#374151;">${n.candidateContact || '—'}</td>
        <td style="padding:12px 16px;font-size:14px;color:#374151;">${n.callBackDate}</td>
        <td style="padding:12px 16px;font-size:14px;">${daysText}</td>
        <td style="padding:12px 16px;">${priorityBadge[n.priority]}</td>
      </tr>`;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:680px;margin:24px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:28px 32px;">
      <h1 style="color:#ffffff;font-size:22px;margin:0;">🔔 Callback Reminders</h1>
      <p style="color:#bfdbfe;font-size:14px;margin:8px 0 0;">Skillnix Recruitment Services</p>
    </div>
    
    <!-- Body -->
    <div style="padding:24px 32px;">
      <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px;">
        Hi <strong>${userName}</strong>,<br/>
        You have <strong>${notifications.length}</strong> upcoming callback reminder${notifications.length > 1 ? 's' : ''} that need your attention:
      </p>
      
      <!-- Table -->
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:10px 16px;text-align:left;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;">Candidate</th>
            <th style="padding:10px 16px;text-align:left;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;">Contact</th>
            <th style="padding:10px 16px;text-align:left;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;">Callback Date</th>
            <th style="padding:10px 16px;text-align:left;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;">Due In</th>
            <th style="padding:10px 16px;text-align:left;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;">Priority</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      
      <p style="color:#6b7280;font-size:13px;margin:20px 0 0;line-height:1.5;">
        💡 <em>Log in to your dashboard to view full details and take action on these callbacks.</em>
      </p>
    </div>
    
    <!-- Footer -->
    <div style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
      <p style="color:#9ca3af;font-size:12px;margin:0;text-align:center;">
        Skillnix Recruitment Services — Automated Callback Reminder System<br/>
        This is an automated notification. You can manage your reminders from the dashboard.
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ─── MAIN: Scan and generate notifications ──────────────────────
async function scanAndNotify() {
  try {
    const now = new Date();
    const currentHour = now.getHours();
    const todayStr = now.toISOString().split('T')[0]; // yyyy-mm-dd
    
    console.log(`\n🔔 [${now.toLocaleString()}] Callback Reminder Scan Started...`);
    
    // Find all candidates with callBackDate set
    const candidates = await Candidate.find({
      callBackDate: { $ne: '', $exists: true }
    }).lean();
    
    if (!candidates.length) {
      console.log('   No candidates with callback dates found.');
      return;
    }
    
    console.log(`   Found ${candidates.length} candidates with callback dates.`);
    
    // Group by user (createdBy)
    const userCandidates = {};
    for (const c of candidates) {
      const cbDate = parseCallbackDate(c.callBackDate);
      if (!cbDate) continue;
      
      const daysRemaining = getDaysRemaining(cbDate);
      
      // Only notify for -7 to +7 range
      if (daysRemaining < -7 || daysRemaining > 7) continue;
      
      const userId = c.createdBy?.toString();
      if (!userId) continue;
      
      if (!userCandidates[userId]) userCandidates[userId] = [];
      userCandidates[userId].push({ ...c, _parsedDate: cbDate, _daysRemaining: daysRemaining });
    }
    
    let totalCreated = 0;
    let totalEmails = 0;
    
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
            console.error(`   Error creating notification: ${err.message}`);
          }
        }
      }
      
      // Send email digest if user has email configured and it's a morning slot (8-10 AM)
      if (currentHour >= 7 && currentHour <= 10 && notificationsToCreate.length > 0) {
        try {
          const isConfigured = await checkUserEmailConfigured(userId);
          if (isConfigured) {
            // Check if we already sent email today
            const emailDedupKey = `email_${userId}_${todayStr}`;
            const existingEmail = await Notification.findOne({ dedupKey: emailDedupKey });
            
            if (!existingEmail) {
              // Get user info
              const User = require('mongoose').model('User');
              const user = await User.findById(userId).lean();
              
              if (user && user.email) {
                const { transporter, configured } = await getUserTransporter(userId);
                if (configured && transporter) {
                  const html = buildReminderEmailHTML(notificationsToCreate, user.name || 'Team Member');
                  
                  await transporter.sendMail({
                    from: user.emailSettings?.smtpEmail || user.email,
                    to: user.email,
                    subject: `🔔 ${notificationsToCreate.length} Callback Reminder${notificationsToCreate.length > 1 ? 's' : ''} — Skillnix Recruitment`,
                    html
                  });
                  
                  // Mark email as sent with dedup
                  await Notification.create({
                    userId,
                    type: 'system',
                    title: 'Email Reminder Sent',
                    message: `Callback reminder email sent with ${notificationsToCreate.length} reminders`,
                    priority: 'low',
                    isRead: true,
                    dedupKey: emailDedupKey,
                    expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
                  }).catch(() => {}); // Ignore dedup errors
                  
                  totalEmails++;
                  console.log(`   📧 Email reminder sent to ${user.email}`);
                }
              }
            }
          }
        } catch (emailErr) {
          console.error(`   Email reminder failed for user ${userId}: ${emailErr.message}`);
        }
      }
    }
    
    console.log(`   ✅ Scan complete: ${totalCreated} notifications created, ${totalEmails} emails sent.\n`);
    
  } catch (error) {
    console.error('❌ Notification scan error:', error);
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
      console.log(`🧹 Cleaned up ${result.deletedCount} old notifications.`);
    }
  } catch (err) {
    console.error('Cleanup error:', err.message);
  }
}

// ─── SCHEDULER: Start the cron-like interval ────────────────────
let scanInterval = null;
let cleanupInterval = null;

function startNotificationScheduler() {
  console.log('🔔 Callback Reminder Scheduler started.');
  
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
  console.log('🔔 Callback Reminder Scheduler stopped.');
}

module.exports = {
  startNotificationScheduler,
  stopNotificationScheduler,
  scanAndNotify,
  cleanupOldNotifications
};
