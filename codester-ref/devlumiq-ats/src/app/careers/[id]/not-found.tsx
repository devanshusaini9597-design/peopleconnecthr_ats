import Link from 'next/link';
import { Briefcase, ArrowLeft } from 'lucide-react';

export default function CareerNotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto mb-6">
          <Briefcase className="w-10 h-10 text-stone-400" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 mb-4">
          Position Not Found
        </h1>
        <p className="text-stone-600 mb-8">
          The job position you&apos;re looking for may have been filled or is no longer available.
        </p>
        <Link
          href="/careers"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          View All Open Positions
        </Link>
      </div>
    </div>
  );
}
