import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FAQ - Devlumiq ATS | Frequently Asked Questions',
  description:
    'Find answers to common questions about Devlumiq ATS, pricing, features, security, and more.'
};

export default function FaqLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
