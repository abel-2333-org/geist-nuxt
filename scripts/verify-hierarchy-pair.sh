#!/usr/bin/env bash
set -euo pipefail
# Reproducible paired production builds. The baseline is the main integrated by PR153.
ROOT=$(pwd)
BASELINE_SHA=${BASELINE_SHA:-19a107527d1226585611f4547619320b430fab2a}
SOURCE_SHA=$(git rev-parse HEAD)
EVIDENCE_ROOT=${EVIDENCE_DIR:-$ROOT/output/playwright/pr153/supplement}
mkdir -p "$EVIDENCE_ROOT"
EVIDENCE_ROOT=$(cd "$EVIDENCE_ROOT" && pwd)
BASE_DIR=$(mktemp -d "${TMPDIR:-/tmp}/geist-hierarchy-base.XXXXXX")
HEAD_PID=''
BASE_PID=''
cleanup() {
  if [ -n "$HEAD_PID" ]; then kill "$HEAD_PID" 2>/dev/null || true; wait "$HEAD_PID" 2>/dev/null || true; fi
  if [ -n "$BASE_PID" ]; then kill "$BASE_PID" 2>/dev/null || true; wait "$BASE_PID" 2>/dev/null || true; fi
  git worktree remove --force "$BASE_DIR" >/dev/null 2>&1 || true
  rmdir "$BASE_DIR" 2>/dev/null || true
}
trap cleanup EXIT
# Copy only the test harness onto the unmodified production baseline.
for url in http://127.0.0.1:3016 http://127.0.0.1:3018; do
  if curl --silent --max-time 2 "$url" >/dev/null; then
    echo "Refusing an occupied comparison port: $url" >&2; exit 1
  fi
done
git worktree add --detach "$BASE_DIR" "$BASELINE_SHA"
mkdir -p "$BASE_DIR/tests/fixtures/hierarchy"
cp tests/fixtures/hierarchy/* "$BASE_DIR/tests/fixtures/hierarchy/"
cp tests/browser/hierarchy*.mjs "$BASE_DIR/tests/browser/"
cp scripts/build-hierarchy.mjs "$BASE_DIR/scripts/"
(cd "$BASE_DIR" && pnpm install --frozen-lockfile)
# Reuse the URL-keyed Nuxt font download cache; do not alter font configuration.
if [ -d "$ROOT/node_modules/.cache/nuxt/fonts" ]; then
  mkdir -p "$BASE_DIR/node_modules/.cache/nuxt"
  cp -R "$ROOT/node_modules/.cache/nuxt/fonts" "$BASE_DIR/node_modules/.cache/nuxt/"
fi
(cd "$BASE_DIR" && node scripts/build-hierarchy.mjs)
node scripts/build-hierarchy.mjs
PORT=3016 HOST=127.0.0.1 node .output/hierarchy/server/index.mjs > "$EVIDENCE_ROOT/head-server.log" 2>&1 &
HEAD_PID=$!
(cd "$BASE_DIR" && exec env PORT=3018 HOST=127.0.0.1 node .output/hierarchy/server/index.mjs) > "$EVIDENCE_ROOT/base-server.log" 2>&1 &
BASE_PID=$!
for url in http://127.0.0.1:3016/__hierarchy http://127.0.0.1:3018/__hierarchy; do
  ready=false
  for attempt in {1..90}; do
    if curl --silent --fail "$url" >/dev/null; then ready=true; break; fi
    sleep 1
  done
  if [ "$ready" != true ]; then echo "Server did not become ready: $url" >&2; exit 1; fi
done
BASE_URL=http://127.0.0.1:3016 EVIDENCE_DIR="$EVIDENCE_ROOT/head-fixture" node tests/browser/hierarchy-fixture.mjs
(cd "$BASE_DIR" && BASE_URL=http://127.0.0.1:3018 REPORT_ONLY=1 EVIDENCE_DIR="$EVIDENCE_ROOT/base-fixture" node tests/browser/hierarchy-fixture.mjs)
BASE_URL=http://127.0.0.1:3016 SOURCE_SHA="$SOURCE_SHA" EVIDENCE_DIR="$EVIDENCE_ROOT/head-focus" node tests/browser/hierarchy-focus.mjs
BASE_URL=http://127.0.0.1:3018 SOURCE_SHA="$BASELINE_SHA" EVIDENCE_DIR="$EVIDENCE_ROOT/base-focus" node tests/browser/hierarchy-focus.mjs
EVIDENCE_DIR="$EVIDENCE_ROOT" node tests/browser/hierarchy-focus-compare.mjs
BASE_URL=http://127.0.0.1:3016 BASELINE_URL=http://127.0.0.1:3018 SOURCE_SHA="$SOURCE_SHA" BASELINE_SHA="$BASELINE_SHA" EVIDENCE_DIR="$EVIDENCE_ROOT/paired" node tests/browser/hierarchy-compare.mjs
cp .output/hierarchy/source.json "$EVIDENCE_ROOT/head-source.json"
cp "$BASE_DIR/.output/hierarchy/source.json" "$EVIDENCE_ROOT/base-source.json"
