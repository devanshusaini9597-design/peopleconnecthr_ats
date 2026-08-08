/**
 * Proctoring risk scoring + plagiarism helpers (token + line/structure similarity).
 */

export type ProctorEventType =
  | 'tab_switch'
  | 'window_blur'
  | 'copy'
  | 'paste'
  | 'snapshot'
  | 'fullscreen_exit'
  | 'start'
  | 'submit';

export interface TimelineEvent {
  type: ProctorEventType | string;
  at: string;
  questionId?: string;
  meta?: Record<string, unknown>;
}

export function computeRiskScore(input: {
  tabSwitchCount: number;
  copyPasteCount: number;
  blurCount: number;
  fullscreenExits: number;
  plagiarismScore?: number | null;
  strictness?: string;
}): { riskScore: number; flagged: boolean } {
  const strict = input.strictness === 'strict' ? 1.4 : input.strictness === 'off' ? 0.5 : 1;
  let risk = 0;
  risk += Math.min(40, input.tabSwitchCount * 8);
  risk += Math.min(25, input.copyPasteCount * 5);
  risk += Math.min(20, input.blurCount * 4);
  risk += Math.min(15, input.fullscreenExits * 5);
  if (input.plagiarismScore != null) {
    risk += Math.min(30, Math.round(input.plagiarismScore * 30));
  }
  risk = Math.min(100, Math.round(risk * strict));
  const flagThreshold = input.strictness === 'strict' ? 35 : 50;
  return { riskScore: risk, flagged: risk >= flagThreshold };
}

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2),
  );
}

function jaccardSets(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Token Jaccard similarity 0–1 */
export function tokenJaccard(a: string, b: string): number {
  return jaccardSets(tokenize(a), tokenize(b));
}

function significantLines(s: string): string[] {
  return s
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0);
}

/** Line-set Jaccard after whitespace normalization */
export function lineJaccard(a: string, b: string): number {
  const la = new Set(significantLines(a).map((l) => l.toLowerCase()));
  const lb = new Set(significantLines(b).map((l) => l.toLowerCase()));
  return jaccardSets(la, lb);
}

/** Longest common subsequence ratio for short texts (char-level, capped) */
function lcsRatio(a: string, b: string): number {
  const x = a.toLowerCase().replace(/\s+/g, ' ').trim();
  const y = b.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!x || !y) return 0;
  // Cap length for O(n*m) safety
  const maxLen = 400;
  const s = x.length > maxLen ? x.slice(0, maxLen) : x;
  const t = y.length > maxLen ? y.slice(0, maxLen) : y;
  const n = s.length;
  const m = t.length;
  const dp = new Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    let prev = 0;
    for (let j = 1; j <= m; j++) {
      const tmp = dp[j];
      if (s[i - 1] === t[j - 1]) dp[j] = prev + 1;
      else dp[j] = Math.max(dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  const lcs = dp[m];
  return lcs / Math.max(n, m);
}

/** Normalized line + LCS structure similarity for short texts */
export function structureRatio(a: string, b: string): number {
  const lines = lineJaccard(a, b);
  const aLen = a.trim().length;
  const bLen = b.trim().length;
  // Prefer LCS for shorter answers; blend for longer
  if (aLen < 800 && bLen < 800) {
    return Math.max(lines, lcsRatio(a, b));
  }
  return lines;
}

function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Stronger plagiarism check for code/text submissions.
 * Strips // and /* *\/ comments, normalizes whitespace, then
 * max(tokenJaccard, lineJaccard, structureRatio).
 */
export function codeSimilarity(a: string, b: string): number {
  const na = normalizeWhitespace(stripComments(a || ''));
  const nb = normalizeWhitespace(stripComments(b || ''));
  if (!na || !nb) return 0;
  return Math.max(tokenJaccard(na, nb), lineJaccard(na, nb), structureRatio(na, nb));
}

/** Backward-compatible alias — uses codeSimilarity */
export function textSimilarity(a: string, b: string): number {
  return codeSimilarity(a, b);
}

export { gradeAnswer } from '@/lib/assessments';
