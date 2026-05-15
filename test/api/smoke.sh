#!/usr/bin/env bash
# API smoke tests for LeadPure enrichment endpoint.
# Usage: ./test/api/smoke.sh [--port 3000] [--key lp_live_testkey123]
#
# Starts dev server if not running, runs tests, cleans up.
# All tests must pass for CI.

set -euo pipefail
shopt -s inherit_errexit

PORT="${PORT:-3000}"
API_KEY="${API_KEY:-lp_live_testkey123}"
BASE="http://localhost:$PORT"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PASS=0
FAIL=0
SERVER_PID=""

cleanup() {
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# ── Helpers ────────────────────────────────────────────────────────

assert_status() {
  local label="$1" method="$2" path="$3" expected="$4" extra_args="${5:-}"
  local actual
  actual=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" \
    "$BASE$path" $extra_args 2>/dev/null || echo "000")
  if [ "$actual" = "$expected" ]; then
    echo "  ✓ $label"
    ((PASS++))
  else
    echo "  ✗ $label (expected $expected, got $actual)"
    ((FAIL++))
  fi
}

assert_json() {
  local label="$1" method="$2" path="$3" jq_filter="$4" extra_args="${5:-}"
  local body
  body=$(curl -s -X "$method" "$BASE$path" $extra_args 2>/dev/null || echo "")
  if echo "$body" | jq -e "$jq_filter" >/dev/null 2>&1; then
    echo "  ✓ $label"
    ((PASS++))
  else
    echo "  ✗ $label (jq filter '$jq_filter' failed)"
    echo "    body: $body"
    ((FAIL++))
  fi
}

# ── Start server if not already running ────────────────────────────

if ! curl -sf -o /dev/null "$BASE/" 2>/dev/null; then
  echo "==> Starting dev server..."
  cd "$ROOT"
  NODE_ENV=development bun run dev &
  SERVER_PID=$!
  # Wait up to 20s for server to be ready
  for i in $(seq 1 20); do
    if curl -sf -o /dev/null "$BASE/" 2>/dev/null; then
      echo "    Server ready after ${i}s"
      break
    fi
    sleep 1
  done
  if ! curl -sf -o /dev/null "$BASE/" 2>/dev/null; then
    echo "FAIL: Server didn't start within 20s"
    exit 1
  fi
else
  echo "==> Using existing server on port $PORT"
fi

echo ""
echo "==> Running API smoke tests"
echo ""

# ── 1. Enrich with valid API key ────────────────────────────────────

echo "  1. Enrich endpoint - happy path"

assert_status "Valid email returns 200" \
  POST "/api/v1/enrich" "200" \
  "-H 'Content-Type: application/json' -H 'x-api-key: $API_KEY' -d '{\"email\":\"test@example.com\"}'"

assert_json "Email in response matches request" \
  POST "/api/v1/enrich" '.email == "test@example.com"' \
  "-H 'Content-Type: application/json' -H 'x-api-key: $API_KEY' -d '{\"email\":\"test@example.com\"}'"

assert_json "Domain extracted from email" \
  POST "/api/v1/enrich" '.domain == "example.com"' \
  "-H 'Content-Type: application/json' -H 'x-api-key: $API_KEY' -d '{\"email\":\"test@example.com\"}'"

assert_json "Confidence is 0.3 to 1.0 float" \
  POST "/api/v1/enrich" '.confidence >= 0.3 and .confidence <= 1.0' \
  "-H 'Content-Type: application/json' -H 'x-api-key: $API_KEY' -d '{\"email\":\"test@example.com\"}'"

assert_json "Not cached" \
  POST "/api/v1/enrich" '.cached == false' \
  "-H 'Content-Type: application/json' -H 'x-api-key: $API_KEY' -d '{\"email\":\"test@example.com\"}'"

# ── 2. Enrich by domain only ────────────────────────────────────────

echo ""
echo "  2. Enrich by domain"

assert_status "Domain-only returns 200" \
  POST "/api/v1/enrich" "200" \
  "-H 'Content-Type: application/json' -H 'x-api-key: $API_KEY' -d '{\"domain\":\"vercel.com\"}'"

assert_json "Domain preserved" \
  POST "/api/v1/enrich" '.domain == "vercel.com"' \
  "-H 'Content-Type: application/json' -H 'x-api-key: $API_KEY' -d '{\"domain\":\"vercel.com\"}'"

# ── 3. Auth failures ────────────────────────────────────────────────

echo ""
echo "  3. Auth & validation"

assert_status "No API key → 401" \
  POST "/api/v1/enrich" "401" \
  "-H 'Content-Type: application/json' -d '{\"email\":\"test@example.com\"}'"

assert_status "Bad API key → 401" \
  POST "/api/v1/enrich" "401" \
  "-H 'Content-Type: application/json' -H 'x-api-key: badkey' -d '{\"email\":\"test@example.com\"}'"

assert_status "No body → 400" \
  POST "/api/v1/enrich" "400" \
  "-H 'Content-Type: application/json' -H 'x-api-key: $API_KEY' -d '{}'"

assert_status "Invalid email → 400" \
  POST "/api/v1/enrich" "400" \
  "-H 'Content-Type: application/json' -H 'x-api-key: $API_KEY' -d '{\"email\":\"notanemail\"}'"

assert_status "Bad JSON → 400" \
  POST "/api/v1/enrich" "400" \
  "-H 'Content-Type: application/json' -H 'x-api-key: $API_KEY' -d 'not-json'"

# ── 4. Landing page ─────────────────────────────────────────────────

echo ""
echo "  4. Landing page"

assert_status "Landing page renders" GET "/" 200
assert_json "Title contains LeadPure" GET "/" '.title | test("LeadPure")'

# ── Summary ─────────────────────────────────────────────────────────

echo ""
echo "========================================"
echo "  Results: $PASS passed, $FAIL failed"
echo "========================================"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
