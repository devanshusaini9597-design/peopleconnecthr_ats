/**
 * Sandboxed code execution for assessment coding questions.
 *
 * When JUDGE0_API_URL is set, uses Judge0 (BYOK) for multi-language execution.
 * Local node:vm (JavaScript only) is OFF by default — opt in with ASSESSMENT_CODE_RUNNER=true.
 *
 * SECURITY: node:vm is NOT a true security boundary. Prefer Judge0 / containers
 * for untrusted production workloads. Do not enable the local runner on internet-facing
 * deployments unless you accept the RCE risk of executing candidate-submitted code in-process.
 *
 * LIMITATION: `script.runInContext(..., { timeout })` only bounds synchronous CPU time.
 * Candidate code that schedules infinite microtask recursion (e.g. `Promise.resolve().then(loop)`)
 * is NOT caught by the timeout and can hang the Node process — another reason the local
 * runner must never be treated as a production sandbox.
 */

import { createContext, Script } from 'node:vm';
import { getProviderSecret } from '@/lib/org-secrets';

export type TestCase = {
  input?: string;
  output?: string;
  expected?: string;
  hidden?: boolean;
};

export type TestResult = {
  index: number;
  passed: boolean;
  input: string;
  expected: string;
  actual: string;
  error?: string;
};

export type RunCodeResult = {
  language: string;
  supported: boolean;
  disabled?: boolean;
  results: TestResult[];
  passedCount: number;
  totalCount: number;
  pointsEarned: number;
  maxPoints: number;
  isCorrect: boolean | null;
};

const JS_TIMEOUT_MS = 1500;
const MAX_CODE_LENGTH = 50_000;
const JUDGE0_POLL_MAX = 10;
const JUDGE0_POLL_MS = 500;

/** Judge0 CE common language_ids */
const JUDGE0_LANGUAGE_IDS: Record<string, number> = {
  javascript: 63,
  js: 63,
  typescript: 74,
  ts: 74,
  python: 71,
  python3: 71,
  py: 71,
  java: 62,
  c: 50,
  cpp: 54,
  'c++': 54,
  csharp: 51,
  'c#': 51,
  go: 60,
  ruby: 72,
  php: 68,
  rust: 73,
  kotlin: 78,
  swift: 83,
};

const JUDGE0_LANG_KEYS = [
  'javascript', 'js', 'typescript', 'ts', 'python', 'python3', 'py',
  'java', 'c', 'cpp', 'c++', 'csharp', 'c#', 'go', 'ruby', 'php',
  'rust', 'kotlin', 'swift',
];

export function judge0Configured(): boolean {
  return Boolean((process.env.JUDGE0_API_URL || '').trim());
}

function isJsLanguage(language: string): boolean {
  return language === 'javascript' || language === 'js';
}

/**
 * Enabled when Judge0 is configured, or when ASSESSMENT_CODE_RUNNER is explicitly true|1|on
 * (local node:vm for JavaScript). Default is OFF — no in-process execution for buyers
 * who have not configured a sandbox.
 */
export function isCodeRunnerEnabled(): boolean {
  const flag = (process.env.ASSESSMENT_CODE_RUNNER || '').toLowerCase().trim();
  if (flag === 'false' || flag === '0' || flag === 'off') return false;
  if (judge0Configured()) return true;
  // Local node:vm requires explicit opt-in (not a true sandbox)
  return flag === 'true' || flag === '1' || flag === 'on';
}

export function getCodeRunnerStatus(): {
  enabled: boolean;
  backend: 'judge0' | 'node-vm' | 'off';
  languages: string[];
} {
  if (!isCodeRunnerEnabled()) {
    return { enabled: false, backend: 'off', languages: [] };
  }
  if (judge0Configured()) {
    return {
      enabled: true,
      backend: 'judge0',
      languages: [...new Set(JUDGE0_LANG_KEYS)],
    };
  }
  return { enabled: true, backend: 'node-vm', languages: ['javascript', 'js'] };
}

function expectedOf(tc: TestCase): string {
  return String(tc.output ?? tc.expected ?? '').trim();
}

function normalizeOut(s: string): string {
  return s.replace(/\r\n/g, '\n').trim();
}

function b64Encode(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64');
}

function b64Decode(s: string | null | undefined): string {
  if (!s) return '';
  try {
    return Buffer.from(s, 'base64').toString('utf8');
  } catch {
    return s;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Extract public (non-hidden) test cases for candidate UI */
export function publicTestCases(raw: unknown): Array<{ input: string; output?: string }> {
  if (!Array.isArray(raw)) return [];
  return (raw as TestCase[])
    .filter((tc) => !tc.hidden)
    .map((tc) => ({
      input: String(tc.input ?? ''),
      output: expectedOf(tc) || undefined,
    }));
}

function wrapSourceForJudge0(code: string, language: string): string {
  if (isJsLanguage(language) || language === 'typescript' || language === 'ts') {
    return `
"use strict";
const __fs = require("fs");
const input = __fs.readFileSync(0, "utf8");
const INPUT = input;
${code}
;(function() {
  if (typeof solve === "function") {
    const __r = solve(input);
    if (__r !== undefined) console.log(__r);
  } else if (typeof main === "function") {
    const __r = main(input);
    if (__r !== undefined) console.log(__r);
  }
})();
`.trim();
  }

  if (language === 'python' || language === 'python3' || language === 'py') {
    return `
import sys
_stdin = sys.stdin.read()
input = _stdin
INPUT = _stdin
${code}
if "solve" in globals():
    __r = solve(_stdin)
    if __r is not None:
        print(__r)
elif "main" in globals():
    __r = main(_stdin)
    if __r is not None:
        print(__r)
`.trim();
  }

  // Other languages: send as-is; stdin provided by Judge0
  return code;
}

function runJavascript(code: string, testCases: TestCase[]): TestResult[] {
  const results: TestResult[] = [];

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const input = String(tc.input ?? '');
    const expected = expectedOf(tc);
    const logs: string[] = [];

    try {
      const sandbox: Record<string, unknown> = {
        console: {
          log: (...args: unknown[]) => {
            logs.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
          },
        },
        input,
        INPUT: input,
      };
      delete sandbox.require;
      try {
        Object.freeze(sandbox);
      } catch {
        /* ignore */
      }

      const context = createContext(sandbox, {
        name: 'assessment-sandbox',
        codeGeneration: { strings: false, wasm: false },
      });

      const wrapped = `
        "use strict";
        ${code}
        ;(function() {
          if (typeof solve === "function") {
            const __r = solve(input);
            if (__r !== undefined) console.log(__r);
          } else if (typeof main === "function") {
            const __r = main(input);
            if (__r !== undefined) console.log(__r);
          }
        })();
      `;

      const script = new Script(wrapped, { filename: 'candidate.js' });
      script.runInContext(context, { timeout: JS_TIMEOUT_MS, breakOnSigint: true });

      const actual = normalizeOut(logs.join('\n'));
      const pass = actual === normalizeOut(expected);
      results.push({ index: i, passed: pass, input, expected, actual });
    } catch (e) {
      results.push({
        index: i,
        passed: false,
        input,
        expected,
        actual: '',
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return results;
}

function judge0Headers(apiKey: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (!apiKey) return headers;

  const useRapid = (process.env.JUDGE0_USE_RAPIDAPI || '').toLowerCase().trim() === 'true';
  if (useRapid) {
    headers['X-RapidAPI-Key'] = apiKey;
    headers['X-RapidAPI-Host'] = (process.env.JUDGE0_RAPIDAPI_HOST || 'judge0-ce.p.rapidapi.com').trim();
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`;
    headers['X-Auth-Token'] = apiKey;
  }
  return headers;
}

type Judge0Submission = {
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  message?: string | null;
  status?: { id?: number; description?: string } | null;
  token?: string;
};

async function fetchJudge0Submission(
  baseUrl: string,
  token: string,
  headers: Record<string, string>,
): Promise<Judge0Submission> {
  const url = `${baseUrl}/submissions/${encodeURIComponent(token)}?base64_encoded=true`;
  const res = await fetch(url, { method: 'GET', headers, cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Judge0 poll failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as Judge0Submission;
}

async function waitForJudge0Result(
  baseUrl: string,
  initial: Judge0Submission,
  headers: Record<string, string>,
): Promise<Judge0Submission> {
  let sub = initial;
  const statusId = () => sub.status?.id ?? 0;

  if (statusId() >= 3) return sub;

  const token = sub.token;
  if (!token) {
    throw new Error('Judge0 returned no token and submission not finished');
  }

  for (let i = 0; i < JUDGE0_POLL_MAX; i++) {
    await sleep(JUDGE0_POLL_MS);
    sub = await fetchJudge0Submission(baseUrl, token, headers);
    if (statusId() >= 3) return sub;
  }

  throw new Error('Judge0 submission timed out waiting for result');
}

async function runSingleJudge0Test(opts: {
  baseUrl: string;
  headers: Record<string, string>;
  languageId: number;
  source: string;
  input: string;
  expected: string;
  index: number;
}): Promise<TestResult> {
  const { baseUrl, headers, languageId, source, input, expected, index } = opts;

  try {
    const body = {
      source_code: b64Encode(source),
      language_id: languageId,
      stdin: b64Encode(input),
      cpu_time_limit: 2,
      memory_limit: 128000,
    };

    const url = `${baseUrl}/submissions?base64_encoded=true&wait=true`;
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        index,
        passed: false,
        input,
        expected,
        actual: '',
        error: `Judge0 error (${res.status}): ${text.slice(0, 300)}`,
      };
    }

    let sub = (await res.json()) as Judge0Submission;
    sub = await waitForJudge0Result(baseUrl, sub, headers);

    const stdout = normalizeOut(b64Decode(sub.stdout));
    const stderr = normalizeOut(b64Decode(sub.stderr));
    const compileOut = normalizeOut(b64Decode(sub.compile_output));
    const message = sub.message ? normalizeOut(b64Decode(sub.message) || String(sub.message)) : '';
    const statusId = sub.status?.id ?? 0;
    const statusDesc = sub.status?.description || '';

    // 3 = Accepted
    if (statusId !== 3 && (stderr || compileOut || message || statusId > 3)) {
      const errParts = [statusDesc, compileOut, stderr, message].filter(Boolean);
      return {
        index,
        passed: false,
        input,
        expected,
        actual: stdout,
        error: errParts.join('\n').slice(0, 500) || `Judge0 status ${statusId}`,
      };
    }

    const pass = stdout === normalizeOut(expected);
    return { index, passed: pass, input, expected, actual: stdout };
  } catch (e) {
    return {
      index,
      passed: false,
      input,
      expected,
      actual: '',
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function runViaJudge0(opts: {
  code: string;
  language: string;
  languageId: number;
  testCases: TestCase[];
  organizationId?: string | null;
}): Promise<TestResult[]> {
  const baseUrl = (process.env.JUDGE0_API_URL || '').trim().replace(/\/$/, '');
  const apiKey = await getProviderSecret(opts.organizationId, 'judge0', ['JUDGE0_API_KEY']);
  const headers = judge0Headers(apiKey);
  const source = wrapSourceForJudge0(opts.code, opts.language);

  const results: TestResult[] = [];
  for (let i = 0; i < opts.testCases.length; i++) {
    const tc = opts.testCases[i];
    results.push(
      await runSingleJudge0Test({
        baseUrl,
        headers,
        languageId: opts.languageId,
        source,
        input: String(tc.input ?? ''),
        expected: expectedOf(tc),
        index: i,
      }),
    );
  }
  return results;
}

function emptyResult(
  language: string,
  cases: TestCase[],
  maxPoints: number,
  extra: Partial<RunCodeResult> = {},
): RunCodeResult {
  return {
    language,
    supported: false,
    results: [],
    passedCount: 0,
    totalCount: cases.length,
    pointsEarned: 0,
    maxPoints,
    isCorrect: null,
    ...extra,
  };
}

function scoreResults(
  language: string,
  results: TestResult[],
  maxPoints: number,
): RunCodeResult {
  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  const ratio = totalCount > 0 ? passedCount / totalCount : 0;
  const pointsEarned = Math.round(ratio * maxPoints);
  const isCorrect = totalCount > 0 ? passedCount === totalCount : null;
  return {
    language,
    supported: true,
    results,
    passedCount,
    totalCount,
    pointsEarned,
    maxPoints,
    isCorrect,
  };
}

export async function runCodeAgainstTests(opts: {
  code: string;
  language?: string | null;
  testCases: unknown;
  points: number;
  organizationId?: string | null;
}): Promise<RunCodeResult> {
  const language = (opts.language || 'javascript').toLowerCase();
  const cases = Array.isArray(opts.testCases) ? (opts.testCases as TestCase[]) : [];
  const maxPoints = opts.points || 1;

  if (!isCodeRunnerEnabled()) {
    return emptyResult(language, cases, maxPoints, { disabled: true });
  }

  if ((opts.code || '').length > MAX_CODE_LENGTH) {
    return {
      language,
      supported: false,
      results: [{
        index: 0,
        passed: false,
        input: '',
        expected: '',
        actual: '',
        error: 'Code too large',
      }],
      passedCount: 0,
      totalCount: cases.length,
      pointsEarned: 0,
      maxPoints,
      isCorrect: false,
    };
  }

  if (cases.length === 0) {
    return emptyResult(language, cases, maxPoints);
  }

  const useJudge0 = judge0Configured();
  const languageId = JUDGE0_LANGUAGE_IDS[language];

  if (useJudge0) {
    if (languageId == null) {
      return emptyResult(language, cases, maxPoints);
    }

    try {
      const results = await runViaJudge0({
        code: opts.code,
        language,
        languageId,
        testCases: cases,
        organizationId: opts.organizationId,
      });

      // If every result is a hard Judge0 transport/API failure and language is JS, fall back to vm
      const allTransportFail =
        results.length > 0 &&
        results.every((r) => r.error && /Judge0 (error|poll failed|timed out)/i.test(r.error));

      if (allTransportFail && isJsLanguage(language)) {
        return scoreResults(language, runJavascript(opts.code, cases), maxPoints);
      }

      return scoreResults(language, results, maxPoints);
    } catch (e) {
      if (isJsLanguage(language)) {
        return scoreResults(language, runJavascript(opts.code, cases), maxPoints);
      }
      return {
        language,
        supported: true,
        results: [{
          index: 0,
          passed: false,
          input: '',
          expected: '',
          actual: '',
          error: e instanceof Error ? e.message : String(e),
        }],
        passedCount: 0,
        totalCount: cases.length,
        pointsEarned: 0,
        maxPoints,
        isCorrect: false,
      };
    }
  }

  // Local node:vm — JavaScript only
  if (!isJsLanguage(language)) {
    return emptyResult(language, cases, maxPoints);
  }

  return scoreResults(language, runJavascript(opts.code, cases), maxPoints);
}
