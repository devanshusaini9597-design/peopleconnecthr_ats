/**
 * Non-fatal analytics metric writers.
 * Never throw — stage moves and applies must succeed for existing buyers.
 */

import { prisma } from './prisma';

function hoursBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60)));
}

function startOfDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Record pipeline stage entry after a stage change */
export async function recordPipelineStageChange(opts: {
  jobId: string;
  stageName: string;
  organizationId: string;
}): Promise<void> {
  try {
    await prisma.pipelineMetric.create({
      data: {
        jobId: opts.jobId,
        stageName: opts.stageName,
        date: startOfDay(),
        period: 'daily',
        candidatesIn: 1,
        candidatesOut: 0,
      },
    });
  } catch {
    /* non-fatal */
  }
}

/** Upsert source quality counters for org */
export async function recordSourceEvent(opts: {
  organizationId: string;
  source: string | null | undefined;
  event: 'applicant' | 'screening' | 'interview' | 'offer' | 'hire';
}): Promise<void> {
  try {
    const source = (opts.source || 'direct').toLowerCase();
    const periodStart = new Date();
    periodStart.setDate(1);
    periodStart.setHours(0, 0, 0, 0);

    const existing = await prisma.sourceQualityMetric.findFirst({
      where: {
        organizationId: opts.organizationId,
        source,
        period: 'monthly',
        date: { gte: periodStart },
      },
    });

    const bump = {
      totalApplicants: opts.event === 'applicant' ? 1 : 0,
      passedScreening: opts.event === 'screening' ? 1 : 0,
      interviews: opts.event === 'interview' ? 1 : 0,
      offers: opts.event === 'offer' ? 1 : 0,
      hires: opts.event === 'hire' ? 1 : 0,
    };

    if (existing) {
      await prisma.sourceQualityMetric.update({
        where: { id: existing.id },
        data: {
          totalApplicants: { increment: bump.totalApplicants },
          passedScreening: { increment: bump.passedScreening },
          interviews: { increment: bump.interviews },
          offers: { increment: bump.offers },
          hires: { increment: bump.hires },
        },
      });
    } else {
      await prisma.sourceQualityMetric.create({
        data: {
          organizationId: opts.organizationId,
          source,
          date: periodStart,
          period: 'monthly',
          ...bump,
        },
      });
    }
  } catch {
    /* non-fatal */
  }
}

/** Write / update time-to-hire when application reaches a terminal or milestone stage */
export async function recordTimeToHireMilestone(opts: {
  applicationId: string;
  jobId: string;
  candidateId: string;
  appliedAt: Date;
  stage: string;
}): Promise<void> {
  try {
    const now = new Date();
    const stage = opts.stage.toUpperCase();

    const existing = await prisma.timeToHireMetric.findUnique({
      where: { applicationId: opts.applicationId },
    });

    const data: Record<string, unknown> = {};
    if (stage === 'SCREENING' || stage === 'PHONE_SCREEN') {
      data.firstStageAt = now;
    }
    if (stage.includes('INTERVIEW') || stage === 'TECHNICAL' || stage === 'ONSITE') {
      data.interviewAt = now;
      data.timeToFirstInterview = hoursBetween(opts.appliedAt, now);
    }
    if (stage === 'OFFER' || stage === 'OFFERED') {
      data.offerAt = now;
      data.timeToOffer = hoursBetween(opts.appliedAt, now);
    }
    if (stage === 'HIRED' || stage === 'HIRE') {
      data.hiredAt = now;
      data.totalTimeToHire = hoursBetween(opts.appliedAt, now);
    }
    if (stage === 'REJECTED') {
      data.rejectedAt = now;
    }

    if (Object.keys(data).length === 0) return;

    if (existing) {
      await prisma.timeToHireMetric.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await prisma.timeToHireMetric.create({
        data: {
          applicationId: opts.applicationId,
          jobId: opts.jobId,
          candidateId: opts.candidateId,
          appliedAt: opts.appliedAt,
          ...data,
        },
      });
    }
  } catch {
    /* non-fatal */
  }
}
