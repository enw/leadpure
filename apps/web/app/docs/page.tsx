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
      <pre className="demo-result">{`curl -X POST https://leadpure.e10d.dev/v1/enrich \\\n  -H 'x-api-key: lp_live_xxx' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"email":"john@acme.com"}'`}</pre>

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
      <pre className="demo-result">{`{\n  "email": "john@acme.com",\n  "domain": "acme.com",\n  "name": "John Smith",\n  "company": "Acme Inc",\n  "industry": "Software",\n  "location": "San Francisco, CA",\n  "social": {\n    "github": "github.com/jsmith",\n    "linkedin": "linkedin.com/in/jsmith"\n  },\n  "confidence": 0.8,\n  "cached": false,\n  "cached_at": null\n}`}</pre>

      <h4>Response — 401 (unauthorized)</h4>
      <pre className="demo-result">{`{"error":"invalid_api_key","message":"API key is missing or invalid"}`}</pre>

      <h4>Response — 400 (validation error)</h4>
      <pre className="demo-result">{`{"error":"validation_error","message":"Either email or domain is required"}`}</pre>

      <h3>GET /api/v1/jobs/:id</h3>
      <p>Poll for an enrichment result that returned 202.</p>
      <pre className="demo-result">{`curl https://leadpure.e10d.dev/api/v1/jobs/job_1234567890_1`}</pre>

      <h3>POST /api/v1/keys</h3>
      <p>Generate a new API key.</p>
      <pre className="demo-result">{`curl -X POST https://leadpure.e10d.dev/api/v1/keys \\\n  -H 'Content-Type: application/json' \\\n  -d '{"email":"you@example.com"}'`}</pre>

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
