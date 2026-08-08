import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Public endpoint - no auth required
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department');
    const location = searchParams.get('location');
    const type = searchParams.get('type');
    const search = searchParams.get('search');
    const companySlug = searchParams.get('company');

    let companyId: string | undefined;
    if (companySlug) {
      const company = await prisma.company.findUnique({
        where: { slug: companySlug },
        select: { id: true },
      });
      companyId = company?.id;
    }

    const where: any = { status: 'Active' };

    if (companyId) {
      where.companyId = companyId;
    }

    if (department && department !== 'all') {
      where.department = department;
    }
    if (location && location !== 'all') {
      where.location = { contains: location, mode: 'insensitive' };
    }
    if (type && type !== 'all') {
      where.type = type;
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { department: { contains: search, mode: 'insensitive' } },
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

    return NextResponse.json({
      jobs,
      filters: {
        departments: departments.map(d => d.department).filter(Boolean),
        locations: locations.map(l => l.location).filter(Boolean),
        types: ['Full-time', 'Part-time', 'Contract', 'Internship'],
      },
    });
  } catch (error) {
    console.error('Error fetching public jobs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}
