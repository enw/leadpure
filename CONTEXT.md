# LeadPure Project Context

## What It Is

A lead enrichment API. Send an email or domain, get structured data back (name, company, industry, social profiles, etc.). Open-source MIT, cache-first, no AI.

## Current Phase

**Phase 2: Scraping Engine** is in progress.
- Phase 1 (Foundation) complete: workspace scaffolded, landing page, mock enrich endpoint, auth stub
- Phase 2 adds: 3 real scrapers (Crunchbase mock, GitHub API, website parser), aggregator, worker queue

## Key Architecture

```
POST /api/v1/enrich { email } 
  → validate API key (x-api-key header)
  → create job, run worker (scrape 3 sources in parallel)
  → aggregate results, return
```

## State

- Mock `enrich()` in `@leadpure/core` returns hardcoded data
- Auth accepts dev key `lp_live_testkey123` without DB
- Demo box on landing page calls `/api/v1/enrich`
- No DB connected yet (optional for dev)

## Environment Variables

```
DATABASE_URL=postgres://... (optional — dev mode works without it)
SELF_HOST=false
```

## Branch

Active work is on `phase-2-scraping-engine`.
