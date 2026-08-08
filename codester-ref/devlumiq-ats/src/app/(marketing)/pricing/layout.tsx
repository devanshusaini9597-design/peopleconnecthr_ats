import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing - Devlumiq ATS | License Options',
  description:
    'Choose a license type that fits your team: Regular or Extended. One-time source-code license.',
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
