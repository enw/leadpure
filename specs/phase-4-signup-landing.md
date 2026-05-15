# Phase 4: Landing Page & Signup

Add API key generation, a signup flow on the landing page, API docs page, and responsive polish.

At the end of this phase, users can enter their email on the landing page, get an API key instantly, and read curl examples in `/docs`.

---

## Files to Create/Modify

### 1. API key generation endpoint

**Create: `apps/web/app/api/v1/keys/route.ts`**

POST handler — generates an API key, stores in DB (or returns dev key if no DB):

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createHash, randomBytes } from 'crypto';
import { db } from '@/lib/db';

const schema = z.object({
  email: z.string().email(),
});

function generateApiKey(): string {
  const prefix = 'lp_live_';
  const suffix = randomBytes(16).toString('hex');
  return prefix + suffix;
}

export async function POST(req: NextRequest) {
  let email: string;
  try {
    const body = await req.json();
    email = schema.parse(body).email;
  } catch {
    return NextResponse.json(
      { error: 'validation_error', message: 'A valid email is required' },
      { status: 400 },
    );
  }

  // No DB — return dev key (dev mode)
  if (!db) {
    return NextResponse.json({
      api_key: 'lp_live_testkey123',
      note: 'Development mode — using shared dev key. Set DATABASE_URL for real keys.',
    });
  }

  // Generate and store key
  const rawKey = generateApiKey();
  const keyHash = createHash('sha256').update(rawKey).digest('hex');

  await db(
    'INSERT INTO api_keys (key_hash, name, tier, monthly_limit) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
    [keyHash, email, 'free', 50],
  );

  return NextResponse.json({ api_key: rawKey, tier: 'free', monthly_limit: 50 });
}
```

### 2. Signup section on landing page

**Create: `apps/web/components/signup-box.tsx`**

Client component — email input → POST /api/v1/keys → shows generated key:

```typescript
'use client';

import { useState } from 'react';

export default function SignupBox() {
  const [email, setEmail] = useState('');
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError(null);
    setApiKey(null);

    try {
      const res = await fetch('/api/v1/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to create key' }));
        setError(err.message ?? 'Something went wrong');
        return;
      }
      const body = await res.json();
      setApiKey(body.api_key);
    } catch {
      setError('Network error — is the server running?');
    } finally {
      setLoading(false);
    }
  }

  if (apiKey) {
    return (
      <section className="signup-section">
        <h2>Your API Key</h2>
        <p>Save this now — you won't see it again.</p>
        <div className="key-display">
          <code>{apiKey}</code>
          <button
            className="btn-primary"
            onClick={() => navigator.clipboard.writeText(apiKey)}
          >
            Copy
          </button>
        </div>
        <div className="key-examples">
          <p>Try it out:</p>
          <pre className="demo-result">{`curl -X POST https://leadpure.dev/v1/enrich \\
  -H 'x-api-key: ${apiKey}' \\
  -H 'Content-Type: application/json' \\
  -d '{"email":"john@acme.com"}'`}</pre>
        </div>
      </section>
    );
  }

  return (
    <section className="signup-section">
      <h2>Get your API key</h2>
      <p>Free tier: 50 enrichments/month. No credit card required.</p>
      <form onSubmit={handleSubmit} className="signup-form">
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="signup-input"
          required
        />
        <button type="submit" disabled={loading || !email} className="btn-primary">
          {loading ? '…' : 'Get API Key →'}
        </button>
      </form>
      {error && <div className="demo-error">{error}</div>}
    </section>
  );
}
```

### 3. API docs page

**Create: `apps/web/app/docs/page.tsx`**

Server component — static markdown-style page with curl examples:

```tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'API Docs — LeadPure',
};

export default function DocsPage() {
  return (
    <main className="docs-page">
      <h1>API Reference</h1>

      <h2>Authentication</h2>
      <p>Send your API key in the <code>x-api-key</code> header:</p>
      <pre className="demo-result">{`curl -X POST https://leadpure.dev/v1/enrich \\
  -H 'x-api-key: lp_live_xxx' \\
  -H 'Content-Type: application/json' \\
  -d '{"email":"john@acme.com"}'`}</pre>

      <h2>Endpoints</h2>

      <h3>POST /api/v1/enrich</h3>
      <p>Enrich an email or domain with company data.</p>
      <table>
        <thead><tr><th>Parameter</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td>email</td><td>string</td><td>no*</td><td>Email address to enrich</td></tr>
          <tr><td>domain</td><td>string</td><td>no*</td><td>Domain to enrich</td></tr>
        </tbody>
      </table>
      <p><em>* Either email or domain is required.</em></p>

      <h4>Response — 200 (enriched)</h4>
      <pre className="demo-result">{`{
  "email": "john@acme.com",
  "domain": "acme.com",
  "name": "John Smith",
  "company": "Acme Inc",
  "industry": "Software",
  "location": "San Francisco, CA",
  "social": {
    "github": "github.com/jsmith",
    "linkedin": "linkedin.com/in/jsmith"
  },
  "confidence": 0.8,
  "cached": false,
  "cached_at": null
}`}</pre>

      <h4>Response — 401 (unauthorized)</h4>
      <pre className="demo-result">{`{"error":"invalid_api_key","message":"API key is missing or invalid"}`}</pre>

      <h4>Response — 400 (validation error)</h4>
      <pre className="demo-result">{`{"error":"validation_error","message":"Either email or domain is required"}`}</pre>

      <h3>GET /api/v1/jobs/:id</h3>
      <p>Poll for an enrichment result that returned 202.</p>
      <pre className="demo-result">{`curl https://leadpure.dev/api/v1/jobs/job_1234567890_1`}</pre>

      <h3>POST /api/v1/keys</h3>
      <p>Generate a new API key.</p>
      <pre className="demo-result">{`curl -X POST https://leadpure.dev/api/v1/keys \\
  -H 'Content-Type: application/json' \\
  -d '{"email":"you@example.com"}'`}</pre>

      <h2>Rate Limits</h2>
      <p>Free tier: 100 requests per minute. 429 on exceed.</p>

      <h2>Errors</h2>
      <table>
        <thead><tr><th>Code</th><th>HTTP Status</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td>invalid_api_key</td><td>401</td><td>Missing or invalid x-api-key header</td></tr>
          <tr><td>validation_error</td><td>400</td><td>Invalid request body</td></tr>
          <tr><td>rate_limited</td><td>429</td><td>Too many requests</td></tr>
          <tr><td>enrichment_failed</td><td>500</td><td>Scraping error</td></tr>
        </tbody>
      </table>
    </main>
  );
}
```

### 4. Update landing page

**Modify: `apps/web/app/page.tsx`**

Add signup section after demo, add docs link in footer:

```tsx
import DemoBox from '../components/demo-box';
import SignupBox from '../components/signup-box';

export default function Home() {
  return (
    <main>
      {/* Hero — same as before */}
      {/* Demo — same as before */}
      
      <div id="signup">
        <SignupBox />
      </div>
      
      {/* Pricing — same as before */}
      
      <footer className="footer">
        <a href="https://github.com/enw/leadpure">GitHub</a>
        <span className="sep">·</span>
        <a href="/docs">API Docs</a>
        <span className="sep">·</span>
        <span>MIT License</span>
        <span className="sep">·</span>
        <span>Built in public</span>
      </footer>
    </main>
  );
}
```

### 5. Add CSS for new sections

**Modify: `apps/web/app/globals.css`**

Add styles for signup, docs page, and responsive tweaks:

```css
/* Signup section */
.signup-section {
  max-width: 42rem;
  margin: 0 auto;
  padding: 4rem 1rem;
  text-align: center;
}

.signup-section h2 {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--accent);
  margin: 0 0 0.5rem;
}

.signup-section > p {
  color: var(--muted);
  font-size: 0.875rem;
  margin: 0 0 1.5rem;
}

.signup-form {
  display: flex;
  gap: 0.5rem;
  max-width: 28rem;
  margin: 0 auto;
}

.signup-input {
  flex: 1;
  background: #18181b;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  color: var(--fg);
  font-size: 0.875rem;
  outline: none;
}

.signup-input:focus { border-color: var(--accent); }

.key-display {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.key-display code {
  background: #18181b;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  color: var(--accent);
  word-break: break-all;
}

.key-examples {
  max-width: 42rem;
  margin: 0 auto;
  text-align: left;
}

.key-examples p {
  font-size: 0.75rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin: 0 0 0.75rem;
}

/* Docs page */
.docs-page {
  max-width: 48rem;
  margin: 0 auto;
  padding: 4rem 1rem;
}

.docs-page h1 {
  font-size: 2rem;
  margin: 0 0 2rem;
}

.docs-page h2 {
  font-size: 1.25rem;
  margin: 2rem 0 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
}

.docs-page h3 {
  font-size: 1rem;
  margin: 1.5rem 0 0.5rem;
}

.docs-page h4 {
  font-size: 0.875rem;
  margin: 1rem 0 0.5rem;
  color: var(--muted);
}

.docs-page p {
  font-size: 0.875rem;
  color: var(--muted);
  line-height: 1.6;
}

.docs-page code {
  background: #18181b;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.8125rem;
}

.docs-page table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
  margin: 1rem 0;
}

.docs-page th, .docs-page td {
  text-align: left;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--border);
}

.docs-page th {
  color: var(--muted);
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.6875rem;
  letter-spacing: 0.05em;
}

/* Responsive */
@media (max-width: 640px) {
  .hero { padding: 4rem 1rem 2rem; }
  .hero h1 { font-size: 2rem; }
  .hero .actions { flex-direction: column; }
  .signup-form { flex-direction: column; }
  .demo-input-row { flex-direction: column; }
  .key-display { flex-direction: column; }
}
```

### 6. Update layout

**Modify: `apps/web/app/layout.tsx`** — add viewport meta for mobile:

Already has `<meta name="viewport" content="width=device-width, initial-scale=1" />` from Next.js — no change needed.

## Verification Gates

Before merging Phase 4:

- [ ] `POST /api/v1/keys` with valid email returns an API key (dev key without DB, real key with DB)
- [ ] `POST /api/v1/keys` with invalid email returns 400
- [ ] Signup form on landing page works: enter email → see key → copy button works
- [ ] `/docs` page renders with curl examples, response schemas, error table
- [ ] Footer has "API Docs" link
- [ ] Landing page looks reasonable on mobile (responsive)
- [ ] `bun test` passes (all unit + smoke tests)
- [ ] Enrich endpoint still works (no regressions)
