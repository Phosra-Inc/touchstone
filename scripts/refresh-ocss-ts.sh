#!/usr/bin/env bash
# Re-pack @ocss/ts from the monorepo into vendor/. Run when the monorepo crypto changes.
set -euo pipefail
SRC="${1:-$HOME/builds/phosra/packages/ocss-ts}"
DEST="$(cd "$(dirname "$0")/.." && pwd)/vendor"
( cd "$SRC" && npm run build && npm pack --pack-destination "$DEST" )
mv "$DEST"/ocss-ts-*.tgz "$DEST/ocss-ts-0.0.0.tgz"
echo "refreshed $DEST/ocss-ts-0.0.0.tgz"
