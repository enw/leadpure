import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateApiKey } from '@/lib/auth';
import { createJob, runJob, getJob } from '@leadpure/worker';

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

  // Phase 2: create job, run it, poll for completion up to 10s
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
      return NextResponse.json(current.result, { status: 200 });
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
