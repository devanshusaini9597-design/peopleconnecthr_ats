describe('supportService', () => {
  it('exports ticket helpers', () => {
    const svc = require('../services/supportService');
    expect(typeof svc.createTicket).toBe('function');
    expect(typeof svc.listMyTickets).toBe('function');
    expect(typeof svc.teamInbox).toBe('function');
    expect(typeof svc.makeTicketRef).toBe('function');
    expect(svc.CATEGORIES.query).toBe('Guidance request');
    expect(svc.CATEGORIES.issue).toBe('Technical issue');
    expect(svc.CATEGORIES.feedback).toBe('Product feedback');
    expect(svc.SUPPORT_INBOX).toBe('info@peopleconnecthr.com');
  });

  it('defaults the product inbox to info@peopleconnecthr.com', () => {
    const prev = process.env.SUPPORT_TEAM_EMAIL;
    delete process.env.SUPPORT_TEAM_EMAIL;
    jest.resetModules();
    const { teamInbox } = require('../services/supportService');
    expect(teamInbox()).toEqual(['info@peopleconnecthr.com']);
    if (prev === undefined) delete process.env.SUPPORT_TEAM_EMAIL;
    else process.env.SUPPORT_TEAM_EMAIL = prev;
    jest.resetModules();
  });

  it('makeTicketRef uses PC-YYMMDD-XXXX', () => {
    const { makeTicketRef } = require('../services/supportService');
    expect(makeTicketRef()).toMatch(/^PC-\d{6}-[A-Z0-9]{4}$/);
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
