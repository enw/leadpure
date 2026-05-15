import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateApiKey } from '@/lib/auth';
import { enrich } from '@leadpure/core';

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

  // Phase 1: always return mock data. Phase 2+: check cache, dispatch workers.
  const result = enrich(parsed);

  return NextResponse.json(result, { status: 200 });
}
