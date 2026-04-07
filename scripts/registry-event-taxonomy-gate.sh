#!/usr/bin/env bash
# registry-event-taxonomy-gate — event taxonomy 운영 게이트
#
# Usage:
#   pnpm gate:event-taxonomy
#   REGISTRY_BASE_URL=http://localhost:3300 CATALOG_ID=demo pnpm gate:event-taxonomy
set -euo pipefail

BASE_URL="${REGISTRY_BASE_URL:-http://localhost:3300}"
CATALOG_ID="${CATALOG_ID:-demo}"

echo "== Event Taxonomy Gate =="
echo "base_url: ${BASE_URL}"
echo "catalog:  ${CATALOG_ID}"

echo ""
echo "-- check taxonomy --"
curl -fsS "${BASE_URL}/api/event-catalog/taxonomy/check?catalog=${CATALOG_ID}"
echo ""

echo ""
echo "-- assert taxonomy --"
curl -fsS -X POST "${BASE_URL}/api/event-catalog/taxonomy/assert?catalog=${CATALOG_ID}"
echo ""

echo ""
echo "event taxonomy gate passed"
