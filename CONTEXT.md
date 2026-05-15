# LeadPure Domain Glossary

Domain language, canonical field definitions, and classification taxonomy for the lead enrichment domain.

## Core Concepts

| Term | Definition |
|---|---|
| **Lead enrichment** | Process of appending structured data (name, company, industry, etc.) to an email address or domain |
| **Enrichment request** | Input to the API: an email and/or domain to look up |
| **Enrichment result** | Output from the API: structured data merged from one or more sources |
| **Cache hit** | Result served from PostgreSQL cache (fast, <50ms) |
| **Cache miss** | No cached result — must scrape sources (slow, 2-10s) |
| **Confidence score** | Float 0.0–1.0 indicating how reliable the aggregated data is |
| **Scraping source** | An external website or API that provides enrichment data |
| **Job** | An in-progress enrichment being processed by the worker |

## Canonical Enrichment Fields

Defined in `packages/core/src/index.ts` (`EnrichResult` interface):

| Field | Type | Nullable | Source | Description |
|---|---|---|---|---|
| `email` | string | no | Request | Canonical email for the enrichment |
| `domain` | string | no | Extracted from email | Domain extracted from email, or provided directly |
| `name` | string | yes | GitHub, Crunchbase | Person's full name |
| `title` | string | yes | LinkedIn (future) | Job title |
| `company` | string | yes | GitHub, Crunchbase, domain inference | Company name (inferred from domain if no source matches) |
| `company_size` | string | yes | Crunchbase | Company size range e.g. "50-200" |
| `industry` | string | yes | Crunchbase, website keywords | Industry classification |
| `location` | string | yes | GitHub, Crunchbase | Geographic location |
| `social.linkedin` | string | yes | Domain inference, website | LinkedIn profile/company URL |
| `social.github` | string | yes | GitHub API, website | GitHub profile URL |
| `social.twitter` | string | yes | Website | Twitter/X profile URL |
| `confidence` | number | no | Computed by aggregator | Confidence score from 0.0 to 1.0 |
| `cached` | boolean | no | System | Whether this result came from cache |
| `cached_at` | string | yes | System | ISO timestamp of when result was cached |

## Confidence Score Classification

| Range | Meaning | Typical Use |
|---|---|---|
| 0.0–0.3 | Low | Few/no sources returned data. Use with caution. |
| 0.3–0.55 | Medium | One reliable source matched (e.g. GitHub only). Useful for casual queries. |
| 0.55–0.80 | High | Two sources corroborated. Reliable for CRM enrichment. |
| 0.80–1.0 | Very High | Three+ sources agree. Production-grade enrichment. |

Computed as: `0.3 + 0.25 × sources_with_data`, capped at 1.0.

## Scraping Source Types

| Source | Type | Authentication | Rate Limit | Reliability |
|---|---|---|---|---|
| Crunchbase | Web scrape (mock for MVP) | None | Unknown — aggressive | Low (blocks headless browsers) |
| GitHub | REST API | None (60/hr) or token (5,000/hr) | 60/hr unauthenticated | High |
| Website | HTTP GET + cheerio | None | 1 req/s courtesy | High |

## Domain Inference Rules

When no source provides a company name, derive it from the domain:

```
acme.com → "Acme"
acme-corp.co.uk → "Acme Corp"
```

Capitalize first letter of each segment. Strip TLD (.com, .org, .co.uk). Strip "www." prefix.

## API Response Status Codes

| Status | Meaning |
|---|---|
| 200 | Enrichment complete — result body included |
| 202 | Enrichment processing — return `{ job_id, status: "processing" }` |
| 400 | Validation error — invalid email or missing email/domain |
| 401 | Missing or invalid API key |

## API Key Format

`lp_live_xxxxxxxxxxxx` — Bearer token via `x-api-key` header.
Dev key (no DB required): `lp_live_testkey123`.

## Cache Policy

- TTL: 30 days for company/demographic data
- Cache key: SHA-256 of the normalized email or domain
- Cache hit: return immediately without scraping
- Cache miss: scrape → write → return

## Environment Modes

| Mode | Env Var | Behavior |
|---|---|---|
| Development | `NODE_ENV=development` | Next.js dev server. CSS works. DB optional. |
| Production (hosted) | `SELF_HOST=false` | Full API key auth, rate limiting, Stripe billing |
| Self-host | `SELF_HOST=true` | No Stripe, unlimited API key, no rate limit |
