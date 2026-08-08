import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { stageToDisplay } from '@/lib/api-helpers';
import { withPermission } from '@/lib/with-permission';
import {
  isOrgBlindScreeningEnabled,
  maskCandidateForList,
  shouldBlindScreen,
} from '@/lib/blind-screening';
import { requireOrgId, isOrgError } from '@/lib/require-org';

export const GET = withPermission('VIEW_CANDIDATES', async (req: NextRequest, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { searchParams } = new URL(req.url);
    const blindEnabled = shouldBlindScreen(
      session.role,
      await isOrgBlindScreeningEnabled(session.organizationId),
    );
    const query = searchParams.get('q') || '';
    const skills = searchParams.get('skills')?.split(',').filter(Boolean) || [];
    const skillIds = searchParams.get('skillIds')?.split(',').filter(Boolean) || [];
    const experience = searchParams.get('experience');
    const tags = searchParams.get('tags')?.split(',').filter(Boolean) || [];
    const source = searchParams.get('source');
    const stage = searchParams.get('stage');

    const where: any = {
      organizationId: orgId,
    };

    // Taxonomy filter (AND — candidate must have all listed skill IDs)
    if (skillIds.length > 0) {
      where.AND = [
        ...(where.AND ?? []),
        ...skillIds.map((skillId: string) => ({
          candidateSkills: { some: { skillId } },
        })),
      ];
    }

    if (query) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
        { currentTitle: { contains: query, mode: 'insensitive' } }
      ];
    }

    if (experience) {
      if (experience.endsWith('+')) {
        const min = parseInt(experience);
        if (!isNaN(min)) where.experience = { gte: min };
      } else {
        const [min, max] = experience.split('-').map(Number);
        if (!isNaN(min) && !isNaN(max)) {
          where.experience = { gte: min, lte: max };
        } else if (!isNaN(min)) {
          where.experience = { gte: min };
        }
      }
    }

    if (source) {
      where.source = source;
    }

    if (stage) {
      where.applications = { some: { stage } };
    }

    let candidates = await prisma.candidate.findMany({
      where,
      include: {
        applications: { orderBy: { updatedAt: 'desc' }, take: 1, include: { job: true } },
        interviews: true,
        notes: true,
        comments: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Application-level filtering for skills/tags (Json fields don't support hasSome in all DBs)
    if (skills.length > 0) {
      candidates = candidates.filter((c) => {
        const cSkills = (c.skills as unknown as string[]) ?? [];
        return skills.some((s: string) => cSkills.includes(s));
      });
    }
    if (tags.length > 0) {
      candidates = candidates.filter((c) => {
        const cTags = (c.tags as unknown as string[]) ?? [];
        return tags.some((t: string) => cTags.includes(t));
      });
    }

    // Transform to match the format expected by frontend
    const list = candidates.map((c, i) => {
      const app = c.applications[0];
      const position = app?.job?.title ?? c.currentTitle ?? '';
      const status = app ? stageToDisplay(app.stage) : 'Applied';
      const row = {
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone ?? '',
        position,
        source: c.source ?? '',
        status,
        experience: c.experience ?? null,
        skills: c.skills ?? [],
        tags: c.tags ?? [],
        createdAt: c.createdAt.toISOString(),
        applications: blindEnabled ? [] : c.applications,
        interviews: blindEnabled ? [] : c.interviews,
        notes: blindEnabled ? [] : c.notes,
        comments: blindEnabled ? [] : c.comments,
      };
      return maskCandidateForList(row, i, blindEnabled);
    });

    return NextResponse.json({ 
      candidates: list,
      total: list.length,
      filters: { skills, experience, tags, source, stage },
      blindScreening: blindEnabled,
    });
  } catch {
    return NextResponse.json({ candidates: [], total: 0 }, { status: 500 });
  }
});
