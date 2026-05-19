import { neon } from '@neondatabase/serverless';
import postgres from 'postgres';
import { createHash } from 'crypto';

const url = process.env.DATABASE_URL || '';
const isSelfHost = process.env.SELF_HOST === 'true';

function createDb() {
  if (!url) return null;
  if (isSelfHost) {
    return postgres(url);
  }
  return neon(url);
}

export const db = createDb();

export function hashInput(input: string): string {
  return createHash('sha256').update(input.toLowerCase().trim()).digest('hex');
}

export async function getCachedEnrichment(email?: string, domain?: string) {
  if (!db) return null;
  const input = email || domain || '';
  const inputHash = hashInput(input);
  const inputType = email ? 'email' : 'domain';

  const rows = await db`SELECT result, confidence, source_meta, created_at
     FROM enrichments
     WHERE input_hash = ${inputHash}
       AND input_type = ${inputType}
       AND expires_at > now()
     ORDER BY created_at DESC
     LIMIT 1`;

  if (rows.length === 0) return null;
  const row = rows[0] as Record<string, unknown>;
  return {
    result: row.result,
    confidence: row.confidence as number,
    source_meta: row.source_meta,
    cached_at: row.created_at,
  };
}

export async function writeEnrichment(
  email: string | undefined,
  domain: string | undefined,
  result: Record<string, unknown>,
  confidence: number,
) {
  if (!db) return;
  const input = email || domain || '';
  const inputHash = hashInput(input);
  const inputType = email ? 'email' : 'domain';

  const existing = await db`SELECT id FROM enrichments WHERE input_hash = ${inputHash} AND input_type = ${inputType}`;

  if (existing.length > 0) {
    await db`UPDATE enrichments
       SET result = ${JSON.stringify(result)}::jsonb,
           confidence = ${confidence},
           source_meta = ${JSON.stringify({ sources: ['github', 'website'] })}::jsonb,
           created_at = now(),
           expires_at = now() + interval '30 days'
       WHERE input_hash = ${inputHash} AND input_type = ${inputType}`;
  } else {
    await db`INSERT INTO enrichments (input_hash, input_type, result, confidence, source_meta)
       VALUES (${inputHash}, ${inputType}, ${JSON.stringify(result)}::jsonb, ${confidence}, ${JSON.stringify({ sources: ['github', 'website'] })}::jsonb)`;
  }
}

export async function logUsage(
  apiKeyId: string,
  endpoint: string,
  inputHash: string | null,
  cacheHit: boolean,
) {
  if (!db) return;
  await db`INSERT INTO usage_log (api_key_id, endpoint, input_hash, cache_hit) VALUES (${apiKeyId}, ${endpoint}, ${inputHash}, ${cacheHit})`;
}
