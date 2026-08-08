'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
  closestCorners,
} from '@dnd-kit/core';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocale } from '@/components/providers/LocaleProvider';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_PERMISSIONS, Role } from '@/lib/roles';
import { 
  LayoutGrid, ChevronLeft, ChevronRight, ChevronDown, Users, Filter,
  ArrowLeftRight, Sparkles, ArrowRight, ArrowLeft
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import PageShell from '@/components/ui/PageShell';
import { KanbanColumn } from '@/components/kanban/KanbanColumn';
import { RejectKeepWarmModal, type RejectKeepWarmChoice } from '@/components/kanban/RejectKeepWarmModal';

const CARDS_PER_PAGE = 8;

const STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Joined', 'Rejected', 'Dropped'];

const stageConfig: Record<string, {
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
  descriptionKey: string;
}> = {
  Applied: {
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    icon: 'blue',
    descriptionKey: 'kanban.descriptions.applied'
  },
  Screening: {
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    icon: 'amber',
    descriptionKey: 'kanban.descriptions.screening'
  },
  Interview: {
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-200',
    icon: 'violet',
    descriptionKey: 'kanban.descriptions.interview'
  },
  Offer: {
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    icon: 'emerald',
    descriptionKey: 'kanban.descriptions.offer'
  },
  Hired: {
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    icon: 'green',
    descriptionKey: 'kanban.descriptions.hired'
  },
  Rejected: {
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    icon: 'red',
    descriptionKey: 'kanban.descriptions.rejected'
  },
  Joined: {
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
    icon: 'teal',
    descriptionKey: 'kanban.descriptions.joined'
  },
  Dropped: {
    color: 'text-stone-600',
    bgColor: 'bg-stone-50',
    borderColor: 'border-stone-200',
    icon: 'stone',
    descriptionKey: 'kanban.descriptions.dropped'
  },
};

type KanbanCardItem = {
  id: string;
  candidateId: string;
  name: string;
  position: string;
  source: string;
  status: string;
  email?: string;
  phone?: string;
  assessmentScore?: number | null;
  latestAssessmentScore?: number | null;
};

function buildByStageFromApplications(applications: {
  id: string;
  candidateId?: string;
  stage: string;
  assessmentScore?: number | null;
  latestAssessmentScore?: number | null;
  candidate: { id?: string; name: string; source?: string; email?: string | null; phone?: string | null };
  job: { title: string };
}[]): Record<string, KanbanCardItem[]> {
  const map: Record<string, KanbanCardItem[]> = {};
  STAGES.forEach((s) => (map[s] = []));
  applications.forEach((a) => {
    const stage = a.stage in map ? a.stage : 'Applied';
    if (!map[stage]) map[stage] = [];
    map[stage].push({
      id: a.id,
      candidateId: a.candidateId || a.candidate.id || '',
      name: a.candidate.name,
      position: a.job?.title ?? '',
      source: a.candidate.source ?? '',
      status: stage,
      email: a.candidate.email ?? undefined,
      phone: a.candidate.phone ?? undefined,
      assessmentScore: a.assessmentScore ?? a.latestAssessmentScore ?? null,
      latestAssessmentScore: a.latestAssessmentScore ?? a.assessmentScore ?? null,
    });
  });
  return map;
}

function emptyByStage(): Record<string, KanbanCardItem[]> {
  const map: Record<string, KanbanCardItem[]> = {};
  STAGES.forEach((s) => (map[s] = []));
  return map;
}

export default function KanbanPage() {
  const { t } = useLocale();
  const toast = useToast();
  const { user } = useAuth();
  const userRole = user?.role as Role | undefined;
  const userPermissions = userRole ? (ROLE_PERMISSIONS[userRole] ?? []) : [];
  const canMoveApplication = userPermissions.includes('MOVE_APPLICATION');
  const [byStage, setByStage] = useState<Record<string, KanbanCardItem[]>>(emptyByStage);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Record<string, { page: number; cardsPerPage: number }>>(
    () => Object.fromEntries(STAGES.map(s => [s, { page: 1, cardsPerPage: CARDS_PER_PAGE }]))
  );
  const [cardsPerPageOptions] = useState([4, 6, 8, 10]);
  const [showCardsPerPage, setShowCardsPerPage] = useState(false);
  const [rejectPrompt, setRejectPrompt] = useState<{
    applicationId: string;
    candidateName: string;
  } | null>(null);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/applications', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      const list = json.applications ?? [];
      const built = list.length ? buildByStageFromApplications(list) : emptyByStage();
      setByStage(built);
    } catch {
      setByStage(emptyByStage());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  // Pagination helpers
  const getPaginatedCandidates = (stage: string) => {
    const allCandidates = byStage[stage] || [];
    const { page, cardsPerPage } = pagination[stage];
    const startIndex = (page - 1) * cardsPerPage;
    return allCandidates.slice(startIndex, startIndex + cardsPerPage);
  };

  const getTotalPages = (stage: string) => {
    const allCandidates = byStage[stage] || [];
    const { cardsPerPage } = pagination[stage];
    return Math.max(1, Math.ceil(allCandidates.length / cardsPerPage));
  };

  const goToPage = (stage: string, page: number) => {
    setPagination(prev => ({
      ...prev,
      [stage]: { ...prev[stage], page: Math.max(1, Math.min(page, getTotalPages(stage))) }
    }));
  };

  const setCardsPerPageForStage = (stage: string, count: number) => {
    setPagination(prev => ({
      ...prev,
      [stage]: { page: 1, cardsPerPage: count }
    }));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 10 } })
  );

  const requestMoveToStage = (applicationId: string, targetStage: string) => {
    if (targetStage === 'Rejected') {
      const card = Object.values(byStage).flat().find((c) => c.id === applicationId);
      setRejectPrompt({
        applicationId,
        candidateName: card?.name || 'Candidate',
      });
      return;
    }
    void moveCardToStage(applicationId, targetStage);
  };

  const moveCardToStage = async (
    applicationId: string,
    targetStage: string,
    extras?: RejectKeepWarmChoice,
  ) => {
    try {
      const body: Record<string, unknown> = { stage: targetStage };
      if (targetStage === 'Rejected' && extras?.addToTalentPool) {
        body.addToTalentPool = true;
        if (extras.grantConsent) body.grantConsent = true;
      }
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setByStage((prev) => {
          const next = JSON.parse(JSON.stringify(prev)) as Record<string, KanbanCardItem[]>;
          let card: KanbanCardItem | null = null;
          for (const stage of STAGES) {
            const idx = next[stage]?.findIndex((c) => c.id === applicationId) ?? -1;
            if (idx >= 0) {
              card = next[stage][idx];
              next[stage] = next[stage].filter((c) => c.id !== applicationId);
              break;
            }
          }
          if (card && next[targetStage]) {
            next[targetStage] = [...next[targetStage], { ...card, status: targetStage }];
          }
          return next;
        });
        const poolNote =
          targetStage === 'Rejected' && (data as { talentPoolId?: string | null }).talentPoolId
            ? ' Added to talent pool.'
            : '';
        toast.success(t('kanban.title'), `${t('kanban.stageUpdated', { stage: targetStage })}${poolNote}`);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(t('common.error'), (data as { error?: string })?.error ?? t('kanban.updateFailed'));
        fetchApplications();
      }
    } catch {
      toast.error(t('common.error'), t('kanban.updateFailed'));
      fetchApplications();
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;
    if (!canMoveApplication) {
      toast.error(t('kanban.noPermission') || 'You do not have permission to move applications');
      return;
    }
    const overId = String(over.id);
    const applicationId = String(active.id);
    if (overId === applicationId) return;
    let targetStage: string | null = STAGES.includes(overId) ? overId : null;
    if (!targetStage) {
      for (const [stage, list] of Object.entries(byStage)) {
        if (list.some((c) => c.id === overId)) {
          targetStage = stage;
          break;
        }
      }
    }
    if (targetStage) {
      requestMoveToStage(applicationId, targetStage);
    }
  };

  const activeCandidate = activeId
    ? Object.values(byStage).flat().find((c) => c.id === activeId)
    : null;

  const totalCandidates = useMemo(() => Object.values(byStage).flat().length, [byStage]);

  return (
    <PageShell>
      <PageHeader icon={LayoutGrid} title={t('kanban.title')} subtitle={t('kanban.subtitle')}>
        {/* Cards Per Page Control */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowCardsPerPage(!showCardsPerPage)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-stone-200 hover:border-brand-300 bg-white text-stone-700 text-sm font-medium transition-all"
          >
            <span>{t('kanban.cards.label')}: {pagination[STAGES[0]]?.cardsPerPage || CARDS_PER_PAGE}</span>
            <ChevronDown className="w-4 h-4" />
          </button>
          <AnimatePresence>
            {showCardsPerPage && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="absolute right-0 top-full mt-1 py-2 rounded-xl border border-stone-200 bg-white shadow-xl z-50 min-w-[140px]"
              >
                <p className="px-3 py-1 text-xs font-semibold text-stone-400 uppercase tracking-wider">{t('kanban.cards.perColumn')}</p>
                {cardsPerPageOptions.map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => {
                      STAGES.forEach(stage => setCardsPerPageForStage(stage, count));
                      setShowCardsPerPage(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      pagination[STAGES[0]]?.cardsPerPage === count
                        ? 'bg-brand-50 text-brand-700 font-medium'
                        : 'text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    {t('kanban.cards.count', { count: String(count) })}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </PageHeader>

      {/* Premium Pipeline Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {STAGES.map((stage) => {
          const count = (byStage[stage] || []).length;
          const config = stageConfig[stage];
          return (
            <motion.div
              key={stage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-xl border ${config.borderColor} ${config.bgColor} p-3 cursor-pointer hover:shadow-md transition-shadow`}
              onClick={() => {
                const element = document.getElementById(`column-${stage}`);
                element?.scrollIntoView({ behavior: 'smooth', inline: 'center' });
              }}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold ${config.color}`}>{t(`kanban.stages.${stage.toLowerCase()}` as keyof typeof t) || stage}</span>
                <span className={`text-lg font-bold ${config.color}`}>{count}</span>
              </div>
              <p className="text-[10px] text-stone-500 mt-1">{t(config.descriptionKey)}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Quick Filters */}
      <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-hide">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-stone-100 text-stone-600 text-xs font-medium">
          <ArrowLeftRight className="w-3.5 h-3.5" />
          {t('kanban.dragHint')}
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-50 text-brand-600 text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5" />
          {t('kanban.totalCandidates', { count: String(totalCandidates) })}
        </div>
      </div>

      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-4 min-h-[420px] animate-pulse">
          {STAGES.map((stage) => (
            <div key={stage} className="w-72 flex-shrink-0 rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-3">
              <div className="h-6 w-24 bg-stone-200 rounded-lg" />
              <div className="h-24 bg-stone-100 rounded-lg" />
              <div className="h-24 bg-stone-100 rounded-lg" />
              <div className="h-24 bg-stone-100 rounded-lg" />
            </div>
          ))}
        </div>
      ) : (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Scrollable Kanban Board with visible controls */}
        <div className="relative group">
          {/* Left Scroll Button */}
          <button
            onClick={() => {
              const container = document.getElementById('kanban-board');
              container?.scrollBy({ left: -400, behavior: 'smooth' });
            }}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white shadow-lg border border-stone-200 flex items-center justify-center text-stone-600 hover:text-brand-600 hover:border-brand-300 transition-all opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          {/* Right Scroll Button */}
          <button
            onClick={() => {
              const container = document.getElementById('kanban-board');
              container?.scrollBy({ left: 400, behavior: 'smooth' });
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white shadow-lg border border-stone-200 flex items-center justify-center text-stone-600 hover:text-brand-600 hover:border-brand-300 transition-all opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto"
          >
            <ArrowRight className="w-5 h-5" />
          </button>

          <div 
            id="kanban-board"
            className="flex gap-4 overflow-x-auto overflow-y-hidden pb-4 pt-1 min-h-[calc(100vh-340px)] scrollbar-thin scroll-smooth" 
            style={{ 
              WebkitOverflowScrolling: 'touch',
            }}
          >
          {STAGES.map((stage) => {
            const totalPages = getTotalPages(stage);
            const currentPage = pagination[stage].page;
            const paginatedCandidates = getPaginatedCandidates(stage);
            const totalCount = (byStage[stage] || []).length;
            const showingCount = paginatedCandidates.length;
            const config = stageConfig[stage];
            const configWithTranslation = config ? {
              ...config,
              description: t(config.descriptionKey)
            } : undefined;

            return (
              <KanbanColumn
                key={stage}
                id={stage}
                title={t(`kanban.stages.${stage.toLowerCase()}` as keyof typeof t) || stage}
                config={configWithTranslation}
                candidates={paginatedCandidates}
                count={totalCount}
                allStages={STAGES}
                currentStage={stage}
                onMoveToStage={(cardId, targetStage) => requestMoveToStage(cardId, targetStage)}
                footer={totalPages > 1 ? (
                  <div className="flex flex-col gap-2">
                    {/* Pagination Info */}
                    <div className="flex items-center justify-between text-xs text-stone-500">
                      <span>{t('common.page')} {currentPage} {t('common.of')} {totalPages}</span>
                      <span>{showingCount} {t('common.of')} {totalCount}</span>
                    </div>
                    {/* Pagination Controls */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => goToPage(stage, currentPage - 1)}
                        disabled={currentPage <= 1}
                        className="p-1.5 rounded-lg hover:bg-stone-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>

                      {/* Page Numbers */}
                      <div className="flex items-center gap-0.5 flex-1 justify-center">
                        {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                          let pageNum: number;
                          if (totalPages <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage === 1) {
                            pageNum = i + 1;
                          } else if (currentPage === totalPages) {
                            pageNum = totalPages - 2 + i;
                          } else {
                            pageNum = currentPage - 1 + i;
                          }
                          return (
                            <button
                              key={pageNum}
                              type="button"
                              onClick={() => goToPage(stage, pageNum)}
                              className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                                pageNum === currentPage
                                  ? 'bg-brand-500 text-white'
                                  : 'hover:bg-stone-200 text-stone-600'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                        {totalPages > 3 && currentPage < totalPages - 1 && (
                          <span className="text-stone-400 px-1">...</span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => goToPage(stage, currentPage + 1)}
                        disabled={currentPage >= totalPages}
                        className="p-1.5 rounded-lg hover:bg-stone-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : totalCount > showingCount ? (
                  <div className="flex items-center justify-between text-xs text-stone-500">
                    <span>{t('kanban.showing', { showing: String(showingCount), total: String(totalCount) })}</span>
                    <button
                      type="button"
                      onClick={() => goToPage(stage, 1)}
                      className="text-brand-600 hover:text-brand-700 font-medium"
                    >
                      {t('kanban.viewAll')}
                    </button>
                  </div>
                ) : null}
              />
            );
          })}
          </div>
        </div>

        <DragOverlay>
          {activeCandidate ? (
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="w-72 rounded-xl border-2 border-brand-500/50 bg-white shadow-2xl p-4 cursor-grabbing"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-brand-100 flex items-center justify-center font-bold text-brand-700 text-sm">
                  {activeCandidate.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-stone-900 truncate">
                    {activeCandidate.name}
                  </p>
                  <p className="text-xs text-stone-500 truncate">
                    {activeCandidate.position}
                  </p>
                  <p className="text-[10px] text-stone-400 mt-1">
                    {activeCandidate.source}
                  </p>
                </div>
              </div>
            </motion.div>
          ) : null}
        </DragOverlay>
      </DndContext>
      )}
      {rejectPrompt && (
        <RejectKeepWarmModal
          candidateName={rejectPrompt.candidateName}
          onCancel={() => setRejectPrompt(null)}
          onConfirm={(choice) => {
            const { applicationId } = rejectPrompt;
            setRejectPrompt(null);
            void moveCardToStage(applicationId, 'Rejected', choice);
          }}
        />
      )}
    </PageShell>
  );
}
