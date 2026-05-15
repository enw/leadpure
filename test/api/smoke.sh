#!/usr/bin/env bash
# API smoke tests for LeadPure enrichment endpoint.
# Usage: ./test/api/smoke.sh [--port 3000] [--key lp_live_testkey123]
#
# Starts dev server if not running, runs tests, cleans up.
# All tests must pass for CI.

set -euo pipefail

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

# Performs a POST with JSON body + api key header
enrich() {
  local data="$1"
  curl -s -X POST "$BASE/api/v1/enrich" \
    -H 'Content-Type: application/json' \
    -H "x-api-key: $API_KEY" \
    -d "$data" 2>/dev/null || echo ""
}

# Performs a POST with JSON body, NO api key (for auth tests)
enrich_noauth() {
  local data="$1"
  curl -s -X POST "$BASE/api/v1/enrich" \
    -H 'Content-Type: application/json' \
    -d "$data" 2>/dev/null || echo ""
}

# Performs a POST with JSON body + bad api key
enrich_badauth() {
  local data="$1"
  curl -s -X POST "$BASE/api/v1/enrich" \
    -H 'Content-Type: application/json' \
    -H 'x-api-key: badkey' \
    -d "$data" 2>/dev/null || echo ""
}

# Get only HTTP status code
status_of() {
  local method="$1" path="$2"
  curl -s -o /dev/null -w "%{http_code}" -X "$method" "$BASE$path" 2>/dev/null || echo "000"
}

# Get landing page
landing() {
  curl -s "$BASE/" 2>/dev/null || echo ""
}

# ── Assertions ─────────────────────────────────────────────────────

pass() {
  echo "  ✓ $1"
  ((PASS++))
}

fail() {
  echo "  ✗ $1"
  ((FAIL++))
}

# ── Start server if not already running ────────────────────────────

if [ "$(status_of GET "/" 2>/dev/null)" = "000" ]; then
  echo "==> Starting dev server..."
  cd "$ROOT"
  NODE_ENV=development bun run dev &
  SERVER_PID=$!
  for i in $(seq 1 30); do
    if [ "$(status_of GET "/")" != "000" ]; then
      echo "    Server ready after ${i}s"
      break
    fi
    sleep 1
  done
  if [ "$(status_of GET "/")" = "000" ]; then
    echo "FAIL: Server didn't start within 30s"
    exit 1
  fi
else
  echo "==> Using existing server on port $PORT"
fi

echo ""
echo "==> Running API smoke tests"
echo ""

# ── 1. Enrich with valid API key ──────────────────────────────────

echo "  1. Enrich endpoint - happy path"

body="$(enrich '{"email":"test@example.com"}')"
code="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v1/enrich" \
  -H 'Content-Type: application/json' -H "x-api-key: $API_KEY" \
  -d '{"email":"test@example.com"}' 2>/dev/null)"

[ "$code" = "200" ] && pass "Valid email returns 200" || fail "Valid email should return 200, got $code"

echo "$body" | jq -e '.email == "test@example.com"' >/dev/null 2>&1 \
  && pass "Email in response matches request" \
  || fail "Email mismatch: $(echo "$body" | jq .email)"

echo "$body" | jq -e '.domain == "example.com"' >/dev/null 2>&1 \
  && pass "Domain extracted from email" \
  || fail "Domain wrong: $(echo "$body" | jq .domain)"

echo "$body" | jq -e '.confidence >= 0.3 and .confidence <= 1.0' >/dev/null 2>&1 \
  && pass "Confidence is 0.3 to 1.0" \
  || fail "Confidence out of range: $(echo "$body" | jq .confidence)"

echo "$body" | jq -e '.cached == false' >/dev/null 2>&1 \
  && pass "Not cached" \
  || fail "Expected cached=false"

# ── 2. Enrich by domain only ──────────────────────────────────────

echo ""
echo "  2. Enrich by domain"

body="$(enrich '{"domain":"vercel.com"}')"
code="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v1/enrich" \
  -H 'Content-Type: application/json' -H "x-api-key: $API_KEY" \
  -d '{"domain":"vercel.com"}' 2>/dev/null)"

[ "$code" = "200" ] && pass "Domain-only returns 200" || fail "Domain-only got $code"
echo "$body" | jq -e '.domain == "vercel.com"' >/dev/null 2>&1 \
  && pass "Domain preserved" \
  || fail "Domain wrong: $(echo "$body" | jq .domain)"

# ── 3. Auth failures ──────────────────────────────────────────────

echo ""
echo "  3. Auth & validation"

code="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v1/enrich" \
  -H 'Content-Type: application/json' -d '{"email":"test@example.com"}' 2>/dev/null)"
[ "$code" = "401" ] && pass "No API key → 401" || fail "No API key: expected 401, got $code"

code="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v1/enrich" \
  -H 'Content-Type: application/json' -H 'x-api-key: badkey' -d '{"email":"test@example.com"}' 2>/dev/null)"
[ "$code" = "401" ] && pass "Bad API key → 401" || fail "Bad API key: expected 401, got $code"

code="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v1/enrich" \
  -H 'Content-Type: application/json' -H "x-api-key: $API_KEY" -d '{}' 2>/dev/null)"
[ "$code" = "400" ] && pass "No body → 400" || fail "No body: expected 400, got $code"

code="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v1/enrich" \
  -H 'Content-Type: application/json' -H "x-api-key: $API_KEY" -d '{"email":"notanemail"}' 2>/dev/null)"
[ "$code" = "400" ] && pass "Invalid email → 400" || fail "Invalid email: expected 400, got $code"

code="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v1/enrich" \
  -H 'Content-Type: application/json' -H "x-api-key: $API_KEY" -d 'not-json' 2>/dev/null)"
[ "$code" = "400" ] && pass "Bad JSON → 400" || fail "Bad JSON: expected 400, got $code"

# ── 4. Landing page ───────────────────────────────────────────────

echo ""
echo "  4. Landing page"

code="$(status_of GET "/")"
[ "$code" = "200" ] && pass "Landing page renders (200)" || fail "Landing page: got $code"

body="$(landing)"
echo "$body" | grep -qi "leadpure" \
  && pass "Page contains LeadPure" \
  || fail "Page doesn't mention LeadPure"

# ── Summary ───────────────────────────────────────────────────────

echo ""
echo "========================================"
echo "  Results: $PASS passed, $FAIL failed"
echo "========================================"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
