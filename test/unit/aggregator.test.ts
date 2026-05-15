import { describe, it, expect } from 'bun:test';
import { aggregate } from '../../apps/worker/src/aggregator';
import type { AggregateSources } from '../../apps/worker/src/aggregator';
import type { EnrichResult } from '../../packages/core/src/index';

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

describe('aggregator', () => {
  it('returns email and domain from input', () => {
    const r = aggregate(makeSources());
    expect(r.email).toBe('test@example.com');
    expect(r.domain).toBe('example.com');
  });

  it('returns null fields when no sources', () => {
    const r = aggregate(makeSources());
    expect(r.name).toBeNull();
    expect(r.title).toBeNull();
    expect(r.company).toBeNull();
    expect(r.industry).toBeNull();
    expect(r.location).toBeNull();
    expect(r.social.linkedin).toBeNull();
    expect(r.social.github).toBeNull();
    expect(r.social.twitter).toBeNull();
  });

  it('confidence is 0.3 with no sources', () => {
    const r = aggregate(makeSources());
    expect(r.confidence).toBe(0.3);
  });

  it('confidence is 0.55 with one source (crunchbase)', () => {
    const r = aggregate(
      makeSources({
        crunchbase: { name: 'Acme', industry: 'Tech', location: 'SF', description: '', funding: '' },
      }),
    );
    expect(r.confidence).toBe(0.55);
  });

  it('confidence is 0.8 with two sources', () => {
    const r = aggregate(
      makeSources({
        crunchbase: { name: 'Acme', industry: 'Tech', location: 'SF', description: '', funding: '' },
        github: { username: 'acme', name: 'Acme Inc', bio: null, location: 'SF', company: null, blog: null, public_repos: 10, languages: ['TypeScript'], avatar_url: null },
      }),
    );
    expect(r.confidence).toBe(0.8);
  });

  it('confidence is 1.0 with three sources', () => {
    const r = aggregate(
      makeSources({
        crunchbase: { name: 'Acme', industry: 'Tech', location: 'SF', description: '', funding: '' },
        github: { username: 'acme', name: 'Acme Inc', bio: null, location: 'SF', company: null, blog: null, public_repos: 10, languages: ['TypeScript'], avatar_url: null },
        website: { title: 'Acme Corp', description: 'A tech company', keywords: ['software'], social_links: [] },
      }),
    );
    expect(r.confidence).toBe(1.0);
  });

  it('name prefers GitHub over Crunchbase', () => {
    const r = aggregate(
      makeSources({
        crunchbase: { name: 'CB Name', industry: '', location: '', description: '', funding: '' },
        github: { username: 'ghuser', name: 'GH Name', bio: null, location: null, company: null, blog: null, public_repos: 0, languages: [], avatar_url: null },
      }),
    );
    expect(r.name).toBe('GH Name');
  });

  it('name falls back to Crunchbase when GitHub has no name', () => {
    const r = aggregate(
      makeSources({
        crunchbase: { name: 'CB Name', industry: '', location: '', description: '', funding: '' },
        github: { username: 'ghuser', name: null, bio: null, location: null, company: null, blog: null, public_repos: 0, languages: [], avatar_url: null },
      }),
    );
    expect(r.name).toBe('CB Name');
  });

  it('company prefers GitHub company field', () => {
    const r = aggregate(
      makeSources({
        crunchbase: { name: 'CB Inc', industry: '', location: '', description: '', funding: '' },
        github: { username: 'ghuser', name: null, bio: null, location: null, company: 'GH Corp', blog: null, public_repos: 0, languages: [], avatar_url: null },
      }),
    );
    expect(r.company).toBe('GH Corp');
  });

  it('company falls back to Crunchbase name', () => {
    const r = aggregate(
      makeSources({
        crunchbase: { name: 'CB Inc', industry: '', location: '', description: '', funding: '' },
        github: { username: 'ghuser', name: null, bio: null, location: null, company: null, blog: null, public_repos: 0, languages: [], avatar_url: null },
      }),
    );
    expect(r.company).toBe('CB Inc');
  });

  it('industry prefers Crunchbase over website keywords', () => {
    const r = aggregate(
      makeSources({
        crunchbase: { name: '', industry: 'Enterprise Software', location: '', description: '', funding: '' },
        website: { title: '', description: '', keywords: ['SaaS'], social_links: [] },
      }),
    );
    expect(r.industry).toBe('Enterprise Software');
  });

  it('industry falls back to website keywords', () => {
    const r = aggregate(
      makeSources({
        crunchbase: { name: '', industry: '', location: '', description: '', funding: '' },
        website: { title: '', description: '', keywords: ['SaaS', 'cloud'], social_links: [] },
      }),
    );
    expect(r.industry).toBe('SaaS');
  });

  it('social.github from GitHub scraper', () => {
    const r = aggregate(
      makeSources({
        github: { username: 'jsmith', name: null, bio: null, location: null, company: null, blog: null, public_repos: 0, languages: [], avatar_url: null },
      }),
    );
    expect(r.social.github).toBe('github.com/jsmith');
  });

  it('social links from website scrape', () => {
    const r = aggregate(
      makeSources({
        website: {
          title: '', description: '', keywords: [],
          social_links: ['https://linkedin.com/company/acme', 'https://x.com/acme'],
        },
      }),
    );
    expect(r.social.linkedin).toBe('https://linkedin.com/company/acme');
    expect(r.social.twitter).toBe('https://x.com/acme');
  });

  it('does not cache', () => {
    const r = aggregate(makeSources());
    expect(r.cached).toBe(false);
    expect(r.cached_at).toBeNull();
  });
});
