'use client';

import { useState } from 'react';

// Dev API key — public in the open-source repo, no real secrets
const DEMO_KEY = 'lp_live_testkey123';

export default function DemoBox() {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleEnrich() {
    if (!email) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/v1/enrich', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': DEMO_KEY,
        },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Server error' }));
        setError(err.message ?? 'Something went wrong');
        return;
      }
      setResult(await res.json());
    } catch {
      setError('Network error — is the server running?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="demo-section">
      <h2>Try it out</h2>
      <p>Enter an email and see what LeadPure returns. No API key needed for the demo.</p>

      <div className="demo-input-row">
        <input
          type="email"
          placeholder="john@acme.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleEnrich()}
          className="demo-input"
        />
        <button
          onClick={handleEnrich}
          disabled={loading || !email}
          className="demo-btn"
        >
          {loading ? '…' : 'Enrich →'}
        </button>
      </div>

      {error && <div className="demo-error">{String(error)}</div>}
      {result !== null ? (
        <pre className="demo-result">{JSON.stringify(result, null, 2)}</pre>
      ) : null}
    </section>
  );
}
