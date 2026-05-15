# Phase 1: Foundation

Build the project skeleton: workspace, database, single endpoint, landing page.

At the end of this phase, `curl -X POST https://leadpure.dev/v1/enrich -d '{"email":"test@example.com"}'` returns mock data and the landing page is reachable.

---

## Repo Structure

```
leadpure/
├── apps/
│   └── web/                 # Next.js app (API routes + landing page)
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx
│       │   └── api/
│       │       └── v1/
│       │           └── enrich/
│       │               └── route.ts       # POST handler
│       ├── lib/
│       │   ├── db.ts                     # Postgres (Neon) connection
│       │   └── auth.ts                   # API key validation (stub)
│       └── components/
│           ├── hero.tsx
│           ├── demo-box.tsx
│           └── pricing.tsx
├── packages/
│   └── core/                # Open-source enrichment engine (shell for now)
│       ├── src/
│       │   ├── enrich.ts    # enrich() — returns mock data this phase
│       │   └── types.ts     # TS types
│       └── package.json
├── docs/
├── .gitignore
├── .gitattributes
├── package.json             # Workspace root
├── bun.lock
├── tsconfig.json
├── tsconfig.base.json
├── .eslintrc.cjs
├── .prettierrc
└── README.md
```

## Workspace Setup

**Root `package.json`** — Bun workspaces:

```json
{
  "name": "leadpure",
  "private": true,
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "dev": "bun run --filter @leadpure/web dev",
    "build": "bun run --filter @leadpure/web build",
    "lint": "bun run --filter @leadpure/* lint",
    "test": "bun test"
  }
}
```

**`packages/core/package.json`**:

```json
{
  "name": "@leadpure/core",
  "version": "0.1.0",
  "main": "src/index.ts",
  "types": "src/index.ts"
}
```

**`apps/web/package.json`**:

```json
{
  "name": "@leadpure/web",
  "version": "0.1.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^15",
    "react": "^19",
    "react-dom": "^19",
    "@neondatabase/serverless": "^0.x",
    "zod": "^3.x"
  },
  "devDependencies": {
    "@types/node": "^22",
    "@types/react": "^19",
    "typescript": "^5",
    "tailwindcss": "^4",
    "@tailwindcss/postcss": "^4"
  }
}
```

## Database Schema (Neon PostgreSQL)

Run this on first `bun run dev` via a migration script or manual apply:

```sql
CREATE TABLE api_keys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash    TEXT NOT NULL UNIQUE,     -- sha256 of the raw key
  name        TEXT NOT NULL DEFAULT '', -- human label
  tier        TEXT NOT NULL DEFAULT 'free',
  usage_count INTEGER NOT NULL DEFAULT 0,
  monthly_limit INTEGER NOT NULL DEFAULT 50,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE enrichments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  input_hash    TEXT NOT NULL,           -- sha256 of the email/domain
  input_type    TEXT NOT NULL,           -- 'email' or 'domain'
  result        JSONB NOT NULL,
  confidence    REAL NOT NULL DEFAULT 0,
  source_meta   JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT now() + interval '30 days'
);

CREATE INDEX idx_enrichments_input_hash ON enrichments(input_hash);
CREATE INDEX idx_enrichments_expires_at ON enrichments(expires_at);

CREATE TABLE usage_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id  UUID REFERENCES api_keys(id),
  endpoint    TEXT NOT NULL,
  input_hash  TEXT,
  cache_hit   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## API Endpoint

### `POST /api/v1/enrich`

**Request:**
```json
{
  "email": "john@acme.com"
}
```

Or by domain:
```json
{
  "domain": "acme.com"
}
```

**Response (200 — cache hit / mock):**
```json
{
  "email": "john@acme.com",
  "domain": "acme.com",
  "name": "John Smith",
  "title": "VP Engineering",
  "company": "Acme Inc",
  "company_size": "50-200",
  "industry": "SaaS",
  "location": "San Francisco, CA",
  "social": {
    "linkedin": "linkedin.com/in/johnsmith",
    "github": "github.com/jsmith",
    "twitter": "x.com/johnsmith"
  },
  "confidence": 0.85,
  "cached": true,
  "cached_at": "2026-05-14T20:00:00Z"
}
```

**Response (202 — processing):**
```json
{
  "job_id": "abc-123",
  "status": "processing"
}
```

**Response (401):**
```json
{
  "error": "invalid_api_key",
  "message": "API key is missing or invalid"
}
```

**Phase 1 behaviour**: Always returns mock data (no scraping yet). Cache lookup is stubbed. Auth checks the `x-api-key` header against the `api_keys` table (on first run, no keys exist — seed one).

### Input Validation (Zod)

```typescript
const enrichRequest = z.object({
  email: z.string().email().optional(),
  domain: z.string().optional(),
}).refine(data => data.email || data.domain, {
  message: "Either email or domain is required"
});
```

### Auth

```
Header: x-api-key: lp_live_xxxxxxxxxxxx
```

Validate by:
1. Hash the key (`sha256`)
2. Lookup `api_keys` by `key_hash`
3. Check `active` and `monthly_limit > usage_count`
4. Increment `usage_count` on success
5. Reject with 401 if not found or inactive

Seed a test key on first DB setup:
```
Key: lp_live_testkey123
```

## Core Package (Mock)

`packages/core/src/enrich.ts` exports:

```typescript
export interface EnrichRequest {
  email?: string;
  domain?: string;
}

export interface EnrichResult {
  email: string;
  domain: string;
  name: string | null;
  title: string | null;
  company: string | null;
  company_size: string | null;
  industry: string | null;
  location: string | null;
  social: {
    linkedin: string | null;
    github: string | null;
    twitter: string | null;
  };
  confidence: number;
  cached: boolean;
  cached_at: string | null;
}

export function enrich(req: EnrichRequest): EnrichResult {
  // Phase 1: return mock data
  // Phase 2+: dispatch to scraper workers
  return { ...mockData };
}
```

Types live in `packages/core/src/types.ts` and are exported from `packages/core/src/index.ts`.

## Landing Page

Next.js App Router, Tailwind v4, one page.

### Sections

**Hero:**
- Headline: "Email enrichment. No lock-in."
- Subhead: "Open-source lead enrichment API. Works with any CRM. Self-host or use our cloud."
- CTA: "Get your API key" (opens email signup form)
- Secondary CTA: "Star on GitHub →" (opens repo)

**Interactive Demo Box:**
```
┌─────────────────────────────────────────────┐
│  Try it out                                 │
│                                             │
│  [email]  john@acme.com            [Enrich →] │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │ {                                   │    │
│  │   "name": "John Smith",             │    │
│  │   "title": "VP Engineering",        │    │
│  │   "company": "Acme Inc",            │    │
│  │   ...                               │    │
│  │ }                                   │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

Calls `POST /api/v1/enrich` with the entered email. Shows the JSON result. On error, shows a friendly message.

**Pricing (announcement only, no Stripe yet):**
- Free: 50/mo
- Starter: 1K/mo — $19
- Pro: 5K/mo — $79
- Business: 25K/mo — $299

**Footer:**
- GitHub link
- "Built in public" (Indie Hackers link)
- MIT license note

### Design

- Dark theme (matching the architecture diagrams)
- Clean, minimal — single column, generous whitespace
- No framework CSS — just Tailwind v4
- No images/illustrations — pure text + code blocks

## Configuration

`.env` (not committed, `.gitignore`d):

```
DATABASE_URL=postgres://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb
SELF_HOST=false
```

## Seed Script

`scripts/seed.ts` — run on first deploy:

```typescript
import { db } from "../apps/web/lib/db";

await db.execute(`
  INSERT INTO api_keys (key_hash, name, tier, monthly_limit)
  VALUES (
    encode(sha256('lp_live_testkey123'::bytea), 'hex'),
    'dev key',
    'free',
    50
  )
  ON CONFLICT (key_hash) DO NOTHING;
`);
```

## What We're NOT Building in Phase 1

- No real worker process
- No real scraping
- No Stripe billing
- No batch endpoint
- No webhooks
- No LinkedIn/GitHub/BuiltWith scrapers
- No cache TTL cleanup job
- No API docs page (beyond the demo box, curl examples in README)

These are Phase 2+.

## Verification Gates

Before merging Phase 1:

- [ ] `bun install` completes without errors
- [ ] `bun run dev` starts Next.js dev server
- [ ] `curl -X POST localhost:3000/api/v1/enrich -H 'x-api-key: lp_live_testkey123' -d '{"email":"test@example.com"}'` returns mock JSON
- [ ] No API key → 401
- [ ] Landing page renders at `localhost:3000`
- [ ] Interactive demo box works (type email, see result)
- [ ] `bun test` passes (at least one test)
- [ ] `bun run lint` passes
- [ ] No hardcoded secrets in committed code
