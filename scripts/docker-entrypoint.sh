#!/bin/sh
set -e

host="${DATABASE_HOST:-db}"
port="${DATABASE_PORT:-5432}"

i=0
while [ "$i" -lt 30 ]; do
  if getent hosts "$host" >/dev/null 2>&1; then
    break
  fi
  i=$((i + 1))
  echo "waiting for ${host} dns..."
  sleep 1
done

i=0
while [ "$i" -lt 30 ]; do
  if bun -e "import postgres from 'postgres'; const s=postgres(process.env.DATABASE_URL,{max:1,connect_timeout:3}); await s\`SELECT 1\`; await s.end();" 2>/dev/null; then
    break
  fi
  i=$((i + 1))
  echo "waiting for postgres at ${host}:${port}..."
  sleep 1
done

bun run scripts/migrate.ts
exec bun run apps/web/server.js
