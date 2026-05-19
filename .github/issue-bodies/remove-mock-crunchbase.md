## Summary

**Remove or strictly gate mock Crunchbase** data. The current `scrapeCrunchbase` fabricates industry, location, and funding from the domain string, which:

- Misleads API consumers (false confidence in company attributes)
- Conflicts with ADR-003 (auditable, source-traceable results)
- Creates legal/reputation risk if presented as enriched facts

## Legal / compliance (required)

- **Truth in output**: API responses must not imply third-party verification when data is derived/heuristic.
- **Source disclosure**: Every populated field should map to a real source in `source_meta` (or be explicitly labeled `inferred` if we keep domain-based company name fallback).
- **No fake Crunchbase**: Do not label mock data as Crunchbase in `source_meta` or docs.

## Proposed approach

### Option A (recommended): Delete mock

- `scrapeCrunchbase` returns `null` always until a **licensed** Crunchbase API integration exists.
- Remove `_isMock` hack; remove crunchbase from default `source_meta` on cache write unless real.
- Aggregator: `company` fallback = website title / GitHub / domain tokenization (existing), clearly lower confidence.

### Option B: Rename to `domain-inference` source

- Move heuristic to `scrapers/domain-inference.ts` with `_inferred: true`.
- Never count toward confidence as a full source; optional `inferred_company` field in result (breaking API — needs version bump).

## Acceptance criteria

- [ ] No fabricated industry/location/funding presented as sourced enrichment
- [ ] `source_meta` reflects only sources that actually returned data
- [ ] Unit tests updated (remove mock-CB confidence cases or replace)
- [ ] `docs/mvp-plan.md` and `docs/data-sources.md` updated
- [ ] Cache rows written without false `crunchbase` attribution

## Depends on

- Website parse improvements (issue: parent epic / separate PR) so cold misses still return useful data

## Out of scope

- Paid Crunchbase API (separate future issue if licensed)
