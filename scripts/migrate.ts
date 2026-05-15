import { neon } from '@neondatabase/serverless';
import { createHash } from 'crypto';

const url = process.env.DATABASE_URL;
if (!url) {
  console.log('DATABASE_URL not set — skipping migration');
  process.exit(0);
}

const sql = neon(url);

// Create api_keys table
await sql(
  `CREATE TABLE IF NOT EXISTS api_keys (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_hash      TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL DEFAULT '',
    tier          TEXT NOT NULL DEFAULT 'free',
    usage_count   INTEGER NOT NULL DEFAULT 0,
    monthly_limit INTEGER NOT NULL DEFAULT 50,
    active        BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
);

// Create enrichments table
await sql(
  `CREATE TABLE IF NOT EXISTS enrichments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    input_hash    TEXT NOT NULL,
    input_type    TEXT NOT NULL,
    result        JSONB NOT NULL,
    confidence    REAL NOT NULL DEFAULT 0,
    source_meta   JSONB NOT NULL DEFAULT '{}',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at    TIMESTAMPTZ NOT NULL DEFAULT now() + interval '30 days'
  )`,
);

// Create indexes on enrichments
await sql(
  'CREATE INDEX IF NOT EXISTS idx_enrichments_input_hash ON enrichments(input_hash)',
);
await sql(
  'CREATE INDEX IF NOT EXISTS idx_enrichments_expires_at ON enrichments(expires_at)',
);

// Create usage_log table
await sql(
  `CREATE TABLE IF NOT EXISTS usage_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id  UUID REFERENCES api_keys(id),
    endpoint    TEXT NOT NULL,
    input_hash  TEXT,
    cache_hit   BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
);

// Seed dev key
const devKeyHash = createHash('sha256').update('lp_live_testkey123').digest('hex');
await sql(
  'INSERT INTO api_keys (key_hash, name, tier, monthly_limit) VALUES ($1, $2, $3, $4) ON CONFLICT (key_hash) DO NOTHING',
  [devKeyHash, 'dev key', 'free', 50],
);

console.log('Migration complete.');
