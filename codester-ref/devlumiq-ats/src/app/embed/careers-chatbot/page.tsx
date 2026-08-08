import { CareersChatbot } from '@/components/careers/CareersChatbot';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Careers assistant',
  robots: { index: false, follow: false },
};

/**
 * Lightweight embeddable careers assistant (iframe target for /careers-chatbot.js).
 * Query: ?company=slug
 */
export default async function EmbedCareersChatbotPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const params = await searchParams;
  const companySlug = typeof params.company === 'string' ? params.company : undefined;

  return (
    <div className="fixed inset-0 bg-white overflow-hidden">
      <CareersChatbot companySlug={companySlug} embedded />
    </div>
  );
}
