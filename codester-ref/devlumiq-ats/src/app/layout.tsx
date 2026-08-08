import type { Metadata, Viewport } from 'next';
import { validateEnv } from '@/lib/env';
validateEnv();
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import { LocaleProvider } from '@/components/providers/LocaleProvider';
import { MotionProvider } from '@/components/providers/MotionProvider';
import { ToastProvider } from '@/components/ui/Toast';
import { GlobalPreloaderWrapper } from '@/components/GlobalPreloaderWrapper';
import { GlobalRouteLoadingBar } from '@/components/GlobalRouteLoadingBar';
import ScrollToTop from '@/components/ScrollToTop';
import { PwaRegister } from '@/components/PwaRegister';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});
const jetbrainsMono = JetBrains_Mono({ variable: '--font-mono', subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: {
    default: 'Devlumiq ATS - Applicant Tracking System',
    template: '%s | Devlumiq ATS',
  },
  description: 'Devlumiq ATS — self-hostable applicant tracking system for HR teams. Candidates, Kanban pipeline, jobs, calendar, analytics, careers portal, and optional AI tools. Full source code included.',
  keywords: ['ATS', 'applicant tracking', 'recruitment software', 'HR software', 'hiring software', 'candidate management', 'job posting', 'recruitment CRM'],
  authors: [{ name: 'Devlumiq ATS' }],
  creator: 'Devlumiq ATS',
  publisher: 'Devlumiq ATS',
  metadataBase: new URL('https://devlumiq.com'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://devlumiq.com',
    siteName: 'Devlumiq ATS',
    title: 'Devlumiq ATS - Applicant Tracking System',
    description: 'Modern applicant tracking system for HR teams. Candidate management, pipeline workflows, Kanban boards, analytics, and more.',
    images: [
      {
        url: '/og-image.svg',
        width: 1200,
        height: 630,
        alt: 'Devlumiq ATS - Applicant Tracking System',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Devlumiq ATS - Applicant Tracking System',
    description: 'Modern applicant tracking system for HR teams. Start your free trial today.',
    images: ['/og-image.svg'],
    creator: '@devlumiq',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'DevLumiq ATS',
  },
  other: {
    'theme-color': '#0d9488',
    'msapplication-TileColor': '#0d9488',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen font-sans bg-stone-50 text-stone-900 overflow-x-hidden touch-manipulation">
        <LocaleProvider>
          <MotionProvider>
          <ToastProvider>
            <GlobalPreloaderWrapper>
              <GlobalRouteLoadingBar />
              {children}
              <ScrollToTop />
              <PwaRegister />
            </GlobalPreloaderWrapper>
          </ToastProvider>
          </MotionProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
