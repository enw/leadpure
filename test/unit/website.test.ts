import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseWebsiteHtml } from '../../apps/worker/src/scrapers/website';
import { isPathAllowed } from '../../apps/worker/src/scrapers/robots';

const fixture = (name: string) =>
  readFileSync(join(import.meta.dir, '../fixtures/website', name), 'utf8');

describe('website parser', () => {
  it('extracts company from JSON-LD and Open Graph', () => {
    const data = parseWebsiteHtml(fixture('jsonld-org.html'));
    expect(data?.company_name).toBe('Stripe, Inc.');
    expect(data?.fields_from).toContain('jsonld');
    expect(data?.fields_from).toContain('opengraph');
    expect(data?.location).toContain('San Francisco');
    expect(data?.company_size).toBe('8000');
    expect(data?.social_links.some((l) => l.includes('linkedin.com'))).toBe(true);
  });

  it('returns null for pages with no useful metadata', () => {
    expect(parseWebsiteHtml(fixture('minimal.html'))).toBeNull();
  });
});

describe('robots.txt', () => {
  it('allows paths not disallowed', () => {
    const robots = `User-agent: *\nDisallow: /admin\n`;
    expect(isPathAllowed('/about', robots)).toBe(true);
    expect(isPathAllowed('/admin', robots)).toBe(false);
  });

  it('rejects secondary paths when robots.txt missing', () => {
    expect(isPathAllowed('/about', null)).toBe(false);
  });
});
