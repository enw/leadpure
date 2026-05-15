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

  await db`INSERT INTO api_keys (key_hash, name, tier, monthly_limit) VALUES (${keyHash}, ${email}, ${'free'}, ${50}) ON CONFLICT DO NOTHING`;

  return NextResponse.json({ api_key: rawKey, tier: 'free', monthly_limit: 50 });
}
