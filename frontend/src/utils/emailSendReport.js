/**
 * Build an accurate bulk-send report from provider responses (not estimated).
 */

export const FAILURE_REASON_META = {
  invalid_address: {
    key: 'invalid_address',
    label: 'Invalid address',
    short: 'Malformed or missing email',
  },
  mailbox_unavailable: {
    key: 'mailbox_unavailable',
    label: 'Mailbox unavailable',
    short: 'Account does not exist or rejected',
  },
  unsubscribed: {
    key: 'unsubscribed',
    label: 'Unsubscribed / no consent',
    short: 'Opted out of marketing',
  },
  blocked: {
    key: 'blocked',
    label: 'Blocked / suppressed',
    short: 'Spam or reputation block',
  },
  configuration: {
    key: 'configuration',
    label: 'Sender configuration',
    short: 'SMTP / campaign setup issue',
  },
  provider_error: {
    key: 'provider_error',
    label: 'Provider error',
    short: 'Rejected at send time',
  },
  other: {
    key: 'other',
    label: 'Other',
    short: 'Unclassified failure',
  },
};

export function classifyFailureReason(failure = {}) {
  if (failure.reasonCode && FAILURE_REASON_META[failure.reasonCode]) {
    return failure.reasonCode;
  }
  const text = `${failure.displayMessage || ''} ${failure.error || ''} ${failure.reason || ''}`.toLowerCase();
  if (/invalid email|email address is required|no valid email|missing email|malformed/.test(text)) {
    return 'invalid_address';
  }
  if (
    /mailbox (not found|unavailable|does not exist)|user unknown|recipient rejected|no such user|550\b|5\.1\.1|address rejected|undeliverable|does not exist|account does not exist|unknown recipient/.test(
      text
    )
  ) {
    return 'mailbox_unavailable';
  }
  if (/unsubscrib|opted.?out|opt.?out|no marketing consent|not eligible for marketing/.test(text)) {
    return 'unsubscribed';
  }
  if (/spam|blocked|blacklist|reputation|suppress/.test(text)) {
    return 'blocked';
  }
  if (/not configured|not verified|oauth|zoho campaigns|smtp|sender|verified domain|credentials/.test(text)) {
    return 'configuration';
  }
  if (!text.trim()) return 'other';
  return 'provider_error';
}

export function buildFailureBreakdown(failures = []) {
  const counts = {};
  const groups = {};
  for (const failure of failures) {
    const code = classifyFailureReason(failure);
    counts[code] = (counts[code] || 0) + 1;
    if (!groups[code]) groups[code] = [];
    groups[code].push(failure);
  }
  const rows = Object.keys(counts)
    .map((key) => ({
      ...(FAILURE_REASON_META[key] || FAILURE_REASON_META.other),
      count: counts[key],
      items: groups[key],
    }))
    .sort((a, b) => b.count - a.count);
  return { counts, rows };
}

export function buildSendReportPayload({
  title,
  channel = 'transactional',
  successList = [],
  failedList = [],
  skipped = 0,
  selectedTotal = null,
}) {
  const sent = successList.length;
  const failed = failedList.length;
  const totalAttempted = sent + failed;
  const selected = selectedTotal != null ? Number(selectedTotal) : totalAttempted + Number(skipped || 0);
  const skippedCount = Math.max(0, Number(skipped) || Math.max(0, selected - totalAttempted));
  const successRate =
    totalAttempted > 0 ? `${((sent / totalAttempted) * 100).toFixed(1)}%` : '0%';
  const breakdown = buildFailureBreakdown(failedList);

  return {
    title,
    channel,
    total: selected,
    attempted: totalAttempted,
    sent,
    failed,
    skipped: skippedCount,
    successRate,
    failures: failedList,
    successes: successList,
    failureBreakdown: breakdown.rows,
    failureCounts: breakdown.counts,
    completedAt: new Date().toISOString(),
  };
}
