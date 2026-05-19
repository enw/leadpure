export interface CrunchbaseData {
  name: string;
  industry: string;
  location: string;
  description: string;
  funding: string;
}

/**
 * Crunchbase integration placeholder.
 * Returns null until a licensed Crunchbase Data API key is configured.
 */
export async function scrapeCrunchbase(_domain: string): Promise<CrunchbaseData | null> {
  return null;
}
