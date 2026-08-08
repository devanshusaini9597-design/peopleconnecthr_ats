'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Briefcase } from 'lucide-react';
import { useLocale } from '@/components/providers/LocaleProvider';
import { JobDescriptionEditor } from '@/components/JobDescriptionEditor';
import { useToast } from '@/components/ui/Toast';
import { required } from '@/lib/validation';
import PageHeader from '@/components/ui/PageHeader';
import PageShell from '@/components/ui/PageShell';

export default function NewJobPage() {
  const router = useRouter();
  const { t } = useLocale();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState('Full-time');
  const [descriptionHtml, setDescriptionHtml] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);

  return (
    <PageShell>
      <PageHeader
        icon={Briefcase}
        title={t('jobEditor.title')}
        subtitle={
          <Link
            href="/dashboard/jobs"
            className="inline-flex items-center gap-1.5 text-stone-500 hover:text-brand-600 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to jobs
          </Link>
        }
      />

      <div className="rounded-2xl border border-stone-200/80 bg-white overflow-hidden shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-shadow">
        <div className="p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-2">{t('jobEditor.jobTitle')}</label>
              <input
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setTitleError(null); }}
                placeholder={t('jobEditor.jobTitlePlaceholder')}
                className={`w-full px-4 py-3 rounded-xl border bg-white text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-brand-500 outline-none transition-all ${titleError ? 'border-red-400' : 'border-stone-200 focus:border-brand-500'}`}
                aria-invalid={!!titleError}
              />
              {titleError && <p className="text-sm text-red-600 mt-1">{titleError}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-2">{t('jobEditor.department')}</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder={t('jobEditor.departmentPlaceholder')}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-2">{t('jobEditor.location')}</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={t('jobEditor.locationPlaceholder')}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-2">{t('jobEditor.type')}</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-900 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
              >
                <option value="Full-time">{t('jobEditor.typeFullTime')}</option>
                <option value="Part-time">{t('jobEditor.typePartTime')}</option>
                <option value="Contract">{t('jobEditor.typeContract')}</option>
                <option value="Internship">{t('jobEditor.typeInternship')}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-2">{t('jobEditor.description')}</label>
            <JobDescriptionEditor
              content={descriptionHtml}
              onChange={setDescriptionHtml}
              placeholder={t('jobEditor.descriptionPlaceholder')}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-stone-100">
            <motion.button
              type="button"
              disabled={submitting || !title.trim()}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={async () => {
                const err = required(title, t('jobEditor.jobTitle'));
                if (err) {
                  setTitleError(t('validation.titleRequired'));
                  return;
                }
                setTitleError(null);
                setSubmitting(true);
                try {
                  const res = await fetch('/api/jobs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                      title: title.trim(),
                      department: department.trim() || 'General',
                      location: location.trim() || 'Remote',
                      type,
                      status: 'Active',
                    }),
                  });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    const msg = data?.error ?? t('common.error');
                    toast.error(t('jobEditor.publish') + ' failed', msg);
                    setSubmitting(false);
                    return;
                  }
                  toast.success(t('jobEditor.publish') ?? 'Published', title.trim());
                  router.push('/dashboard/jobs');
                } catch {
                  toast.error(t('common.error'), t('jobEditor.publish') + ' failed');
                } finally {
                  setSubmitting(false);
                }
              }}
              className="btn-primary !px-6 !py-3.5 disabled:opacity-70"
            >
              <Briefcase className="w-5 h-5" />
              {submitting ? (t('jobEditor.publishing') ?? 'Publishing...') : t('jobEditor.publish')}
            </motion.button>
            <Link
              href="/dashboard/jobs"
              className="btn-secondary !px-6 !py-3.5"
            >
              {t('jobEditor.cancel')}
            </Link>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
