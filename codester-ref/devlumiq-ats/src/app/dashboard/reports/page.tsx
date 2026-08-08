'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, Calendar, TrendingUp, Users, Clock, BarChart2, Loader2, Target } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import PageShell from '@/components/ui/PageShell';
import StatCard from '@/components/ui/StatCard';
import { useLocale } from '@/components/providers/LocaleProvider';
import { useToast } from '@/components/ui/Toast';
import { jsPDF } from 'jspdf';

type DashboardSummary = {
  totalCandidates: number;
  thisMonth: number;
  conversionRate?: number;
  avgTimeToHire?: number;
  topSources?: { source: string; count: number }[];
  pipeline?: { stage: string; count: number }[];
};

export default function ReportsPage() {
  const { t } = useLocale();
  const toast = useToast();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/dashboard/summary', { credentials: 'include', cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed'))))
      .then((json) => { if (!cancelled) setData(json as DashboardSummary); })
      .catch(() => { if (!cancelled) setData({ totalCandidates: 0, thisMonth: 0, conversionRate: 0, avgTimeToHire: 0, topSources: [], pipeline: [] }); });
    return () => { cancelled = true; };
  }, []);

  const d = data ?? { totalCandidates: 0, thisMonth: 0, conversionRate: 0, avgTimeToHire: 0, topSources: [], pipeline: [] };

  const reportCards = [
    { id: 'recruitment-overview', titleKey: 'reports.report1Title', descKey: 'reports.report1Desc', icon: BarChart2, color: 'brand',   accentGrad: 'from-brand-400 to-teal-500',     iconCls: 'bg-brand-50 text-brand-600'   },
    { id: 'time-to-hire',          titleKey: 'reports.report2Title', descKey: 'reports.report2Desc', icon: Clock,    color: 'emerald', accentGrad: 'from-emerald-400 to-teal-500',   iconCls: 'bg-emerald-50 text-emerald-600' },
    { id: 'source-performance',   titleKey: 'reports.report3Title', descKey: 'reports.report3Desc', icon: TrendingUp, color: 'amber', accentGrad: 'from-amber-400 to-orange-500',  iconCls: 'bg-amber-50 text-amber-600'   },
    { id: 'candidate-funnel',     titleKey: 'reports.report4Title', descKey: 'reports.report4Desc', icon: Users,    color: 'violet',  accentGrad: 'from-violet-400 to-purple-500', iconCls: 'bg-violet-50 text-violet-600' },
  ];

  function generateReportPDF(reportId: string, reportTitle: string, isHistory?: boolean) {
    setGeneratingId(reportId);
    setTimeout(() => {
      const doc = new jsPDF();
      doc.setFontSize(22);
      doc.text(reportTitle, 20, 25);
      doc.setFontSize(12);
      doc.text(`${t('reports.generatedOn')} ${new Date().toLocaleDateString()}`, 20, 35);
      if (isHistory) {
        doc.text(t('reports.archivedReport'), 20, 48);
      } else {
        doc.text(`${t('reports.totalCandidates')}: ${d.totalCandidates}`, 20, 48);
        doc.text(`${t('reports.thisMonth')}: ${d.thisMonth}`, 20, 55);
        doc.text(`${t('reports.conversionRate')}: ${d.conversionRate ?? 0}%`, 20, 62);
        doc.text(`${t('reports.avgTimeToHireLabel')}: ${d.avgTimeToHire ?? 0} ${t('reports.days')}`, 20, 69);
        if (reportId === 'source-performance' && (d.topSources?.length ?? 0) > 0) {
          doc.text(t('reports.topSources'), 20, 82);
          (d.topSources ?? []).slice(0, 5).forEach((s, i) => {
            doc.text(`${s.source}: ${s.count}`, 25, 90 + i * 7);
          });
        }
        if (reportId === 'candidate-funnel' && (d.pipeline?.length ?? 0) > 0) {
          doc.text(t('reports.pipelineStages'), 20, 82);
          (d.pipeline ?? []).slice(0, 8).forEach((p, i) => {
            doc.text(`${p.stage}: ${p.count}`, 25, 90 + i * 7);
          });
        }
      }
      doc.save(`${reportTitle.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
      setGeneratingId(null);
      toast.success(t('reports.export'), t('reports.exportSuccess'));
    }, 600);
  }

  if (data === null) {
    return (
      <PageShell className="animate-pulse">
        <div className="h-10 w-48 rounded-xl bg-stone-200" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-stone-100" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-stone-100" />
          ))}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader icon={FileText} title={t('reports.title')} subtitle={t('reports.subtitle')} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label={t('reports.totalCandidates')}
          value={String(d.totalCandidates)}
          icon={Users}
          iconClassName="text-brand-600 bg-brand-50"
        />
        <StatCard
          label={t('reports.thisMonth')}
          value={String(d.thisMonth)}
          icon={TrendingUp}
          iconClassName="text-emerald-600 bg-emerald-50"
        />
        <StatCard
          label={t('reports.conversionRate')}
          value={`${d.conversionRate ?? 0}%`}
          icon={Target}
          iconClassName="text-violet-600 bg-violet-50"
        />
        <StatCard
          label={t('reports.avgTimeToHireLabel')}
          value={`${d.avgTimeToHire ?? 0} ${t('reports.days')}`}
          icon={Clock}
          iconClassName="text-amber-600 bg-amber-50"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reportCards.map((r, i) => {
          const Icon = r.icon;
          const loading = generatingId === r.id;
          return (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              whileHover={{ y: -4 }}
              className="rounded-2xl border border-stone-200/80 bg-white overflow-hidden shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-all group"
            >
              {/* Colored accent top bar */}
              <div className={`h-1 bg-gradient-to-r ${r.accentGrad}`} />
              <div className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`p-2 sm:p-2.5 rounded-xl ${r.iconCls} flex-shrink-0`}>
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-stone-900 truncate">{t(r.titleKey)}</h3>
                    <p className="text-xs sm:text-sm text-stone-500 mt-0.5 line-clamp-2">{t(r.descKey)}</p>
                  </div>
                </div>
                <motion.button
                  type="button"
                  disabled={!!generatingId}
                  whileHover={{ scale: loading ? 1 : 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => generateReportPDF(r.id, t(r.titleKey))}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-semibold bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors text-sm disabled:opacity-70 disabled:cursor-not-allowed min-w-[88px] sm:min-w-[100px] justify-center flex-shrink-0"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {loading ? t('reports.generating') ?? 'Generating...' : t('reports.export')}
                </motion.button>
              </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-2xl border border-stone-200/80 bg-white p-6 sm:p-8 shadow-[var(--shadow-card)]"
      >
        <div className="flex items-center gap-2 mb-6">
          <Calendar className="w-5 h-5 text-brand-600" />
          <h2 className="text-lg font-bold text-stone-900">{t('reports.reportHistory')}</h2>
        </div>
        <div className="space-y-4">
          {(() => {
            const now = new Date();
            const historyEntries = [
              { id: 'hist-1', nameKey: 'reports.hist1Name', monthOffset: 1, day: 1, size: '2.4 MB', suffix: 'Recruitment_Overview' },
              { id: 'hist-2', nameKey: 'reports.hist2Name', monthOffset: 2, day: 28, size: '1.8 MB', suffix: 'Source_Performance' },
              { id: 'hist-3', nameKey: 'reports.hist3Name', monthOffset: 3, day: 15, size: '3.1 MB', suffix: 'Time_to_Hire' },
            ].map(({ id, nameKey, monthOffset, day, size, suffix }) => {
              const d = new Date(now.getFullYear(), now.getMonth() - monthOffset, Math.min(day, new Date(now.getFullYear(), now.getMonth() - monthOffset + 1, 0).getDate()));
              const label = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
              const monthYear = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).replace(' ', '_');
              return { id, nameKey, date: label, size, title: `${suffix}_${monthYear}` };
            });
            return historyEntries.map((report) => (
            <div key={report.id} className="flex items-center justify-between py-3 border-b border-stone-100 last:border-0">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-stone-400" />
                <div>
                  <p className="font-medium text-stone-900">{t(report.nameKey)}</p>
                  <p className="text-xs text-stone-500">{report.date} · {report.size}</p>
                </div>
              </div>
              <button
                type="button"
                disabled={!!generatingId}
                onClick={() => generateReportPDF(report.id, t(report.nameKey), true)}
                className="flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-70 disabled:cursor-not-allowed min-w-[80px] justify-end"
              >
                {generatingId === report.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {generatingId === report.id ? (t('reports.generating') ?? 'Generating...') : t('reports.download')}
              </button>
            </div>
          ));
          })()}
        </div>
      </motion.div>
    </PageShell>
  );
}
