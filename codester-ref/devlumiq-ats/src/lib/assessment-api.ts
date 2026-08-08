/**
 * Shared helpers for public token-gated assessment APIs.
 * Kept separate from assessments.ts to avoid heavy imports in edge cases.
 */

import { publicTestCases } from '@/lib/code-runner';
import {
  findAssignmentByToken,
  ensureNotExpired,
  isWritableStatus,
} from '@/lib/assessments';

export { findAssignmentByToken, ensureNotExpired, isWritableStatus };

export function publicQuestionsPayload(
  questions: Array<{
    id: string;
    type: string;
    question: string;
    description: string | null;
    codeSnippet: string | null;
    options: unknown;
    points: number;
    language: string | null;
    testCases: unknown;
  }>,
) {
  return questions.map((q) => {
    const type = (q.type || '').toLowerCase();
    const isCoding = type.includes('coding') || type === 'code';
    return {
      id: q.id,
      type: q.type,
      question: q.question,
      description: q.description,
      codeSnippet: q.codeSnippet,
      options: q.options,
      points: q.points,
      language: q.language,
      // Public practice cases only (no hidden expected outputs leaked beyond public ones)
      testCases: isCoding ? publicTestCases(q.testCases) : undefined,
    };
  });
}
