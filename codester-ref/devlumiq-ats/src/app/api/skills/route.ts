import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, withPermission } from '@/lib/with-permission';
import { requireOrgId, isOrgError } from '@/lib/require-org';
import { orgSkillSlug, slugifySkill, seedSystemSkills } from '@/lib/skills';

/** List system + org skills (searchable) */
export const GET = withAuth(async (req: NextRequest, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    const category = searchParams.get('category') || '';
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '100')));

    const where: Record<string, unknown> = {
      OR: [
        { isSystem: true },
        { organizationId: orgId },
      ],
    };

    if (q) {
      where.AND = [
        {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { slug: { contains: slugifySkill(q), mode: 'insensitive' } },
          ],
        },
      ];
    }
    if (category) {
      where.category = category;
    }

    const [skills, total] = await Promise.all([
      prisma.skill.findMany({
        where,
        orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
        take: limit,
        select: {
          id: true,
          name: true,
          slug: true,
          category: true,
          isSystem: true,
          organizationId: true,
          _count: { select: { candidateSkills: true, jobSkills: true } },
        },
      }),
      prisma.skill.count({ where }),
    ]);

    const categories = await prisma.skill.findMany({
      where: {
        OR: [{ isSystem: true }, { organizationId: orgId }],
      },
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' },
    });

    return NextResponse.json({
      skills,
      total,
      categories: categories.map((c) => c.category),
    });
  } catch (e) {
    console.error('GET /api/skills', e);
    return NextResponse.json({ error: 'Failed to load skills' }, { status: 500 });
  }
});

/** Create org-custom skill */
export const POST = withPermission('MANAGE_SETTINGS', async (req: NextRequest, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const body = await req.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const category = typeof body.category === 'string' ? body.category.trim() || 'Custom' : 'Custom';
    const description = typeof body.description === 'string' ? body.description.trim() : null;

    if (!name || name.length < 1 || name.length > 80) {
      return NextResponse.json({ error: 'Skill name is required (1–80 chars)' }, { status: 400 });
    }

    const slug = orgSkillSlug(orgId, name);
    const existing = await prisma.skill.findFirst({
      where: {
        OR: [
          { slug },
          { organizationId: orgId, name: { equals: name, mode: 'insensitive' } },
          { isSystem: true, name: { equals: name, mode: 'insensitive' } },
        ],
      },
    });
    if (existing) {
      return NextResponse.json({ skill: existing, existed: true });
    }

    const skill = await prisma.skill.create({
      data: {
        name,
        slug,
        category,
        description,
        isSystem: false,
        organizationId: orgId,
      },
    });

    return NextResponse.json({ skill, existed: false }, { status: 201 });
  } catch (e) {
    console.error('POST /api/skills', e);
    return NextResponse.json({ error: 'Failed to create skill' }, { status: 500 });
  }
});

/** Seed system skills from bundled catalog (idempotent) — ADMIN only */
export const PUT = withPermission('MANAGE_SETTINGS', async (_req: NextRequest) => {
  try {
    const result = await seedSystemSkills();
    return NextResponse.json({
      created: result.created,
      skipped: result.skipped,
      totalSystem: result.total,
    });
  } catch (e) {
    console.error('PUT /api/skills', e);
    return NextResponse.json({ error: 'Failed to seed skills' }, { status: 500 });
  }
});
