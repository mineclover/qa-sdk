---
def:
  id: local-development-runtime-test
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: operation
  tags: [runtime, local, testing, contract]
  links:
    - target: local-development-runtime
      type: refines
sources:
  - scripts/dev-local.sh
  - scripts/health.sh
  - packages/definition-service/scripts/dev.mjs
  - packages/registry-client/src/index.ts
  - packages/platform-demo/public/send-test-event.sh
---

# QA-SDK 로컬 개발 런타임 검증

## 목적 ^purpose

로컬 개발 런타임이 Cloudflare target으로 drift하지 않고, 서비스 기동 순서와 핵심 소비 경로를 실제로 제공하는지 검증한다.

## 검증 매핑 ^validation

| 시나리오                   | 실행                                                                                      | 기대 결과                                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 전체 stack 기동            | `corepack pnpm dev:local`                                                                 | 10개 local service가 기동되고 하나의 실패가 전체에 전파됨                                              |
| service health             | `corepack pnpm health`                                                                    | registry, definition, ingest, gate, query, decode, gateway, demo-api, shop-web, platform-demo가 응답함 |
| health failure propagation | 하나 이상의 local target을 중지한 뒤 `corepack pnpm health`                               | 실패 target 수를 출력하고 exit code `1`을 반환함                                                       |
| infrastructure health      | 같은 `health` 실행                                                                        | PostgreSQL `ready`, Redis `PONG`                                                                       |
| event smoke                | `bash packages/platform-demo/public/send-test-event.sh http://localhost:8787`             | `accepted: true`, `record_count: 1`                                                                    |
| Cloudflare 분리            | `corepack pnpm health`                                                                    | 기본 실행에서 Cloudflare section을 조회하지 않음                                                       |
| readiness timeout          | registry-service를 기동하지 않고 `REGISTRY_HEALTH_WAIT_SECONDS=1 corepack pnpm dev:local` | definition/decode 대기가 무한 반복되지 않고 실패 전파됨                                                |
| dev watcher 분류           | `node --check packages/definition-service/scripts/dev.mjs`                                | dev-only watcher 문법이 유효하고 production `start` 경로와 분리됨                                      |
| registry client contract   | `corepack pnpm --filter @qa-sdk/registry-client test`                                     | event schema route, cache, fail-open 동작이 public client 테스트로 고정됨                              |

## source-backed evidence ^evidence

- `scripts/dev-local.sh`의 registry→definition/decode readiness gate
- `scripts/health.sh`의 10개 local service 및 infrastructure check
- `packages/platform-demo/public/send-test-event.sh`의 gateway ingest smoke

## 현재 검증 결과 ^current-evidence

- `corepack pnpm health` — 10개 local HTTP surface 모두 200, PostgreSQL `ready`, Redis `PONG`
- `bash packages/platform-demo/public/send-test-event.sh http://localhost:8787` — `accepted: true`, `record_count: 1`
- `node --check packages/definition-service/scripts/dev.mjs` 및 `bash -n scripts/dev-local.sh` — 통과
- `corepack pnpm --filter @qa-sdk/registry-client build` — TypeScript build 통과
- `corepack pnpm --filter @qa-sdk/registry-client test` — 12 tests 통과
