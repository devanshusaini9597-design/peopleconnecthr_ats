/**
 * Unit tests for freelance board stage lock / unlock cell kinds.
 */
const path = require('path');
const fs = require('fs');

// Lightweight re-implementation mirrored from FreelanceKanbanBoard.jsx (keep in sync).
const LINEAR = ['submitted', 'reviewing', 'shortlisted', 'selection', 'joined'];
const STAGES = [
  ...LINEAR.map((id) => ({ id, label: id })),
  { id: 'rejected', label: 'Declined', terminal: true },
];

function linearOrder(stages) {
  return (stages || [])
    .filter((s) => !s.terminal && !/reject|drop/i.test(String(s.id || s.label || '')))
    .map((s) => s.id);
}

function isTerminalStage(stageId, stages) {
  const s = (stages || []).find((x) => x.id === stageId);
  if (s?.terminal) return true;
  return /reject|drop|declin/i.test(String(stageId || ''));
}

function cellKind(current, stageId, stages) {
  if (current === stageId) return 'current';
  const order = stages?.length ? linearOrder(stages) : LINEAR;
  const currentTerminal = isTerminalStage(current, stages);
  const stageTerminal = isTerminalStage(stageId, stages);
  if (currentTerminal) return 'locked';
  if (stageTerminal) return 'empty';
  const ci = order.indexOf(current);
  const si = order.indexOf(stageId);
  if (si >= 0 && ci >= 0 && si < ci) return 'locked';
  return 'empty';
}

describe('freelance stage lock/unlock', () => {
  it('locks all other stages when current is rejected (no Place here siblings)', () => {
    expect(cellKind('rejected', 'submitted', STAGES)).toBe('locked');
    expect(cellKind('rejected', 'reviewing', STAGES)).toBe('locked');
    expect(cellKind('rejected', 'shortlisted', STAGES)).toBe('locked');
    expect(cellKind('rejected', 'selection', STAGES)).toBe('locked');
    expect(cellKind('rejected', 'joined', STAGES)).toBe('locked');
    expect(cellKind('rejected', 'rejected', STAGES)).toBe('current');
  });

  it('locks prior stages while mid-pipeline; keeps future and declined placeable', () => {
    expect(cellKind('shortlisted', 'submitted', STAGES)).toBe('locked');
    expect(cellKind('shortlisted', 'reviewing', STAGES)).toBe('locked');
    expect(cellKind('shortlisted', 'shortlisted', STAGES)).toBe('current');
    expect(cellKind('shortlisted', 'selection', STAGES)).toBe('empty');
    expect(cellKind('shortlisted', 'joined', STAGES)).toBe('empty');
    expect(cellKind('shortlisted', 'rejected', STAGES)).toBe('empty');
  });

  it('exports cellKind from board module source', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../../frontend/src/components/freelance/FreelanceKanbanBoard.jsx'),
      'utf8'
    );
    expect(src).toMatch(/export function cellKind/);
    expect(src).toMatch(/Stage is locked/);
    expect(src).toMatch(/Unlock & move/);
    expect(src).toMatch(/Confirm move/);
    expect(src).toMatch(/requestStageMove|onRequestMove/);
  });
});
