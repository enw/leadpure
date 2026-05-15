# LeadPure

**Email enrichment. No lock-in. Open source.**

LeadPure is a standalone, API-first lead enrichment service. Feed it an email or company domain — get back structured data: name, title, company, tech stack, funding, social links.

Born from a simple observation: Clearbit got acquired by HubSpot and disappeared behind a walled garden. The middle market has no good standalone option.

- **Open-source core** (MIT) — self-host or use the hosted API
- **API-first** — works with any CRM, any automation tool
- **Pay-as-you-go** — no monthly credits expiring in 30 days
- **Zero LLM dependency** — pure scraping + aggregation (cheap, auditable, deterministic)

## Docs Index

| Doc | What |
|---|---|
| [decisions.md](decisions.md) | Architecture Decision Records |
| [architecture.md](architecture.md) | System architecture, data flow, stack |
| [mvp-plan.md](mvp-plan.md) | First sprint — what we build and in what order |
| [business-model.md](business-model.md) | Pricing, costs, marketing, revenue model |

## Quick Links

- **Live API** — (TBD)
- **GitHub** — (TBD)
- **Self-host** — `git clone ... && docker compose up`

## Constraints

- No LLM/ML in the enrichment pipeline
- Open-source core (MIT)
- Runs fully autonomously (cron-scheduled scraping, auto-billing, zero-touch)
- One language across the entire stack (TypeScript)
