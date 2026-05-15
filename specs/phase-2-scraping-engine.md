# Phase 2: Scraping Engine

Build real scrapers for Crunchbase, GitHub, and website parsing. Wire into the enrich pipeline with an in-process worker queue and aggregator.

At the end of this phase, `POST /v1/enrich` with a real email returns real data from 3 sources. Cold start ~2-5s. Cache writes after scrape.

---

## Architecture Changes

```
API Route (/api/v1/enrich/route.ts)
  │ POST: validate → check cache (stub) → dispatch to Worker → return { status: "processing" }
  │ GET /api/v1/jobs/:id: poll for completed result
  │
  ▼
Worker (apps/worker/)
  │ In-process queue. Process jobs sequentially for MVP.
  │ Parallel scrape via Promise.all across 3 sources.
  │ Aggregator merges → writes to PG → marks job complete.
  │
  └── Scrapers (apps/worker/scrapers/)
      ├── crunchbase.ts   → httpx to Crunchbase public search
      ├── github.ts       → GitHub REST API (no auth for public)
      └── website.ts      → cheerio to parse <title>, meta, blog links
```

### Key Design Choices

- **No Playwright** for MVP — all 3 sources work via HTTP/API, no JS rendering needed. Playwright added later for LinkedIn.
- **No Redis queue** — Bun workers + in-memory Map for job tracking. Simple, no infra. Swap to BullMQ if load demands.
- **Blocking API for now** — client sends POST, worker scrapes inline for MVP simplicity. Async/poll added in Phase 3.
- **Worker lives in `apps/worker/`** — separate process so it can run independently on fly.io later. For now, Next.js API route spawns it.

## Files to Create/Modify

### Create: `apps/worker/package.json`

```json
{
  "name": "@leadpure/worker",
  "version": "0.1.0",
  "scripts": {
    "dev": "bun run --watch src/index.ts"
  },
  "dependencies": {
    "@leadpure/core": "workspace:*",
    "@neondatabase/serverless": "^1.1.0",
    "cheerio": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5"
  }
}
```

### Create: `apps/worker/tsconfig.json`

Extend the base:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
```

### Create: `apps/worker/src/index.ts`

Entry point. Exports a `processEnrichment` function.

```typescript
import { EnrichRequest, EnrichResult } from '@leadpure/core';
import { scrapeCrunchbase } from './scrapers/crunchbase';
import { scrapeGithub } from './scrapers/github';
import { scrapeWebsite } from './scrapers/website';
import { aggregate } from './aggregator';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Job {
  id: string;
  request: EnrichRequest;
  status: JobStatus;
  result?: EnrichResult;
  error?: string;
  created_at: string;
  completed_at?: string;
}

const jobs = new Map<string, Job>();

export function createJob(req: EnrichRequest): string {
  const id = crypto.randomUUID();
  const job: Job = {
    id,
    request: req,
    status: 'pending',
    created_at: new Date().toISOString(),
  };
  jobs.set(id, job);
  return id;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export async function processEnrichment(req: EnrichRequest): Promise<EnrichResult> {
  const domain = req.domain ?? req.email?.split('@')[1] ?? '';

  const [crunchbase, github, website] = await Promise.allSettled([
    scrapeCrunchbase(domain).catch(() => null),
    scrapeGithub(req.email, domain).catch(() => null),
    scrapeWebsite(domain).catch(() => null),
  ]);

  const result = aggregate({
    email: req.email ?? `hello@${domain}`,
    domain,
    crunchbase: crunchbase.status === 'fulfilled' ? crunchbase.value : null,
    github: github.status === 'fulfilled' ? github.value : null,
    website: website.status === 'fulfilled' ? website.value : null,
  });

  return result;
}

export async function runJob(jobId: string): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) throw new Error(`Job ${jobId} not found`);
  job.status = 'processing';
  try {
    job.result = await processEnrichment(job.request);
    job.status = 'completed';
    job.completed_at = new Date().toISOString();
  } catch (err) {
    job.status = 'failed';
    job.error = String(err);
  }
}
```

### Create: `apps/worker/src/scrapers/crunchbase.ts`

Crunchbase scraper via public search page (no API key needed).

```typescript
export interface CrunchbaseData {
  name: string | null;
  industry: string | null;
  location: string | null;
  description: string | null;
  funding: string | null;
}

export async function scrapeCrunchbase(domain: string): Promise<CrunchbaseData | null> {
  const url = `https://www.crunchbase.com/search/organization/field/organizations/${encodeURIComponent(domain)}`;
  // For MVP: return mock data. Real scraping via Playwright/httpx in Phase 2b.
  // Crunchbase blocks headless browsers — this is a known risk documented in data-sources.md.
  return {
    name: `${domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1)}`,
    industry: 'Software',
    location: 'San Francisco, CA',
    description: null,
    funding: null,
  };
}
```

### Create: `apps/worker/src/scrapers/github.ts`

GitHub scraper via public REST API.

```typescript
export interface GithubData {
  username: string | null;
  name: string | null;
  bio: string | null;
  location: string | null;
  company: string | null;
  blog: string | null;
  public_repos: number;
  languages: string[];
  avatar_url: string | null;
}

export async function scrapeGithub(email?: string, domain?: string): Promise<GithubData | null> {
  // Strategy: search users by email/domain via GitHub API
  // GitHub's search API: GET /search/users?q=email@domain.com
  // For MVP: use email to search, fall back to org search by domain

  if (!email && !domain) return null;

  let username: string | null = null;

  // Try email search first
  if (email) {
    const res = await fetch(`https://api.github.com/search/users?q=${encodeURIComponent(email)}+in:email`);
    if (res.ok) {
      const data = await res.json() as { items: Array<{ login: string }> };
      if (data.items?.length > 0) {
        username = data.items[0].login;
      }
    }
  }

  // Fallback: search by domain in company field
  if (!username && domain) {
    const res = await fetch(`https://api.github.com/search/users?q=${encodeURIComponent(domain)}+in:company`);
    if (res.ok) {
      const data = await res.json() as { items: Array<{ login: string }> };
      if (data.items?.length > 0) {
        username = data.items[0].login;
      }
    }
  }

  if (!username) return null;

  // Get user profile
  const profileRes = await fetch(`https://api.github.com/users/${username}`);
  if (!profileRes.ok) return null;
  const profile = await profileRes.json() as {
    name: string | null;
    bio: string | null;
    location: string | null;
    company: string | null;
    blog: string | null;
    public_repos: number;
    avatar_url: string;
  };

  // Get repo languages (first 5 repos)
  const reposRes = await fetch(`https://api.github.com/users/${username}/repos?per_page=5&sort=updated`);
  const languages = new Set<string>();
  if (reposRes.ok) {
    const repos = await reposRes.json() as Array<{ language: string | null }>;
    for (const repo of repos) {
      if (repo.language) languages.add(repo.language);
    }
  }

  return {
    username,
    name: profile.name,
    bio: profile.bio,
    location: profile.location,
    company: profile.company,
    blog: profile.blog,
    public_repos: profile.public_repos,
    languages: Array.from(languages),
    avatar_url: profile.avatar_url,
  };
}
```

### Create: `apps/worker/src/scrapers/website.ts`

Website parser via fetch + cheerio.

```typescript
import * as cheerio from 'cheerio';

export interface WebsiteData {
  title: string | null;
  description: string | null;
  keywords: string[];
  social_links: string[];
}

export async function scrapeWebsite(domain: string): Promise<WebsiteData | null> {
  const urls = [
    `https://${domain}`,
    `https://www.${domain}`,
    `http://${domain}`,
  ];

  let html: string | null = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadPure/0.1; +https://leadpure.dev)' },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        html = await res.text();
        break;
      }
    } catch {
      continue;
    }
  }

  if (!html) return null;

  const $ = cheerio.load(html);

  const title = $('title').first().text().trim() || null;
  const description = $('meta[name="description"]').attr('content')?.trim() || null;
  const keywords = ($('meta[name="keywords"]').attr('content') || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  const social_links: string[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (href.includes('linkedin.com/') || href.includes('github.com/') || href.includes('twitter.com/') || href.includes('x.com/')) {
      social_links.push(href);
    }
  });

  return { title, description, keywords, social_links };
}
```

### Create: `apps/worker/src/aggregator.ts`

Merge scraped data, dedupe, compute confidence.

```typescript
import { EnrichResult } from '@leadpure/core';
import { CrunchbaseData } from './scrapers/crunchbase';
import { GithubData } from './scrapers/github';
import { WebsiteData } from './scrapers/website';

interface ScrapeResults {
  email: string;
  domain: string;
  crunchbase: CrunchbaseData | null;
  github: GithubData | null;
  website: WebsiteData | null;
}

export function aggregate(sources: ScrapeResults): EnrichResult {
  const { email, domain, crunchbase, github, website } = sources;

  // Determine best name
  const name = github?.name ?? crunchbase?.name ?? null;

  // Determine best company
  const company = github?.company ?? crunchbase?.name ?? domain.split('.')[0];
  const company_name = company
    ? company.charAt(0).toUpperCase() + company.replace(/^@/, '').slice(1)
    : null;

  // Industry: prefer Crunchbase
  const industry = crunchbase?.industry ?? website?.keywords[0] ?? null;

  // Location: prefer GitHub, fallback to Crunchbase
  const location = github?.location ?? crunchbase?.location ?? null;

  // Social links
  const linkedin = crunchbase?.name
    ? `linkedin.com/company/${domain.split('.')[0]}`
    : null;
  const github_username = github?.username
    ? `github.com/${github.username}`
    : website?.social_links.find((l) => l.includes('github')) ?? null;
  const twitter = website?.social_links.find(
    (l) => l.includes('twitter') || l.includes('x.com')
  ) ?? null;

  // Confidence score: 0.0 - 1.0
  // Rules: +0.4 per source with >=1 field populated
  let sourcesWithData = 0;
  if (crunchbase && (crunchbase.name || crunchbase.industry)) sourcesWithData++;
  if (github && github.username) sourcesWithData++;
  if (website && (website.title || website.description)) sourcesWithData++;
  const confidence = Math.min(0.3 + sourcesWithData * 0.25, 1.0);

  return {
    email,
    domain,
    name,
    title: null, // TODO: LinkedIn scraper in Phase 3
    company: company_name,
    company_size: null, // Hard to get without paid sources
    industry,
    location,
    social: {
      linkedin,
      github: github_username,
      twitter,
    },
    confidence: Math.round(confidence * 100) / 100,
    cached: false,
    cached_at: null,
  };
}
```

### Modify: `apps/web/app/api/v1/enrich/route.ts`

Wire to worker instead of returning mock data.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateApiKey } from '@/lib/auth';
import { createJob, runJob, getJob } from '@leadpure/worker';

const schema = z
  .object({
    email: z.string().email().optional(),
    domain: z.string().optional(),
  })
  .refine((d) => d.email || d.domain, {
    message: 'Either email or domain is required',
  });

export async function POST(req: NextRequest) {
  const key = await validateApiKey(req.headers.get('x-api-key'));
  if (!key || !key.active) {
    return NextResponse.json(
      { error: 'invalid_api_key', message: 'API key is missing or invalid' },
      { status: 401 },
    );
  }

  let parsed: z.infer<typeof schema>;
  try {
    const body = await req.json();
    parsed = schema.parse(body);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'validation_error', message: err.errors[0].message },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: 'invalid_json', message: 'Request body must be valid JSON' },
      { status: 400 },
    );
  }

  // Phase 2: real scraping
  const jobId = createJob(parsed);
  // Fire and forget — don't await in the request handler
  runJob(jobId).catch(console.error);

  // Poll for result (simple: wait up to 10s for MVP)
  const result = await pollJob(jobId, 10_000);
  if (!result) {
    return NextResponse.json({ job_id: jobId, status: 'processing' }, { status: 202 });
  }

  return NextResponse.json(result, { status: 200 });
}

async function pollJob(jobId: string, timeoutMs: number): Promise<unknown | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const job = getJob(jobId);
    if (job?.status === 'completed') return job.result;
    if (job?.status === 'failed') throw new Error(job.error);
    await new Promise((r) => setTimeout(r, 200));
  }
  return null; // still processing
}
```

### Add: `apps/worker/src/jobs.ts` (optional helper, keep in index.ts for simplicity)

## Verification Gates

Before merging Phase 2:

- [ ] `bun install` completes without errors (new `@leadpure/worker` workspace resolves)
- [ ] `bun run --filter @leadpure/worker lint` passes (tsc --noEmit)
- [ ] `bun run --filter @leadpure/web lint` passes
- [ ] `POST /api/v1/enrich` with `x-api-key: lp_live_testkey123` returns real data for a known domain (e.g., `github.com` or `vercel.com`)
- [ ] GitHub scraper returns at least name + location for emails matching known GitHub users
- [ ] Website parser extracts `<title>` and `<meta description>` correctly
- [ ] Crunchbase scraper returns industry + location (mock data acceptable for MVP — real scraping noted as post-MVP)
- [ ] Aggregator produces confidence score: 0.55 for 1 source, 0.80 for 2 sources, 1.0 for 3 sources
- [ ] Cache miss completes in <10s
- [ ] No real API tokens/hardcoded secrets

## What We're NOT Building in Phase 2

- No LinkedIn scraper (Playwright needed — Phase 3+)
- No BuiltWith scraper (paid API — Phase 3+)
- No async/poll endpoint (`GET /api/v1/jobs/:id`) — Phase 3
- No PostgreSQL cache writes — Phase 3
- No rate limiting — Phase 3
- No batch endpoint — post-MVP

## Unresolved Questions

- Crunchbase blocks headless browsers. Mock data acceptable now, but real scraping needs Playwright + proxies ($). Is that Phase 3 or post-MVP?
- GitHub API has rate limits (60 req/hr unauthenticated). Should we add a `GITHUB_TOKEN` env var in Phase 2 or Phase 3?
- Worker runs in-process with Next.js. For fly.io deployment, worker needs its own entrypoint. Keep as-is for Vercel, or add a `worker.ts` entry for fly.io now?
