import * as cheerio from 'cheerio';

export interface WebsiteData {
  title: string | null;
  description: string | null;
  keywords: string[];
  social_links: string[];
}

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const SOCIAL_PATTERNS = [
  /linkedin\.com/i,
  /github\.com/i,
  /twitter\.com/i,
  /x\.com/i,
  /facebook\.com/i,
  /youtube\.com/i,
  /instagram\.com/i,
  /tiktok\.com/i,
];

async function fetchWithTimeout(
  url: string,
  timeoutMs = 8000
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (text.length > 1_000_000) return null; // skip huge pages
    return text;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function tryFetch(domain: string): Promise<string | null> {
  const variants = [
    `https://${domain}`,
    `https://www.${domain}`,
    `http://${domain}`,
  ];

  for (const url of variants) {
    const html = await fetchWithTimeout(url);
    if (html) return html;
  }

  return null;
}

/**
 * Scrape a company website for metadata and social links.
 * Tries https://, https://www., and http:// variants of the domain.
 */
export async function scrapeWebsite(domain: string): Promise<WebsiteData | null> {
  try {
    const html = await tryFetch(domain);
    if (!html) return null;

    const $ = cheerio.load(html);

    // Title
    const title = $('title').first().text().trim() || null;

    // Meta description
    const description =
      $('meta[name="description"]').attr('content')?.trim() || null;

    // Meta keywords
    const keywordsRaw = $('meta[name="keywords"]').attr('content') || '';
    const keywords = keywordsRaw
      .split(/[,;]/)
      .map((k) => k.trim())
      .filter(Boolean);

    // Social links from <a> tags
    const socialLinks = new Set<string>();
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      for (const pattern of SOCIAL_PATTERNS) {
        if (pattern.test(href)) {
          socialLinks.add(href);
          break;
        }
      }
    });

    return {
      title: title && title.length < 200 ? title : null,
      description: description && description.length < 500 ? description : null,
      keywords: keywords.slice(0, 30),
      social_links: Array.from(socialLinks),
    };
  } catch {
    return null;
  }
}
