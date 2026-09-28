/** Split Gmail/Outlook quoted replies for list previews and text fallback. */

export function stripQuotePrefixes(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.replace(/^(>\s?)+/, ''))
    .join('\n')
    .trim();
}

export function extractReplyAndQuote(text) {
  const raw = String(text || '').replace(/\r\n/g, '\n').slice(0, 12000).trim();
  if (!raw) return { reply: '', quote: '' };

  try {
    const gmail = raw.match(/^([\s\S]*?)\n\s*On .{8,160}wrote:\s*\n([\s\S]*)$/i);
    if (gmail && gmail[1].trim()) {
      return { reply: gmail[1].trim(), quote: stripQuotePrefixes(gmail[2]) };
    }

    const outlook = raw.match(/^([\s\S]*?)\n-{2,}\s*Original Message\s*-{2,}([\s\S]*)$/i);
    if (outlook && outlook[1].trim()) {
      return { reply: outlook[1].trim(), quote: String(outlook[2] || '').trim() };
    }
  } catch {
    return { reply: raw.replace(/\s+/g, ' ').trim(), quote: '' };
  }

  const lines = raw.split('\n');
  const replyLines = [];
  const quoteLines = [];
  let quoting = false;
  for (const line of lines) {
    if (!quoting && (/^\s*>/.test(line) || /^On .+ wrote:\s*$/i.test(line))) quoting = true;
    if (quoting) quoteLines.push(line);
    else replyLines.push(line);
  }
  const reply = replyLines.join('\n').trim();
  const quote = stripQuotePrefixes(quoteLines.join('\n'));
  return { reply: reply || raw, quote: reply ? quote : '' };
}

export function extractQuotedOriginalHtml(quoteHtml) {
  const raw = String(quoteHtml || '');
  if (!raw) return '';
  const full = raw.match(/<!DOCTYPE[\s\S]*<\/html>/i);
  if (full) return full[0];
  const htmlDoc = raw.match(/<html[\s\S]*<\/html>/i);
  if (htmlDoc) return htmlDoc[0];
  const tables = raw.match(/<table[\s\S]*?<\/table>/gi) || [];
  if (tables.length) {
    return tables.slice().sort((a, b) => b.length - a.length)[0];
  }
  return raw.replace(/<div[^>]*class="[^"]*gmail_attr[^"]*"[^>]*>[\s\S]*?<\/div>/i, '').trim();
}

export function decodeMailLabel(value) {
  return String(value || '')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export function looksLikeHtml(value) {
  const s = String(value || '').trim();
  return /<(html|body|div|table|p|br|img|span)\b/i.test(s);
}

/** Hide internal routing stamps from the reading pane (old “Hiring contact” line). */
export function stripInternalMailStamps(html) {
  return String(html || '')
    .replace(/<p[^>]*>[\s\S]*?Hiring contact:[\s\S]*?<\/p>/gi, '')
    .replace(/<!--\s*pc-hiring-contact:[^>]*-->/gi, '');
}

/** Gmail clips quoted branded mail with overflow:hidden — undo that in stored HTML. */
export function unclipEmailHtml(html) {
  let s = String(html || '');
  if (!s) return s;
  const hold = [];
  s = s.replace(/display\s*:\s*none\s*;\s*max-height\s*:\s*0(?:px)?\s*;\s*overflow\s*:\s*hidden/gi, () => {
    hold.push('display:none;max-height:0;overflow:hidden');
    return `%%ATS_PREHEADER_${hold.length}%%`;
  });
  s = s.replace(/overflow\s*:\s*hidden/gi, 'overflow:visible');
  s = s.replace(/max-height\s*:\s*\d+(?:\.\d+)?px/gi, 'max-height:none');
  hold.forEach((orig, i) => {
    s = s.replace(`%%ATS_PREHEADER_${i + 1}%%`, orig);
  });
  return s;
}

export function splitQuotedHtml(html) {
  const raw = String(html || '').trim();
  if (!raw) return { replyHtml: '', quoteHtml: '', quoteLabel: '' };

  const gmail = raw.match(/^([\s\S]*?)(<div[^>]*class="[^"]*gmail_quote[\s\S]*)$/i);
  if (gmail && gmail[1].replace(/<br\s*\/?>/gi, '').replace(/<[^>]+>/g, '').trim()) {
    const attr = gmail[2].match(/gmail_attr[^>]*>([\s\S]*?)<\/div>/i);
    const label = attr ? String(attr[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
    return { replyHtml: gmail[1].trim(), quoteHtml: gmail[2].trim(), quoteLabel: label };
  }

  const wrote = raw.match(/^([\s\S]*?)(<div[^>]*>\s*On .{8,180}wrote:[\s\S]*)$/i);
  if (wrote && wrote[1].replace(/<[^>]+>/g, '').trim()) {
    return { replyHtml: wrote[1].trim(), quoteHtml: wrote[2].trim(), quoteLabel: 'Original email' };
  }

  return { replyHtml: raw, quoteHtml: '', quoteLabel: '' };
}

export async function downloadInboxAttachment(authenticatedFetch, threadId, messageId, attachmentId, filename) {
  const res = await authenticatedFetch(
    `/api/inbox/threads/${threadId}/messages/${messageId}/attachments/${attachmentId}`
  );
  if (!res.ok) throw new Error('Could not download attachment');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'attachment';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function listPreview(text) {
  try {
    const { reply } = extractReplyAndQuote(text);
    return String(reply || text || '').replace(/\s+/g, ' ').trim().slice(0, 180);
  } catch {
    return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 180);
  }
}

export function relativeWhen(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const diff = Date.now() - t;
  if (diff < 60 * 1000) return 'just now';
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
