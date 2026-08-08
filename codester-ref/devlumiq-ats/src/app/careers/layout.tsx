import MarketingHeader from '@/components/MarketingHeader';
import MarketingFooter from '@/components/MarketingFooter';
import CookieConsent from '@/components/CookieConsent';
import AnnouncementBar from '@/components/AnnouncementBar';

export default function CareersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <AnnouncementBar />
      <MarketingHeader />
      <main className="flex-1 w-full min-w-0">{children}</main>
      <MarketingFooter />
      <CookieConsent />
    </div>
  );
}
