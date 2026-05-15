# Phase 5: Polish & Deploy

Ship LeadPure: docker-compose for self-hosters, README for onboarding, deployment config, launch prep.

At the end of this phase, `docker compose up` brings up a working self-host instance, `README.md` has quick start + API docs, and the project is deployable to Vercel.

---

## Design Choices

- **Worker runs in-process with Next.js** — no separate fly.io service needed for MVP. Worker code is bundled into Next.js serverless functions. If load demands, extract to a separate process later.
- **Self-host uses Next.js standalone output** — `next build` produces a minimal `.next/standalone/` with just what's needed.
- **No Stripe in self-host mode** — `SELF_HOST=true` env var skips rate limits + billing. Unlimited API key provided.
- **Vercel deploy is the primary target** — `next build` + `vercel deploy`. No extra config needed beyond what's already there.

## Files to Create

### 1. `Dockerfile`

Multi-stage build for Next.js standalone output:

```dockerfile
# Stage 1: Install deps + build
FROM oven/bun:1 AS builder
WORKDIR /app

# Copy workspace manifests
COPY package.json bun.lock ./
COPY apps/web/package.json apps/web/package.json
COPY apps/web/tsconfig.json apps/web/tsconfig.json
COPY packages/core/package.json packages/core/package.json
COPY apps/worker/package.json apps/worker/package.json

# Install all deps
RUN bun install --frozen-lockfile

# Copy source
COPY tsconfig.base.json ./
COPY packages/core/ packages/core/
COPY apps/web/ apps/web/
COPY apps/worker/ apps/worker/
COPY scripts/ scripts/

# Build Next.js standalone
RUN cd apps/web && NODE_ENV=production bun run build

# Stage 2: Runtime
FROM oven/bun:1 AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV SELF_HOST=true

# Copy standalone build
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY scripts/ ./scripts/

EXPOSE 3000

CMD ["bun", "run", "apps/web/server.js"]
```

### 2. `docker-compose.yml`

```yaml
version: "3.8"

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: leadpure
      POSTGRES_PASSWORD: leadpure
      POSTGRES_DB: leadpure
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U leadpure"]
      interval: 5s
      timeout: 3s
      retries: 5

  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://leadpure:leadpure@db:5432/leadpure
      SELF_HOST: "true"
    depends_on:
      db:
        condition: service_healthy
    # Run migration on start, then start server
    command: >
      sh -c "bun run scripts/migrate.ts && bun run apps/web/server.js"

volumes:
  pgdata:
```

### 3. `.env.example`

```env
# Database
DATABASE_URL=postgres://user:password@host:5432/leadpure

# Mode
# SELF_HOST=true  — skip rate limits, billing, unlimited key
# SELF_HOST=false — full billing, rate limiting (default)
SELF_HOST=false

# Deployment
# Set to your Vercel deployment URL in production
# LEADPURE_URL=https://leadpure.dev
```

### 4. `README.md`

Write a comprehensive README covering:

**Header**: LeadPure logo/title, tagline "Email enrichment. No lock-in. Open source.", badges (MIT, built with Bun/Next.js)

**Quick Start (local dev)**:
```bash
git clone https://github.com/enw/leadpure
cd leadpure
bun install
bun run dev
# Open http://localhost:3000
```

**API Usage**:
- Getting an API key: `POST /api/v1/keys`
- Enrich an email: `POST /api/v1/enrich`
- Poll a job: `GET /api/v1/jobs/:id`
- Rate limits: 100 req/min free tier
- Include curl examples for each endpoint

**Self-host with Docker**:
```bash
docker compose up
# Open http://localhost:3000
```

**Deploy to Vercel**:
- Connect repo, set `FRAMEWORK_PRESET: nextjs`, `ROOT_DIRECTORY: apps/web`
- Set `DATABASE_URL` env var (Neon free tier)
- The worker (in-process) is bundled into the serverless function automatically

**Project Structure**:
- Brief overview of monorepo layout

**Development**:
- How to run tests: `bun test`, `bun run test:smoke`
- How to add a scraper
- How to run DB migration: `bun run migrate`

**License**: MIT

### 5. Update `apps/web/next.config.ts`

Add standalone output for Docker build:

```typescript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.DOCKER_BUILD ? 'standalone' : undefined,
};

export default nextConfig;
```

## Files to Modify

### `docs/mvp-plan.md`

Mark Phase 4 as done, Phase 5 as 🚧.

### `apps/web/package.json`

Add build script override for standalone if needed. The existing `next build` works — no change needed unless `output: 'standalone'` requires it.

## Verification Gates

Before merging Phase 5:

- [ ] `docker compose build` completes without errors
- [ ] `docker compose up` starts API + DB, migration runs
- [ ] `curl localhost:3000/api/v1/enrich` works against docker instance
- [ ] `curl localhost:3000/` landing page renders in docker
- [ ] `bun test` passes (all tests)
- [ ] `bun run --filter @leadpure/worker lint` passes
- [ ] README renders properly on GitHub (markdown preview)
- [ ] `.env.example` has all config vars documented
- [ ] No hardcoded secrets in docker-compose or README
