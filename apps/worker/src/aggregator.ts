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

function extractCompany(source: AggregateSources): string | null {
  return source.github?.company ?? source.crunchbase?.name ?? null;
}

function extractName(source: AggregateSources): string | null {
  return source.github?.name ?? source.crunchbase?.name ?? null;
}

function extractIndustry(source: AggregateSources): string | null {
  if (source.crunchbase?.industry) return source.crunchbase.industry;
  if (source.website?.keywords?.length) return source.website.keywords[0];
  return null;
}

function extractLocation(source: AggregateSources): string | null {
  return source.github?.location ?? source.crunchbase?.location ?? null;
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
  if (source.crunchbase) sources++;
  if (source.github) sources++;
  if (source.website) sources++;
  return Math.min(0.3 + sources * 0.25, 1.0);
}

/**
 * Aggregate data from all scraping sources into a single EnrichResult.
 * Priority order: GitHub > Crunchbase > Website scraped metadata.
 */
export function aggregate(sources: AggregateSources): EnrichResult {
  return {
    email: sources.email,
    domain: sources.domain,
    name: extractName(sources),
    title: null,
    company: extractCompany(sources) ?? null,
    company_size: null,
    industry: extractIndustry(sources),
    location: extractLocation(sources),
    social: extractSocial(sources),
    confidence: calculateConfidence(sources),
    cached: false,
    cached_at: null,
  };
}
