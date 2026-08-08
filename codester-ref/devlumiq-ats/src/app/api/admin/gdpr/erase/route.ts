import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission } from '@/lib/with-permission';
import { invalidateAllSessions } from '@/lib/auth';

/**
 * DELETE /api/admin/gdpr/erase?userId=
 * ADMIN only — anonymize all personal data for a user (GDPR Article 17 — Right to Erasure).
 * Soft anonymization: replaces PII with placeholder values, retains audit trail structure.
 */
export const DELETE = withPermission('MANAGE_USERS', async (request: NextRequest, _ctx, session) => {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId query param is required' }, { status: 400 });
  }

  if (userId === session.id) {
    return NextResponse.json({ error: 'You cannot erase your own account' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, organizationId: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (session.organizationId && user.organizationId !== session.organizationId) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const anonymizedEmail = `erased-${userId}@gdpr.deleted`;
  const anonymizedName = '[Erased User]';

  await prisma.$transaction(async (tx) => {
    // Anonymize user record
    await tx.user.update({
      where: { id: userId },
      data: {
        name: anonymizedName,
        email: anonymizedEmail,
        password: null,
        avatar: null,
        isActive: false,
        verificationToken: null,
        resetToken: null,
        inviteToken: null,
      },
    });

    // Remove session tracking data
    await tx.userSession.deleteMany({ where: { userId } });

    // Anonymize activity logs (keep structure, remove metadata PII)
    await tx.userActivityLog.updateMany({
      where: { userId },
      data: { metadata: {} },
    });
  });

  // Force-logout the erased user
  await invalidateAllSessions(userId).catch(() => {});

  await prisma.userActivityLog.create({
    data: {
      userId: session.id,
      action: 'gdpr_erase',
      metadata: { targetUserId: userId, anonymizedEmail },
    },
  }).catch(() => {});

  return NextResponse.json({
    success: true,
    message: `User data for ${userId} has been anonymized in compliance with GDPR Article 17.`,
  });
});
