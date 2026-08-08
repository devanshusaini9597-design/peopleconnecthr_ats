import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Us - Devlumiq ATS | Get in Touch',
  description:
    'Contact Devlumiq ATS for sales, support, or inquiries. We respond within 24 hours.'
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
