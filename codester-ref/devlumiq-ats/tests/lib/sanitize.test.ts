import { describe, it, expect, beforeAll } from 'vitest';
import { JSDOM } from 'jsdom';
import { sanitizeHtml, sanitizeText } from '@/lib/sanitize';

describe('sanitizeHtml', () => {
  // First DOMPurify/jsdom init can be slow on cold start
  beforeAll(() => {
    sanitizeHtml('<p>warm</p>');
  }, 30_000);

  it('allows safe formatting tags', () => {
    const clean = sanitizeHtml('<p>Hello <strong>world</strong></p>');
    expect(clean).toContain('<p>');
    expect(clean).toContain('<strong>');
    expect(clean).toContain('Hello');
  });

  it('strips script tags', () => {
    const clean = sanitizeHtml('<p>Hi</p><script>alert(1)</script>');
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('alert');
  });

  it('blocks javascript: URLs', () => {
    const clean = sanitizeHtml('<a href="javascript:alert(1)">x</a>');
    expect(clean.toLowerCase()).not.toContain('javascript:');
  });

  it('blocks data: URLs', () => {
    const clean = sanitizeHtml('<a href="data:text/html,<script>alert(1)</script>">x</a>');
    expect(clean.toLowerCase()).not.toMatch(/href=["']data:/);
  });

  /**
   * Regression: the old regex sanitizer re-emitted attribute values without
   * re-encoding, so a single-quoted value containing `"` could break out and
   * inject onmouseover as a live attribute. DOMPurify must encode the breakout
   * so it stays inside the href value and is never a real event handler.
   */
  it('does not allow quote-breakout attribute injection', () => {
    const dirty = `<a href='https://x.com" onmouseover="alert(1)'>click</a>`;
    const clean = sanitizeHtml(dirty);

    // Parse as HTML — the breakout must not become a live onmouseover attribute
    const { document } = new JSDOM(clean).window;
    const anchor = document.querySelector('a');
    expect(anchor).toBeTruthy();
    expect(anchor!.getAttribute('onmouseover')).toBeNull();
    expect(anchor!.getAttributeNames().some((n: string) => n.startsWith('on'))).toBe(false);
    // Href may contain the encoded junk, but must not be a javascript: URL
    const href = (anchor!.getAttribute('href') || '').toLowerCase();
    expect(href.startsWith('javascript:')).toBe(false);
  });

  it('does not allow event handler attributes', () => {
    const clean = sanitizeHtml('<p onclick="alert(1)" onerror="alert(2)">x</p>');
    expect(clean.toLowerCase()).not.toContain('onclick');
    expect(clean.toLowerCase()).not.toContain('onerror');
  });
});

describe('sanitizeText', () => {
  it('strips all tags', () => {
    expect(sanitizeText('<p>Hello <b>world</b></p>')).toBe('Hello world');
  });
});
