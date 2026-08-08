import { afterEach, describe, expect, it } from 'vitest';
import {
  getCodeRunnerStatus,
  isCodeRunnerEnabled,
  publicTestCases,
} from '@/lib/code-runner';

const ENV_KEYS = ['ASSESSMENT_CODE_RUNNER', 'JUDGE0_API_URL'] as const;

function clearRunnerEnv() {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

afterEach(() => {
  clearRunnerEnv();
});

describe('isCodeRunnerEnabled', () => {
  it('is off by default (no Judge0, no opt-in)', () => {
    clearRunnerEnv();
    expect(isCodeRunnerEnabled()).toBe(false);
    expect(getCodeRunnerStatus().backend).toBe('off');
  });

  it('enables when Judge0 is configured', () => {
    clearRunnerEnv();
    process.env.JUDGE0_API_URL = 'https://ce.judge0.com';
    expect(isCodeRunnerEnabled()).toBe(true);
    expect(getCodeRunnerStatus().backend).toBe('judge0');
  });

  it('enables local node:vm only with explicit opt-in', () => {
    clearRunnerEnv();
    process.env.ASSESSMENT_CODE_RUNNER = 'true';
    expect(isCodeRunnerEnabled()).toBe(true);
    expect(getCodeRunnerStatus().backend).toBe('node-vm');
  });

  it('force-disables even when Judge0 is set', () => {
    clearRunnerEnv();
    process.env.JUDGE0_API_URL = 'https://ce.judge0.com';
    process.env.ASSESSMENT_CODE_RUNNER = 'false';
    expect(isCodeRunnerEnabled()).toBe(false);
  });
});

describe('publicTestCases', () => {
  it('strips hidden cases so candidates never see them', () => {
    const visible = publicTestCases([
      { input: '1', output: '2', hidden: false },
      { input: 'secret', output: 'leak', hidden: true },
      { input: '3', expected: '4' },
    ]);
    expect(visible).toEqual([
      { input: '1', output: '2' },
      { input: '3', output: '4' },
    ]);
    expect(visible.some((tc) => tc.input === 'secret')).toBe(false);
  });

  it('returns empty array for non-arrays', () => {
    expect(publicTestCases(null)).toEqual([]);
    expect(publicTestCases('x')).toEqual([]);
  });
});
