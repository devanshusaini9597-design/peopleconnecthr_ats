describe('supportService', () => {
  it('exports ticket helpers', () => {
    const svc = require('../services/supportService');
    expect(typeof svc.createTicket).toBe('function');
    expect(typeof svc.listMyTickets).toBe('function');
    expect(typeof svc.teamInbox).toBe('function');
    expect(typeof svc.makeTicketRef).toBe('function');
    expect(svc.CATEGORIES.query).toBe('Query');
    expect(svc.CATEGORIES.issue).toBe('Issue');
    expect(svc.CATEGORIES.feedback).toBe('Feedback');
    expect(svc.SUPPORT_INBOX).toBe('support@skillnixrecruitment.com');
  });

  it('defaults the product inbox to support@skillnixrecruitment.com', () => {
    const prev = process.env.SUPPORT_TEAM_EMAIL;
    delete process.env.SUPPORT_TEAM_EMAIL;
    jest.resetModules();
    const { teamInbox } = require('../services/supportService');
    expect(teamInbox()).toEqual(['support@skillnixrecruitment.com']);
    if (prev === undefined) delete process.env.SUPPORT_TEAM_EMAIL;
    else process.env.SUPPORT_TEAM_EMAIL = prev;
    jest.resetModules();
  });

  it('makeTicketRef uses SN-YYMMDD-XXXX', () => {
    const { makeTicketRef } = require('../services/supportService');
    expect(makeTicketRef()).toMatch(/^SN-\d{6}-[A-Z0-9]{4}$/);
  });

  it('teamInbox reads SUPPORT_TEAM_EMAIL as a list', () => {
    const prev = process.env.SUPPORT_TEAM_EMAIL;
    process.env.SUPPORT_TEAM_EMAIL = 'hello@skillnix.app, support@peopleconnecthr.com';
    const { teamInbox } = require('../services/supportService');
    expect(teamInbox()).toEqual(['hello@skillnix.app', 'support@peopleconnecthr.com']);
    if (prev === undefined) delete process.env.SUPPORT_TEAM_EMAIL;
    else process.env.SUPPORT_TEAM_EMAIL = prev;
  });
});
