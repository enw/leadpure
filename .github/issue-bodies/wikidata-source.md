## Summary

Add a **Wikidata** company lookup source: given a domain, query the Wikidata SPARQL endpoint for entities with official website (P856) matching that domain, and map structured fields into enrichment results.

Replaces part of what mock Crunchbase pretends to provide (industry, HQ, legal name) for entities that exist in Wikidata.

## Legal / compliance (required)

- **License**: Wikidata content is generally **[CC0](https://www.wikidata.org/wiki/Wikidata:Copyright)** for structured data; some properties may have stricter terms — document attribution in `docs/data-sources.md` and API `source_meta` (e.g. `wikidata` + entity Q-id URL).
- **API ToS**: Use the [public Query Service](https://query.wikidata.org/) respectfully; follow [Wikidata:Data access](https://www.wikidata.org/wiki/Wikidata:Data_access) (no heavy bulk scraping; reasonable timeouts; identify bot in User-Agent).
- **No circumvention**: Do not bypass query limits or mirror full dumps in our DB beyond normal 30-day enrichment cache of *per-request* results.
- **Provenance**: Store `wikidata_id` (Q-number) on internal source payload; expose in `source_meta` for auditability (ADR-003).

## Implementation sketch

### New module

`apps/worker/src/scrapers/wikidata.ts`

```ts
export interface WikidataOrgData {
  wikidata_id: string;       // e.g. "Q95"
  name: string | null;
  industry: string | null;   // P452 label
  location: string | null;     // HQ P159 label
  description: string | null;
  source_url: string;        // https://www.wikidata.org/wiki/Q95
}
```

### SPARQL (domain → entity)

- Normalize domain (strip `www.`, lowercase).
- Match P856 as URI: `https://domain`, `https://www.domain`, `http://…` (UNION).
- Optional: restrict to subclasses of organization (P31/P279*).
- Request `format=json` from `https://query.wikidata.org/sparql` with `Accept: application/sparql-results+json`.
- Timeout ≤ 5s; return `null` on miss (no fabrication).

### Worker wiring

- Add to `Promise.allSettled` in `apps/worker/src/index.ts` (parallel with github/website).
- Extend `AggregateSources` + `aggregator.ts`:
  - `company` / `name`: prefer GitHub > Wikidata > website title
  - `industry`: Wikidata > website keywords (drop mock CB industry when Wikidata hits)
  - `location`: GitHub > Wikidata
- Confidence: count Wikidata when `wikidata_id` present (real source).

### Tests

- Unit tests with mocked SPARQL JSON fixtures (stripe.com / example.com miss).
- No live network in CI.

## Acceptance criteria

- [ ] SPARQL lookup by domain returns org when P856 matches
- [ ] Miss returns `null` without throwing
- [ ] Aggregator uses Wikidata fields with correct priority
- [ ] `source_meta` / internal trace includes `wikidata` + Q-id
- [ ] `docs/data-sources.md` updated with license + rate-limit notes

## Out of scope

- Full Wikidata dump / offline mirror
- Person (P106) enrichment from Wikidata

## References

- [P856 official website](https://www.wikidata.org/wiki/Property:P856)
- [Query Service](https://query.wikidata.org/)
