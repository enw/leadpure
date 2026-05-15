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

### Phase 1: Foundation (Day 1)

- [ ] Scaffold Bun workspace (`leadpure/packages/core`, `leadpure/apps/api`, `leadpure/apps/worker`)
- [ ] Set up TypeScript config, ESLint, Prettier
- [ ] Set up Neon PostgreSQL (free tier) + initial schema
- [ ] Create `POST /v1/enrich` route (shell — returns mock data)
- [ ] Landing page skeleton (Next.js App Router, hero + interactive demo)

### Phase 2: Scraping Engine (Day 2-3)

- [ ] **Crunchbase scraper**: search company by domain, extract name, industry, funding, location
- [ ] **GitHub scraper**: search user by email/name, extract profile, repos, tech languages
- [ ] **Website parser**: fetch URL, extract `<title>`, meta description, blog feed, contact info
- [ ] **Aggregator**: merge results, dedupe, compute confidence score
- [ ] **Worker**: wire up in-process queue, process enrichments asynchronously

### Phase 3: Integration (Day 4)

- [ ] Wire API → Worker → PostgreSQL pipeline end-to-end
- [ ] Add cache check before scraping
- [ ] Add `GET /v1/jobs/:id` for polling
- [ ] API key generation + validation
- [ ] Rate limiting (100 req/min for free, higher for paid)

### Phase 4: Landing Page (Day 5)

- [ ] Hero section: "Email enrichment. No lock-in. Open source."
- [ ] Interactive demo box: type email → see enrichment result
- [ ] Pricing section (announced, not yet functional Stripe)
- [ ] "Get API Key" form (email → generated key shown once)
- [ ] GitHub star link + "Self-host" CTA

### Phase 5: Polish & Deploy (Day 6)

- [ ] `docker-compose.yml` for self-hosters
- [ ] Vercel deployment (API + frontend)
- [ ] fly.io deployment (worker)
- [ ] Domain setup (leadpure.dev or similar)
- [ ] `.env.example` with all config vars
- [ ] README with quick start, API docs, self-host instructions
- [ ] Post on Hacker News, Indie Hackers, r/SaaS

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
