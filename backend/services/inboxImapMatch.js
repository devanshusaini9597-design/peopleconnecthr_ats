/**
 * Pure helpers for IMAP ingest: hiring-contact stamp, plus-tags, subjects.
 */

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeSubject(value) {
  return String(value || '')
    .replace(/^\s*((re|fw|fwd|aw|sv|antw)\s*:\s*)+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Root of a Gmail-style conversation (strip Re: and leaked quote / preview tails). */
function conversationRootSubject(value) {
  let n = normalizeSubject(value);
  n = n.replace(/\s+On\s+(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b[\s\S]*$/i, '');
  n = n.replace(/\s+[—–]\s+.+$/, '');
  n = n.replace(/\s{2,}/g, ' ').trim();
  return n;
}

function conversationGroupKey(thread) {
  const email = normalizeEmail(thread?.participants?.candidateEmail);
  const root = conversationRootSubject(thread?.subject).toLowerCase() || '(none)';
  return `${threadOwnerKey(thread)}|${email}|${root}`;
}

function mergeConversationRows(into, from) {
  const ids = [...new Set([
    ...(into.conversationIds || [into._id]).map(String),
    ...(from.conversationIds || [from._id]).map(String),
  ])];
  const newer = new Date(from.lastMessageAt || 0) >= new Date(into.lastMessageAt || 0) ? from : into;
  const older = newer === from ? into : from;
  return {
    ...older,
    ...newer,
    conversationIds: ids,
    unreadCount: Number(into.unreadCount || 0) + Number(from.unreadCount || 0),
    starred: Boolean(into.starred || from.starred),
    lastMessagePreview: newestReplyPreview(newer.lastMessagePreview) || newer.lastMessagePreview || older.lastMessagePreview,
    subject: conversationRootSubject(newer.subject) || newer.subject || older.subject,
    messageCount: Number(into.messageCount || 1) + Number(from.messageCount || 1),
  };
}

function gmailFromLabel(thread, extraCount = 0) {
  const name = thread?.participants?.candidateName
    || thread?.participants?.candidateEmail
    || 'Unknown';
  const n = Math.max(Number(thread?.participantCount || 0), extraCount, (thread?.conversationIds || []).length > 1 ? 2 : 1);
  if (n > 1) return `${name}, me ${n}`;
  return name;
}

/**
 * Collapse Re: / quoted-subject siblings into one Gmail-style row.
 * Two employees mailing the same candidate stay separate (owner is in the key).
 * An unassigned IMAP row folds into the only assigned row for that person+subject.
 */
function groupInboxConversations(threads) {
  const map = new Map();
  for (const t of threads || []) {
    if (t.isDraft) {
      map.set(`draft:${t._id}`, { ...t, conversationIds: [t._id], lastMessagePreview: newestReplyPreview(t.lastMessagePreview) || t.lastMessagePreview });
      continue;
    }
    const k = conversationGroupKey(t);
    const row = {
      ...t,
      conversationIds: [t._id],
      lastMessagePreview: newestReplyPreview(t.lastMessagePreview) || t.lastMessagePreview,
      subject: conversationRootSubject(t.subject) || t.subject,
      messageCount: 1,
    };
    if (!map.has(k)) map.set(k, row);
    else map.set(k, mergeConversationRows(map.get(k), row));
  }

  const byRest = new Map();
  for (const [k] of map) {
    if (k.startsWith('draft:')) continue;
    const rest = k.slice(k.indexOf('|') + 1);
    if (!byRest.has(rest)) byRest.set(rest, []);
    byRest.get(rest).push(k);
  }
  for (const keys of byRest.values()) {
    const unassigned = keys.filter((k) => k.startsWith('unassigned|'));
    const assigned = keys.filter((k) => !k.startsWith('unassigned|'));
    if (assigned.length === 1 && unassigned.length) {
      let merged = map.get(assigned[0]);
      for (const u of unassigned) {
        merged = mergeConversationRows(merged, map.get(u));
        map.delete(u);
      }
      map.set(assigned[0], merged);
    } else if (assigned.length === 0 && unassigned.length > 1) {
      let merged = map.get(unassigned[0]);
      for (const u of unassigned.slice(1)) {
        merged = mergeConversationRows(merged, map.get(u));
        map.delete(u);
      }
      map.set(unassigned[0], merged);
    }
  }

  return [...map.values()]
    .map((t) => ({
      ...t,
      fromLabel: gmailFromLabel(t),
    }))
    .sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
}

function sameConversation(a, b) {
  if (!a || !b) return false;
  return conversationGroupKey(a) === conversationGroupKey(b)
    || (
      normalizeEmail(a.participants?.candidateEmail) === normalizeEmail(b.participants?.candidateEmail)
      && conversationRootSubject(a.subject).toLowerCase() === conversationRootSubject(b.subject).toLowerCase()
      && (threadOwnerKey(a) === 'unassigned' || threadOwnerKey(b) === 'unassigned' || threadOwnerKey(a) === threadOwnerKey(b))
    );
}

function htmlToText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse hiring-contact from campaign HTML: hidden marker, legacy stamp, or
 * “Name (email@x)” signature. Used so team@ replies stay on that employee.
 */
function parseHiringContact(text) {
  const raw = String(text || '');
  const hidden = raw.match(/pc-hiring-contact:\s*([^\s<>]+@[^\s<>]+)/i);
  if (hidden) {
    return { name: '', email: normalizeEmail(hidden[1]) };
  }
  const withName = raw.match(/Hiring contact:\s*([^<(]+?)\s*\(\s*([^)\s]+@[^)\s]+)\s*\)/i);
  if (withName) {
    return {
      name: String(withName[1] || '').trim(),
      email: normalizeEmail(withName[2]),
    };
  }
  const emailOnly = raw.match(/Hiring contact:\s*([^\s<]+@[^\s>,]+)/i);
  if (emailOnly) {
    return { name: '', email: normalizeEmail(emailOnly[1]) };
  }
  const regards = raw.match(/Kind regards,[\s\S]{0,80}?([^\s<]+@[^\s<]+)/i);
  if (regards) {
    return { name: '', email: normalizeEmail(regards[1]) };
  }
  return null;
}

function plusLocalFromAddress(address) {
  const email = normalizeEmail(address);
  const at = email.indexOf('@');
  if (at < 1) return '';
  const local = email.slice(0, at);
  const plus = local.indexOf('+');
  if (plus < 1) return '';
  return local.slice(plus + 1);
}

function subjectsLikelyMatch(a, b) {
  const left = normalizeSubject(a).toLowerCase();
  const right = normalizeSubject(b).toLowerCase();
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length >= 8 && right.includes(left)) return true;
  if (right.length >= 8 && left.includes(right)) return true;
  return false;
}

function stripQuotePrefixes(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.replace(/^(>\s?)+/, ''))
    .join('\n')
    .trim();
}

/**
 * Split a reply from the quoted original (Gmail/Outlook style).
 */
function extractReplyAndQuote(text) {
  const raw = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!raw) return { reply: '', quote: '' };

  const gmail = raw.match(/^([\s\S]*?)\n\s*On .{8,160}wrote:\s*\n([\s\S]*)$/i);
  if (gmail && gmail[1].trim()) {
    return { reply: gmail[1].trim(), quote: stripQuotePrefixes(gmail[2]) };
  }

  const outlook = raw.match(/^([\s\S]*?)\n-{2,}\s*Original Message\s*-{2,}([\s\S]*)$/i);
  if (outlook && outlook[1].trim()) {
    return { reply: outlook[1].trim(), quote: String(outlook[2] || '').trim() };
  }

  const lines = raw.split('\n');
  const replyLines = [];
  const quoteLines = [];
  let quoting = false;
  for (const line of lines) {
    if (!quoting && (/^\s*>/.test(line) || /^On .+ wrote:\s*$/i.test(line))) {
      quoting = true;
    }
    if (quoting) quoteLines.push(line);
    else replyLines.push(line);
  }
  const reply = replyLines.join('\n').trim();
  const quote = stripQuotePrefixes(quoteLines.join('\n'));
  return { reply: reply || raw, quote: reply ? quote : '' };
}

function newestReplyPreview(text, html) {
  const { reply } = extractReplyAndQuote(text || htmlToText(html));
  return String(reply || '').replace(/\s+/g, ' ').trim().slice(0, 180);
}

function threadOwnerKey(thread) {
  if (thread?.assignedTo) return `id:${thread.assignedTo}`;
  const email = normalizeEmail(thread?.assignedEmail);
  if (email) return `em:${email}`;
  return 'unassigned';
}

/**
 * Split one mixed thread into per-employee buckets. Outbound `sentBy`
 * starts a new owner; inbound follows hiring-contact stamp or the last
 * staff member who wrote in this conversation.
 */
function bucketMessagesByOwner(msgs, thread) {
  const buckets = new Map();
  let lastOwnerKey = threadOwnerKey(thread);
  for (const m of msgs || []) {
    let key = lastOwnerKey || 'unassigned';
    if (m.direction === 'outbound' && m.sentBy) {
      key = `id:${m.sentBy}`;
      lastOwnerKey = key;
    } else {
      const stamp = parseHiringContact(`${m.body || ''}\n${htmlToText(m.bodyHtml || '')}\n${m.subject || ''}`);
      if (stamp?.email) {
        key = `em:${stamp.email}`;
        lastOwnerKey = key;
      } else {
        key = lastOwnerKey || 'unassigned';
      }
    }
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(m);
  }
  return { buckets, keepKey: threadOwnerKey(thread) };
}

module.exports = {
  normalizeEmail,
  normalizeSubject,
  conversationRootSubject,
  conversationGroupKey,
  groupInboxConversations,
  sameConversation,
  gmailFromLabel,
  htmlToText,
  parseHiringContact,
  plusLocalFromAddress,
  subjectsLikelyMatch,
  extractReplyAndQuote,
  newestReplyPreview,
  threadOwnerKey,
  bucketMessagesByOwner,
};
