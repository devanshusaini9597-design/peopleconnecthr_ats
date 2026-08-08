'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { motion } from 'framer-motion';
import { KanbanCard } from './KanbanCard';

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

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

type StageConfig = {
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
  description: string;
};

export function KanbanColumn({
  id,
  title,
  candidates,
  count,
  pagination,
  footer,
  config,
  allStages,
  currentStage,
  onMoveToStage,
}: {
  id: string;
  title: string;
  candidates: Candidate[];
  count: number;
  pagination?: PaginationProps;
  footer?: React.ReactNode;
  config?: StageConfig;
  allStages?: string[];
  currentStage?: string;
  onMoveToStage?: (cardId: string, targetStage: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const itemIds = candidates.map((c) => c.id);

  const columnConfig = config || { 
    color: 'text-stone-600', 
    bgColor: 'bg-stone-50', 
    borderColor: 'border-stone-200',
    icon: 'stone',
    description: ''
  };

  return (
    <motion.div
      id={`column-${title}`}
      ref={setNodeRef}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex-shrink-0 w-80 rounded-2xl border-2 transition-all duration-300 flex flex-col ${
        isOver
          ? 'border-brand-500/60 bg-brand-50/30 shadow-lg shadow-brand-500/10 scale-[1.02]'
          : `${columnConfig.borderColor} ${columnConfig.bgColor} hover:shadow-md`
      }`}
      style={{ maxHeight: 'calc(100vh - 280px)' }}
    >
      {/* Premium Column Header */}
      <div className={`p-4 border-b ${columnConfig.borderColor} flex-shrink-0 bg-white/60 backdrop-blur-sm rounded-t-2xl`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${columnConfig.bgColor.replace('bg-', 'bg-').replace('50', '500')}`} />
            <h3 className={`font-bold text-sm ${columnConfig.color}`}>{title}</h3>
          </div>
          <span className={`text-xs font-bold ${columnConfig.color} bg-white/80 px-2.5 py-1 rounded-full border ${columnConfig.borderColor}`}>
            {count}
          </span>
        </div>
        <p className="text-[10px] text-stone-500 mt-1 ml-4.5">{columnConfig.description}</p>
      </div>
      
      {/* Scrollable Cards Area */}
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div className="p-3 space-y-3 overflow-y-auto flex-1 scrollbar-thin scroll-smooth">
          {candidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <div className={`w-12 h-12 rounded-xl ${columnConfig.bgColor} flex items-center justify-center mb-2`}>
                <span className="text-xl">📭</span>
              </div>
              <p className="text-xs text-stone-400 font-medium">No candidates</p>
            </div>
          ) : (
            candidates.map((c) => (
              <KanbanCard
                key={c.id}
                candidate={c}
                stageColor={columnConfig.color}
                allStages={allStages}
                currentStage={currentStage || id}
                onMoveToStage={onMoveToStage ? (targetStage) => onMoveToStage(c.id, targetStage) : undefined}
              />
            ))
          )}
        </div>
      </SortableContext>
      
      {/* Footer with Pagination */}
      {footer && (
        <div className={`p-3 border-t ${columnConfig.borderColor} flex-shrink-0 bg-white/50 rounded-b-2xl`}>
          {footer}
        </div>
      )}
    </motion.div>
  );
}
