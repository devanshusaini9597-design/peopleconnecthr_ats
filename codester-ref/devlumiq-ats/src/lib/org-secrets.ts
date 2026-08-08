/**
 * Resolve BYOK provider secrets: org encrypted key first, then env fallbacks.
 */

import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

/**
 * Returns the first available secret for a provider.
 * Prefers an active org-stored encrypted key, then the first non-empty env fallback.
 */
export async function getProviderSecret(
  organizationId: string | null | undefined,
  provider: string,
  envFallbacks: string[],
): Promise<string | null> {
  if (organizationId) {
    try {
      const row = await prisma.orgApiKeyConfig.findUnique({
        where: {
          organizationId_provider: { organizationId, provider },
        },
      });
      if (row?.isActive && row.encryptedKey) {
        try {
          const raw = decrypt(row.encryptedKey);
          if (raw?.trim()) return raw.trim();
        } catch {
          /* ENCRYPTION_KEY missing/changed — fall through to env */
        }
      }
    } catch {
      /* DB unavailable — fall through to env */
    }
  }

  for (const name of envFallbacks) {
    const v = (process.env[name] || '').trim();
    if (v) return v;
  }
  return null;
}
