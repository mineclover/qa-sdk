#!/usr/bin/env bash
# QA-SDK 전체 로컬 개발 스택 기동.
# Cloudflare endpoint를 사용하지 않으며, 각 서비스는 localhost 포트로 연결된다.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_DATA_DIR="$REPO_ROOT/data"
mkdir -p "$LOCAL_DATA_DIR"

# Workspace consumers resolve package exports from dist; refresh the changed client
# before starting ingest so local runtime and source stay on the same route contract.
corepack pnpm --filter @qa-sdk/registry-client build

# A dependency that never becomes healthy must fail the local stack instead of
# leaving concurrently waiting forever.
REGISTRY_HEALTH_WAIT_SECONDS="${REGISTRY_HEALTH_WAIT_SECONDS:-60}"

exec corepack pnpm exec concurrently \
  --kill-others-on-fail \
  --names registry,definition,ingest,gate,query,decode,gateway,demo-api,shop,demo \
  --prefix "[{name}]" \
  "PORT=3300 SQLITE_PATH=$LOCAL_DATA_DIR/registry-service.local.sqlite DEFINITION_SYNC_ON_SEED=false DEV_DASHBOARD_ENABLED=false OTEL_ENABLED=false corepack pnpm --filter @qa-sdk/registry-service dev" \
  "attempt=0; until curl -fsS http://localhost:3300/health >/dev/null 2>&1; do attempt=\$((attempt + 1)); [ \"\$attempt\" -ge \"$REGISTRY_HEALTH_WAIT_SECONDS\" ] && { echo 'registry-service health wait timed out' >&2; exit 1; }; sleep 1; done; PORT=3700 SQLITE_PATH=$LOCAL_DATA_DIR/definition-service.local.sqlite ROOT_DIR=$REPO_ROOT REGISTRY_URL=http://localhost:3300 SYNC_ON_START=true corepack pnpm --filter @qa-sdk/definition-service dev" \
  "STORE_DRIVER=memory TRACE_DATABASE_URL= REDIS_URL= TASK_QUEUE_ENABLED=false INSIGHTS_DRIVER=local PORT=3200 REGISTRY_URL=http://localhost:3300 REGISTRY_VALIDATION_MODE=warn CONVERGENCE_ENABLED=false corepack pnpm --filter @qa-sdk/ingest-server dev" \
  "PORT=3400 SQLITE_PATH=$LOCAL_DATA_DIR/gate-service.local.sqlite corepack pnpm --filter gate-service dev" \
  "PORT=3500 SQLITE_PATH=$LOCAL_DATA_DIR/query-service.local.sqlite GATE_SERVICE_URL=http://localhost:3400 corepack pnpm --filter query-service dev" \
  "attempt=0; until curl -fsS http://localhost:3300/health >/dev/null 2>&1; do attempt=\$((attempt + 1)); [ \"\$attempt\" -ge \"$REGISTRY_HEALTH_WAIT_SECONDS\" ] && { echo 'registry-service health wait timed out' >&2; exit 1; }; sleep 1; done; PORT=3600 REGISTRY_URL=http://localhost:3300 CACHE_DRIVER=memory corepack pnpm --filter @qa-sdk/decode-service dev" \
  "PORT=8787 AUTH_MODE=bypass REGISTRY_URL=http://localhost:3300 INGEST_URL=http://localhost:3200 GATE_URL=http://localhost:3400 QUERY_URL=http://localhost:3500 DECODE_URL=http://localhost:3600 corepack pnpm --filter @qa-sdk/gateway dev" \
  "corepack pnpm --filter @qa-sdk/platform-demo-api dev" \
  "corepack pnpm --filter @qa-sdk/shop-web dev" \
  "corepack pnpm --filter @qa-sdk/platform-demo dev"
