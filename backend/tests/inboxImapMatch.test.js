const {
  normalizeSubject,
  parseHiringContact,
  plusLocalFromAddress,
  subjectsLikelyMatch,
  htmlToText,
} = require('../services/inboxImapMatch');

describe('inboxImapMatch', () => {
  test('strips Re/Fwd prefixes', () => {
    expect(normalizeSubject('Re: Re: Java hiring')).toBe('Java hiring');
    expect(normalizeSubject('Fwd: Java hiring')).toBe('Java hiring');
  });

  test('parses hiring contact stamp', () => {
    expect(parseHiringContact('Thanks\nHiring contact: Asmita (asmita@skillnixrecruitment.com)\n')).toEqual({
      name: 'Asmita',
      email: 'asmita@skillnixrecruitment.com',
    });
    expect(parseHiringContact('Hiring contact:  asmita@skillnixrecruitment.com')).toEqual({
      name: '',
      email: 'asmita@skillnixrecruitment.com',
    });
    expect(parseHiringContact('<!-- pc-hiring-contact:rohit@skillnixrecruitment.com -->')).toEqual({
      name: '',
      email: 'rohit@skillnixrecruitment.com',
    });
  });

  test('reads plus-tag from To address', () => {
    expect(plusLocalFromAddress('team+asmita@skillnixrecruitment.com')).toBe('asmita');
    expect(plusLocalFromAddress('team@skillnixrecruitment.com')).toBe('');
  });

  test('matches campaign subjects with reply prefix', () => {
    expect(subjectsLikelyMatch('Re: Q3 Java pipeline', 'Q3 Java pipeline')).toBe(true);
    expect(subjectsLikelyMatch('Hello', 'Totally different')).toBe(false);
  });

  test('htmlToText keeps hiring contact', () => {
    const text = htmlToText('<p>Hi</p><p>Hiring contact: <strong>Sam (sam@x.com)</strong></p>');
    expect(parseHiringContact(text).email).toBe('sam@x.com');
  });

  test('does not merge two staff into one bucket for the same candidate', () => {
    const { bucketMessagesByOwner } = require('../services/inboxImapMatch');
    const ownerId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
    const adminId = 'bbbbbbbbbbbbbbbbbbbbbbbb';
    const thread = { assignedTo: ownerId, assignedEmail: 'owner@co.com' };
    const { buckets, keepKey } = bucketMessagesByOwner([
      { _id: '1', direction: 'outbound', sentBy: ownerId, body: 'Hi from owner' },
      { _id: '2', direction: 'inbound', body: 'Thanks owner' },
      { _id: '3', direction: 'outbound', sentBy: adminId, body: 'Hi from admin' },
      { _id: '4', direction: 'inbound', body: 'Thanks admin' },
    ], thread);
    expect(keepKey).toBe(`id:${ownerId}`);
    expect(buckets.size).toBe(2);
    expect(buckets.get(`id:${ownerId}`).map((m) => m._id)).toEqual(['1', '2']);
    expect(buckets.get(`id:${adminId}`).map((m) => m._id)).toEqual(['3', '4']);
  });

  test('extracts newest reply from Gmail quoted text', () => {
    const { extractReplyAndQuote, newestReplyPreview } = require('../services/inboxImapMatch');
    const raw = 'Ok\n\nOn Sat, Sep 26, 2026, 23:32 Sarbjeet Singh <team@skillnixrecruitment.com> wrote:\n> Hiring drive\n> Dear SPARTAN';
    const parts = extractReplyAndQuote(raw);
    expect(parts.reply).toBe('Ok');
    expect(newestReplyPreview(raw)).toBe('Ok');
  });

  test('groups Re: replies and leaked preview tails into one conversation', () => {
    const { groupInboxConversations, conversationRootSubject } = require('../services/inboxImapMatch');
    expect(conversationRootSubject('Re: Open role — trsting new featue')).toBe('Open role');
    expect(conversationRootSubject('Re: Open role — checking On Sun, Sep 27, 2026 at 12:17 PM ROHIT')).toBe('Open role');
    const owner = 'aaaaaaaaaaaaaaaaaaaaaaaa';
    const grouped = groupInboxConversations([
      {
        _id: '1',
        assignedTo: owner,
        assignedEmail: 'rohit@co.com',
        subject: 'Re: Open role — trsting new featue',
        lastMessageAt: '2026-09-27T13:31:00.000Z',
        lastMessagePreview: 'trsting new featue',
        unreadCount: 0,
        participants: { candidateName: 'Devanshu saini', candidateEmail: 'dev@x.com' },
      },
      {
        _id: '2',
        assignedTo: owner,
        assignedEmail: 'rohit@co.com',
        subject: 'Re: Open role — checking On Sun, Sep 27, 2026 at 12:17 PM ROHIT RAJBHAR',
        lastMessageAt: '2026-09-27T12:18:00.000Z',
        lastMessagePreview: 'Ok\n\nOn Sat, Sep 26, 2026, 23:32 Sarbjeet Singh wrote:\nHiring drive',
        unreadCount: 1,
        participants: { candidateName: 'Devanshu saini', candidateEmail: 'dev@x.com' },
      },
    ]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].conversationIds.map(String).sort()).toEqual(['1', '2']);
    expect(grouped[0].fromLabel).toMatch(/Devanshu saini, me/);
    expect(grouped[0].lastMessagePreview).toBe('trsting new featue');
  });

  test('does not group two employees on the same candidate subject', () => {
    const { groupInboxConversations } = require('../services/inboxImapMatch');
    const grouped = groupInboxConversations([
      {
        _id: '1',
        assignedTo: 'aaaaaaaaaaaaaaaaaaaaaaaa',
        assignedEmail: 'a@co.com',
        subject: 'Open role',
        lastMessageAt: '2026-09-27T13:00:00.000Z',
        participants: { candidateEmail: 'dev@x.com', candidateName: 'Dev' },
      },
      {
        _id: '2',
        assignedTo: 'bbbbbbbbbbbbbbbbbbbbbbbb',
        assignedEmail: 'b@co.com',
        subject: 'Re: Open role',
        lastMessageAt: '2026-09-27T12:00:00.000Z',
        participants: { candidateEmail: 'dev@x.com', candidateName: 'Dev' },
      },
    ]);
    expect(grouped).toHaveLength(2);
  });
});
