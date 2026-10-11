/**
 * Optional isolated coding tests via Judge0 (or compatible) HTTP sandbox.
 * Never executes candidate code in-process.
 */
const axios = require('axios');

const LANGUAGE_IDS = {
  javascript: 63,
  js: 63,
  node: 63,
  python: 71,
  python3: 71,
  java: 62,
  cpp: 54,
  'c++': 54,
  c: 50,
  typescript: 74,
  ts: 74,
  go: 60,
  golang: 60,
  php: 68,
  ruby: 72,
  csharp: 51,
  'c#': 51,
};

function sandboxConfigured() {
  return Boolean(String(process.env.JUDGE0_URL || process.env.CODE_SANDBOX_URL || '').trim());
}

function languageId(language) {
  const key = String(language || 'javascript').trim().toLowerCase();
  return LANGUAGE_IDS[key] || 63;
}

async function runCase({ source, language, stdin, expected }) {
  const base = String(process.env.JUDGE0_URL || process.env.CODE_SANDBOX_URL || '').replace(/\/$/, '');
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.JUDGE0_KEY) headers['X-Auth-Token'] = process.env.JUDGE0_KEY;
  const response = await axios.post(
    `${base}/submissions?base64_encoded=false&wait=true`,
    {
      source_code: String(source || '').slice(0, 20000),
      language_id: languageId(language),
      stdin: String(stdin || '').slice(0, 4000),
      expected_output: expected == null ? undefined : String(expected).slice(0, 4000),
      cpu_time_limit: 3,
      memory_limit: 128000,
    },
    { headers, timeout: 15000 }
  );
  const data = response.data || {};
  const stdout = String(data.stdout || '').trim();
  const want = expected == null ? null : String(expected).trim();
  const statusId = data.status?.id;
  const passed = want == null
    ? statusId === 3
    : statusId === 3 && stdout === want;
  return {
    passed,
    stdout,
    stderr: String(data.stderr || data.compile_output || '').slice(0, 1000),
    status: data.status?.description || '',
  };
}

async function scoreCodeQuestion(question, source) {
  if (!sandboxConfigured()) {
    return { autoScore: undefined, needsReview: true, sandbox: false };
  }
  const tests = [...(question.visibleTests || []), ...(question.hiddenTests || [])]
    .filter((t) => t && (t.expected != null && String(t.expected).length))
    .slice(0, 8);
  if (!tests.length) return { autoScore: undefined, needsReview: true, sandbox: true, passed: 0, total: 0 };

  let passed = 0;
  const reports = [];
  for (const test of tests) {
    try {
      const result = await runCase({
        source,
        language: question.language,
        stdin: test.input || test.stdin || '',
        expected: test.expected,
      });
      if (result.passed) passed += 1;
      reports.push({ name: test.name || 'case', passed: result.passed, status: result.status });
    } catch (err) {
      reports.push({ name: test.name || 'case', passed: false, status: err.message || 'sandbox_error' });
    }
  }
  const points = Number(question.points) || 0;
  return {
    autoScore: Math.round((points * passed) / tests.length),
    needsReview: passed < tests.length,
    sandbox: true,
    passed,
    total: tests.length,
    reports,
  };
}

module.exports = { sandboxConfigured, scoreCodeQuestion, languageId };
