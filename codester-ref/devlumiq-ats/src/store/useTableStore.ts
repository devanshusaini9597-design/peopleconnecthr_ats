import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CandidatesColumnId = 'candidate' | 'position' | 'experience' | 'source' | 'status' | 'smartMatch' | 'actions';

interface TableState {
  columnVisibility: Record<CandidatesColumnId, boolean>;
  setColumnVisible: (id: CandidatesColumnId, visible: boolean) => void;
  toggleColumn: (id: CandidatesColumnId) => void;
}

const defaultVisibility: Record<CandidatesColumnId, boolean> = {
  candidate: true,
  position: true,
  experience: true,
  source: true,
  status: true,
  smartMatch: true,
  actions: true,
};

export const useTableStore = create<TableState>()(
  persist(
    (set) => ({
      columnVisibility: defaultVisibility,
      setColumnVisible: (id, visible) =>
        set((s) => ({
          columnVisibility: { ...s.columnVisibility, [id]: visible },
        })),
      toggleColumn: (id) =>
        set((s) => {
          const next = { ...s.columnVisibility, [id]: !s.columnVisibility[id] };
          const allHidden = (Object.keys(next) as CandidatesColumnId[]).every((k) => !next[k]);
          if (allHidden) next[id] = true;
          return { columnVisibility: next };
        }),
    }),
    { name: 'ats-candidates-table-v3', partialize: (s) => ({ columnVisibility: s.columnVisibility }) }
  )
);
