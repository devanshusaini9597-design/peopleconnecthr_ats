import MarketingHeader from '@/components/MarketingHeader';
import MarketingFooter from '@/components/MarketingFooter';
import CookieConsent from '@/components/CookieConsent';
import AnnouncementBar from '@/components/AnnouncementBar';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <AnnouncementBar />
      <MarketingHeader />
      <main id="main-content" className="flex-1 overflow-x-hidden w-full min-w-0" role="main">{children}</main>
      <MarketingFooter />
      <CookieConsent />
    </div>
  );
}
