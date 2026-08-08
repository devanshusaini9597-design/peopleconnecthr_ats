import type { Metadata } from 'next';
import { getJobs } from '@/lib/careers';
import { prisma } from '@/lib/prisma';
import CareersClient from './CareersClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const company = await prisma.company.findFirst().catch(() => null);
  const title = company?.metaTitle ?? (company?.name ? `${company.name} — Open Positions` : 'Open Positions | Join Our Team');
  const desc = company?.metaDescription ?? company?.description ?? 'Explore exciting career opportunities. Join our team and help us build the future.';
  return {
    title,
    description: desc,
    openGraph: { title, description: desc, type: 'website' },
  };
}

export default async function CareersPage() {
  const company = await prisma.company.findFirst({
    include: {
      benefits: { orderBy: { sortOrder: 'asc' } },
      teamMembers: { orderBy: { sortOrder: 'asc' } },
      socialLinks: { orderBy: { sortOrder: 'asc' } },
    },
  }).catch(() => null);

  const initialData = await getJobs({ companySlug: company?.slug ?? undefined });

  const transformedJobs = initialData.jobs.map(job => ({
    ...job,
    postedAt: job.postedAt.toISOString(),
  }));

  return (
    <CareersClient
      initialJobs={transformedJobs}
      initialFilters={initialData.filters}
      companySlug={company?.slug ?? undefined}
      company={company ? {
        name: company.name,
        logoUrl: company.logoUrl ?? undefined,
        heroTitle: company.heroTitle,
        heroSubtitle: company.heroSubtitle ?? undefined,
        heroBackground: company.heroBackground ?? undefined,
        primaryColor: company.primaryColor,
        secondaryColor: company.secondaryColor,
        description: company.description ?? undefined,
        website: company.website ?? undefined,
        showBenefits: company.showBenefits,
        showTeamPhotos: company.showTeamPhotos,
        benefits: company.benefits.map(b => ({ icon: b.icon, title: b.title, description: b.description })),
        teamMembers: company.teamMembers.map(m => ({ name: m.name, role: m.role, photoUrl: m.photoUrl ?? undefined, bio: m.bio ?? undefined })),
        socialLinks: company.socialLinks.map(s => ({ platform: s.platform, url: s.url })),
      } : null}
    />
  );
}
