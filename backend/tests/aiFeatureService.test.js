describe('aiFeatureService contracts', () => {
  it('exports score/search/embed and generation helpers', () => {
    const svc = require('../services/aiFeatureService');
    expect(typeof svc.loadAiAdapter).toBe('function');
    expect(typeof svc.scoreResume).toBe('function');
    expect(typeof svc.semanticSearch).toBe('function');
    expect(typeof svc.embedCandidate).toBe('function');
    expect(typeof svc.generateJobDescription).toBe('function');
    expect(typeof svc.draftEmail).toBe('function');
    expect(typeof svc.matchCandidate).toBe('function');
  });

  it('scoreResume requires jobDescription', async () => {
    const { scoreResume } = require('../services/aiFeatureService');
    await expect(
      scoreResume('000000000000000000000000', { resumeText: 'x' })
    ).rejects.toMatchObject({ message: 'jobDescription is required', statusCode: 400 });
  });

  it('generateJobDescription requires bullets', async () => {
    const { generateJobDescription } = require('../services/aiFeatureService');
    await expect(
      generateJobDescription('000000000000000000000000', {})
    ).rejects.toMatchObject({ message: 'bullets is required', statusCode: 400 });
  });
});
