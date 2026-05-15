# LeadPure Agent Convention

## Project

Open-source email enrichment API. TypeScript (Bun/Next.js), cache-first PostgreSQL, no LLM.

## Tech Stack

- **Runtime**: Bun
- **Framework**: Next.js (App Router) — API routes + frontend
- **Workspace**: `packages/*` (core lib), `apps/*` (web, worker)
- **DB**: Neon PostgreSQL via `@neondatabase/serverless`
- **Validation**: Zod
- **Scraping**: cheerio (HTML parse), fetch (HTTP), GitHub REST API
- **Tests**: bun test

## Workflow

- **Current phase**: Phase 4 (Signup & Landing) on `phase-4-signup-landing` branch
- Trunk-based: `main` branch. Feature branches per phase.
- Each phase: spec → branch → implement → PR → user validates → merge
- PRs via `gh` CLI
- Run `bun run dev` from root to start Next.js dev server
- `NODE_ENV=development` must be set for Next.js dev mode (CSS parsing)

## Package Structure

| Package | Path | Purpose |
|---|---|---|
| `@leadpure/core` | `packages/core/` | Types + enrichment engine |
| `@leadpure/web` | `apps/web/` | Next.js app (API + landing page) |
| `@leadpure/worker` | `apps/worker/` | Scraping workers |

## Code Standards

- No LLM/AI in production code
- Validate at boundaries (input, API responses)
- No abstractions for one-off operations
- Delete unused code completely
- Minimum code that solves the problem
