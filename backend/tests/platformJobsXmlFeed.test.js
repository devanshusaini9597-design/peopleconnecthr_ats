const { buildJobsXmlDocument, cdataSafe } = require('../services/careersService');

describe('platform jobs XML helpers', () => {
  it('strips CDATA terminators', () => {
    expect(cdataSafe('a ]]> b')).toBe('a  b');
  });

  it('builds a platform document with ATS publisher and tenant company jobs', () => {
    const xml = buildJobsXmlDocument({
      publisher: 'People Connect HR',
      publisherUrl: 'https://www.peopleconnecthr.com',
      itemsXml: `
  <job>
    <title><![CDATA[Sales Manager]]></title>
    <company><![CDATA[Skillnix Recruitment Services]]></company>
  </job>`,
    });
    expect(xml).toContain('<publisher>People Connect HR</publisher>');
    expect(xml).toContain('<publisherurl>https://www.peopleconnecthr.com</publisherurl>');
    expect(xml).toContain('<company><![CDATA[Skillnix Recruitment Services]]></company>');
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });
});
