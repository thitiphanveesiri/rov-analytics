#!/usr/bin/env bash
# รันทุก test: ต้องมี devDependencies  `npm i -D esbuild fake-indexeddb`
# - test ที่ import "@/..." หรือ JSX ถูก bundle ด้วย esbuild ก่อนรัน (alias @ = root โปรเจกต์)
set -euo pipefail
cd "$(dirname "$0")/.."
TMP="$(mktemp -d)"
bundle_and_run() {
  npx esbuild "tests/$1" --bundle --platform=node --format=esm --alias:@=. --loader:.js=jsx --outfile="$TMP/$1" --log-level=error
  node "$TMP/$1"
}
node tests/stats.test.mjs
node tests/mergeGames.test.mjs
node tests/storage.offline.test.mjs          # ต้องมี fake-indexeddb
node tests/matchSync.test.mjs
bundle_and_run playedAt.test.mjs
bundle_and_run rivalBrief.test.mjs
bundle_and_run scoreboardMatch.test.mjs
bundle_and_run scoreboardOcr.test.mjs
bundle_and_run trackHeatmap.test.mjs
echo "ALL TESTS OK"
