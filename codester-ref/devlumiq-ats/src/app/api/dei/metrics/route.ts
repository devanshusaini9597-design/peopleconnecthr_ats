import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission } from '@/lib/with-permission';
import { requireOrgId, isOrgError } from '@/lib/require-org';

const STAGES = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED'];

/**
 * GET — aggregate diversity funnel (compliance-restricted).
 * Uses CandidateSelfId only — never joins to scores.
 */
export const GET = withPermission('MANAGE_SETTINGS', async (req: NextRequest, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const jobId = new URL(req.url).searchParams.get('jobId');

    const selfIds = await prisma.candidateSelfId.findMany({
      where: {
        organizationId: orgId,
        declinedToSelfId: false,
      },
      select: {
        candidateId: true,
        gender: true,
        ethnicity: true,
        veteranStatus: true,
        disability: true,
      },
    });

    const candidateIds = selfIds.map((s) => s.candidateId).filter(Boolean) as string[];
    const apps = candidateIds.length
      ? await prisma.application.findMany({
          where: {
            candidateId: { in: candidateIds },
            ...(jobId ? { jobId } : {}),
            candidate: { organizationId: orgId },
          },
          select: { candidateId: true, stage: true },
        })
      : [];

    const stageByCandidate = new Map<string, string>();
    for (const a of apps) {
      // keep latest-ish by overwriting — good enough for funnel snapshot
      stageByCandidate.set(a.candidateId, a.stage);
    }

    const selfByCandidate = new Map(selfIds.filter((s) => s.candidateId).map((s) => [s.candidateId!, s]));

    const funnel = STAGES.map((stage) => {
      const inStage = [...stageByCandidate.entries()].filter(([, s]) => s === stage || s === stageToLegacy(stage));
      const gender: Record<string, number> = {};
      const ethnicity: Record<string, number> = {};
      const veterans: Record<string, number> = {};
      const disability: Record<string, number> = {};
      for (const [cid] of inStage) {
        const sid = selfByCandidate.get(cid);
        if (!sid) continue;
        const g = sid.gender || 'undisclosed';
        const e = sid.ethnicity || 'undisclosed';
        gender[g] = (gender[g] || 0) + 1;
        ethnicity[e] = (ethnicity[e] || 0) + 1;
        if (sid.veteranStatus) {
          veterans[sid.veteranStatus] = (veterans[sid.veteranStatus] || 0) + 1;
        }
        if (sid.disability) {
          disability[sid.disability] = (disability[sid.disability] || 0) + 1;
        }
      }
      return {
        stage,
        total: inStage.length,
        breakdown: { gender, ethnicity, veterans, disability },
      };
    });

    // Diverse-slate alert at INTERVIEW (opt-in setting)
    const settings = await prisma.orgDeiSettings.findUnique({ where: { organizationId: orgId } });
    let alert: { message: string } | null = null;
    if (settings?.diverseSlateAlerts) {
      const interview = funnel.find((f) => f.stage === 'INTERVIEW');
      const ethKeys = Object.keys(interview?.breakdown.ethnicity || {}).filter((k) => k !== 'undisclosed');
      if (interview && interview.total >= 3 && ethKeys.length < 2) {
        alert = {
          message:
            'Diverse-slate alert: interview shortlist may lack disclosed demographic diversity (aggregate, opt-in data only). Review sourcing — do not use this for individual decisions.',
        };
      }
    }

    // Persist snapshot (non-blocking style)
    for (const f of funnel) {
      if (f.total === 0) continue;
      await prisma.diversityMetric
        .create({
          data: {
            organizationId: orgId,
            jobId: jobId || null,
            stage: f.stage,
            breakdown: f.breakdown,
            totalCount: f.total,
            period: 'snapshot',
          },
        })
        .catch(() => {});
    }

    return NextResponse.json({
      funnel,
      alert,
      note: 'Self-ID is voluntary and stored separately from hiring decisions.',
      disclosedCount: selfIds.length,
    });
  } catch (e) {
    console.error('GET dei/metrics', e);
    return NextResponse.json({ error: 'Failed to load DEI metrics' }, { status: 500 });
  }
});

function stageToLegacy(stage: string) {
  const map: Record<string, string> = {
    APPLIED: 'Applied',
    SCREENING: 'Screening',
    INTERVIEW: 'Interview',
    OFFER: 'Offer',
    HIRED: 'Hired',
  };
  return map[stage] || stage;
}

function asCountRecord(v: unknown): Record<string, number> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === 'number' && Number.isFinite(val)) out[k] = val;
  }
  return out;
}

function sumMatching(rec: Record<string, number>, patterns: RegExp[]): number {
  let sum = 0;
  for (const [k, v] of Object.entries(rec)) {
    if (patterns.some((p) => p.test(k))) sum += v;
  }
  return sum;
}

function sumNotMatching(rec: Record<string, number>, patterns: RegExp[]): number {
  let sum = 0;
  for (const [k, v] of Object.entries(rec)) {
    if (!patterns.some((p) => p.test(k))) sum += v;
  }
  return sum;
}

function veteranAggregate(breakdown: Record<string, unknown>): number {
  if (typeof breakdown.veterans === 'number') return breakdown.veterans;
  const veterans = asCountRecord(breakdown.veterans ?? breakdown.veteranStatus);
  if (Object.keys(veterans).length) {
    return sumMatching(veterans, [/veteran/i, /^yes$/i, /protected/i, /active.?duty/i]);
  }
  return 0;
}

function disabilityAggregate(breakdown: Record<string, unknown>): number {
  if (typeof breakdown.disability === 'number') return breakdown.disability;
  const disability = asCountRecord(breakdown.disability);
  if (Object.keys(disability).length) {
    return sumMatching(disability, [/yes/i, /has.?disabilit/i, /identified/i, /^y$/i]);
  }
  return 0;
}

/** POST export — OFCCP / EEO-1 style aggregate CSV (admin/compliance) */
export const POST = withPermission('MANAGE_SETTINGS', async (req: NextRequest, _ctx, session) => {
  const orgId = requireOrgId(session);
  if (isOrgError(orgId)) return orgId;

  const metrics = await prisma.diversityMetric.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const headers = [
    'reporting_period',
    'job_group_or_stage',
    'total',
    'male',
    'female',
    'white',
    'black_or_african_american',
    'hispanic_or_latino',
    'asian',
    'other_or_undisclosed',
    'veterans',
    'disability',
  ];

  const ethKnown = [
    /white/i,
    /black|african.?american/i,
    /hispanic|latino|latina/i,
    /asian/i,
  ];

  const rows: string[][] = [headers];
  for (const m of metrics) {
    const breakdown =
      m.breakdown && typeof m.breakdown === 'object' && !Array.isArray(m.breakdown)
        ? (m.breakdown as Record<string, unknown>)
        : {};
    const gender = asCountRecord(breakdown.gender);
    const ethnicity = asCountRecord(breakdown.ethnicity);

    const male = sumMatching(gender, [/^m(ale)?$/i, /man/i]);
    const female = sumMatching(gender, [/^f(emale)?$/i, /woman/i]);
    const white = sumMatching(ethnicity, [/white/i, /caucasian/i]);
    const black = sumMatching(ethnicity, [/black/i, /african.?american/i]);
    const hispanic = sumMatching(ethnicity, [/hispanic/i, /latino/i, /latina/i]);
    const asian = sumMatching(ethnicity, [/asian/i]);
    const otherEth = sumNotMatching(ethnicity, ethKnown);

    const period =
      m.period && m.period !== 'snapshot'
        ? m.period
        : m.date.toISOString().slice(0, 10);

    rows.push([
      period,
      m.stage,
      String(m.totalCount),
      String(male),
      String(female),
      String(white),
      String(black),
      String(hispanic),
      String(asian),
      String(otherEth),
      String(veteranAggregate(breakdown)),
      String(disabilityAggregate(breakdown)),
    ]);
  }

  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="ofccp-eeo-aggregate-export.csv"',
    },
  });
});
