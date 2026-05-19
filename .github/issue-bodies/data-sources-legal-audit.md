## Summary

Create and maintain a **Data Sources Legal & Compliance** section in the repo so all enrichment sources (existing and planned) are usable for MIT OSS core + hosted API without ToS violations.

## Deliverables

### 1. `docs/data-sources-legal.md` (new)

For each source, document:

| Source | Allowed use | License / ToS | Attribution required | Rate limits | Redistribution (hosted API) |
|--------|-------------|---------------|----------------------|-------------|------------------------------|
| Website (first-party fetch) | robots.txt respect | Site ToS varies | N/A | Self-imposed | OK — public page metadata |
| GitHub API | API only | GitHub ToS | Recommended | 5k/hr with token | Per GitHub terms |
| Wikidata SPARQL | Query Service | CC0 (+ exceptions) | Yes (link Q-id) | Query Service fair use | Generally OK for facts |
| SEC EDGAR | data.sec.gov | Public domain US gov | Credit SEC | 10 rps | OK |
| RDAP | Registry servers | Registry policy | Registry URL | Per TLD | OK for non-redacted fields |
| Mock Crunchbase | **Remove** | N/A | — | — | **Not OK** |

### 2. Runtime guardrails

- [ ] Central `SCRAPER_USER_AGENT` with contact email from env `LEADPURE_CONTACT_EMAIL`
- [ ] `robots.txt` check optional flag before website secondary paths (`/about`, `/team`) — default **respect disallow**
- [ ] `source_meta` schema: `{ sources: string[], provenance?: Record<string, string> }`

### 3. README disclaimer

Short note: enrichment uses publicly available data; customers responsible for compliance with anti-spam / privacy laws (CAN-SPAM, GDPR) when using enriched data.

## Acceptance criteria

- [ ] Doc reviewed against current scrapers in `apps/worker/src/scrapers/`
- [ ] No source listed as "Crunchbase" unless real API licensed
- [ ] Self-host `.env.example` documents required contact email + tokens
- [ ] Linked from `docs/data-sources.md`

## Notes

This is a **documentation + light code** issue; individual source issues implement per-source compliance.
