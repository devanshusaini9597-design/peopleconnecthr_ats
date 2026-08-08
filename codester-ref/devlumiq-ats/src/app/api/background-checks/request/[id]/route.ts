import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, withPermission } from '@/lib/with-permission';
import { requireOrgId, isOrgError } from '@/lib/require-org';

// DELETE /api/background-checks/request/:id - Delete a background check
export const DELETE = withPermission('RUN_BACKGROUND_CHECKS', async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  session,
) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { id } = await params;

    const existingCheck = await prisma.backgroundCheck.findFirst({
      where: {
        id,
        candidate: { organizationId: orgId },
      },
    });

    if (!existingCheck) {
      return NextResponse.json(
        { error: 'Background check not found' },
        { status: 404 },
      );
    }

    await prisma.backgroundCheck.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Background check deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting background check:', error);
    return NextResponse.json(
      { error: 'Failed to delete background check' },
      { status: 500 },
    );
  }
});

// GET /api/background-checks/request/:id - Get single background check
export const GET = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  session,
) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { id } = await params;

    const check = await prisma.backgroundCheck.findFirst({
      where: {
        id,
        candidate: { organizationId: orgId },
      },
      include: {
        candidate: {
          select: { id: true, name: true, email: true },
        },
        application: {
          select: {
            job: {
              select: { title: true },
            },
          },
        },
      },
    });

    if (!check) {
      return NextResponse.json(
        { error: 'Background check not found' },
        { status: 404 },
      );
    }

    return NextResponse.json(check);
  } catch (error) {
    console.error('Error fetching background check:', error);
    return NextResponse.json(
      { error: 'Failed to fetch background check' },
      { status: 500 },
    );
  }
});
