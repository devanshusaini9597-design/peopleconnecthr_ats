import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { withPermission } from '@/lib/with-permission';

const prisma = new PrismaClient();

// Bulk delete candidates
export const DELETE = withPermission('DELETE_CANDIDATE', async (request: NextRequest) => {
  try {
    const { ids } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'No candidate IDs provided' },
        { status: 400 }
      );
    }

    // Delete applications first (foreign key constraint)
    await prisma.application.deleteMany({
      where: { candidateId: { in: ids } },
    });

    // Delete other related records
    await prisma.candidateNote.deleteMany({
      where: { candidateId: { in: ids } },
    });

    await prisma.comment.deleteMany({
      where: { candidateId: { in: ids } },
    });

    await prisma.resume.deleteMany({
      where: { candidateId: { in: ids } },
    });

    // Delete candidates
    const result = await prisma.candidate.deleteMany({
      where: { id: { in: ids } },
    });

    return NextResponse.json({
      success: true,
      deleted: result.count,
    });
  } catch (error) {
    console.error('Error in bulk delete:', error);
    return NextResponse.json(
      { error: 'Failed to delete candidates' },
      { status: 500 }
    );
  }
});

// Bulk update candidate status
export const PATCH = withPermission('MOVE_APPLICATION', async (request: NextRequest) => {
  try {
    const { ids, stage } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0 || !stage) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Update applications for these candidates
    // Since we need jobId for applications, we'll update the most recent application
    const candidates = await prisma.candidate.findMany({
      where: { id: { in: ids } },
      include: { applications: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    const updates = [];
    for (const candidate of candidates) {
      if (candidate.applications.length > 0) {
        const application = candidate.applications[0];
        updates.push(
          prisma.application.update({
            where: { id: application.id },
            data: { stage },
          })
        );
      }
    }

    await Promise.all(updates);

    // Create activity logs
    await prisma.activityLog.createMany({
      data: ids.map((id) => ({
        type: 'status_changed',
        payload: JSON.stringify({
          candidateId: id,
          to: stage,
          timestamp: new Date().toISOString(),
        }),
      })),
    });

    return NextResponse.json({
      success: true,
      updated: updates.length,
    });
  } catch (error) {
    console.error('Error in bulk update:', error);
    return NextResponse.json(
      { error: 'Failed to update candidates' },
      { status: 500 }
    );
  }
});
