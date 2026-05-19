import { describe, it, expect } from 'bun:test';
import { aggregate } from '../../apps/worker/src/aggregator';
import type { AggregateSources } from '../../apps/worker/src/aggregator';

function makeSources(overrides: Partial<AggregateSources> = {}): AggregateSources {
  return {
    email: 'test@example.com',
    domain: 'example.com',
    crunchbase: null,
    github: null,
    website: null,
    ...overrides,
  };
}

const sampleGithub = {
  username: 'acme',
  name: 'Jane Acme',
  bio: null,
  location: 'Boston, MA',
  company: 'Acme Corp',
  blog: null,
  public_repos: 10,
  languages: ['TypeScript'],
  avatar_url: null,
};

const sampleWebsite = {
  title: 'Acme Corp',
  description: 'A tech company',
  keywords: ['software'],
  social_links: ['https://linkedin.com/company/acme'],
  company_name: 'Acme Corporation',
  industry: 'Enterprise Software',
  location: 'New York, NY',
  company_size: '51-200',
  fields_from: ['jsonld', 'homepage'] as const,
};

describe('aggregator', () => {
  it('returns email and domain from input', () => {
    const r = aggregate(makeSources());
    expect(r.email).toBe('test@example.com');
    expect(r.domain).toBe('example.com');
  });

  it('returns null fields when no sources', () => {
    const r = aggregate(makeSources());
    expect(r.name).toBeNull();
    expect(r.company).toBeNull();
    expect(r.industry).toBeNull();
    expect(r.confidence).toBe(0.3);
  });

  it('confidence is 0.55 with GitHub only', () => {
    const r = aggregate(makeSources({ github: sampleGithub }));
    expect(r.confidence).toBe(0.55);
    expect(r.name).toBe('Jane Acme');
    expect(r.company).toBe('Acme Corp');
  });

  it('confidence is 0.8 with GitHub and website', () => {
    const r = aggregate(
      makeSources({
        github: { ...sampleGithub, company: null, name: null },
        website: sampleWebsite,
      }),
    );
    expect(r.confidence).toBe(0.8);
    expect(r.company).toBe('Acme Corporation');
    expect(r.industry).toBe('Enterprise Software');
    expect(r.location).toBe('Boston, MA');
    expect(r.company_size).toBe('51-200');
  });

  it('company prefers GitHub over website', () => {
    const r = aggregate(
      makeSources({
        github: sampleGithub,
        website: sampleWebsite,
      }),
    );
    expect(r.company).toBe('Acme Corp');
  });

  it('industry prefers website structured industry over keywords', () => {
    const r = aggregate(
      makeSources({
        website: { ...sampleWebsite, industry: 'FinTech' },
      }),
    );
    expect(r.industry).toBe('FinTech');
  });

  it('industry falls back to website keywords', () => {
    const r = aggregate(
      makeSources({
        website: { ...sampleWebsite, industry: null },
      }),
    );
    expect(r.industry).toBe('software');
  });

  it('crunchbase null does not affect confidence', () => {
    const r = aggregate(makeSources({ crunchbase: null }));
    expect(r.confidence).toBe(0.3);
  });

  it('real crunchbase counts toward confidence', () => {
    const r = aggregate(
      makeSources({
        crunchbase: {
          name: 'Acme',
          industry: 'Tech',
          location: 'SF',
          description: '',
          funding: '',
        },
        website: sampleWebsite,
        github: sampleGithub,
      }),
    );
    expect(r.confidence).toBe(1.0);
  });

  it('social links from website scrape', () => {
    const r = aggregate(makeSources({ website: sampleWebsite }));
    expect(r.social.linkedin).toBe('https://linkedin.com/company/acme');
  });

  it('does not cache', () => {
    const r = aggregate(makeSources());
    expect(r.cached).toBe(false);
    expect(r.cached_at).toBeNull();
  });
});
