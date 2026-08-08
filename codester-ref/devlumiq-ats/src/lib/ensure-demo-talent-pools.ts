import { prisma } from '@/lib/prisma';

const DEMO_POOLS = [
  {
    name: 'Silver medalists — Engineering',
    poolType: 'silver_medalist',
    description: 'Strong final-round candidates we almost hired — keep warm for the next Eng opening.',
    tags: ['engineering', 'silver'],
    reason: 'Reached final round; excellent culture fit',
  },
  {
    name: 'Keep warm — Product & Design',
    poolType: 'keep_warm',
    description: 'Designers and PMs to nurture with quarterly check-ins.',
    tags: ['product', 'design'],
    reason: 'Strong portfolio; timing was not right',
  },
  {
    name: 'Future fit — Leadership',
    poolType: 'future_fit',
    description: 'Senior ICs and managers for upcoming leadership roles.',
    tags: ['leadership', 'future'],
    reason: 'High potential for future leadership hire',
  },
] as const;

const DEMO_CANDIDATES = [
  { name: 'Maya Chen', email: 'maya.chen.pool@demo.devlumiq.com', title: 'Senior Frontend Engineer', location: 'San Francisco, CA', skills: ['React', 'TypeScript', 'Next.js'] },
  { name: 'Jordan Blake', email: 'jordan.blake.pool@demo.devlumiq.com', title: 'Backend Engineer', location: 'Austin, TX', skills: ['Node.js', 'PostgreSQL', 'AWS'] },
  { name: 'Samira Patel', email: 'samira.patel.pool@demo.devlumiq.com', title: 'Full Stack Engineer', location: 'Remote', skills: ['Python', 'React', 'Docker'] },
  { name: 'Chris Nguyen', email: 'chris.nguyen.pool@demo.devlumiq.com', title: 'Staff Engineer', location: 'Seattle, WA', skills: ['Go', 'Kubernetes', 'System Design'] },
  { name: 'Avery Lopez', email: 'avery.lopez.pool@demo.devlumiq.com', title: 'Product Designer', location: 'New York, NY', skills: ['Figma', 'UI Design', 'Prototyping'] },
  { name: 'Riley Kim', email: 'riley.kim.pool@demo.devlumiq.com', title: 'Product Manager', location: 'Chicago, IL', skills: ['Roadmapping', 'Agile', 'Analytics'] },
  { name: 'Taylor Brooks', email: 'taylor.brooks.pool@demo.devlumiq.com', title: 'UX Researcher', location: 'Remote', skills: ['UX Research', 'Interviews', 'Synthesis'] },
  { name: 'Morgan Ellis', email: 'morgan.ellis.pool@demo.devlumiq.com', title: 'Design Lead', location: 'Boston, MA', skills: ['Design Systems', 'Figma', 'Leadership'] },
  { name: 'Casey Rivera', email: 'casey.rivera.pool@demo.devlumiq.com', title: 'Engineering Manager', location: 'Denver, CO', skills: ['Leadership', 'Mentoring', 'Node.js'] },
  { name: 'Quinn Foster', email: 'quinn.foster.pool@demo.devlumiq.com', title: 'Director of Product', location: 'Remote', skills: ['OKRs', 'Strategy', 'Hiring'] },
  { name: 'Jamie Ortiz', email: 'jamie.ortiz.pool@demo.devlumiq.com', title: 'VP Engineering', location: 'San Jose, CA', skills: ['Leadership', 'Architecture', 'Hiring'] },
  { name: 'Reese Park', email: 'reese.park.pool@demo.devlumiq.com', title: 'DevOps Lead', location: 'Portland, OR', skills: ['AWS', 'Terraform', 'CI/CD'] },
];

async function ensureDemoCandidates(organizationId: string) {
  let candidates = await prisma.candidate.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take: 15,
    select: { id: true, name: true, location: true, skills: true, currentTitle: true },
  });

  if (candidates.length >= 6) return candidates;

  for (const c of DEMO_CANDIDATES) {
    const existing = await prisma.candidate.findFirst({
      where: { email: c.email, organizationId },
      select: { id: true },
    });
    if (existing) continue;
    await prisma.candidate.create({
      data: {
        name: c.name,
        email: c.email,
        organizationId,
        currentTitle: c.title,
        location: c.location,
        skills: c.skills,
        tags: ['talent-pool-demo'],
        source: 'talent_pool_seed',
        experience: 5,
        talentPoolConsent: true,
        talentPoolConsentAt: new Date(),
      },
    });
  }

  candidates = await prisma.candidate.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take: 15,
    select: { id: true, name: true, location: true, skills: true, currentTitle: true },
  });
  return candidates;
}

/**
 * Creates 3 demo talent pools + members when the org has none.
 * Also creates demo candidates if the org has too few people.
 */
export async function ensureDemoTalentPools(
  organizationId: string,
  createdById?: string,
  opts?: { force?: boolean },
) {
  const existing = await prisma.talentPool.count({
    where: { organizationId, isActive: true },
  });
  if (existing > 0 && !opts?.force) {
    return { created: false, pools: 0, members: 0, reason: 'already_exists' as const };
  }

  if (opts?.force && existing > 0) {
    await prisma.talentPoolMember.deleteMany({
      where: { pool: { organizationId } },
    });
    await prisma.talentPool.deleteMany({ where: { organizationId } });
  }

  const candidates = await ensureDemoCandidates(organizationId);
  if (candidates.length === 0) {
    return { created: false, pools: 0, members: 0, reason: 'no_candidates' as const };
  }

  await prisma.candidate.updateMany({
    where: { id: { in: candidates.map((c) => c.id) } },
    data: { talentPoolConsent: true, talentPoolConsentAt: new Date() },
  });

  let members = 0;
  const now = Date.now();

  for (let i = 0; i < DEMO_POOLS.length; i++) {
    const def = DEMO_POOLS[i];
    const pool = await prisma.talentPool.create({
      data: {
        organizationId,
        name: def.name,
        description: def.description,
        poolType: def.poolType,
        tags: [...def.tags],
        createdById: createdById ?? null,
      },
    });

    const slice = candidates.slice(i * 4, i * 4 + 5);
    for (let j = 0; j < slice.length; j++) {
      const c = slice[j];
      await prisma.talentPoolMember.upsert({
        where: { poolId_candidateId: { poolId: pool.id, candidateId: c.id } },
        create: {
          poolId: pool.id,
          candidateId: c.id,
          addedReason: def.reason,
          addedById: createdById ?? null,
          tags: [...def.tags],
          lastContactedAt: j % 2 === 0 ? new Date(now - (j + 1) * 7 * 86400000) : null,
          notes: j === 0 ? 'Priority nurture — schedule coffee chat next month.' : null,
        },
        update: {},
      });
      members += 1;
    }
  }

  return { created: true, pools: DEMO_POOLS.length, members, reason: 'seeded' as const };
}
