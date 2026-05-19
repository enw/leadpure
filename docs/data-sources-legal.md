# Data Sources — Legal & Compliance

LeadPure enriches leads using **publicly available** data only. This document summarizes allowed use, attribution, and operational guardrails per source.

## Operational defaults

| Setting | Purpose |
|---------|---------|
| `LEADPURE_CONTACT_EMAIL` | Included in HTTP `User-Agent` (SEC, websites, RDAP) |
| `GITHUB_TOKEN` | Recommended for production GitHub API rate limits |

## Sources

### Website (first-party HTTP)

| Item | Detail |
|------|--------|
| **Data** | HTML metadata, JSON-LD `Organization`, Open Graph, public `/about`-style pages |
| **Legal** | Respect `robots.txt` for secondary paths; identify bot via User-Agent; no login/paywall bypass |
| **Rate** | Max 2 secondary fetches per domain per enrichment; 8s timeout |
| **Redistribution** | Metadata extracted from public pages; customer responsible for outreach compliance (CAN-SPAM, GDPR) |

### GitHub REST API

| Item | Detail |
|------|--------|
| **Data** | Public user/org profiles, repos |
| **Legal** | [GitHub Terms](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service) — API only, no HTML scraping |
| **Rate** | Use `GITHUB_TOKEN`; honor search/core limits |
| **Attribution** | `source_meta` includes `github` |

### Crunchbase

| Item | Detail |
|------|--------|
| **Status** | **Disabled** until licensed Crunchbase Data API |
| **Legal** | Do not scrape crunchbase.com or return fabricated “Crunchbase” fields |

### Planned (see GitHub issues)

- **Wikidata** — CC0; link to Q-id in provenance
- **SEC EDGAR** — US government public data; User-Agent + 10 rps
- **RDAP** — Registry policies; no invented registrant org when redacted

## API honesty

- `confidence` reflects count of **real** sources only
- `source_meta.sources` lists sources that actually contributed
- No field is labeled as third-party verified unless that source returned data

## Disclaimer (hosted API)

Enrichment output is informational. Customers must comply with applicable privacy and marketing laws when using enriched data for outreach.
