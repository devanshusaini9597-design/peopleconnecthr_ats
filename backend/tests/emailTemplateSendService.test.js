const {
  applyVariables,
  buildHtmlContent,
  polishMergedSubject,
  polishMergedBody,
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

  it('polishMergedSubject removes empty hiring-drive placeholders', () => {
    expect(
      polishMergedSubject(
        applyVariables('Hiring drive: {{position}} – {{date}} | {{company}}', {
          position: '',
          date: '',
          company: 'Skillnix Recruitment Services',
        })
      )
    ).toBe('Hiring drive | Skillnix Recruitment Services');
  });

  it('polishMergedBody fixes empty fields and grammar', () => {
    const body = polishMergedBody(
      applyVariables(
        `Dear {{candidateName}},

We are running a hiring drive for {{position}} with {{company}}.

Drive details:
• Date: {{date}}
• Time: {{time}}
• Location: {{location}}

Reply to confirm interest.`,
        {
          candidateName: 'Spartan',
          position: '',
          company: 'Skillnix Recruitment Services',
          date: '',
          time: '',
          location: '',
        }
      )
    );
    expect(body).toContain('Dear Spartan');
    expect(body).toContain('hiring drive with Skillnix Recruitment Services');
    expect(body).not.toMatch(/\bfor\s+with\b/i);
    expect(body).not.toMatch(/Date:/);
    expect(body).not.toMatch(/Time:/);
    expect(body).not.toMatch(/Drive details/i);
  });

  it('buildHtmlContent omits empty detail rows', () => {
    const html = buildHtmlContent(
      'Dear Ada,\n\nDrive details:\nDate: \nLocation: Remote\n\nBest regards,\nHR',
      { isSubscribeInvite: false }
    );
    expect(html).toMatch(/Location/);
    expect(html).toMatch(/Remote/);
    expect(html).not.toMatch(/>Date</);
  });
});
