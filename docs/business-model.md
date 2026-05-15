# Business Model

## Pricing

| Tier | Enrichments/mo | Price | Unit Cost | Best For |
|---|---|---|---|---|
| Free | 50 | $0 | — | Evaluation, hobbyists, open-source fans |
| Starter | 1,000 | $19 | $0.019 | Solo founders, micro-agencies |
| Pro | 5,000 | $79 | $0.016 | SMB sales teams, CRM sync |
| Business | 25,000 | $299 | $0.012 | Growing sales orgs, batch enrichment |
| Enterprise | Custom | Custom | Negotiated | Agencies, platforms, embedded |

**Overage**: $0.01/enrichment beyond tier limit. Capped at 2x monthly tier (auto-upsell).

**No expiring credits.** Unused enrichments roll over to the next month (up to 3x monthly limit). This is a deliberate differentiator from Clearbit/HubSpot.

**Prepay blocks**: Buy 10,000 enrichments for $99 (no expiry), 50,000 for $399. For teams that want predictable cost without monthly commitment.

## Cost of Ownership

### Monthly Fixed Costs (Hosted Service)

| Item | Cost | Notes |
|---|---|---|
| Vercel (Hobby) | $0 | Paused after inactivity, cold starts acceptable |
| Neon PostgreSQL | $0 | Free tier: 0.5GB, 3 projects |
| fly.io (worker) | ~$5-10 | Single shared-cpu-1x instance |
| Domain | ~$1/mo | leadpure.dev ($12/yr) |
| Proxies (Smartproxy) | ~$25-30 | Residential pool, 5GB/mo |
| **Total fixed** | **~$31-41/mo** | |

### Variable Costs (per 1,000 Enrichments)

| Item | Cost | Notes |
|---|---|---|
| Proxy bandwidth | ~$0.50-1.00 | ~5-10MB per new enrichment |
| Compute (scraping) | ~$0.10-0.30 | Workers, CPU time |
| DB storage | ~$0.05 | JSONB cache entry |
| **Total per 1K** | **~$0.65-1.35** | |

### Margin Analysis

| Tier | Revenue | Est. Cost (50% new) | Gross Margin |
|---|---|---|---|
| Free (50) | $0 | ~$0.05 | — (marketing cost) |
| Starter (1K) | $19 | ~$1.00 | **~95%** |
| Pro (5K) | $79 | ~$4.00 | **~95%** |
| Business (25K) | $299 | ~$17.00 | **~94%** |

Cost drops as cache hit rate rises. At 50% cache hit rate (most teams enrich the same prospects), per-enrichment cost halves:

| Tier | Revenue | Est. Cost (50% cache hit) | Margin |
|---|---|---|---|
| Starter (1K) | $19 | ~$0.50 | **~97%** |

## Revenue Projections

Conservative (assuming typical indie SaaS trajectory):

| Month | Users | Paid | MRR | Burn |
|---|---|---|---|---|
| 1 | 50 (free) | 2 | $38 | $41 |
| 2 | 150 | 8 | $198 | $41 |
| 3 | 400 | 20 | $580 | $41 |
| 6 | 2,000 | 60 | $2,100 | $60 (scale up) |
| 12 | 8,000 | 200 | ~$7,000 | $80 |

**Breakeven**: Month 1 is a loss of ~$3. Month 2 is profitable.

**At $2K MRR**, the business funds itself with zero attention. Run entirely on cron + webhooks.

## Marketing Plan

### Launch (Week 1)

- **Hacker News**: "Clearbit died so I built LeadPure — open-source email enrichment"
- **Reddit**: r/SaaS, r/microsaas, r/sales, r/Entrepreneur build-in-public threads
- **Indie Hackers**: daily dev logs tagged #buildinpublic
- **X/Twitter**: post launch thread with interactive demo GIF

### Growth (Month 1-3)

- **One-click deploy button** in README ("Deploy on Railway in 60 seconds")
- **Product Hunt** launch at v1 stable
- **Blog**: "How to self-host your own lead enrichment API" (SEO play)
- **Hermes skill** — LeadPure enrichment as a chat command for Hermes Agent users
- **Open-source cred** — collect GitHub stars via viral README

### Scaling (Month 3+)

- **Integrations**: Zapier, Make, n8n connector
- **Guest posts**: Sales blogs, CRM comparison sites
- **Referral**: Free enrichment credits for referring a team

## Why This Works Autonomously

| Activity | Runs Via | Manual Touch? |
|---|---|---|
| Scraping pipeline | Cron (Hermes or fly.io cron) | No |
| Billing | Stripe metered API | No (auto-invoice) |
| API key creation | Stripe webhook → auto-provision | No |
| Cache TTL cleanup | pg_cron | No |
| Free tier limit enforcement | API rate limiter | No |
| Marketing | HN/Reddit posts (initial burst) | Yes (day 1 only) |
| Support | Email (low volume at startup) | Reactive |
| Code updates | PRs (as needed) | Occasional |

After the initial launch push, the service runs with near-zero attention. Revenue accumulates passively.
