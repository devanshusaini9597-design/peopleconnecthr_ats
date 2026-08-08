import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getJobs(filters?: {
  department?: string;
  location?: string;
  type?: string;
  search?: string;
  companySlug?: string;
}) {
  let companyId: string | undefined;
  if (filters?.companySlug) {
    const company = await prisma.company.findUnique({
      where: { slug: filters.companySlug },
      select: { id: true },
    });
    companyId = company?.id;
  }

  const where: any = { status: 'Active' };
  if (companyId) {
    where.companyId = companyId;
  }

  if (filters?.department && filters.department !== 'all') {
    where.department = filters.department;
  }
  if (filters?.location && filters.location !== 'all') {
    where.location = { contains: filters.location, mode: 'insensitive' };
  }
  if (filters?.type && filters.type !== 'all') {
    where.type = filters.type;
  }
  if (filters?.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { department: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const [jobs, departments, locations] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy: { postedAt: 'desc' },
      select: {
        id: true,
        title: true,
        department: true,
        location: true,
        type: true,
        postedAt: true,
        applicants: true,
      },
    }),
    prisma.job.findMany({
      where: { status: 'Active', ...(companyId ? { companyId } : {}) },
      distinct: ['department'],
      select: { department: true },
    }),
    prisma.job.findMany({
      where: { status: 'Active', ...(companyId ? { companyId } : {}) },
      distinct: ['location'],
      select: { location: true },
    }),
  ]);

  return {
    jobs,
    filters: {
      departments: departments.map(d => d.department).filter(Boolean),
      locations: locations.map(l => l.location).filter(Boolean),
      types: ['Full-time', 'Part-time', 'Contract', 'Internship'],
    },
  };
}

export async function getJobById(id: string, companySlug?: string) {
  let companyId: string | undefined;
  if (companySlug) {
    const company = await prisma.company.findUnique({
      where: { slug: companySlug },
      select: { id: true },
    });
    companyId = company?.id;
  }

  const job = await prisma.job.findFirst({
    where: { id, status: 'Active', ...(companyId ? { companyId } : {}) },
    select: {
      id: true,
      title: true,
      department: true,
      location: true,
      type: true,
      postedAt: true,
      applicants: true,
      companyId: true,
    },
  });

  return job;
}
