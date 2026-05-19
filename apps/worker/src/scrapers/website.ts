import * as cheerio from 'cheerio';
import { fetchWithTimeout } from './http';
import { fetchRobotsTxt, isPathAllowed } from './robots';
import { parseJsonLdOrganization, parseJsonLdScripts, type JsonLdOrgFields } from './jsonld-org';

export type WebsiteFieldSource = 'homepage' | 'about' | 'jsonld' | 'opengraph';

export interface WebsiteData {
  title: string | null;
  description: string | null;
  keywords: string[];
  social_links: string[];
  company_name: string | null;
  industry: string | null;
  location: string | null;
  company_size: string | null;
  fields_from: WebsiteFieldSource[];
}

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

const SECONDARY_PATHS = ['/about', '/about-us', '/company', '/team'];

const GENERIC_PAGE_TITLES = new Set(['home', 'welcome', 'index', 'default', 'untitled']);

interface ParsedPage {
  title: string | null;
  description: string | null;
  keywords: string[];
  social_links: string[];
  company_name: string | null;
  industry: string | null;
  location: string | null;
  company_size: string | null;
  fields_from: WebsiteFieldSource[];
}

function cleanTitle(title: string | null): string | null {
  if (!title) return null;
  const trimmed = title.trim();
  if (!trimmed || trimmed.length > 200) return null;
  const parts = trimmed.split(/\s*[|\-–—]\s*/);
  const first = parts[0]?.trim();
  return first && first.length > 1 ? first : trimmed;
}

function titleAsCompanyName(title: string | null): string | null {
  const cleaned = cleanTitle(title);
  if (!cleaned) return null;
  if (GENERIC_PAGE_TITLES.has(cleaned.toLowerCase())) return null;
  return cleaned;
}

function mergeField<T>(current: T | null, next: T | null): T | null {
  return current ?? next;
}

function mergeParsed(target: ParsedPage, page: ParsedPage): void {
  target.title = mergeField(target.title, page.title);
  target.description = mergeField(target.description, page.description);
  target.company_name = mergeField(target.company_name, page.company_name);
  target.industry = mergeField(target.industry, page.industry);
  target.location = mergeField(target.location, page.location);
  target.company_size = mergeField(target.company_size, page.company_size);

  const kw = new Set([...target.keywords, ...page.keywords]);
  target.keywords = Array.from(kw).slice(0, 30);

  const links = new Set([...target.social_links, ...page.social_links]);
  target.social_links = Array.from(links);

  for (const f of page.fields_from) {
    if (!target.fields_from.includes(f)) target.fields_from.push(f);
  }
}

function collectSocialLinks($: cheerio.CheerioAPI, into: Set<string>): void {
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    for (const pattern of SOCIAL_PATTERNS) {
      if (pattern.test(href)) {
        into.add(href);
        break;
      }
    }
  });
}

function applyJsonLd(parsed: ParsedPage, jsonld: JsonLdOrgFields): void {
  parsed.company_name = mergeField(parsed.company_name, jsonld.name);
  parsed.description = mergeField(parsed.description, jsonld.description);
  parsed.industry = mergeField(parsed.industry, jsonld.industry);
  parsed.location = mergeField(parsed.location, jsonld.location);
  parsed.company_size = mergeField(parsed.company_size, jsonld.company_size);
  if (!parsed.fields_from.includes('jsonld')) parsed.fields_from.push('jsonld');
}

function parseHtml(html: string, pageKind: WebsiteFieldSource): ParsedPage {
  const $ = cheerio.load(html);
  const socialSet = new Set<string>();
  collectSocialLinks($, socialSet);

  const parsed: ParsedPage = {
    title: null,
    description: null,
    keywords: [],
    social_links: [],
    company_name: null,
    industry: null,
    location: null,
    company_size: null,
    fields_from: [pageKind],
  };

  const titleRaw = $('title').first().text().trim() || null;
  parsed.title = titleRaw;

  const ogSiteName = $('meta[property="og:site_name"]').attr('content')?.trim();
  const ogTitle = $('meta[property="og:title"]').attr('content')?.trim();
  const ogDescription = $('meta[property="og:description"]').attr('content')?.trim();

  if (ogSiteName || ogTitle || ogDescription) {
    if (!parsed.fields_from.includes('opengraph')) parsed.fields_from.push('opengraph');
  }

  parsed.company_name =
    (ogSiteName && !GENERIC_PAGE_TITLES.has(ogSiteName.toLowerCase()) ? ogSiteName : null) ||
    titleAsCompanyName(ogTitle ?? null) ||
    titleAsCompanyName(titleRaw) ||
    null;

  parsed.description =
    ogDescription ||
    $('meta[name="description"]').attr('content')?.trim() ||
    null;

  const keywordsRaw = $('meta[name="keywords"]').attr('content') || '';
  parsed.keywords = keywordsRaw
    .split(/[,;]/)
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, 30);

  const jsonld = parseJsonLdOrganization(parseJsonLdScripts(html));
  if (jsonld) {
    applyJsonLd(parsed, jsonld);
    if (jsonld.name) parsed.company_name = jsonld.name;
  }

  if (pageKind === 'about' && !parsed.company_name) {
    const h1 = $('h1').first().text().trim();
    if (h1 && h1.length < 120) parsed.company_name = h1;
  }

  for (const link of jsonld?.same_as ?? []) socialSet.add(link);
  parsed.social_links = [...new Set(socialSet)];

  if (parsed.description && parsed.description.length > 500) {
    parsed.description = parsed.description.slice(0, 500);
  }

  return parsed;
}

function hasUsefulData(parsed: ParsedPage): boolean {
  return Boolean(
    parsed.company_name ||
      parsed.description ||
      parsed.industry ||
      parsed.location ||
      parsed.social_links.length ||
      parsed.keywords.length,
  );
}

async function tryFetchHomepage(domain: string): Promise<{ html: string; baseUrl: string } | null> {
  const variants = [
    `https://${domain}`,
    `https://www.${domain}`,
    `http://${domain}`,
  ];

  for (const url of variants) {
    const html = await fetchWithTimeout(url);
    if (html) return { html, baseUrl: url.replace(/\/$/, '') };
  }

  return null;
}

export function parseWebsiteHtml(html: string, pageKind: WebsiteFieldSource = 'homepage'): WebsiteData | null {
  const parsed = parseHtml(html, pageKind);
  if (!hasUsefulData(parsed)) return null;

  return {
    title: parsed.title,
    description: parsed.description,
    keywords: parsed.keywords,
    social_links: parsed.social_links,
    company_name: parsed.company_name,
    industry: parsed.industry,
    location: parsed.location,
    company_size: parsed.company_size,
    fields_from: parsed.fields_from,
  };
}

/**
 * Scrape a company website for metadata, JSON-LD Organization, Open Graph, and social links.
 * Secondary paths are fetched only when allowed by robots.txt.
 */
export async function scrapeWebsite(domain: string): Promise<WebsiteData | null> {
  try {
    const home = await tryFetchHomepage(domain);
    if (!home) return null;

    const merged = parseHtml(home.html, 'homepage');
    if (!hasUsefulData(merged)) return null;

    const robotsTxt = await fetchRobotsTxt((url) => fetchWithTimeout(url, 5000), domain);

    let secondaryFetches = 0;
    for (const path of SECONDARY_PATHS) {
      if (secondaryFetches >= 2) break;
      if (!isPathAllowed(path, robotsTxt)) continue;

      const url = `${home.baseUrl}${path}`;
      const html = await fetchWithTimeout(url, 6000);
      if (!html) continue;

      const page = parseHtml(html, 'about');
      if (hasUsefulData(page)) {
        mergeParsed(merged, page);
        secondaryFetches++;
      }
    }

    return {
      title: merged.title,
      description: merged.description,
      keywords: merged.keywords,
      social_links: merged.social_links,
      company_name: merged.company_name,
      industry: merged.industry,
      location: merged.location,
      company_size: merged.company_size,
      fields_from: merged.fields_from,
    };
  } catch {
    return null;
  }
}
