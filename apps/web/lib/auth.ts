import { db } from './db';
import { createHash } from 'crypto';

export interface ApiKey {
  id: string;
  tier: string;
  usage_count: number;
  monthly_limit: number;
  active: boolean;
}

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

const DEV_KEY_HASH = hashKey('lp_live_testkey123');

export async function validateApiKey(key: string | null): Promise<ApiKey | null> {
  if (!key) return null;

  // Phase 1: accept dev key without DB
  if (hashKey(key) === DEV_KEY_HASH) {
    return { id: 'dev', tier: 'free', usage_count: 0, monthly_limit: 50, active: true };
  }

  if (!db) return null;

  const rows = await db(
    'SELECT id, tier, usage_count, monthly_limit, active FROM api_keys WHERE key_hash = $1',
    [hashKey(key)],
  );
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;

  return {
    id: row.id as string,
    tier: row.tier as string,
    usage_count: row.usage_count as number,
    monthly_limit: row.monthly_limit as number,
    active: row.active as boolean,
  };
}
