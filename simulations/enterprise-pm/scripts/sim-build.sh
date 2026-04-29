#!/usr/bin/env bash
# enterprise-pm 시뮬 카나리 빌드 — catalog 산출 version tag 주입.
# spec: docs/superpowers/specs/2026-04-28-canary-scaling/02-canary-topology.md §2.2

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
SIM_DIR="$ROOT_DIR/simulations/enterprise-pm"
cd "$ROOT_DIR"

# spec §5 단방향 의존: sim-service-catalog의 in-process API만 호출.
# (qa-sdk CLI에 catalog get-version subcommand 도입 시 그쪽으로 교체.)
APPROVAL_V1_TAG=$(npx tsx -e '
  import { SIM_SERVICE_PREFIXES } from "./simulations/enterprise-pm/contracts/service-version.catalog.ts";
  import { getServiceVersionTag } from "sim-service-catalog";
  process.stdout.write(getServiceVersionTag(SIM_SERVICE_PREFIXES.approvalApi, "stable"));
')
APPROVAL_V2_TAG=$(npx tsx -e '
  import { SIM_SERVICE_PREFIXES } from "./simulations/enterprise-pm/contracts/service-version.catalog.ts";
  import { getServiceVersionTag } from "sim-service-catalog";
  process.stdout.write(getServiceVersionTag(SIM_SERVICE_PREFIXES.approvalApi, "candidate"));
')

if [ -z "$APPROVAL_V1_TAG" ] || [ -z "$APPROVAL_V2_TAG" ]; then
  echo "sim-build.sh: catalog get-version 실패 — V1=$APPROVAL_V1_TAG V2=$APPROVAL_V2_TAG" >&2
  exit 1
fi

echo "sim-build.sh: APPROVAL_V1_TAG=$APPROVAL_V1_TAG (stable), APPROVAL_V2_TAG=$APPROVAL_V2_TAG (candidate)"
export APPROVAL_V1_TAG APPROVAL_V2_TAG

cd "$SIM_DIR"
docker compose -f docker-compose.sim.yaml build \
  --build-arg APPROVAL_V1_TAG="$APPROVAL_V1_TAG" \
  --build-arg APPROVAL_V2_TAG="$APPROVAL_V2_TAG" \
  sim-approval-api-v1 sim-approval-api-v2
