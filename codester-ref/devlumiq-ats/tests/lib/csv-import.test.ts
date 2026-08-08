import { describe, it, expect } from 'vitest';
import {
  parseCsvText,
  autoMapHeaders,
  validateAndMapRows,
} from '@/lib/csv-import';

describe('csv-import', () => {
  it('parses quoted CSV with commas', () => {
    const text = 'name,email,location\n"Doe, Jane",jane@ex.com,"Austin, TX"\n';
    const { headers, rows } = parseCsvText(text);
    expect(headers).toEqual(['name', 'email', 'location']);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Doe, Jane');
    expect(rows[0].location).toBe('Austin, TX');
  });

  it('auto-maps common header aliases', () => {
    const mapping = autoMapHeaders(['Full Name', 'E-mail', 'Phone Number', 'Years of Experience']);
    expect(mapping.name).toBe('Full Name');
    expect(mapping.email).toBe('E-mail');
    expect(mapping.phone).toBe('Phone Number');
    expect(mapping.experience).toBe('Years of Experience');
  });

  it('validates required fields and rejects bad emails', () => {
    const { headers, rows } = parseCsvText(
      'name,email\nJane,not-an-email\n,missing@ex.com\nValid User,valid@ex.com\n',
    );
    const mapping = autoMapHeaders(headers);
    const { valid, errors } = validateAndMapRows(rows, mapping);
    expect(valid).toHaveLength(1);
    expect(valid[0].email).toBe('valid@ex.com');
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  it('detects duplicate emails within the file', () => {
    const { headers, rows } = parseCsvText(
      'name,email\nA,a@ex.com\nB,a@ex.com\n',
    );
    const mapping = autoMapHeaders(headers);
    const { valid, errors } = validateAndMapRows(rows, mapping);
    expect(valid).toHaveLength(1);
    expect(errors.some((e) => e.message.includes('Duplicate'))).toBe(true);
  });
});
