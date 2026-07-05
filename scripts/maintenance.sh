#!/usr/bin/env bash
set -e

echo "==> 1. Linting (oxlint)"
corepack pnpm run lint

echo "==> 2. Architectural Boundaries Check"
corepack pnpm exec tsx scripts/check-dependency-boundaries.ts

echo "==> 3. API Manifest Regeneration"
corepack pnpm exec tsx scripts/generate-api-reference.ts

echo "==> 4. Package Usage & Health Analysis"
corepack pnpm run arch:usage

echo "==> 5. Building Core & SDK"
corepack pnpm --filter @qa-sdk/core build
corepack pnpm --filter @qa-sdk/sdk build

echo "==> 5. All-Tests (Partial/Stable)"
corepack pnpm run test

echo "✓ System is Healthy and Architecturally Sound."
