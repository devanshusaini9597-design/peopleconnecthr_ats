const { languageId, sandboxConfigured } = require('../services/codeExecutionService');

describe('codeExecutionService', () => {
  it('maps languages to Judge0 ids and stays off without a sandbox URL', () => {
    expect(languageId('python')).toBe(71);
    expect(languageId('javascript')).toBe(63);
    const prev = process.env.JUDGE0_URL;
    delete process.env.JUDGE0_URL;
    delete process.env.CODE_SANDBOX_URL;
    expect(sandboxConfigured()).toBe(false);
    if (prev !== undefined) process.env.JUDGE0_URL = prev;
  });
});
