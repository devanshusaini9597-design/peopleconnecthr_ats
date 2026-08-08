import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service - Devlumiq ATS',
  description: 'Terms of Service for Devlumiq ATS'
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
