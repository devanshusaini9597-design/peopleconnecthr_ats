'use client';

import { useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/** Legacy URL: /assessments/take/[id]?token=… → /assess/[token] */
export default function LegacyTakeRedirect() {
  const params = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const token = search.get('token') || '';

  useEffect(() => {
    if (token) {
      router.replace(`/assess/${token}`);
    }
  }, [token, router]);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6 text-center text-stone-600">
        Invalid assessment link — missing token.
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 text-stone-500 gap-2">
      <Loader2 className="w-5 h-5 animate-spin" /> Redirecting…
      <span className="sr-only">{String(params.id)}</span>
    </div>
  );
}
