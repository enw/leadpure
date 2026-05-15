# MVP Plan

## Scope

Build the minimum viable LeadPure: a working enrichment API + landing page that demonstrates value and gets first users. Target: ship in one focused sprint.

## Must Have (MVP)

- [ ] Single enrichment endpoint (`POST /v1/enrich` with `{email}` or `{domain}`)
- [ ] Cache-first PostgreSQL backend (30-day TTL)
- [ ] At least 3 data sources live (Crunchbase, GitHub, website parse)
- [ ] API key auth (generate key on signup)
- [ ] Landing page with value prop + interactive demo
- [ ] Deployed and reachable at a public URL
- [ ] Open-source repo with MIT license

## Nice to Have (Post-MVP)

- [ ] Batch enrichment endpoint
- [ ] Stripe billing (free tier + paid tiers)
- [ ] LinkedIn scraping (most complex — ratelimiting, anti-bot)
- [ ] BuiltWith/tech stack detection
- [ ] Webhook notification on enrichment completion
- [ ] TUI client (Hermes skill)
- [ ] API docs page with curl examples
- [ ] Self-host `docker-compose.yml`

## Sprint Tasks

### Phase 1: Foundation (Day 1) ✅

- [x] Scaffold Bun workspace (`leadpure/packages/core`, `leadpure/apps/api`, `leadpure/apps/worker`)
- [x] Set up TypeScript config, Prettier
- [x] Create `POST /v1/enrich` route (shell — returns mock data)
- [x] Landing page skeleton (Next.js App Router, hero + interactive demo)

### Phase 2: Scraping Engine (Day 2-3) ✅

- [x] **GitHub scraper**: search user by email/name, extract profile, repos, tech languages
- [x] **Website parser**: fetch URL, extract `<title>`, meta description, social links
- [x] **Crunchbase scraper**: mock data (real scrape blocked by anti-bot)
- [x] **Aggregator**: merge results, dedupe, compute confidence score
- [x] **Worker**: wire up in-process queue, process enrichments asynchronously
- [x] Tests: unit tests (15) + API smoke tests (16)

### Phase 3: Integration (Day 4) ✅

- [x] **DB migration + schema setup**: `api_keys`, `enrichments`, `usage_log` tables (Neon PostgreSQL)
- [x] **Cache check before scrape**: check `enrichments` table by input_hash, return if valid (30-day TTL)
- [x] **Cache write after scrape**: insert/update enrichment result to DB after worker completes
- [x] **`GET /api/v1/jobs/:id`**: async polling endpoint for enrichments that exceed 10s synchronous wait
- [x] **API key DB validation**: unify dev key with real DB-backed key lookup
- [x] **Seed script**: `bun run seed` to create tables + insert dev key
- [x] **Rate limiting**: in-memory sliding window (100 req/min free tier, disabled without DB)
- [x] **Confidence fix**: don't count mock Crunchbase as a real data source in confidence calc

**Lessons from Phase 2 affecting Phase 3:**
- Mock Crunchbase always returns data, inflating confidence. Fix: exclude mock sources from confidence.
- Worker uses in-memory job store. No persistence. With Postgres, jobs persist across restarts.
- DB runs via dev `DATABASE_URL`. Dev mode works without it (graceful fallback).
- Rate limit only active when DB is connected (prevents annoyance during dev).

### Phase 4: Landing Page & Signup (Day 5) ✅

- [x] Hero section: "Email enrichment. No lock-in. Open source."
- [x] Interactive demo box: type email → see enrichment result
- [x] Pricing section (announced, not yet functional Stripe)
- [x] GitHub star link
- [x] **API key generation endpoint** (`POST /api/v1/keys`): email → generated key, stored in DB
- [x] **"Get your API key" section**: email form on landing page → shows generated key once
- [x] **API docs page** (`/docs`): curl examples, response format, error codes
- [x] **Landing page polish**: responsive layout, better mobile, self-host CTA

### Phase 5: Polish & Deploy (Day 6) ✅

- [x] **`Dockerfile`**: multi-stage build for Next.js standalone
- [x] **`docker-compose.yml`**: API + PostgreSQL, migration on start
- [x] **`.env.example`**: all config vars documented
- [x] **`README.md`**: quick start, API docs, self-host, deploy to Vercel
- [x] **`next.config.ts`**: standalone output for Docker builds
- [ ] Post on Hacker News, Indie Hackers, r/SaaS (user does this)

## What Each Phase Unblocked Looks Like

**End of Phase 1**: `curl -X POST https://leadpure.dev/v1/enrich -d '{"email":"test@example.com"}'` returns mock data. Landing page exists.

**End of Phase 2**: `POST /v1/enrich` with a real email returns real data from Crunchbase + GitHub + website. ~2-5s on cold start.

**End of Phase 3**: Same endpoint, but repeated calls for the same email return in <50ms (cache hit). Jobs endpoint works for polling.

**End of Phase 4**: Landing page has working interactive demo. Users can sign up and get an API key.

**End of Phase 5**: Live at leadpure.dev. Self-hostable. Posted on HN/Reddit.

## Verification Gates

Before marking MVP done:
- [ ] `POST /v1/enrich` returns correct data for 3 test emails
- [ ] Cache hit returns in <100ms
- [ ] Cache miss scrapes and returns in <10s
- [ ] Landing page demo box works in Chrome, Firefox, Safari
- [ ] API key auth rejects unauthorized requests with 401
- [ ] `docker compose up` brings up a working self-host instance
- [ ] No hardcoded secrets in the repo
