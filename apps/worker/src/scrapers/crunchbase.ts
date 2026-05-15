export interface CrunchbaseData {
  name: string;
  industry: string;
  location: string;
  description: string;
  funding: string;
}

/**
 * Scrape Crunchbase for company info by domain.
 * MVP returns mock data — Crunchbase aggressively blocks headless browsers.
 */
export async function scrapeCrunchbase(domain: string): Promise<CrunchbaseData | null> {
  try {
    // For MVP, return mock data derived from the domain
    const companyName = domain
      .replace(/^www\./, '')
      .split('.')[0]
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    return {
      name: companyName,
      industry: 'Technology',
      location: 'San Francisco, CA',
      description: `${companyName} is a technology company building innovative solutions.`,
      funding: '$10M - $50M',
    };
  } catch {
    return null;
  }
}
