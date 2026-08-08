const {
  applyVariables,
  buildHtmlContent,
} = require('../services/emailTemplateSendService');

describe('emailTemplateSendService', () => {
  it('applyVariables replaces mustache keys', () => {
    expect(applyVariables('Hi {{candidateName}} at {{company}}', {
      candidateName: 'Ada',
      company: 'Acme',
    })).toBe('Hi Ada at Acme');
  });

  it('buildHtmlContent turns plain text into paragraphs', () => {
    const html = buildHtmlContent('Dear Ada,\n\nWelcome aboard.\n\nBest regards,\nHR', {
      isSubscribeInvite: false,
    });
    expect(html).toMatch(/Dear Ada/);
    expect(html).toMatch(/Welcome aboard/);
    expect(html).toMatch(/Best regards/);
  });

  it('buildHtmlContent skips subscribe line for invite templates', () => {
    const html = buildHtmlContent('Hello\nSubscribe now: http://x\nBye', {
      isSubscribeInvite: true,
    });
    expect(html).not.toMatch(/Subscribe now/);
    expect(html).toMatch(/Hello/);
  });
});
