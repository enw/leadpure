# Data Sources

Each source is scraped in parallel. The aggregator merges results and computes a confidence score.

## MVP Sources

### 1. Crunchbase

| Field | Method | Risk |
|---|---|---|
| Company name | Search by domain via Crunchbase API (free tier) or scrape | Low — public API available |
| Industry | Company page | Low |
| Funding rounds | Company page | Low |
| HQ location | Company page | Low |
| Founded date | Company page | Low |
| Founders | Company page → People tab | Low-Moderate |

**Approach**: Use Crunchbase's public search API. If the domain is `acme.com`, search for "acme" and match by domain in results.

### 2. GitHub

| Field | Method | Risk |
|---|---|---|
| Name | Search user by email (commits) → profile | Low |
| Bio | User profile API (public) | Low |
| Location | User profile | Low |
| Company | User profile | Low |
| Tech languages | Public repos → language stats | Low |
| Website/Blog | User profile | Low |

**Approach**: `GET https://api.github.com/search/users?q=email:john@acme.com` then fetch user profile + repos. Unauthenticated rate limit is 60/hr — use a GitHub token (free) for 5,000/hr.

### 3. Website Parse

| Field | Method | Risk |
|---|---|---|
| Company name | `<title>`, `<meta name="og:site_name">` | Very Low |
| Description | `<meta name="description">` | Very Low |
| Industry | Heuristic from body text (keyword matching) | Low |
| Blog/RSS | Discover `<link rel="alternate" type="application/rss+xml">` | Very Low |
| Contact | `/about`, `/contact`, `/team` page scrape | Low |
| Tech stack | `<script>` sources, HTML class patterns | Low |

**Approach**: Simple HTTP GET (or headless if JS renders content), cheerio parse. No Playwright needed for most sites.

## Post-MVP Sources

### 4. LinkedIn (Public Profiles)

| Field | Method | Risk |
|---|---|---|
| Job title | Public profile | High |
| Company | Public profile | High |
| Location | Public profile | High |
| Education | Public profile | High |
| Skills | Public profile | High |

**Risk**: LinkedIn aggressively blocks scrapers. Requires residential proxies + careful throttling + headless browser fallback. May need to respect 5-10 req/min per proxy IP.

**Approach**: 
- MVP: skip LinkedIn entirely (we already get most of this from Crunchbase + GitHub)
- Post-MVP: Lukechats Puppeteer-based LinkedIn scraper or custom Playwright with rotating proxies
- Alternative: use Google's cache/preview of LinkedIn profiles

### 5. BuiltWith

| Field | Method | Risk |
|---|---|---|
| Web framework | Website scan | Low |
| Analytics | Website scan | Low |
| CDN/Hosting | Website scan | Low |
| JavaScript frameworks | Website scan | Low |

**Approach**: BuiltWith has a free lookup widget. Can scrape directly with a simple GET. Rate limit 50/day without account, 500/day with free account.

### 6. News/RSS

| Field | Method | Risk |
|---|---|---|
| Recent press | Google News RSS search: `acme.com` | Low |
| Product launches | TechCrunch, Product Hunt | Low |
| Hiring signals | Company careers page | Low |

## Scraping Tactics

| Tactic | When | Cost |
|---|---|---|
| Direct HTTP (httpx) | Static sites, public APIs (Crunchbase, GitHub, Google News) | Free |
| cheerio parse | HTML extraction from static responses | Free |
| Playwright headless | JS-rendered content (LinkedIn, some website pages) | ~$0.50/hr proxy |
| Residential proxy pool | Rate-limited targets (LinkedIn) | $25-30/mo |
| API key | Free-tier public APIs (GitHub) | Free (signup) |

## Confidence Score Heuristic

Simple rule-based score (0.0 - 1.0):

```
base = 0.5  # one source always grants some confidence
+0.15 per source that provides the same field
+0.10 if source matches verified email domain (domain = company domain)
-0.10 if sources disagree on a field
-0.05 per 30 days since source data was last fresh
clamped to [0.0, 1.0]
```

Future: expose per-field confidence so clients can set their own thresholds.

## Freshness

| Source | Staleness | Refresh |
|---|---|---|
| Crunchbase | Company data changes slowly | 30-day TTL |
| GitHub | Profile data changes slowly | 30-day TTL |
| Website | Content can change daily | 7-day TTL |
| LinkedIn | Role changes are high-value | 7-day TTL |
| BuiltWith | Tech stack changes slowly | 30-day TTL |

Cache automatically updates when a user re-enriches the same email. Idle stale entries cleaned by weekly cron.
