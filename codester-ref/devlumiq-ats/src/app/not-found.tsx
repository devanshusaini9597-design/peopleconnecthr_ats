'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Home, ArrowLeft } from 'lucide-react';
import { useLocale } from '@/components/providers/LocaleProvider';

export default function NotFound() {
  const { t } = useLocale();

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-stone-50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-md"
      >
        <h1 className="text-8xl font-extrabold text-brand-600">404</h1>
        <h2 className="text-2xl font-bold text-stone-900 mt-4">{t('notFound.title')}</h2>
        <p className="text-stone-600 mt-2">{t('notFound.desc')}</p>
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/">
            <motion.button
              whileTap={{ scale: 0.98 }}
              className="btn-cta-primary flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 rounded-xl font-bold"
            >
              <Home className="w-5 h-5" /> {t('notFound.backHome')}
            </motion.button>
          </Link>
          <button
            onClick={() => typeof window !== 'undefined' && window.history.back()}
            className="btn-cta-outline flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 rounded-xl font-semibold border-2 border-stone-200 text-stone-800 bg-transparent"
          >
            <span className="relative z-10 flex items-center justify-center gap-2"><ArrowLeft className="w-5 h-5" /> {t('notFound.goBack')}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
