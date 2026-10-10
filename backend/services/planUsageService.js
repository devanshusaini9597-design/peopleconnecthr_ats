/**
 * Live plan meters for the customer. Counts match the limits that block creates.
 * Emails are this calendar month in the organization timezone.
 */
const Organization = require('../models/Organization');
const { resolvePlanLimit, getCurrentUsage } = require('../middleware/rbacMiddleware');

function meter(key, label, used, limit, note) {
  const unlimited = limit === -1;
  const safeUsed = Number(used) || 0;
  return {
    key,
    label,
    used: safeUsed,
    limit: unlimited ? null : limit,
    unlimited,
    remaining: unlimited ? null : Math.max(0, Number(limit) - safeUsed),
    note,
  };
}

async function countEmailsThisMonth(org) {
  const timezone = org.settings?.timezone || process.env.DEFAULT_TIMEZONE || 'UTC';
  try {
    const { monthRanges } = require('../utils/analyticsTime');
    const EmailSendLog = require('../models/EmailSendLog');
    const range = monthRanges(new Date(), timezone);
    const rows = await EmailSendLog.aggregate([
      {
        $match: {
          organizationId: org._id,
          sentAt: { $gte: range.startOfMonth, $lt: range.startOfNextMonth },
        },
      },
      { $group: { _id: null, n: { $sum: { $ifNull: ['$totals.sent', 0] } } } },
    ]);
    return { used: Number(rows[0]?.n || 0), periodStart: range.startOfMonth, timezone };
  } catch (_) {
    return {
      used: Number(org.usageCurrent?.emailsSent || 0),
      periodStart: null,
      timezone,
    };
  }
}

async function getPlanUsage(organizationId) {
  const org = await Organization.findById(organizationId)
    .select('name plan usageLimits usageCurrent settings.timezone');
  if (!org) {
    const err = new Error('Organization not found');
    err.statusCode = 404;
    throw err;
  }

  const [users, jobs, candidates, email] = await Promise.all([
    getCurrentUsage(org, 'users'),
    getCurrentUsage(org, 'jobs'),
    getCurrentUsage(org, 'candidates'),
    countEmailsThisMonth(org),
  ]);

  const meters = [
    meter('users', 'Team seats', users, resolvePlanLimit(org, 'users'), 'People who can sign in'),
    meter('jobs', 'Open jobs', jobs, resolvePlanLimit(org, 'jobs'), 'Open and on-hold jobs (closed jobs do not count)'),
    meter('candidates', 'Candidates', candidates, resolvePlanLimit(org, 'candidates'), 'People in your database'),
    meter('emails', 'Emails this month', email.used, resolvePlanLimit(org, 'emails'), 'Resets at the start of each month'),
  ];

  return {
    plan: org.plan || 'starter',
    timezone: email.timezone,
    periodStart: email.periodStart,
    meters,
  };
}

module.exports = { getPlanUsage };
