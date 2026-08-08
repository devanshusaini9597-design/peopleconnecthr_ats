import { describe, it, expect } from 'vitest';
import { normalizePhone, isValidE164 } from '@/lib/messaging';

describe('messaging helpers', () => {
  it('normalizes US 10-digit phones to E.164', () => {
    expect(normalizePhone('(555) 123-4567')).toBe('+15551234567');
    expect(normalizePhone('5551234567')).toBe('+15551234567');
  });

  it('keeps already-international numbers', () => {
    expect(normalizePhone('+44 7700 900123')).toBe('+447700900123');
  });

  it('validates E.164', () => {
    expect(isValidE164('+15551234567')).toBe(true);
    expect(isValidE164('5551234567')).toBe(false);
    expect(isValidE164('+0123')).toBe(false);
  });
});
