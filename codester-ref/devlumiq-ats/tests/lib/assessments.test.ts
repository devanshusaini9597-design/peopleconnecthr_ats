import { afterEach, describe, expect, it } from 'vitest';
import {
  gradeAnswer,
  isAutoGradableMcq,
  isCodingType,
  needsManualReview,
  validateAnswerPayload,
} from '@/lib/assessments';

afterEach(() => {
  delete process.env.ASSESSMENT_CODE_RUNNER;
  delete process.env.JUDGE0_API_URL;
});

describe('assessment type helpers', () => {
  it('detects MCQ vs coding vs manual-review types', () => {
    expect(isAutoGradableMcq('Multiple Choice')).toBe(true);
    expect(isAutoGradableMcq('logical reasoning')).toBe(true);
    expect(isCodingType('Coding Challenge')).toBe(true);
    expect(needsManualReview('Open Ended')).toBe(true);
    expect(needsManualReview('Personality')).toBe(true);
    expect(needsManualReview('Multiple Choice')).toBe(false);
  });
});

describe('gradeAnswer', () => {
  it('auto-grades MCQ case-insensitively on the server', async () => {
    const correct = await gradeAnswer(
      { type: 'Multiple Choice', correctAnswer: 'B', points: 5 },
      'b',
    );
    expect(correct).toEqual({ isCorrect: true, pointsEarned: 5, pendingReview: false });

    const wrong = await gradeAnswer(
      { type: 'mcq', correctAnswer: 'B', points: 5 },
      'A',
    );
    expect(wrong).toEqual({ isCorrect: false, pointsEarned: 0, pendingReview: false });
  });

  it('leaves open/personality answers for manual review', async () => {
    const result = await gradeAnswer(
      { type: 'Open Ended', correctAnswer: null, points: 10 },
      'A thoughtful essay…',
    );
    expect(result).toEqual({ isCorrect: null, pointsEarned: 0, pendingReview: true });
  });

  it('does not execute coding answers when runner is disabled', async () => {
    delete process.env.ASSESSMENT_CODE_RUNNER;
    delete process.env.JUDGE0_API_URL;
    const result = await gradeAnswer(
      {
        type: 'Coding',
        correctAnswer: null,
        points: 10,
        language: 'javascript',
        testCases: [{ input: '1', output: '1' }],
      },
      'return 1',
      'function solve(){ return 1 }',
    );
    expect(result.pendingReview).toBe(true);
    expect(result.pointsEarned).toBe(0);
    expect(result.isCorrect).toBeNull();
  });
});

describe('validateAnswerPayload', () => {
  it('accepts normal answers and rejects oversized payloads', () => {
    expect(validateAnswerPayload({ answer: 'ok' })).toEqual({
      answer: 'ok',
      codeSubmission: null,
    });
    const huge = 'x'.repeat(100_001);
    expect(validateAnswerPayload({ answer: huge }).error).toBe('Answer too large');
  });
});
