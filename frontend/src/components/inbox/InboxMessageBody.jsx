import React from 'react';
import { Paperclip } from 'lucide-react';
import EmailHtmlFrame from '../ui/EmailHtmlFrame';
import {
  extractReplyAndQuote,
  looksLikeHtml,
  stripInternalMailStamps,
  splitQuotedHtml,
  unclipEmailHtml,
  downloadInboxAttachment,
} from './mailBody';
import { authenticatedFetch } from '../../utils/fetchUtils';

function AttachmentList({ message, threadId }) {
  const list = Array.isArray(message?.attachments) ? message.attachments.filter((a) => a.filename) : [];
  if (!list.length || !threadId) return null;
  return (
    <div className="flex flex-wrap gap-1.5 px-1">
      {list.map((a) => (
        <button
          key={a._id || a.filename}
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-stone-700 hover:bg-stone-50"
          onClick={() => downloadInboxAttachment(authenticatedFetch, threadId, message._id, a._id, a.filename).catch(() => {})}
        >
          <Paperclip className="w-3 h-3" />
          {a.filename}
        </button>
      ))}
    </div>
  );
}

function MailFrame({ html, title, minHeight = 160 }) {
  return (
    <div className="rounded-xl border border-stone-200/80 bg-white overflow-x-auto">
      <EmailHtmlFrame
        html={unclipEmailHtml(html)}
        title={title}
        autoHeight
        minHeight={minHeight}
        maxHeight={8000}
        className="w-full border-0 bg-white"
      />
    </div>
  );
}

function stripTags(value) {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export default function InboxMessageBody({ message, threadId }) {
  const html = String(message?.bodyHtml || '').trim();
  const text = String(message?.body || '').trim();
  const isEmail = (message?.channel || 'email') === 'email';
  const inbound = message?.direction === 'inbound';
  const htmlSource = stripInternalMailStamps(
    looksLikeHtml(html) ? html : (looksLikeHtml(text) ? text : '')
  );
  const files = <AttachmentList message={message} threadId={threadId} />;

  if (isEmail && inbound) {
    const parts = splitQuotedHtml(htmlSource);
    const { reply } = extractReplyAndQuote(text);
    const replyText = reply || stripTags(parts.replyHtml || htmlSource) || text || '(empty message)';
    return (
      <div className="space-y-2">
        <div className="rounded-xl border border-stone-200/80 bg-white px-5 py-4 text-[14px] leading-relaxed text-stone-800 whitespace-pre-wrap break-words">
          {replyText}
        </div>
        {files}
      </div>
    );
  }

  if (isEmail && htmlSource) {
    return (
      <div className="space-y-2">
        <MailFrame html={htmlSource} title={message.subject || 'Email'} minHeight={240} />
        {files}
      </div>
    );
  }

  if (isEmail) {
    const { reply } = extractReplyAndQuote(text);
    return (
      <div className="space-y-2">
        <div className="rounded-xl border border-stone-200/80 bg-white px-5 py-4 text-[14px] leading-relaxed text-stone-800 whitespace-pre-wrap break-words">
          {reply || text || '(empty message)'}
        </div>
        {files}
      </div>
    );
  }

  return (
    <>
    <div
      className={`max-w-[92%] sm:max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
        message.direction === 'outbound'
          ? 'ml-auto bg-brand-600 text-white rounded-br-md'
          : 'mr-auto bg-white border border-stone-200/80 text-stone-800 rounded-bl-md'
      }`}
    >
      <div className="whitespace-pre-wrap break-words">{text}</div>
    </div>
    {files}
    </>
  );
}
