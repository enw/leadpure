# LeadPure

> Email enrichment. No lock-in. Open source.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built with Bun](https://img.shields.io/badge/Built%20with-Bun-14161a?logo=bun)](https://bun.sh)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/enw/leadpure/pulls)

## Quick Start (local dev)

```bash
git clone https://github.com/enw/leadpure
cd leadpure
bun install
bun run dev
# Open http://localhost:3000
```

## API Usage

### Get an API key

```bash
curl -X POST https://leadpure.e10d.dev/api/v1/keys \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com"}'
```

Response:
```json
{ "api_key": "lp_live_xxx", "tier": "free", "monthly_limit": 50 }
```

### Enrich an email

```bash
curl -X POST https://leadpure.e10d.dev/api/v1/enrich \
  -H 'x-api-key: lp_live_xxx' \
  -H 'Content-Type: application/json' \
  -d '{"email":"john@acme.com"}'
```

Response includes: name, company, industry, location, social profiles, confidence score.

### Poll a job

```bash
curl https://leadpure.e10d.dev/api/v1/jobs/job_1234567890_1
```

### Rate limits

Free tier: 100 requests/minute. Returns 429 on exceed.

## Self-host with Docker

```bash
docker compose up
# Open http://localhost:3000
# Migration runs automatically on first start
```

## Deploy to Vercel

1. Push the repo to GitHub
2. Import at https://vercel.com/new
3. Set FRAMEWORK_PRESET: Next.js, Root Directory: apps/web
4. Add DATABASE_URL env var (get free one at https://neon.tech)
5. Deploy

The worker runs in-process with Next.js — no separate service needed.

## Project Structure

```
leadpure/
├── apps/
│   └── web/          # Next.js app (API routes + frontend)
├── packages/
│   └── core/         # Shared types
├── apps/
│   └── worker/       # Scraping workers (in-process)
├── scripts/          # DB migration
├── docs/             # Architecture docs
├── specs/            # Phase specs
└── test/             # Tests
```

## Development

```bash
bun test              # Unit tests
bun run test:smoke    # API smoke tests (needs dev server)
bun run migrate       # Run DB migration
```

## License

MIT
