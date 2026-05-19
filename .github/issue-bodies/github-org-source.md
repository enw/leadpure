## Summary

Extend the existing GitHub scraper with an **organization** path: find a GitHub org whose profile `blog` / `email` / `description` matches the email domain, and merge org-level company fields (name, location, description) into enrichment.

Complements user-by-email search; improves company-level data for tech domains.

## Legal / compliance (required)

- **GitHub ToS & API policies**: Use only the [documented REST API](https://docs.github.com/en/rest); authenticate with `GITHUB_TOKEN` env var (required for production rate limits).
- **Identification**: Set `User-Agent` to identify LeadPure + contact (already partially done); include in self-host docs.
- **Public data only**: Do not use scraped HTML of github.com outside the API.
- **Rate limits**: Respect search (30/min authed) and core limits; fail gracefully to `null`.
- **Redistribution**: GitHub API data may be used per their terms for displaying enriched profiles; document that hosted API returns GitHub-derived fields with attribution in `source_meta`.

## Implementation sketch

### Extend `apps/worker/src/scrapers/github.ts`

New export or internal path: `scrapeGithubOrg(domain: string): Promise<GithubOrgData | null>`

Strategies (in order):

1. `GET /search/users?q={domain}+in:blog&type=org` (or `type:org` qualifier per API docs)
2. Fallback: search orgs where company/description mentions domain
3. `GET /orgs/{login}` for full profile

```ts
export interface GithubOrgData {
  login: string;
  name: string | null;
  description: string | null;
  location: string | null;
  blog: string | null;
  public_repos: number;
}
```

### Merge with existing user scraper

- Run user + org lookups in parallel inside `scrapeGithub` OR separate settled promise in `runJob`.
- Aggregator: `company` ← user.company ?? org.name; `name` stays person-first (user.name).

### Env

- Document `GITHUB_TOKEN` in README / `.env.example` (required for prod, optional in dev).

## Acceptance criteria

- [ ] Known org domain (e.g. `github.com`, `vercel.com`) returns org profile fields
- [ ] Unknown domain returns `null` for org path without failing user path
- [ ] Uses `GITHUB_TOKEN` when set
- [ ] Tests with mocked fetch fixtures
- [ ] `docs/data-sources.md` notes ToS + token requirement

## Out of scope

- Private org data
- GitHub Enterprise
