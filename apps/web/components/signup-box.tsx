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
        <p>Save this now — you won&apos;t see it again.</p>
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
          <pre className="demo-result">{`curl -X POST https://leadpure.e10d.dev/v1/enrich \\\n  -H 'x-api-key: ${apiKey}' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"email":"john@acme.com"}'`}</pre>
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
