# Architecture

## Overview

LeadPure is a lead enrichment API. Send an email or domain, get structured data back. The system is cache-first: check PostgreSQL, scrape sources on miss, cache result for 30 days.

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Client                                     │
│  (curl, HubSpot, Zapier, n8n, Hermes Agent, your app)              │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ POST /v1/enrich { email | domain }
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       API Gateway (Next.js API Routes)              │
│                                                                     │
│  - API key validation (Bearer token → PostgreSQL lookup)            │
│  - Rate limiting (sliding window, per key)                          │
│  - Usage accounting (increment counter for billing)                 │
│  - Cache check: hit → return instantly (~10ms)                       │
│  - Cache miss → dispatch to Worker queue                             │
│  - Pull result (poll or webhook) → return to client                  │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Worker Pool (Bun workers)                     │
│                                                                     │
│  On cache miss, scrape sources in parallel:                         │
│                                                                     │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌─────────────┐  │
│  │ Crunchbase  │  │  LinkedIn  │  │  GitHub    │  │ BuiltWith    │  │
│  │ (httpx)     │  │ (Playwright│  │ (REST API) │  │ (httpx)      │  │
│  └────────────┘  └────────────┘  └────────────┘  └─────────────┘  │
│                                                                     │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                    │
│  │ Website     │  │ News/RSS   │  │ Social     │                    │
│  │ (cheerio)   │  │ (httpx)    │  │ (httpx)    │                    │
│  └────────────┘  └────────────┘  └────────────┘                    │
│                                                                     │
│  Aggregator: merge results, dedupe, run confidence heuristic,       │
│  write to PostgreSQL cache, notify API Gateway                      │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         PostgreSQL                                  │
│                                                                     │
│  enrichments:                                                        │
│    id, email/domain, result JSONB, confidence float,                │
│    source_meta JSONB, created_at, expires_at                        │
│                                                                     │
│  api_keys:                                                           │
│    id, key_hash, tier, usage_this_month, monthly_limit, active      │
│                                                                     │
│  usage_log:                                                         │
│    id, api_key_id, timestamp, endpoint, result (hit/miss)           │
│                                                                     │
│  Indexes: hash(email/domain) for O(1) lookup                        │
│  TTL auto-cleanup via pg_cron or background worker                  │
└─────────────────────────────────────────────────────────────────────┘
                            ▲
                            │
┌───────────────────────────┴─────────────────────────────────────────┐
│                    Stripe (Billing)                                 │
│                                                                     │
│  Metered billing per API key. Monthly invoice for overages.         │
│  Free tier: 50 enrichments/month, no card required.                 │
└─────────────────────────────────────────────────────────────────────┘
```

## Stack

| Layer | Technology | Rationale |
|---|---|---|
| Runtime | Bun | Built-in TS, fast test runner, worker spawning |
| Framework | Next.js (App Router) | API routes + frontend, one deploy to Vercel |
| API validation | Zod | Schema validation, type inference |
| Database | PostgreSQL (Neon) | Cache + auth + billing, free tier available |
| Scraping | Playwright + cheerio + httpx | Playwright for JS-heavy sites (LinkedIn), cheerio for static, raw httpx for APIs |
| Queue | In-process Bun workers | Simpler than Redis queue for MVP; add BullMQ if load demands |
| Billing | Stripe | Metered billing, subscription API, well-documented |
| Deployment | Vercel (API + frontend) + fly.io (workers) | Workers need persistent processes, Vercel is serverless |
| Proxies | Smartproxy or Bright Data | Residential IPs for aggressive scrape targets (LinkedIn) |
| CI/CD | GitHub Actions | Lint, test, deploy on push to main |

## Data Flow

### Enrichment (synchronous happy path)

```
1. Client → POST /v1/enrich { email: "john@acme.com" }
2. API validates API key, checks rate limit
3. Hash email, query enrichments table
4. Cache HIT → return cached result (<50ms, HTTP 200)
5. Cache MISS → enqueue job → return { status: "processing", job_id }
6. Client polls GET /v1/jobs/:job_id or receives webhook
```

### Enrichment (async processing path)

```
7. Worker picks up job from internal queue
8. Scrape sources in parallel (Promise.all):
   a. Crunchbase (httpx — company/people search)
   b. LinkedIn public (Playwright — profile)
   c. GitHub (REST API — profile + repos)
   d. BuiltWith (httpx — tech stack lookup by domain)
   e. Website (cheerio — <title>, <meta>, blog)
   f. News (Google News RSS)
9. Aggregator merges, dedupes, scores confidence
10. Write to PostgreSQL cache
11. Notify API Gateway (via callback or DB poll)
12. Client receives result
```

### Batch enrichment

```
POST /v1/enrich/batch { emails: ["a@x.com", "b@y.com", ...] }

Returns immediately with a batch_id. Worker processes in parallel.
Client polls GET /v1/batches/:batch_id for progress and results.
```

## Directory Structure

```
leadpure/
├── apps/
│   └── web/                 # Next.js app (API routes + landing page)
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx      # Landing page
│       │   ├── globals.css
│       │   ├── docs/
│       │   │   └── page.tsx  # API docs
│       │   └── api/
│       │       └── v1/
│       │           ├── enrich/
│       │           │   └── route.ts    # POST /api/v1/enrich
│       │           ├── jobs/
│       │           │   └── [id]/
│       │           │       └── route.ts # GET /api/v1/jobs/:id
│       │           └── keys/
│       │               └── route.ts    # POST /api/v1/keys
│       ├── components/
│       │   ├── demo-box.tsx
│       │   └── signup-box.tsx
│       └── lib/
│           ├── db.ts         # Postgres connection + cache helpers
│           ├── auth.ts       # API key validation
│           └── rate-limit.ts # In-memory rate limiter
│   └── worker/               # Scraping workers (in-process)
│       └── src/
│           ├── index.ts      # Job system (createJob/runJob/getJob)
│           ├── aggregator.ts # Merge + confidence
│           └── scrapers/
│               ├── crunchbase.ts  # Disabled until licensed API
│               ├── github.ts      # GitHub REST API
│               └── website.ts     # cheerio parser
├── packages/
│   └── core/                 # Shared types
│       └── src/
│           └── index.ts      # EnrichRequest, EnrichResult
├── docs/                     # Planning docs
├── specs/                    # Phase specs
├── scripts/
│   └── migrate.ts            # DB migration
├── test/
│   ├── api/
│   │   ├── smoke.sh          # Shell smoke tests
│   │   └── smoke.test.ts     # Bun API smoke tests
│   └── unit/
│       ├── aggregator.test.ts
│       └── rate-limit.test.ts
├── AGENTS.md
├── CONTEXT.md
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── README.md
├── package.json              # Workspace root
├── tsconfig.json
└── tsconfig.base.json
```

## Self-Host Mode

The `docker-compose.yml` runs:
- API (Next.js standalone build)
- Worker (Bun process)
- PostgreSQL
- (No Stripe — self-hosters get an unlimited API key by default)

Environment variables toggle hosted vs self-host mode:
- `SELF_HOST=true` → skip Stripe, skip rate limits, skip usage tracking
- `SELF_HOST=false` → full billing, rate limiting, metering (hosted service)
