# Architecture Decision Records

## ADR-001: TypeScript over Python

**Status:** Accepted  
**Date:** 2026-05-14

### Context

The project needs a REST API, background workers for scraping, a landing page, and potentially a CLI tool and interactive docs. Two paths: Python (FastAPI + scraper stack) or TypeScript (Next.js tRPC/API routes + workers).

### Decision

TypeScript across the entire stack.

### Rationale

- Single language: API, workers, landing page, CLI — one repo, one type system, one test runner
- Playwright (the core scraping runtime) is native Node, ports to Python have friction and lag
- Next.js API routes + frontend = one deploy target (Vercel), not two
- Bun workers handle parallel I/O-bound scraping just as well as Python asyncio
- Zod and TypeScript provide equivalent type safety to Pydantic
- A solo founder maintaining one language stack is a real productivity multiplier

### Consequences

- No Scrapy framework (we get the scraping middleware via Playwright + custom orchestration)
- No `asyncpg` — Node PG drivers (`pg`, `@vercel/postgres`) are fine
- If we ever need heavy data transforms (pandas-like), we pull in `arquero` or `uwu`

---

## ADR-002: Open-Source Core (MIT)

**Status:** Accepted  
**Date:** 2026-05-14

### Context

We need to differentiate from closed-source incumbents (Clearbit, ZoomInfo, Apollo) and give privacy-conscious teams a path to self-host.

### Decision

Core enrichment engine is MIT-licensed. The hosted API is a paid service built on top.

### Rationale

- Open-source drives adoption and trust (competitive moat against closed-source incumbents)
- Self-hosting option for teams with compliance requirements (HIPAA, GDPR, internal policies)
- Separate hosted-api layer (API keys, rate limiting, billing) is where the monetization lives — the core enrichment engine is the commodity
- Community contributions improve data source coverage (crowdsourced scrapers)

### Consequences

- Need clear separation between `packages/core` (OSS) and `packages/api` (proprietary)
- README must include "Deploy on Railway" and self-host docs from day one
- Must maintain a `docker-compose.yml` for self-hosters

---

## ADR-003: No LLM/ML in Pipeline

**Status:** Accepted  
**Date:** 2026-05-14

### Context

Standard enrichment tools use NLP and ML to extract entities. This adds cost, latency, and opacity. User requested "not AI-related" if possible.

### Decision

Zero LLM/ML in the enrichment pipeline. Pure deterministic scraping + structured data extraction.

### Rationale

- Scraping is 10-100x cheaper per enrichment than any LLM call
- Deterministic output means auditable, reproducible results
- No prompt fragility, no model versioning drift
- Every enrichment result is traceable to a specific source URL
- Simpler to self-host (no GPU, no model dependencies)

### Consequences

- More source-specific parsing code (each source needs a custom extractor instead of one LLM prompt)
- Coverage gaps where data isn't publicly structured (some enrichment dimensions may be null)
- Confidence scoring is rule-based (source count, freshness, cross-references)

---

## ADR-004: Cache-First Architecture

**Status:** Accepted  
**Date:** 2026-05-14

### Context

Enriching the same email twice is wasteful. Source scraping is the bottleneck (2-5s per enrichment). Users expect sub-second responses.

### Decision

PostgreSQL with a 30-day TTL cache. Cache hit returns in <50ms. Only scrape on cache miss.

### Rationale

- Most teams enrich the same prospects repeatedly (CRM syncs, re-uploads)
- 30-day TTL balances freshness with cost savings
- Materialized views for enrichment stats (free tier tracking, usage billing)
- One fewer service to run — no Redis, no separate cache layer

### Consequences

- Cache invalidation strategy needed for user-triggered refresh
- Cold-start problem: first enrichment on any email takes 2-5s
- Can add a Redis write-through layer later if read pressure demands it

---

## ADR-005: Pay-as-You-Go Billing (No Expiring Credits)

**Status:** Accepted  
**Date:** 2026-05-14

### Context

Clearbit and incumbents use monthly credit buckets that expire. Users hate this — it's the most common complaint in reviews. We need a simpler model.

### Decision

Usage-based billing with monthly tiers that roll over. Unused enrichments carry forward.

### Rationale

- No expiring credits = trust signal vs incumbents
- Predictable revenue from tier ceilings, with overage billing for spikes
- Users can buy a "forever" block of enrichments (prepay for 10K, use over 6 months)
- Simpler to implement: count enrichments per API key per month, Stripe metered billing

### Consequences

- Revenue is usage-sensitive (more successful = more revenue, but also more cost)
- Need robust usage tracking and rate limiting on the API key
- Free tier (50/mo) is a marketing cost — needs to be tracked separately

---

## ADR-006: Bun as Runtime and Package Manager

**Status:** Accepted  
**Date:** 2026-05-14

### Context

Need a runtime that handles both API server and background workers efficiently. Node.js is the default, but Bun offers better DX for this use case.

### Decision

Bun for runtime, bun test, bun build. Node.js as fallback with `--bun` flag for compatibility.

### Rationale

- Built-in TypeScript transpilation (no `ts-node`, `tsx`, `esbuild` needed)
- `bun test` is near-instant, drops in for vitest
- Bun's fetch-based HTTP server is competitive with Fastify/Express
- Worker spawning via `Bun.spawn()` is trivial
- Node.js compatibility means we can fall back if needed

### Consequences

- First-time setup requires `brew install oven-sh/bun/bun`
- Must test against Node.js before CI deployment (Vercel uses Node)
- Some npm packages have Bun-specific bugs (test during build)

---

## ADR-007: Landing Page as Next.js App (Not Static)

**Status:** Accepted  
**Date:** 2026-05-14

### Context

The landing page needs to serve marketing content AND host an interactive demo box ("enter an email, see enrichment results"). Could be static HTML or a framework.

### Decision

Next.js with the same repo. API routes serve the demo, App Router pages serve the marketing site.

### Rationale

- Interactive demo needs a real API call — can't be a static site
- One deploy (Vercel) for both frontend and API
- ISR for marketing pages (static-like performance)
- API routes co-located means no CORS issues in the demo

### Consequences

- Build times slightly longer than a static Hugo/Astro site
- Marketing page performance depends on Vercel edge compute
- Can extract to a separate static site later if needed
