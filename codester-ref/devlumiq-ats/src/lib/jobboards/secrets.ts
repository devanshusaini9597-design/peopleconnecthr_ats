import { encrypt, decrypt } from '@/lib/encryption';

/** Encrypt secret if ENCRYPTION_KEY is configured; otherwise store plaintext (dev). */
export function maybeEncryptSecret(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return value;
  if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 64) return value;
  try {
    if (looksEncrypted(value)) return value;
    return encrypt(value);
  } catch {
    return value;
  }
}

function looksEncrypted(value: string): boolean {
  try {
    const buf = Buffer.from(value, 'base64');
    return buf.length > 28 && Buffer.from(value, 'base64').toString('base64') === value;
  } catch {
    return false;
  }
}

export function decryptSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 64) return value;
  try {
    return decrypt(value);
  } catch {
    return value; // legacy plaintext
  }
}
