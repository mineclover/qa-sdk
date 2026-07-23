---
def:
  id: local-development-runtime
  type: spec
  tier: system
  scope: flow
  aspect: user_scenario
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [runtime, local, development, contract]
  links:
    - target: local-development-runtime-test
      type: traces_to
sources:
  - package.json
  - scripts/dev-local.sh
  - scripts/health.sh
  - packages/definition-service/scripts/dev.mjs
  - docs/specs/registry-system/client.spec.md
  - docs/getting-started.md
  - packages/platform-demo/public/send-test-event.sh
---

# QA-SDK 로컬 개발 런타임

## 목적 ^purpose

`qa-sdk`의 지원되는 로컬 개발 프로파일을 정의한다. 이 프로파일은 Cloudflare 배포를 재현하는 별도 배포 시스템이 아니라, 서비스 간 계약과 문서 스펙을 로컬에서 검증하기 위한 운영 조립 경계다.

## 진입점 ^overview

| 명령                                                                          | 책임                                   |
| ----------------------------------------------------------------------------- | -------------------------------------- |
| `corepack pnpm dev:local`                                                     | 전체 로컬 서비스 조립 및 기동          |
| `corepack pnpm health`                                                        | 로컬 서비스와 로컬 인프라 상태 확인    |
| `CHECK_CLOUDFLARE=1 corepack pnpm health`                                     | Cloudflare 상태를 명시적으로 추가 확인 |
| `bash packages/platform-demo/public/send-test-event.sh http://localhost:8787` | gateway→ingest 이벤트 smoke 확인       |

정확한 프로세스 명령과 환경 변수는 [scripts/dev-local.sh](../../../scripts/dev-local.sh)가 소유한다. 이 문서는 그 실행 경계와 불변 조건을 정의한다.

## 로컬 서비스 표면 ^interface

| 서비스             | 포트 | 로컬 역할                                        |
| ------------------ | ---: | ------------------------------------------------ |
| registry-service   | 3300 | catalog, prefix, event schema, endpoint registry |
| definition-service | 3700 | 문서 metadata sync, search, graph                |
| ingest-server      | 3200 | 이벤트 수집 및 검증                              |
| gate-service       | 3400 | 품질 gate 처리                                   |
| query-service      | 3500 | 저장 이벤트 조회                                 |
| decode-service     | 3600 | registry DecodeMap 기반 주소 디코딩              |
| gateway            | 8787 | 로컬 API gateway                                 |
| platform-demo-api  | 8788 | local Wrangler demo API                          |
| shop-web           | 5220 | 정적 shopping demo                               |
| platform-demo      | 5176 | Vite monitor/demo UI                             |

모든 로컬 HTTP target은 `localhost`를 사용한다. Cloudflare URL은 `dev:local` 기동 경로에 포함하지 않으며, health 명령의 opt-in 분기에서만 조회한다.

## 구현 책임 분류 ^ownership

- `scripts/dev-local.sh`는 지원되는 로컬 전체 stack의 composition root다. 서비스 목록, readiness gate, 로컬 포트와 환경 변수는 이 파일이 소유한다.
- `packages/definition-service/scripts/dev.mjs`는 `definition-service`의 `dev` script가 사용하는 개발 전용 TypeScript watch/restart helper다. production entrypoint, public API, 배포 contract가 아니며 `start`/`build` 경로를 대체하지 않는다.
- `packages/registry-client/src/index.ts`는 로컬 실행 helper가 아니라 `@qa-sdk/registry-client`의 정식 public client다. 이벤트 검증 transport contract는 [registry-client spec](../registry-system/client.spec.md)가 소유하고, `dev-local`은 최신 workspace export를 build하는 소비자일 뿐이다.
- 따라서 `dev.mjs`의 변경은 watcher 수명주기와 local developer experience 범위에서만 검토하고, registry-client API 변경이나 production service contract로 승격하지 않는다.

## 기동 순서 ^flow

```text
registry-service
  ├─ health OK → definition-service (SYNC_ON_START=true)
  ├─ health OK → decode-service
  └─ URL 주입 → ingest-server, gateway

gate-service → query-service

platform-demo-api, shop-web, platform-demo
  └─ local-only consumer surfaces
```

registry seed 단계에서는 `DEFINITION_SYNC_ON_SEED=false`를 사용하고, definition-service의 startup sync가 문서 동기화 소유권을 갖는다. 이중 sync와 registry startup race를 허용하지 않는다.

## 제약 조건 ^constraint

- `dev:local` 시작 전에 workspace export를 사용하는 `@qa-sdk/registry-client`를 build하여 source와 `dist` route contract를 맞춘다.
- registry-service가 health를 제공하기 전 definition-service와 decode-service를 시작하지 않는다.
- 하나의 프로세스가 실패하면 `concurrently --kill-others-on-fail`로 로컬 스택 전체를 종료한다.
- 로컬 SQLite 파일은 저장소의 `data/` 아래에 둔다. 운영 DB나 Cloudflare D1을 로컬 실행의 기본 저장소로 사용하지 않는다.
- gateway는 로컬에서 `AUTH_MODE=bypass`로 실행되며, 이 설정은 개발 프로파일 전용이다.
- local stack의 성공 판정은 `health`의 10개 HTTP surface와 PostgreSQL/Redis 상태 확인 및 이벤트 smoke 결과로 검증한다.

## 관련 소스 ^sources

- [`package.json`](../../../package.json) — `dev:local`, `health` 명령 진입점
- [`scripts/dev-local.sh`](../../../scripts/dev-local.sh) — 프로세스 조립, 순서, 환경 변수
- [`scripts/health.sh`](../../../scripts/health.sh) — 로컬/Cloudflare health surface
- [`packages/definition-service/scripts/dev.mjs`](../../../packages/definition-service/scripts/dev.mjs) — dev-only watcher/restart helper
- [`docs/specs/registry-system/client.spec.md`](../registry-system/client.spec.md) — registry-client public contract
- [`packages/platform-demo/public/send-test-event.sh`](../../../packages/platform-demo/public/send-test-event.sh) — 이벤트 smoke 입력

## 검증 ^validation

검증 시나리오와 기대 결과는 [local-development-runtime.test.md](./local-development-runtime.test.md)에 정의한다.
