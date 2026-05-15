import { NextRequest, NextResponse } from 'next/server';
import { getJob } from '@leadpure/worker';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const job = getJob(id);
  if (!job) {
    return NextResponse.json({ error: 'job_not_found', message: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json({
    job_id: job.id,
    status: job.status,
    result: job.result ?? null,
    error: job.error ?? null,
    created_at: job.created_at,
    completed_at: job.completed_at ?? null,
  });
}
