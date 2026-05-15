import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateApiKey } from '@/lib/auth';
import { createJob, runJob, getJob } from '@leadpure/worker';
import { getCachedEnrichment, writeEnrichment } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';

const schema = z
  .object({
    email: z.string().email().optional(),
    domain: z.string().optional(),
  })
  .refine((d) => d.email || d.domain, {
    message: 'Either email or domain is required',
  });

export async function POST(req: NextRequest) {
  // Auth
  const key = await validateApiKey(req.headers.get('x-api-key'));
  if (!key || !key.active) {
    return NextResponse.json(
      { error: 'invalid_api_key', message: 'API key is missing or invalid' },
      { status: 401 },
    );
  }

  // Parse + validate body
  let parsed: z.infer<typeof schema>;
  try {
    const body = await req.json();
    parsed = schema.parse(body);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'validation_error', message: err.errors[0].message },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: 'invalid_json', message: 'Request body must be valid JSON' },
      { status: 400 },
    );
  }

  // Rate limit (skip if no DB — dev mode)
  if (process.env.DATABASE_URL) {
    if (!checkRateLimit(key.id)) {
      return NextResponse.json(
        { error: 'rate_limited', message: 'Too many requests. 100/min limit.' },
        { status: 429 },
      );
    }
  }

  // Cache check
  const cached = await getCachedEnrichment(parsed.email, parsed.domain);
  if (cached) {
    return NextResponse.json(
      {
        ...(cached.result as Record<string, unknown>),
        cached: true,
        cached_at: cached.cached_at,
      },
      { status: 200 },
    );
  }

  // Miss — create job, run worker, poll for completion up to 10s
  const job = createJob(parsed);

  // Fire and forget — runJob will update the job in-place
  void runJob(job.id).catch(() => {});

  // Poll for up to 10 seconds (20 attempts × 500ms)
  const deadline = Date.now() + 10_000;
  let lastStatus = 'pending';

  while (Date.now() < deadline) {
    const current = getJob(job.id);
    if (!current) break;

    lastStatus = current.status;

    if (current.status === 'completed' && current.result) {
      // Write to cache (fire and forget)
      void writeEnrichment(
        parsed.email,
        parsed.domain,
        current.result as unknown as Record<string, unknown>,
        current.result.confidence,
      );
      return NextResponse.json(
        { ...current.result, cached: false, cached_at: null },
        { status: 200 },
      );
    }

    if (current.status === 'failed') {
      return NextResponse.json(
        { error: 'enrichment_failed', message: current.error ?? 'Unknown error' },
        { status: 500 },
      );
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  // Still processing after timeout — return 202 with job id
  return NextResponse.json(
    { job_id: job.id, status: lastStatus === 'processing' ? 'processing' : 'queued' },
    { status: 202 },
  );
}
