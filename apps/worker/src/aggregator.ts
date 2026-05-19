import type { EnrichResult } from '@leadpure/core';
import type { CrunchbaseData } from './scrapers/crunchbase';
import type { GithubData } from './scrapers/github';
import type { WebsiteData } from './scrapers/website';

export interface AggregateSources {
  email: string;
  domain: string;
  crunchbase: CrunchbaseData | null;
  github: GithubData | null;
  website: WebsiteData | null;
}

function isRealCrunchbase(data: CrunchbaseData | null): data is CrunchbaseData {
  return data !== null;
}

function websiteContributes(data: WebsiteData | null): boolean {
  if (!data) return false;
  return Boolean(
    data.company_name ||
      data.description ||
      data.industry ||
      data.location ||
      data.fields_from.includes('jsonld'),
  );
}

function extractCompany(source: AggregateSources): string | null {
  if (source.github?.company) return source.github.company;
  if (source.website?.company_name) return source.website.company_name;
  if (isRealCrunchbase(source.crunchbase)) return source.crunchbase.name;
  return null;
}

function extractName(source: AggregateSources): string | null {
  return source.github?.name ?? null;
}

function extractIndustry(source: AggregateSources): string | null {
  if (source.website?.industry) return source.website.industry;
  if (source.website?.keywords?.length) return source.website.keywords[0];
  if (isRealCrunchbase(source.crunchbase)) return source.crunchbase.industry;
  return null;
}

function extractLocation(source: AggregateSources): string | null {
  if (source.github?.location) return source.github.location;
  if (source.website?.location) return source.website.location;
  if (isRealCrunchbase(source.crunchbase)) return source.crunchbase.location;
  return null;
}

function extractCompanySize(source: AggregateSources): string | null {
  return source.website?.company_size ?? null;
}

function extractSocial(source: AggregateSources): EnrichResult['social'] {
  const social: EnrichResult['social'] = {
    linkedin: null,
    github: null,
    twitter: null,
  };

  if (source.github) {
    social.github = `github.com/${source.github.username}`;
  }

  if (source.website?.social_links) {
    for (const link of source.website.social_links) {
      if (/linkedin\.com/i.test(link) && !social.linkedin) social.linkedin = link;
      if (/(github\.com)/i.test(link) && !social.github) social.github = link;
      if (/(twitter\.com|x\.com)/i.test(link) && !social.twitter) social.twitter = link;
    }
  }

  return social;
}

function calculateConfidence(source: AggregateSources): number {
  let sources = 0;
  if (isRealCrunchbase(source.crunchbase)) sources++;
  if (source.github) sources++;
  if (websiteContributes(source.website)) sources++;
  return Math.min(0.3 + sources * 0.25, 1.0);
}

/**
 * Aggregate data from all scraping sources into a single EnrichResult.
 * Priority: GitHub (person) > website structured data > Crunchbase (when licensed).
 */
export function aggregate(sources: AggregateSources): EnrichResult {
  return {
    email: sources.email,
    domain: sources.domain,
    name: extractName(sources),
    title: null,
    company: extractCompany(sources),
    company_size: extractCompanySize(sources),
    industry: extractIndustry(sources),
    location: extractLocation(sources),
    social: extractSocial(sources),
    confidence: calculateConfidence(sources),
    cached: false,
    cached_at: null,
  };
}
