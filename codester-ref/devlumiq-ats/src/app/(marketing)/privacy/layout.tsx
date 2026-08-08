import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - Devlumiq ATS',
  description: 'Privacy Policy for Devlumiq ATS'
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
