## Summary

Add optional **SEC EDGAR** enrichment for **US public companies**: map domain → CIK (when possible) and fetch company metadata from `data.sec.gov` submissions API.

High value when it hits; expected miss rate is high for typical B2B SMB leads.

## Legal / compliance (required)

- **SEC Fair Access policy**: All requests must include a descriptive **`User-Agent` header** with company name and contact email (e.g. `LeadPure/1.0 (contact@example.com)`). See [SEC.gov developer guidance](https://www.sec.gov/os/webmaster-faq#developers).
- **Rate limit**: Max **10 requests/second** per IP; implement client-side throttle + backoff on 429/503.
- **Public filings only**: Use official `data.sec.gov` JSON endpoints; no scraping `sec.gov` HTML.
- **No misrepresentation**: Do not imply SEC endorsement; label fields as from public filings in `source_meta`.
- **Scope**: US issuers only; no fabricated data on miss.

## Implementation sketch

### New module

`apps/worker/src/scrapers/sec-edgar.ts`

```ts
export interface SecEdgarData {
  cik: string;
  name: string;
  tickers: string[];
  exchanges: string[];
  sic_description: string | null;
  state_of_incorporation: string | null;
  source_url: string;  // EDGAR browse URL
}
```

### Domain → CIK (heuristic chain)

1. Load/cache `https://www.sec.gov/files/company_tickers.json` (daily refresh in worker memory or file cache).
2. Match normalized company name from **website title** or **GitHub org name** against ticker `title` field (fuzzy, conservative — only accept high-confidence matches).
3. Optional later: maintain small domain→CIK override table for top domains.

### Fetch

- `GET https://data.sec.gov/submissions/CIK##########.json` (zero-pad CIK to 10 digits).

### Aggregator

- `industry` ← `sic_description`
- `location` ← state / business address from submissions when available
- `company` ← legal name when higher confidence than inferred domain name
- Confidence: count only when CIK resolved + 200 response

## Acceptance criteria

- [ ] Valid public company (e.g. `apple.com`) returns SEC-backed fields when CIK resolves
- [ ] Random SMB domain returns `null` without error
- [ ] User-Agent includes contact per SEC policy
- [ ] Rate limiter prevents burst > 10 rps
- [ ] Tests use fixture JSON (no live SEC in CI)
- [ ] Documented in `docs/data-sources.md`

## Out of scope

- Private companies
- Parsing full 10-K text
- Financial metrics in MVP (submissions metadata only)
