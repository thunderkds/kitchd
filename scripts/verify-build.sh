#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")/.."

rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install --frozen-lockfile
NODE_ENV=production pnpm install --prod=false --frozen-lockfile
NODE_ENV=production pnpm run build
test -f packages/shared/dist/index.js
test -f apps/api/dist/src/main.js
test -f apps/web/dist/index.html
test ! -d apps/mobile/dist
pnpm --filter @kitchenos/web run test
echo "M001 VERIFICATION: pass"
