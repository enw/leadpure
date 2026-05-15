# Phase 3: PostgreSQL Integration

Wire the enrichment pipeline to PostgreSQL: cache check before scrape, cache write after, async job polling, API key DB validation, rate limiting, confidence fix.

At the end of this phase, repeated calls for the same email return in <50ms (cache hit), the `GET /api/v1/jobs/:id` endpoint works for polling, and rate limiting protects the free tier.

---

## Architecture Changes

```
POST /api/v1/enrich
  → validate API key (DB or dev key)
  → check rate limit (sliding window)
  → check enrichments cache (PG): hit → return <50ms
  → miss → create job → run worker → write cache → return

GET /api/v1/jobs/:id
  → returns job status + result if completed

Worker (unchanged — still runs in-process)
  → scrapers + aggregator (same as Phase 2)
  → no DB awareness (API route handles cache)
```

### Key Design Choices

- **Cache operations in API route, not worker** — simpler. Worker just scrapes + aggregates.
- **In-memory rate limiting** — simple Map of {key_hash → [{timestamp}]} with periodic cleanup. No Redis needed for MVP.
- **Graceful fallback** — all DB-dependent features skip when `DATABASE_URL` is not set. Dev mode works without a database.
- **Confidence fix** — mock Crunchbase adds `_isMock: true` flag. Aggregator excludes mock sources from confidence count.

## Files to Create/Modify

### 1. Confidence fix (worker)

**Modify: `apps/worker/src/scrapers/crunchbase.ts`**

Add `_isMock: true` to the returned object:
```typescript
export interface CrunchbaseData {
  name: string;
  industry: string;
  location: string;
  description: string;
  funding: string;
  _isMock: true; // always true in MVP
}
```

**Modify: `apps/worker/src/aggregator.ts`**

Change `calculateConfidence` to exclude mock sources:
```typescript
function calculateConfidence(source: AggregateSources): number {
  let sources = 0;
  if (source.crunchbase && !('_isMock' in source.crunchbase)) sources++;
  if (source.github) sources++;
  if (source.website) sources++;
  return Math.min(0.3 + sources * 0.25, 1.0);
}
```

### 2. Database migration

**Create: `scripts/migrate.ts`**

Run via `bun run migrate`. Creates the three tables if they don't exist:

```typescript
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) {
  console.log('DATABASE_URL not set — skipping migration');
  process.exit(0);
}

const sql = neon(url);

await sql`
  CREATE TABLE IF NOT EXISTS api_keys (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_hash      TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL DEFAULT '',
    tier          TEXT NOT NULL DEFAULT 'free',
    usage_count   INTEGER NOT NULL DEFAULT 0,
    monthly_limit INTEGER NOT NULL DEFAULT 50,
    active        BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

await sql`
  CREATE TABLE IF NOT EXISTS enrichments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    input_hash    TEXT NOT NULL,
    input_type    TEXT NOT NULL,
    result        JSONB NOT NULL,
    confidence    REAL NOT NULL DEFAULT 0,
    source_meta   JSONB NOT NULL DEFAULT '{}',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at    TIMESTAMPTZ NOT NULL DEFAULT now() + interval '30 days'
  );
`;

await sql`
  CREATE INDEX IF NOT EXISTS idx_enrichments_input_hash ON enrichments(input_hash);
`;
await sql`
  CREATE INDEX IF NOT EXISTS idx_enrichments_expires_at ON enrichments(expires_at);
`;

await sql`
  CREATE TABLE IF NOT EXISTS usage_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id  UUID REFERENCES api_keys(id),
    endpoint    TEXT NOT NULL,
    input_hash  TEXT,
    cache_hit   BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

// Seed dev key
const devKeyHash = crypto.createHash('sha256').update('lp_live_testkey123').digest('hex');
await sql`
  INSERT INTO api_keys (key_hash, name, tier, monthly_limit)
  VALUES (${devKeyHash}, 'dev key', 'free', 50)
  ON CONFLICT (key_hash) DO NOTHING;
`;

console.log('Migration complete.');
```

### 3. Cache helpers

**Modify: `apps/web/lib/db.ts`**

Add cache lookup and write helpers:

```typescript
import { neon } from '@neondatabase/serverless';
import { createHash } from 'crypto';

const url = process.env.DATABASE_URL;
export const db = url ? neon(url) : null;

export function hashInput(input: string): string {
  return createHash('sha256').update(input.toLowerCase().trim()).digest('hex');
}

export async function getCachedEnrichment(email?: string, domain?: string) {
  if (!db) return null;
  const input = email || domain || '';
  const inputHash = hashInput(input);
  const inputType = email ? 'email' : 'domain';
  
  const rows = await db`
    SELECT result, confidence, source_meta, created_at
    FROM enrichments
    WHERE input_hash = ${inputHash}
      AND input_type = ${inputType}
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1
  `;
  
  if (rows.length === 0) return null;
  const row = rows[0] as Record<string, unknown>;
  return {
    result: row.result,
    confidence: row.confidence as number,
    source_meta: row.source_meta,
    cached_at: row.created_at,
  };
}

export async function writeEnrichment(
  email: string | undefined,
  domain: string | undefined,
  result: Record<string, unknown>,
  confidence: number,
) {
  if (!db) return;
  const input = email || domain || '';
  const inputHash = hashInput(input);
  const inputType = email ? 'email' : 'domain';
  
  // Upsert: update if same input_hash exists, otherwise insert
  const existing = await db`
    SELECT id FROM enrichments WHERE input_hash = ${inputHash} AND input_type = ${inputType}
  `;
  
  if (existing.length > 0) {
    await db`
      UPDATE enrichments
      SET result = ${JSON.stringify(result)}::jsonb,
          confidence = ${confidence},
          source_meta = ${JSON.stringify({ sources: ['github', 'website', 'crunchbase'] })}::jsonb,
          created_at = now(),
          expires_at = now() + interval '30 days'
      WHERE input_hash = ${inputHash} AND input_type = ${inputType}
    `;
  } else {
    await db`
      INSERT INTO enrichments (input_hash, input_type, result, confidence, source_meta)
      VALUES (
        ${inputHash},
        ${inputType},
        ${JSON.stringify(result)}::jsonb,
        ${confidence},
        ${JSON.stringify({ sources: ['github', 'website', 'crunchbase'] })}::jsonb
      )
    `;
  }
}

export async function logUsage(
  apiKeyId: string,
  endpoint: string,
  inputHash: string | null,
  cacheHit: boolean,
) {
  if (!db) return;
  await db`
    INSERT INTO usage_log (api_key_id, endpoint, input_hash, cache_hit)
    VALUES (${apiKeyId}, ${endpoint}, ${inputHash}, ${cacheHit})
  `;
}
```

Note: Use `db(...)` tagged template style only if neon supports it. If not, use `db.query(...)` or the function-call syntax from Phase 1.

### 4. Rate limiter

**Create: `apps/web/lib/rate-limit.ts`**

Simple in-memory sliding window:

```typescript
interface WindowEntry {
  timestamps: number[];
}

const windows = new Map<string, WindowEntry>();

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 100; // free tier

// Clean up stale entries every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [key, entry] of windows) {
    entry.timestamps = entry.timestamps.filter(t => t > cutoff);
    if (entry.timestamps.length === 0) windows.delete(key);
  }
}, 300_000).unref();

export function checkRateLimit(keyId: string): boolean {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  
  let entry = windows.get(keyId);
  if (!entry) {
    entry = { timestamps: [] };
    windows.set(keyId, entry);
  }
  
  // Remove expired timestamps
  entry.timestamps = entry.timestamps.filter(t => t > cutoff);
  
  if (entry.timestamps.length >= MAX_REQUESTS) {
    return false; // rate limited
  }
  
  entry.timestamps.push(now);
  return true;
}
```

### 5. Job polling endpoint

**Create: `apps/web/app/api/v1/jobs/[id]/route.ts`**

GET handler:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getJob } from '@leadpure/worker';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const job = getJob(params.id);
  if (!job) {
    return NextResponse.json({ error: 'job_not_found', message: 'Job not found' }, { status: 404 });
  }
  
  return NextResponse.json({
    job_id: job.id,
    status: job.status,
    result: job.result ?? null,
    error: job.error ?? null,
    created_at: job.created_at,
    completed_at: job.completed_at ?? null,
  });
}
```

Note: In Next.js App Router with newer versions, the params handling may need to be `const { id } = await params` — check the version.

### 6. Wire it all up

**Modify: `apps/web/app/api/v1/enrich/route.ts`**

Add cache check + rate limit + cache write:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateApiKey } from '@/lib/auth';
import { createJob, runJob, getJob } from '@leadpure/worker';
import { getCachedEnrichment, writeEnrichment, hashInput } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';

const schema = /* same as Phase 2 */;

export async function POST(req: NextRequest) {
  // Auth
  const key = await validateApiKey(req.headers.get('x-api-key'));
  if (!key || !key.active) {
    return NextResponse.json(/* 401 */);
  }

  // Parse body
  let parsed;
  try {
    const body = await req.json();
    parsed = schema.parse(body);
  } catch (err) {
    /* same validation error handling */
  }

  // Rate limit (skip if no DB — dev mode)
  if (process.env.DATABASE_URL) {
    if (!checkRateLimit(key.id)) {
      return NextResponse.json(
        { error: 'rate_limited', message: 'Too many requests. 100/min limit.' },
        { status: 429 },
      );
    }
  }

  // Cache check
  const cached = await getCachedEnrichment(parsed.email, parsed.domain);
  if (cached) {
    return NextResponse.json({
      ...cached.result as Record<string, unknown>,
      cached: true,
      cached_at: cached.cached_at,
    }, { status: 200 });
  }

  // Miss — run worker
  const job = createJob(parsed);
  void runJob(job.id).catch(() => {});

  // Poll loop (10s)
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const current = getJob(job.id);
    if (!current) break;
    if (current.status === 'completed' && current.result) {
      // Write to cache (fire and forget)
      void writeEnrichment(parsed.email, parsed.domain, current.result as Record<string, unknown>, current.result.confidence);
      return NextResponse.json({ ...current.result, cached: false, cached_at: null }, { status: 200 });
    }
    if (current.status === 'failed') {
      return NextResponse.json({ error: 'enrichment_failed', message: current.error }, { status: 500 });
    }
    await new Promise(r => setTimeout(r, 500));
  }

  return NextResponse.json({ job_id: job.id, status: 'processing' }, { status: 202 });
}
```

### 7. Seed + migrate scripts

**Update root `package.json`** — add scripts:

```json
"scripts": {
  "migrate": "bun run scripts/migrate.ts",
  ...
}
```

## Verification Gates

Before merging Phase 3:

- [ ] `bun run migrate` creates tables (with DATABASE_URL set) or exits gracefully (without)
- [ ] Confidence no longer inflated by mock Crunchbase (confidence = 0.55 with only GitHub + website)
- [ ] Cache check returns cached result on repeated request (with DB)
- [ ] Cache miss → scrape → write → subsequent hit returns <50ms (with DB)
- [ ] `GET /api/v1/jobs/test-job-id` returns job status (404 for unknown, 200 with result for known)
- [ ] Rate limit 100+1st request returns 429 (with DB)
- [ ] Without DATABASE_URL, everything works same as Phase 2 (graceful fallback)
- [ ] `bun test` passes (all existing unit + smoke tests still work)
- [ ] All worker tests pass

## Unresolved Questions

- Should the worker persist jobs to DB too, or keep in-memory? In-memory is fine for MVP — jobs are ephemeral (results go to cache after completion). Memory jobs die on server restart but the next request re-scrapes and re-caches.
- Neon's `sql` tagged template syntax — need to confirm whether `db` (neon client) supports tagged templates or function-call syntax. The Phase 1 `auth.ts` uses `db('SELECT ...', [params])` which is the function-call style.
