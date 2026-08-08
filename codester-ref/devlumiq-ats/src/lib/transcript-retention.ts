/**
 * Purge interview transcripts past retention policy.
 * Call from cron route or instrumentation interval.
 */

import { prisma } from '@/lib/prisma';

export async function purgeExpiredTranscripts(): Promise<number> {
  const rows = await prisma.interviewTranscript.findMany({
    include: {
      interview: {
        select: { id: true, transcriptRetentionDays: true, createdAt: true, updatedAt: true },
      },
    },
    take: 500,
  });

  let deleted = 0;
  const now = Date.now();

  for (const row of rows) {
    const days = row.interview.transcriptRetentionDays ?? 90;
    const base = row.createdAt.getTime();
    const expiry = base + days * 24 * 60 * 60 * 1000;
    if (now > expiry) {
      await prisma.interviewTranscript.delete({ where: { id: row.id } });
      deleted++;
    }
  }

  return deleted;
}
