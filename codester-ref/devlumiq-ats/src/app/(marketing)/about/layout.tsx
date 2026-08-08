import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Us - Devlumiq ATS | Our Mission & Team',
  description:
    'Learn about Devlumiq ATS mission to simplify recruitment. Meet our team and discover our approach to modern hiring.'
};

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
