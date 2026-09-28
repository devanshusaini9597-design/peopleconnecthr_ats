const {
  polishMergedSubject,
  polishMergedBody,
  mergeAndPolish,
} = require('../utils/emailMergePolish');
const { applyVariables, buildHtmlContent } = require('../services/emailTemplateSendService');

describe('emailMergePolish', () => {
  it('drops empty labeled rows and orphan headers', () => {
    const body = polishMergedBody(
      applyVariables(
        `Dear {{candidateName}},

We are running a hiring drive for {{position}} with {{company}}.

Drive details:
• Date: {{date}}
• Time: {{time}}
• Location: {{location}}

Drive schedule: {{date}} | {{time}}

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
    expect(body).not.toMatch(/Drive schedule/i);
  });

  it('keeps filled pipe segments and drops empty ones', () => {
    const body = polishMergedBody('Drive schedule:  | 3:00 PM');
    expect(body).toBe('3:00 PM');
  });

  it('omits N/A and TBD labeled lines', () => {
    const body = polishMergedBody('Department: N/A\nJoining date: TBD\nLocation: Remote');
    expect(body).not.toMatch(/Department/);
    expect(body).not.toMatch(/Joining date/);
    expect(body).toContain('Location: Remote');
  });

  it('preserves {{candidateName}} when requested', () => {
    const body = polishMergedBody('Dear {{candidateName}},\n\nDate: \n\nThanks', {
      preserveTokens: ['candidateName'],
    });
    expect(body).toContain('{{candidateName}}');
    expect(body).not.toMatch(/Date:/);
  });

  it('strips a trailing ? from apply URLs', () => {
    const body = polishMergedBody(
      'Apply using the link below:\nhttps://www.peopleconnecthr.com/careers/skillnix-recruitment/jobs/vv9d97s5?'
    );
    expect(body).toContain('https://www.peopleconnecthr.com/careers/skillnix-recruitment/jobs/vv9d97s5');
    expect(body).not.toMatch(/\?$/m);
  });

  it('mergeAndPolish cleans subject empties', () => {
    expect(
      mergeAndPolish('Hiring drive: {{position}} – {{date}} | {{company}}', {
        position: '',
        date: '',
        company: 'Acme',
      }, { kind: 'subject' })
    ).toBe('Hiring drive | Acme');
  });
});

describe('emailTemplateSendService html', () => {
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
