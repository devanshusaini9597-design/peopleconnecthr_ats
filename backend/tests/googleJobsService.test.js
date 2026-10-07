const { inferWorkplaceType, parseOneLocation, buildSchemaJobLocations } = require('../utils/jobLocationParse');
const { buildJobPostingJsonLd, getRobotsTxt, renderGoogleJobHtml, EMPLOYMENT_MAP } = require('../services/googleJobsService');

describe('jobLocationParse', () => {
  it('detects remote and Indian city/state', () => {
    expect(inferWorkplaceType({ location: 'Remote — India' })).toBe('remote');
    expect(inferWorkplaceType({ location: 'Bangalore / Hybrid' })).toBe('hybrid');
    const parsed = parseOneLocation('Bengaluru');
    expect(parsed.addressLocality).toBe('Bengaluru');
    expect(parsed.addressRegion).toBe('Karnataka');
    expect(parsed.addressCountry).toBe('IN');
  });

  it('builds TELECOMMUTE when workplace is remote', () => {
    const loc = buildSchemaJobLocations({ workplaceType: 'remote', location: 'India' });
    expect(loc.jobLocationType).toBe('TELECOMMUTE');
    expect(loc.applicantLocationRequirements).toEqual({ '@type': 'Country', name: 'IN' });
  });
});

describe('googleJobsService JobPosting JSON-LD', () => {
  const org = { _id: '64b000000000000000000001', name: 'Acme Hiring', slug: 'acme-hiring' };
  const job = {
    _id: '64b000000000000000000002',
    title: 'CREDIT ANALYST',
    publicId: 'abcd2345',
    employmentType: 'full_time',
    workplaceType: 'onsite',
    location: 'Mumbai',
    locations: ['Mumbai'],
    description: '<p>Own the credit book.</p>',
    publishedAt: new Date('2026-10-01T00:00:00.000Z'),
    clientName: 'Acme Hiring',
    industry: 'BFSI',
  };

  it('maps tenant job to schema.org JobPosting', () => {
    const ld = buildJobPostingJsonLd(job, org);
    expect(ld['@type']).toBe('JobPosting');
    expect(ld.employmentType).toBe(EMPLOYMENT_MAP.full_time);
    expect(ld.hiringOrganization.name).toBe('Acme Hiring');
    expect(ld.identifier.value).toBe('acme-hiring:abcd2345');
    expect(ld.directApply).toBe(true);
    expect(ld.url).toContain('/careers/acme-hiring/jobs/abcd2345');
    expect(ld.jobLocation.address.addressLocality).toBe('Mumbai');
    expect(ld.jobLocation.address.addressCountry).toBe('IN');
    expect(ld.description).toContain('Own the credit book');
  });

  it('does not leak a different client name for agency jobs', () => {
    const ld = buildJobPostingJsonLd({ ...job, clientName: 'Secret Bank Ltd' }, org);
    expect(ld.hiringOrganization.name).not.toMatch(/Secret Bank/i);
    expect(ld.description).not.toMatch(/Secret Bank/i);
  });

  it('renders crawler HTML with JSON-LD', () => {
    const ld = buildJobPostingJsonLd(job, org);
    const html = renderGoogleJobHtml(job, org, ld);
    expect(html).toContain('application/ld+json');
    expect(html).toContain('CREDIT ANALYST');
    expect(html).toContain('rel="canonical"');
  });

  it('exposes sitemap in robots.txt', () => {
    const robots = getRobotsTxt();
    expect(robots).toMatch(/Sitemap: /);
    expect(robots).toMatch(/Allow: \/careers\//);
  });
});
