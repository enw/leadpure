import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseJsonLdOrganization, parseJsonLdScripts } from '../../apps/worker/src/scrapers/jsonld-org';

const fixture = (name: string) =>
  readFileSync(join(import.meta.dir, '../fixtures/website', name), 'utf8');

describe('jsonld-org', () => {
  it('parses Organization from JSON-LD script', () => {
    const html = fixture('jsonld-org.html');
    const org = parseJsonLdOrganization(parseJsonLdScripts(html));
    expect(org?.name).toBe('Stripe, Inc.');
    expect(org?.description).toContain('Financial infrastructure');
    expect(org?.location).toContain('San Francisco');
    expect(org?.company_size).toBe('8000');
    expect(org?.same_as.length).toBeGreaterThanOrEqual(2);
  });

  it('returns null when no organization schema', () => {
    const org = parseJsonLdOrganization(parseJsonLdScripts(fixture('minimal.html')));
    expect(org).toBeNull();
  });
});
