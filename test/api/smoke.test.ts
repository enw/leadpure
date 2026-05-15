import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

const BASE = process.env.LEADPURE_URL || 'http://localhost:3000';
const API_KEY = process.env.LEADPURE_KEY || 'lp_live_testkey123';

// ── Helpers ────────────────────────────────────────────────────────

async function enrich(data: object, key: string | null = API_KEY): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (key) headers['x-api-key'] = key;
  return fetch(`${BASE}/api/v1/enrich`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
}

// ── Tests ──────────────────────────────────────────────────────────

describe('enrich endpoint', () => {
  // 1. Happy path
  describe('with valid API key', () => {
    let body: any;

    beforeAll(async () => {
      const res = await enrich({ email: 'test@example.com' });
      body = await res.json();
    });

    test('returns 200', async () => {
      const res = await enrich({ email: 'test@example.com' });
      expect(res.status).toBe(200);
    });

    test('email matches request', () => {
      expect(body.email).toBe('test@example.com');
    });

    test('domain extracted from email', () => {
      expect(body.domain).toBe('example.com');
    });

    test('confidence 0.3 - 1.0', () => {
      expect(body.confidence).toBeGreaterThanOrEqual(0.3);
      expect(body.confidence).toBeLessThanOrEqual(1.0);
    });

    test('not cached', () => {
      expect(body.cached).toBe(false);
      expect(body.cached_at).toBeNull();
    });

    test('has expected fields', () => {
      expect(body).toHaveProperty('name');
      expect(body).toHaveProperty('title');
      expect(body).toHaveProperty('company');
      expect(body).toHaveProperty('industry');
      expect(body).toHaveProperty('location');
      expect(body).toHaveProperty('social');
      expect(body.social).toHaveProperty('linkedin');
      expect(body.social).toHaveProperty('github');
      expect(body.social).toHaveProperty('twitter');
    });
  });

  // 2. By domain only
  describe('enrich by domain', () => {
    test('returns 200', async () => {
      const res = await enrich({ domain: 'vercel.com' });
      expect(res.status).toBe(200);
    });

    test('domain preserved', async () => {
      const res = await enrich({ domain: 'vercel.com' });
      const body = await res.json();
      expect(body.domain).toBe('vercel.com');
    });
  });

  // 3. Auth failures
  describe('auth', () => {
    test('no API key returns 401', async () => {
      const res = await enrich({ email: 'test@example.com' }, null);
      expect(res.status).toBe(401);
    });

    test('bad API key returns 401', async () => {
      const res = await enrich({ email: 'test@example.com' }, 'badkey');
      expect(res.status).toBe(401);
    });

    test('401 body has error field', async () => {
      const res = await enrich({ email: 'test@example.com' }, null);
      const body = await res.json();
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('message');
    });
  });

  // 4. Validation
  describe('validation', () => {
    test('missing email and domain returns 400', async () => {
      const res = await enrich({});
      expect(res.status).toBe(400);
    });

    test('invalid email returns 400', async () => {
      const res = await enrich({ email: 'notanemail' });
      expect(res.status).toBe(400);
    });

    test('bad JSON returns 400', async () => {
      const res = await fetch(`${BASE}/api/v1/enrich`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
        },
        body: 'not-json',
      });
      expect(res.status).toBe(400);
    });
  });
});

describe('landing page', () => {
  test('returns 200', async () => {
    const res = await fetch(BASE + '/');
    expect(res.status).toBe(200);
  });

  test('contains LeadPure', async () => {
    const res = await fetch(BASE + '/');
    const html = await res.text();
    expect(html.toLowerCase()).toContain('leadpure');
  });
});

describe('jobs endpoint', () => {
  test('unknown job returns 404', async () => {
    const res = await fetch(`${BASE}/api/v1/jobs/nonexistent-job-id`);
    expect(res.status).toBe(404);
  });

  test('404 body has error field', async () => {
    const res = await fetch(`${BASE}/api/v1/jobs/nonexistent-job-id`);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(body).toHaveProperty('message');
    expect(body.error).toBe('job_not_found');
  });
});
