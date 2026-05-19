import { describe, it, expect } from 'bun:test';
import { scrapeCrunchbase } from '../../apps/worker/src/scrapers/crunchbase';

describe('crunchbase', () => {
  it('returns null until licensed API is configured', async () => {
    expect(await scrapeCrunchbase('stripe.com')).toBeNull();
  });
});
