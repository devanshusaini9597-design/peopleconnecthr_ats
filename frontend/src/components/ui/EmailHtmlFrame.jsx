import React, { useEffect, useState, useCallback, useRef } from 'react';
import { unclipEmailHtml } from '../inbox/mailBody';

const CLIP_FIX = `<style id="ats-mail-overflow">
html,body{margin:0 !important;overflow:visible !important;max-height:none !important;height:auto !important;}
img{max-width:100% !important;height:auto !important;}
table,td,blockquote,.gmail_quote,.gmail_quote_container{max-height:none !important;overflow:visible !important;}
</style>`;

function toDocument(body) {
  const raw = unclipEmailHtml(String(body || '').trim());
  if (/<html[\s>]/i.test(raw)) {
    if (/<\/head>/i.test(raw)) return raw.replace(/<\/head>/i, `${CLIP_FIX}</head>`);
    return raw.replace(/<html[^>]*>/i, (m) => `${m}<head>${CLIP_FIX}</head>`);
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><base target="_blank">${CLIP_FIX}
<style>
body{padding:16px 20px;font-family:Segoe UI,Calibri,Arial,sans-serif;font-size:14px;line-height:1.6;color:#1c1917;background:#fff;}
a{color:#0f766e;}blockquote{margin:12px 0;padding:0 0 0 12px;border-left:3px solid #e7e5e4;color:#57534e;}
</style></head><body>${raw}</body></html>`;
}

function unclipDom(doc) {
  if (!doc?.body) return;
  const nodes = [doc.documentElement, doc.body, ...doc.body.querySelectorAll('*')];
  nodes.forEach((el) => {
    const style = String(el.getAttribute('style') || '');
    if (/display\s*:\s*none/i.test(style) && /max-height\s*:\s*0/i.test(style)) return;
    el.style.setProperty('overflow', 'visible', 'important');
    el.style.setProperty('max-height', 'none', 'important');
  });
}

function measureDoc(doc) {
  if (!doc) return 0;
  const body = doc.body;
  const el = doc.documentElement;
  return Math.max(
    body?.scrollHeight || 0,
    el?.scrollHeight || 0
  );
}

/**
 * Full email HTML inside a blob iframe.
 * Unclips Gmail overflow and grows (or scrolls) so the letter is never cut off.
 */
export default function EmailHtmlFrame({
  html = '',
  title = 'Email preview',
  className = 'w-full border-0 bg-white',
  style,
  autoHeight = false,
  minHeight = 220,
  maxHeight = 20000,
}) {
  const [blobUrl, setBlobUrl] = useState('');
  const [height, setHeight] = useState(minHeight);
  const frameRef = useRef(null);

  useEffect(() => {
    const body = String(html || '').trim();
    if (!body) {
      setBlobUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(new Blob([toDocument(body)], { type: 'text/html;charset=utf-8' }));
    setBlobUrl(url);
    setHeight(minHeight);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [html, minHeight]);

  const applyHeight = useCallback((iframe) => {
    if (!autoHeight || !iframe) return;
    try {
      const doc = iframe.contentDocument;
      if (!doc) return;
      unclipDom(doc);
      const h = measureDoc(doc);
      if (h) setHeight(Math.min(Math.max(h + 24, minHeight), maxHeight));
    } catch {
      /* cross-origin */
    }
  }, [autoHeight, minHeight, maxHeight]);

  const onLoad = useCallback((e) => {
    const iframe = e.currentTarget;
    applyHeight(iframe);
    try {
      const doc = iframe.contentDocument;
      if (!doc) return;
      Array.from(doc.images || []).forEach((img) => {
        img.addEventListener('load', () => applyHeight(iframe));
      });
      [50, 200, 600, 1200].forEach((ms) => setTimeout(() => applyHeight(iframe), ms));
    } catch {
      /* ignore */
    }
  }, [applyHeight]);

  if (!String(html || '').trim()) return null;
  if (!blobUrl) {
    return <div className="w-full animate-pulse bg-stone-50" style={{ minHeight }} />;
  }

  const box = style || {
    height: autoHeight ? height : 'min(80vh, 900px)',
    minHeight: `${minHeight}px`,
    width: '100%',
    overflow: 'auto',
  };

  return (
    <iframe
      ref={frameRef}
      src={blobUrl}
      title={title}
      className={className}
      style={box}
      sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
      referrerPolicy="no-referrer"
      scrolling="yes"
      onLoad={onLoad}
    />
  );
}
