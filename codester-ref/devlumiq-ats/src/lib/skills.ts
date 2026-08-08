/**
 * Skills taxonomy helpers — match scoring + slug/normalize.
 * Keeps Candidate.skills JSON in sync for backward compatibility.
 */

import { prisma } from '@/lib/prisma';

export function slugifySkill(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\w\s+#.-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function orgSkillSlug(organizationId: string, name: string): string {
  return `org-${organizationId.slice(0, 8)}-${slugifySkill(name)}`;
}

export interface SkillMatchDetail {
  skillId: string;
  name: string;
  required: boolean;
  weight: number;
  minProficiency: number;
  candidateHas: boolean;
  candidateProficiency: number | null;
  matched: boolean;
}

export interface SkillMatchResult {
  matchPercent: number;
  requiredMatchPercent: number;
  matchedCount: number;
  requiredCount: number;
  totalWeighted: number;
  matchedWeighted: number;
  details: SkillMatchDetail[];
}

export function computeSkillMatch(
  jobSkills: Array<{
    skillId: string;
    required: boolean;
    minProficiency: number;
    weight: number;
    skill: { id: string; name: string };
  }>,
  candidateSkills: Array<{
    skillId: string;
    proficiency: number;
  }>,
): SkillMatchResult {
  const candMap = new Map(candidateSkills.map((c) => [c.skillId, c.proficiency]));
  const details: SkillMatchDetail[] = jobSkills.map((js) => {
    const proficiency = candMap.get(js.skillId) ?? null;
    const candidateHas = proficiency !== null;
    const matched =
      candidateHas && (proficiency as number) >= (js.minProficiency ?? 1);
    return {
      skillId: js.skillId,
      name: js.skill.name,
      required: js.required,
      weight: js.weight ?? 1,
      minProficiency: js.minProficiency ?? 1,
      candidateHas,
      candidateProficiency: proficiency,
      matched,
    };
  });

  const required = details.filter((d) => d.required);
  const requiredMatched = required.filter((d) => d.matched);
  const totalWeighted = details.reduce((s, d) => s + d.weight, 0);
  const matchedWeighted = details.filter((d) => d.matched).reduce((s, d) => s + d.weight, 0);

  const requiredMatchPercent =
    required.length === 0
      ? 100
      : Math.round((requiredMatched.length / required.length) * 100);

  const matchPercent =
    totalWeighted === 0
      ? 100
      : Math.round((matchedWeighted / totalWeighted) * 100);

  return {
    matchPercent,
    requiredMatchPercent,
    matchedCount: details.filter((d) => d.matched).length,
    requiredCount: required.length,
    totalWeighted,
    matchedWeighted,
    details,
  };
}

/** Sync Candidate.skills JSON array from CandidateSkill relations */
export async function syncCandidateSkillsJson(candidateId: string): Promise<string[]> {
  const rows = await prisma.candidateSkill.findMany({
    where: { candidateId },
    include: { skill: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  });
  const names = rows.map((r) => r.skill.name);
  await prisma.candidate.update({
    where: { id: candidateId },
    data: { skills: names },
  });
  return names;
}

/**
 * Resolve skill names to Skill IDs (create org-custom if needed),
 * then upsert CandidateSkill rows. Also syncs JSON.
 */
export async function setCandidateSkillsByName(
  candidateId: string,
  skillNames: string[],
  opts?: { organizationId?: string | null; proficiency?: number; source?: string },
): Promise<void> {
  const unique = [...new Set(skillNames.map((s) => s.trim()).filter(Boolean))];
  const orgId = opts?.organizationId ?? null;
  const proficiency = opts?.proficiency ?? 3;
  const source = opts?.source ?? 'manual';

  const skillIds: string[] = [];
  for (const name of unique) {
    const baseSlug = slugifySkill(name);
    // Prefer system skill by name/slug, else org custom, else create
    let skill =
      (await prisma.skill.findFirst({
        where: {
          OR: [
            { slug: baseSlug, isSystem: true },
            { name: { equals: name, mode: 'insensitive' as const }, isSystem: true },
            ...(orgId
              ? [
                  { slug: orgSkillSlug(orgId, name) },
                  { organizationId: orgId, name: { equals: name, mode: 'insensitive' as const } },
                ]
              : []),
          ],
        },
      })) ?? null;

    if (!skill && orgId) {
      skill = await prisma.skill.create({
        data: {
          name,
          slug: orgSkillSlug(orgId, name),
          category: 'Custom',
          isSystem: false,
          organizationId: orgId,
        },
      });
    } else if (!skill) {
      skill = await prisma.skill.create({
        data: {
          name,
          slug: `adhoc-${baseSlug}-${Date.now().toString(36)}`,
          category: 'Custom',
          isSystem: false,
        },
      });
    }
    skillIds.push(skill.id);
  }

  const existing = await prisma.candidateSkill.findMany({
    where: { candidateId },
    select: { id: true, skillId: true },
  });
  const keep = new Set(skillIds);
  const toDelete = existing.filter((e) => !keep.has(e.skillId)).map((e) => e.id);
  if (toDelete.length) {
    await prisma.candidateSkill.deleteMany({ where: { id: { in: toDelete } } });
  }

  for (const skillId of skillIds) {
    await prisma.candidateSkill.upsert({
      where: { candidateId_skillId: { candidateId, skillId } },
      create: { candidateId, skillId, proficiency, source },
      update: { proficiency, source },
    });
  }

  await syncCandidateSkillsJson(candidateId);
}

export async function getJobCandidateMatch(jobId: string, candidateId: string): Promise<SkillMatchResult | null> {
  const [jobSkills, candidateSkills] = await Promise.all([
    prisma.jobSkill.findMany({
      where: { jobId },
      include: { skill: { select: { id: true, name: true } } },
    }),
    prisma.candidateSkill.findMany({
      where: { candidateId },
      select: { skillId: true, proficiency: true },
    }),
  ]);
  if (jobSkills.length === 0) return null;
  return computeSkillMatch(jobSkills, candidateSkills);
}

/**
 * Seed system skills from the bundled O*NET-style catalog (data/onet-skills.json).
 * Falls back to SYSTEM_SKILLS_SEED when the catalog file is missing.
 */
export async function seedSystemSkills(): Promise<{
  created: number;
  skipped: number;
  total: number;
}> {
  const { loadBundledSkillsCatalog, importSystemSkillsFromCatalog } = await import(
    '@/lib/skills-catalog'
  );
  const catalog = loadBundledSkillsCatalog();
  return importSystemSkillsFromCatalog(catalog);
}

/** Minimal curated fallback when data/onet-skills.json is unavailable */
export const SYSTEM_SKILLS_SEED: Array<{ name: string; category: string }> = [
  // Engineering
  { name: 'JavaScript', category: 'Engineering' },
  { name: 'TypeScript', category: 'Engineering' },
  { name: 'Python', category: 'Engineering' },
  { name: 'Java', category: 'Engineering' },
  { name: 'C#', category: 'Engineering' },
  { name: 'Go', category: 'Engineering' },
  { name: 'Rust', category: 'Engineering' },
  { name: 'Ruby', category: 'Engineering' },
  { name: 'PHP', category: 'Engineering' },
  { name: 'Swift', category: 'Engineering' },
  { name: 'Kotlin', category: 'Engineering' },
  { name: 'React', category: 'Engineering' },
  { name: 'Next.js', category: 'Engineering' },
  { name: 'Vue.js', category: 'Engineering' },
  { name: 'Angular', category: 'Engineering' },
  { name: 'Node.js', category: 'Engineering' },
  { name: 'Django', category: 'Engineering' },
  { name: 'Spring Boot', category: 'Engineering' },
  { name: 'GraphQL', category: 'Engineering' },
  { name: 'REST APIs', category: 'Engineering' },
  { name: 'SQL', category: 'Engineering' },
  { name: 'PostgreSQL', category: 'Engineering' },
  { name: 'MySQL', category: 'Engineering' },
  { name: 'MongoDB', category: 'Engineering' },
  { name: 'Redis', category: 'Engineering' },
  { name: 'AWS', category: 'Engineering' },
  { name: 'Azure', category: 'Engineering' },
  { name: 'Google Cloud', category: 'Engineering' },
  { name: 'Docker', category: 'Engineering' },
  { name: 'Kubernetes', category: 'Engineering' },
  { name: 'CI/CD', category: 'Engineering' },
  { name: 'Git', category: 'Engineering' },
  { name: 'Terraform', category: 'Engineering' },
  { name: 'Machine Learning', category: 'Engineering' },
  { name: 'Data Structures', category: 'Engineering' },
  // Design
  { name: 'Figma', category: 'Design' },
  { name: 'UI Design', category: 'Design' },
  { name: 'UX Research', category: 'Design' },
  { name: 'Wireframing', category: 'Design' },
  { name: 'Design Systems', category: 'Design' },
  { name: 'Adobe XD', category: 'Design' },
  { name: 'Illustration', category: 'Design' },
  // Product / Business
  { name: 'Product Management', category: 'Product' },
  { name: 'Agile', category: 'Product' },
  { name: 'Scrum', category: 'Product' },
  { name: 'Roadmapping', category: 'Product' },
  { name: 'A/B Testing', category: 'Product' },
  { name: 'SQL Analytics', category: 'Product' },
  { name: 'Stakeholder Management', category: 'Product' },
  // Data
  { name: 'Data Analysis', category: 'Data' },
  { name: 'Tableau', category: 'Data' },
  { name: 'Power BI', category: 'Data' },
  { name: 'Excel', category: 'Data' },
  { name: 'Statistics', category: 'Data' },
  { name: 'ETL', category: 'Data' },
  { name: 'dbt', category: 'Data' },
  // Soft skills
  { name: 'Communication', category: 'Soft Skills' },
  { name: 'Leadership', category: 'Soft Skills' },
  { name: 'Problem Solving', category: 'Soft Skills' },
  { name: 'Mentoring', category: 'Soft Skills' },
  { name: 'Project Management', category: 'Soft Skills' },
  { name: 'Customer Success', category: 'Soft Skills' },
  // Sales / Marketing
  { name: 'B2B Sales', category: 'Sales' },
  { name: 'Cold Outreach', category: 'Sales' },
  { name: 'CRM', category: 'Sales' },
  { name: 'SEO', category: 'Marketing' },
  { name: 'Content Marketing', category: 'Marketing' },
  { name: 'Google Ads', category: 'Marketing' },
  { name: 'Email Marketing', category: 'Marketing' },
  // HR / Recruiting
  { name: 'Talent Acquisition', category: 'People' },
  { name: 'Interviewing', category: 'People' },
  { name: 'HRIS', category: 'People' },
  { name: 'Employee Relations', category: 'People' },
  // Expanded common skills
  { name: 'C++', category: 'Engineering' },
  { name: 'Scala', category: 'Engineering' },
  { name: 'Elixir', category: 'Engineering' },
  { name: 'Flutter', category: 'Engineering' },
  { name: 'React Native', category: 'Engineering' },
  { name: 'Svelte', category: 'Engineering' },
  { name: 'Express.js', category: 'Engineering' },
  { name: 'FastAPI', category: 'Engineering' },
  { name: 'NestJS', category: 'Engineering' },
  { name: '.NET', category: 'Engineering' },
  { name: 'Laravel', category: 'Engineering' },
  { name: 'Elasticsearch', category: 'Engineering' },
  { name: 'Kafka', category: 'Engineering' },
  { name: 'RabbitMQ', category: 'Engineering' },
  { name: 'Microservices', category: 'Engineering' },
  { name: 'System Design', category: 'Engineering' },
  { name: 'Observability', category: 'Engineering' },
  { name: 'Prometheus', category: 'Engineering' },
  { name: 'Grafana', category: 'Engineering' },
  { name: 'Linux', category: 'Engineering' },
  { name: 'Bash', category: 'Engineering' },
  { name: 'Cybersecurity', category: 'Engineering' },
  { name: 'iOS Development', category: 'Engineering' },
  { name: 'Android Development', category: 'Engineering' },
  { name: 'WebSockets', category: 'Engineering' },
  { name: 'gRPC', category: 'Engineering' },
  { name: 'Storybook', category: 'Design' },
  { name: 'Prototyping', category: 'Design' },
  { name: 'Accessibility', category: 'Design' },
  { name: 'User Testing', category: 'Design' },
  { name: 'Motion Design', category: 'Design' },
  { name: 'OKRs', category: 'Product' },
  { name: 'User Stories', category: 'Product' },
  { name: 'Competitive Analysis', category: 'Product' },
  { name: 'Go-to-Market', category: 'Product' },
  { name: 'Python Pandas', category: 'Data' },
  { name: 'Apache Spark', category: 'Data' },
  { name: 'Airflow', category: 'Data' },
  { name: 'Looker', category: 'Data' },
  { name: 'R Programming', category: 'Data' },
  { name: 'Negotiation', category: 'Soft Skills' },
  { name: 'Public Speaking', category: 'Soft Skills' },
  { name: 'Cross-functional Collaboration', category: 'Soft Skills' },
  { name: 'Account Management', category: 'Sales' },
  { name: 'Salesforce', category: 'Sales' },
  { name: 'Outbound Sales', category: 'Sales' },
  { name: 'Social Media Marketing', category: 'Marketing' },
  { name: 'Brand Strategy', category: 'Marketing' },
  { name: 'Copywriting', category: 'Marketing' },
  { name: 'Compensation & Benefits', category: 'People' },
  { name: 'Onboarding', category: 'People' },
  { name: 'Diversity & Inclusion', category: 'People' },
];
