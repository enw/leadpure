## Summary

Add a lightweight **RDAP** (Registration Data Access Protocol) source for domain registration metadata: registrar, creation date, nameservers, and registrant org **when not redacted**.

Useful for confidence signals and sparse company hints — not a full Crunchbase replacement.

## Legal / compliance (required)

- **Protocol**: Prefer RDAP over legacy WHOIS port-43 scraping; query appropriate **registry RDAP server** for the TLD (bootstrap from [IANA RDAP bootstrap](https://data.iana.org/rdap/dns.json) or follow redirects per RFC 7484).
- **ICANN / registry policies**: Registrant data is often **redacted** (GDPR/WHOIS privacy). Never invent org names; return only fields present in RDAP JSON.
- **Rate limits**: Respect registry limits; single lookup per enrichment; cache 30 days with other sources.
- **No bulk**: One domain per enrichment request path only.
- **Self-host option**: Document that operators may use their own RDAP resolver; avoid depending on third-party WHOIS APIs with restrictive ToS unless explicitly licensed.

## Implementation sketch

### New module

`apps/worker/src/scrapers/rdap.ts`

```ts
export interface RdapData {
  domain: string;
  registrar: string | null;
  created: string | null;      // ISO date
  expires: string | null;
  nameservers: string[];
  registrant_org: string | null;  // only if vcard org present
  status: string[];
  registry_url: string;        // RDAP self link for provenance
}
```

### Flow

1. Determine RDAP base URL for TLD (cache bootstrap JSON).
2. `GET {base}/domain/{domain}` with LeadPure User-Agent.
3. Parse JSON: `entities[]` with `vcardArray` for registrant/admin; `events` for registration.
4. Return `null` on NXDOMAIN / HTTP errors.

### Aggregator (minimal)

- Do **not** set `company` from registrant unless high-confidence org string (non-redacted, matches domain brand).
- Optional: bump confidence slightly when domain has valid registration + age > N days.
- `source_meta.rdap`: true + registry link

## Acceptance criteria

- [ ] `stripe.com` returns registrar + dates (org may be null if redacted)
- [ ] Invalid domain returns `null`
- [ ] No synthetic company names from RDAP
- [ ] Tests with fixture RDAP JSON
- [ ] Legal notes in `docs/data-sources.md`

## Out of scope

- Historical WHOIS archives
- Paid WHOIS API vendors
