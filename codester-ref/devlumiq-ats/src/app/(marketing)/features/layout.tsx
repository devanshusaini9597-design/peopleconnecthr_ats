import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Features - Devlumiq ATS | Complete Recruitment Platform',
  description:
    'Discover all features of Devlumiq ATS: Kanban pipeline, candidate management, analytics, calendar scheduling, email integration, and more.'
};

export default function FeaturesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
