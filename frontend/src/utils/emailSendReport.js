/**
 * Build an accurate send report from provider responses (ZeptoMail + Zoho Campaigns).
 * Counts come from the live send response — never estimated.
 */

export const FAILURE_REASON_META = {
  invalid_address: {
    key: 'invalid_address',
    label: 'Invalid email',
    short: 'Malformed or missing address',
  },
  mailbox_unavailable: {
    key: 'mailbox_unavailable',
    label: 'Bounce / mailbox missing',
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
    short: 'ZeptoMail / Campaigns setup issue',
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
  const text = `${failure.displayMessage || ''} ${failure.error || ''} ${failure.reason || ''} ${failure.code || ''}`.toLowerCase();
  if (
    /invalid email|email address is required|no valid email|missing email|malformed|bad address|not a valid email|invalid recipient|invalid.?to/i.test(
      text
    )
  ) {
    return 'invalid_address';
  }
  if (
    /bounce|hard.?bounce|soft.?bounce|mailbox (not found|unavailable|does not exist)|user unknown|recipient rejected|no such user|550\b|5\.1\.1|address rejected|undeliverable|does not exist|account does not exist|unknown recipient|inactive mailbox|mailbox full|over quota/i.test(
      text
    )
  ) {
    return 'mailbox_unavailable';
  }
  if (/unsubscrib|opted.?out|opt.?out|no marketing consent|not eligible for marketing/.test(text)) {
    return 'unsubscribed';
  }
  if (/spam|blocked|blacklist|reputation|suppress|sm_111|not verified/.test(text) && /spam|block|blacklist|suppress|reputation/.test(text)) {
    return 'blocked';
  }
  if (
    /not configured|not verified|oauth|zoho campaigns|zeptomail|smtp|sender|verified domain|credentials|api key|sm_111|auth_failed|authentication failed/i.test(
      text
    )
  ) {
    return 'configuration';
  }
  if (!text.trim()) return 'other';
  return 'provider_error';
}

export function normalizeFailureEntry(failure = {}) {
  const email = String(failure.email || failure.to || '').trim();
  const displayMessage =
    failure.displayMessage || failure.error || failure.reason || failure.message || 'Send failed';
  const reasonCode = classifyFailureReason({ ...failure, displayMessage });
  return {
    email,
    error: failure.error || displayMessage,
    displayMessage,
    reasonCode,
  };
}

export function normalizeSuccessEntry(entry) {
  if (typeof entry === 'string') return { email: entry };
  if (entry && typeof entry === 'object') {
    return { email: String(entry.email || entry.to || '').trim(), messageId: entry.messageId || '' };
  }
  return { email: '' };
}

export function buildFailureBreakdown(failures = []) {
  const counts = {};
  const groups = {};
  const normalized = failures.map(normalizeFailureEntry);
  for (const failure of normalized) {
    const code = failure.reasonCode || 'other';
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
  return { counts, rows, failures: normalized };
}

export function buildSendReportPayload({
  title,
  channel = 'transactional',
  provider = '',
  successList = [],
  failedList = [],
  skipped = 0,
  selectedTotal = null,
}) {
  const successes = (successList || []).map(normalizeSuccessEntry).filter((s) => s.email);
  const breakdown = buildFailureBreakdown(failedList || []);
  const failures = breakdown.failures;
  const sent = successes.length;
  const failed = failures.length;
  const totalAttempted = sent + failed;
  const selected =
    selectedTotal != null ? Number(selectedTotal) : totalAttempted + Number(skipped || 0);
  const skippedCount = Math.max(0, Number(skipped) || Math.max(0, selected - totalAttempted));
  const successRate =
    totalAttempted > 0 ? `${((sent / totalAttempted) * 100).toFixed(1)}%` : '0%';

  const resolvedProvider =
    provider ||
    (channel === 'marketing' ? 'Zoho Campaigns' : 'ZeptoMail / transactional');

  return {
    title,
    channel,
    provider: resolvedProvider,
    total: selected,
    attempted: totalAttempted,
    sent,
    failed,
    skipped: skippedCount,
    successRate,
    failures,
    successes,
    failureBreakdown: breakdown.rows,
    failureCounts: breakdown.counts,
    completedAt: new Date().toISOString(),
  };
}

/** Accurate toast copy — always states both accepted and failed when mixed. */
export function formatSendOutcomeToast({ sent = 0, failed = 0, skipped = 0, channel = 'transactional' }) {
  const noun = channel === 'marketing' ? 'campaign' : 'email';
  const s = Number(sent) || 0;
  const f = Number(failed) || 0;
  const k = Number(skipped) || 0;
  const skipBit = k > 0 ? ` · ${k.toLocaleString()} skipped (no email)` : '';

  if (s > 0 && f > 0) {
    return {
      type: 'warning',
      message: `${s.toLocaleString()} ${noun}${s === 1 ? '' : 's'} accepted, ${f.toLocaleString()} failed — see delivery report${skipBit}`,
      duration: 8000,
    };
  }
  if (s > 0 && f === 0) {
    return {
      type: 'success',
      message:
        s === 1
          ? `${channel === 'marketing' ? 'Campaign' : 'Email'} accepted for delivery${skipBit}`
          : `${s.toLocaleString()} ${noun}${s === 1 ? '' : 's'} accepted for delivery${skipBit}`,
      duration: 5000,
    };
  }
  if (s === 0 && f > 0) {
    return {
      type: 'error',
      message: `${f.toLocaleString()} ${noun}${f === 1 ? '' : 's'} failed — see delivery report for reasons${skipBit}`,
      duration: 8000,
    };
  }
  return {
    type: 'warning',
    message: `No messages were sent${skipBit}`,
    duration: 6000,
  };
}

export function showSendOutcomeToast(toastApi, outcome) {
  const { type, message, duration } = formatSendOutcomeToast(outcome);
  try {
    const api = toastApi && typeof toastApi === 'object' ? toastApi : null;
    if (type === 'success' && typeof api?.success === 'function') {
      api.success(message, duration);
      return;
    }
    if (type === 'warning' && typeof api?.warning === 'function') {
      api.warning(message, duration);
      return;
    }
    if (type === 'error' && typeof api?.error === 'function') {
      api.error(message, duration);
      return;
    }
    // Fallbacks so mixed results never go silent
    if (typeof api?.info === 'function') {
      api.info(message, duration);
      return;
    }
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(message);
    }
  } catch (err) {
    console.warn('[emailSendReport] toast failed:', err?.message || err, message);
  }
}
