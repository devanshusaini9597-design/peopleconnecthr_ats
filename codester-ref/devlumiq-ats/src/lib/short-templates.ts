/**
 * Derive SMS / WhatsApp short-form copy from email templates.
 */

export function htmlToPlainShort(html: string, maxLen = 320): string {
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1).trimEnd() + '…';
}

export function resolveChannelBody(
  template: { body: string; smsBody?: string | null; whatsappBody?: string | null },
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP',
): string {
  if (channel === 'SMS') {
    return template.smsBody?.trim() || htmlToPlainShort(template.body, 320);
  }
  if (channel === 'WHATSAPP') {
    return template.whatsappBody?.trim() || htmlToPlainShort(template.body, 1000);
  }
  return template.body;
}

export function applyTemplateVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}
