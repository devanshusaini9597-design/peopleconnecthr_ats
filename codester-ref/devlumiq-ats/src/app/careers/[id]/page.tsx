import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getJobById } from '@/lib/careers';
import JobDetailClient from './JobDetailClient';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const job = await getJobById(id);
  
  if (!job) {
    return {
      title: 'Job Not Found',
    };
  }
  
  return {
    title: `${job.title} | Careers`,
    description: `Apply for ${job.title} at our ${job.location} office. Join our ${job.department} team.`,
  };
}

export default async function JobDetailPage({ params }: Props) {
  const { id } = await params;
  const job = await getJobById(id);
  
  if (!job) {
    notFound();
  }
  
  // Transform job data to match expected types
  const transformedJob = {
    ...job,
    postedAt: job.postedAt.toISOString(),
  };
  
  return <JobDetailClient job={transformedJob} />;
}
