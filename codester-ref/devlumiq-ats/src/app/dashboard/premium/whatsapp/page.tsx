'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/** Legacy URL: /dashboard/premium/whatsapp → unified /dashboard/messages */
export default function LegacyWhatsAppRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/messages');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 text-stone-500 gap-2">
      <Loader2 className="w-5 h-5 animate-spin" /> Redirecting to Messages…
    </div>
  );
}
