#!/usr/bin/env bash
set -e

echo "==> 1. Linting (oxlint)"
pnpm run lint

echo "==> 2. Architectural Boundaries Check"
npx tsx scripts/check-dependency-boundaries.ts

echo "==> 3. API Manifest Regeneration"
npx tsx scripts/generate-api-reference.ts

echo "==> 4. Building Core & SDK"
pnpm --filter @qa-sdk/core build
pnpm --filter @qa-sdk/sdk build

echo "==> 5. All-Tests (Partial/Stable)"
pnpm run test

echo "✓ System is Healthy and Architecturally Sound."
