'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import { GripVertical, Star, FileText, Mail, Phone, ExternalLink, ChevronDown, ArrowRight } from 'lucide-react';

// Portal-based dropdown to escape overflow-y-auto clipping in KanbanColumn
function MoveStagePortal({
  isOpen,
  onClose,
  stages,
  triggerId,
  onMove,
}: {
  isOpen: boolean;
  onClose: () => void;
  stages: string[];
  triggerId: string;
  onMove: (stage: string) => void;
}) {
  const [position, setPosition] = useState<{ top?: number; bottom?: number; left: number; width: number }>({ left: 0, width: 200 });

  useEffect(() => {
    if (isOpen) {
      const btn = document.getElementById(triggerId);
      if (btn) {
        const rect = btn.getBoundingClientRect();
        const dropdownHeight = Math.min(stages.length * 42 + 52, 280);
        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - rect.bottom;
        if (spaceBelow < dropdownHeight && rect.top > spaceBelow) {
          setPosition({ bottom: viewportHeight - rect.top + 4, left: rect.left, width: rect.width });
        } else {
          setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
        }
      }
    }
  }, [isOpen, triggerId, stages.length]);

  if (!isOpen) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed bg-white rounded-xl border border-stone-200 shadow-2xl z-50 overflow-hidden"
        style={{
          ...(position.top !== undefined ? { top: position.top } : {}),
          ...(position.bottom !== undefined ? { bottom: position.bottom } : {}),
          left: Math.max(8, position.left),
          width: Math.max(180, position.width),
          maxHeight: 'calc(100vh - 40px)',
          maxWidth: 'calc(100vw - 16px)',
        }}
      >
        <div className="px-3 py-2.5 bg-gradient-to-r from-brand-600 to-teal-600">
          <p className="text-xs font-semibold text-white flex items-center gap-1.5">
            <ArrowRight className="w-3 h-3" />
            Move to Stage
          </p>
        </div>
        <div className="py-1 max-h-56 overflow-y-auto">
          {stages.map((stage) => (
            <button
              key={stage}
              type="button"
              onClick={() => { onMove(stage); onClose(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-xs text-stone-700 hover:bg-brand-50 hover:text-brand-700 transition-colors font-medium"
            >
              <ArrowRight className="w-3 h-3 text-brand-500 flex-shrink-0" />
              {stage}
            </button>
          ))}
        </div>
      </div>
    </>,
    document.body
  );
}

type Candidate = {
  id: string;
  candidateId?: string;
  name: string;
  position: string;
  source: string;
  status: string;
  email?: string;
  createdAt?: string;
  phone?: string;
  assessmentScore?: number | null;
  latestAssessmentScore?: number | null;
};

export function KanbanCard({
  candidate,
  stageColor,
  allStages,
  currentStage,
  onMoveToStage,
}: {
  candidate: Candidate;
  stageColor?: string;
  allStages?: string[];
  currentStage?: string;
  onMoveToStage?: (targetStage: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: candidate.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isInterviewStage = candidate.status === 'Interview';
  const isOfferStage = candidate.status === 'Offer';
  const isHired = candidate.status === 'Hired';
  const colorClass = stageColor || 'text-stone-600';
  const profileId = candidate.candidateId || candidate.id;
  const showContact =
    Boolean(candidate.email) &&
    candidate.email !== 'hidden@blind.local' &&
    !candidate.name.startsWith('Candidate ');
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [swipeHint, setSwipeHint] = useState<'left' | 'right' | null>(null);
  const otherStages = allStages ? allStages.filter((s) => s !== (currentStage || candidate.status)) : [];
  const stageList = allStages || [];
  const stageIdx = stageList.indexOf(currentStage || candidate.status);

  const swipeToAdjacent = (dir: 'left' | 'right') => {
    if (!onMoveToStage || stageIdx < 0) {
      setShowMoveMenu(true);
      return;
    }
    const next = dir === 'right' ? stageList[stageIdx + 1] : stageList[stageIdx - 1];
    if (next) onMoveToStage(next);
    else setShowMoveMenu(true);
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      whileHover={{ y: -2 }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.35}
      onDrag={(_, info) => {
        if (info.offset.x > 40) setSwipeHint('right');
        else if (info.offset.x < -40) setSwipeHint('left');
        else setSwipeHint(null);
      }}
      onDragEnd={(_, info) => {
        setSwipeHint(null);
        if (info.offset.x > 80) swipeToAdjacent('right');
        else if (info.offset.x < -80) swipeToAdjacent('left');
      }}
      className={`group relative rounded-xl border border-stone-200 bg-white p-3.5 shadow-sm hover:shadow-lg hover:border-stone-300 transition-all duration-300 touch-pan-y ${
        isDragging ? 'opacity-90 shadow-2xl ring-2 ring-brand-500 rotate-2 scale-105 z-50' : ''
      }`}
    >
      {swipeHint && (
        <div className={`absolute inset-y-0 ${swipeHint === 'right' ? 'left-0' : 'right-0'} w-1.5 rounded-full bg-brand-500`} />
      )}
      {/* Drag Handle */}
      <button
        type="button"
        className="absolute top-2 right-2 p-1.5 rounded-lg text-stone-300 hover:text-stone-500 hover:bg-stone-100 cursor-grab active:cursor-grabbing transition-colors"
        {...attributes}
        {...listeners}
        aria-label="Drag to move"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>

      {/* Card Content */}
      <Link 
        href={`/dashboard/candidates/${profileId}`} 
        className="flex items-start gap-3 pr-8"
      >
        <motion.div
          layoutId={`candidate-avatar-${candidate.id}`}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className={`w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 flex items-center justify-center font-bold text-brand-700 text-sm flex-shrink-0 border-2 border-white shadow-sm ${colorClass.replace('text-', 'ring-').replace('600', '200')} ring-2`}
        >
          {candidate.name[0]}
        </motion.div>
        <div className="flex-1 min-w-0 pt-0.5">
          <p className="font-bold text-stone-900 text-sm truncate leading-tight">
            {candidate.name}
          </p>
          <p className="text-xs text-stone-500 truncate mt-0.5">
            {candidate.position}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[10px] text-stone-400 bg-stone-50 px-1.5 py-0.5 rounded">
              {candidate.source}
            </span>
            {(candidate.assessmentScore != null || candidate.latestAssessmentScore != null) && (
              <Link
                href={`/dashboard/candidates/${profileId}#assessments`}
                onClick={(e) => e.stopPropagation()}
                className="text-[10px] font-semibold text-teal-700 bg-teal-50 border border-teal-100 px-1.5 py-0.5 rounded hover:bg-teal-100"
                title="View candidate assessments"
              >
                Assess {Math.round(Number(candidate.assessmentScore ?? candidate.latestAssessmentScore))}%
              </Link>
            )}
          </div>
        </div>
      </Link>
      
      {/* Premium Actions Footer */}
      <div className="mt-3 pt-3 border-t border-stone-100 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {isInterviewStage && (
              <Link
                href={`/dashboard/premium/scoring?candidate=${profileId}`}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 text-amber-700 text-[10px] font-semibold hover:bg-amber-100 transition-colors"
              >
                <Star className="w-3 h-3" />
                Score
              </Link>
            )}
            {isOfferStage && (
              <Link
                href={`/dashboard/premium/offers?candidate=${profileId}`}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-semibold hover:bg-emerald-100 transition-colors"
              >
                <FileText className="w-3 h-3" />
                Offer
              </Link>
            )}
            {isHired && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-50 text-green-700 text-[10px] font-semibold">
                <span>✓</span>
                Hired
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {showContact && candidate.phone && (
              <a
                href={`https://wa.me/${candidate.phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                title="WhatsApp"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982 1.001-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413"/>
                </svg>
              </a>
            )}
            {showContact && candidate.email && (
              <a
                href={`mailto:${candidate.email}`}
                className="p-1.5 rounded-lg text-brand-500 hover:bg-brand-50 hover:text-brand-600 transition-colors"
                title="Send Email"
              >
                <Mail className="w-3.5 h-3.5" />
              </a>
            )}
            <Link
              href={`/dashboard/candidates/${profileId}`}
              className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
              title="View Profile"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Mobile Stage Selector - portal-based to escape overflow clipping */}
        {onMoveToStage && otherStages.length > 0 && (
          <div>
            <button
              id={`move-stage-btn-${candidate.id}`}
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowMoveMenu((v) => !v); }}
              className="w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg bg-stone-50 hover:bg-brand-50 text-stone-500 hover:text-brand-600 text-[10px] font-semibold border border-stone-200 hover:border-brand-300 transition-colors"
            >
              <span className="flex items-center gap-1"><ArrowRight className="w-3 h-3" /> Move Stage</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${showMoveMenu ? 'rotate-180' : ''}`} />
            </button>
            <MoveStagePortal
              isOpen={showMoveMenu}
              onClose={() => setShowMoveMenu(false)}
              stages={otherStages}
              triggerId={`move-stage-btn-${candidate.id}`}
              onMove={onMoveToStage}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}
