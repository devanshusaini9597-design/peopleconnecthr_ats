import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission } from '@/lib/with-permission';
import { ROLES } from '@/lib/roles';
import { invalidateAllSessions } from '@/lib/auth';

/** PATCH /api/users/[id] — update role or active status (ADMIN only) */
export const PATCH = withPermission(
  'MANAGE_USERS',
  async (request: NextRequest, ctx, session) => {
    try {
      const { id } = await (ctx.params as Promise<{ id: string }>);

      if (id === session.id) {
        return NextResponse.json({ error: 'You cannot modify your own account here' }, { status: 400 });
      }

      const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, organizationId: true } });
      if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      if (session.organizationId && target.organizationId !== session.organizationId) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const body = await request.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updates: Record<string, any> = {};

      if (body.role !== undefined) {
        const role = body.role.toString().toUpperCase();
        if (!Object.keys(ROLES).includes(role)) {
          return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
        }
        updates.role = role;
      }

      if (body.isActive !== undefined) {
        updates.isActive = Boolean(body.isActive);
      }

      if (body.name !== undefined) {
        const name = body.name.toString().trim();
        if (!name) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
        updates.name = name;
      }

      const updated = await prisma.user.update({
        where: { id },
        data: updates,
        select: { id: true, name: true, email: true, role: true, isActive: true },
      });

      // Log the role/status change and invalidate sessions so new permissions take effect immediately
      if (updates.role || updates.isActive === false) {
        await invalidateAllSessions(id);
      }
      if (updates.role) {
        await prisma.userActivityLog.create({
          data: {
            userId: session.id,
            action: 'role_change',
            metadata: { targetUserId: id, fromRole: target.role, toRole: updates.role },
          },
        }).catch(() => {});
      }

      return NextResponse.json({ user: updated });
    } catch (e) {
      console.error('PATCH /api/users/[id]', e);
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }
  },
);

/** DELETE /api/users/[id] — deactivate (soft delete) a user (ADMIN only) */
export const DELETE = withPermission(
  'MANAGE_USERS',
  async (_req: NextRequest, ctx, session) => {
    try {
      const { id } = await (ctx.params as Promise<{ id: string }>);

      if (id === session.id) {
        return NextResponse.json({ error: 'You cannot deactivate your own account' }, { status: 400 });
      }

      if (session.organizationId) {
        const target = await prisma.user.findUnique({ where: { id }, select: { organizationId: true } });
        if (!target || target.organizationId !== session.organizationId) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
      }

      await prisma.user.update({
        where: { id },
        data: { isActive: false },
      });

      // Kick the user out of all active sessions immediately
      await invalidateAllSessions(id);

      await prisma.userActivityLog.create({
        data: {
          userId: session.id,
          action: 'user_deactivated',
          metadata: { targetUserId: id },
        },
      }).catch(() => {});

      return NextResponse.json({ success: true });
    } catch (e) {
      console.error('DELETE /api/users/[id]', e);
      return NextResponse.json({ error: 'Failed to deactivate user' }, { status: 500 });
    }
  },
);
