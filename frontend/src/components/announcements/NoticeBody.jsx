import React from 'react';
import { plainText, sanitizeNoticeHtml } from './announcementsConstants';

export default function NoticeBody({ body, className = '' }) {
  const raw = String(body || '');
  if (!raw.trim()) return null;
  if (!/<[a-z][\s\S]*>/i.test(raw)) {
    return <p className={`whitespace-pre-wrap break-words ${className}`}>{raw}</p>;
  }
  return (
    <div
      className={`ann-html break-words [&_a]:text-brand-700 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizeNoticeHtml(raw) }}
    />
  );
}

export function noticePreviewText(body) {
  return plainText(body).replace(/\s+/g, ' ');
}
