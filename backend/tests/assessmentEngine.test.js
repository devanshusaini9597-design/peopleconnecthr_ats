const engine = require('../utils/assessmentEngine');

const mcq = (id, correct, points = 10) => ({
  _id: id, type: 'multiple_choice', prompt: 'Q', options: ['a', 'b'], correctOptionIndex: correct, points,
});
const written = (id, points = 20) => ({
  _id: id, type: 'text', prompt: 'Explain', points, rubric: 'Clarity',
});

describe('assessmentEngine security and scoring', () => {
  test('candidate payload never includes keys, rubrics or hidden tests', () => {
    const safe = engine.sanitizeCandidateQuestion({
      _id: 'q1',
      type: 'code',
      prompt: 'Write sum',
      language: 'javascript',
      points: 15,
      correctOptionIndex: 1,
      hiddenTests: [{ input: '1', expected: '1' }],
      rubric: 'secret',
      answerKey: 'nope',
    });
    expect(safe.correctOptionIndex).toBeUndefined();
    expect(safe.hiddenTests).toBeUndefined();
    expect(safe.rubric).toBeUndefined();
    expect(safe.answerKey).toBeUndefined();
    expect(safe.prompt).toBe('Write sum');
  });

  test('auto-scores MCQ and does not fail while written answers need review', () => {
    const scored = engine.scoreAttempt({
      questions: [mcq('1', 0), written('2')],
      answers: [{ questionId: '1', response: '0' }, { questionId: '2', response: 'essay' }],
      rules: { passingScorePercent: 50, negativeMarkPercent: 0 },
    });
    expect(scored.answers.find((a) => String(a.questionId) === '1').autoScore).toBe(10);
    expect(scored.needsReview).toBe(true);
    expect(scored.scoringStatus).toBe('pending_review');
    expect(scored.passFail).toBe('pending');
  });

  test('applies negative marking on wrong MCQ and can pass/fail only when fully scored', () => {
    const scored = engine.scoreAttempt({
      questions: [mcq('1', 0, 10), mcq('2', 1, 10)],
      answers: [{ questionId: '1', response: '1' }, { questionId: '2', response: '1' }],
      rules: { passingScorePercent: 50, negativeMarkPercent: 50 },
    });
    expect(scored.needsReview).toBe(false);
    expect(scored.totalScore).toBe(5);
    expect(scored.passFail).toBe('fail');
  });

  test('deadline is server-side and capped by invite expiry', () => {
    const startedAt = new Date('2026-01-01T10:00:00Z');
    const deadline = engine.computeDeadline({
      startedAt,
      durationMinutes: 60,
      inviteExpiresAt: new Date('2026-01-01T10:20:00Z'),
    });
    expect(deadline.toISOString()).toBe('2026-01-01T10:20:00.000Z');
  });

  test('ranking is score-desc and skips pending review so they are not failed-ranked', () => {
    const ranked = engine.rankRows([
      { status: 'submitted', scoringStatus: 'scored', totalScore: 8 },
      { status: 'submitted', scoringStatus: 'pending_review', totalScore: 90 },
      { status: 'graded', scoringStatus: 'scored', totalScore: 12 },
    ]);
    expect(ranked.map((r) => r.totalScore)).toEqual([12, 8]);
    expect(ranked[0].rank).toBe(1);
  });

  test('skill breakdown is job-comparable and uses confirmed scores', () => {
    const breakdown = engine.buildSkillBreakdown(
      [
        { _id: '1', skillTag: 'React', points: 10 },
        { _id: '2', skillTag: 'React', points: 10 },
        { _id: '3', section: 'Aptitude', points: 20 },
      ],
      [
        { questionId: '1', autoScore: 10 },
        { questionId: '2', autoScore: 0 },
        { questionId: '3', manualScore: 16 },
      ]
    );
    expect(breakdown.find((r) => r.skill === 'React').percent).toBe(50);
    expect(breakdown.find((r) => r.skill === 'Aptitude').earned).toBe(16);
  });

  test('hidden result visibility does not leak scores', () => {
    const view = engine.candidateResultView(
      { totalScore: 99, maxScore: 100, scoringStatus: 'scored', passFail: 'pass' },
      { resultVisibility: 'hidden' }
    );
    expect(view.totalScore).toBeUndefined();
    expect(view.message).toMatch(/hiring team/i);
  });
});
