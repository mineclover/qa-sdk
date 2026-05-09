#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACK_DIR="${1:-/tmp/rlsc-pack}"

rm -rf "$PACK_DIR"
mkdir -p "$PACK_DIR"

pnpm --dir "$ROOT_DIR" --filter rlsc-analysis build
pnpm --dir "$ROOT_DIR" --filter rlsc-perspective build
pnpm --dir "$ROOT_DIR" --filter rlsc build

pnpm --dir "$ROOT_DIR" --filter rlsc-analysis pack --pack-destination "$PACK_DIR"
pnpm --dir "$ROOT_DIR" --filter rlsc-perspective pack --pack-destination "$PACK_DIR"
pnpm --dir "$ROOT_DIR" --filter rlsc pack --pack-destination "$PACK_DIR"

analysis_tgz="$(find "$PACK_DIR" -maxdepth 1 -name 'rlsc-analysis-*.tgz' -print -quit)"

cat <<EOF
Packed RLSC packages into:
  $PACK_DIR

Local tarball consumers must override rlsc-analysis until it is published:

{
  "pnpm": {
    "overrides": {
      "rlsc-analysis": "file:$analysis_tgz"
    }
  }
}
EOF
