---
def:
  id: store-driver-selection
  scope: constraint
  aspect: infra_constraint
  depth: specification
  tier: component
  lifecycle: approved
  layer: operation
  tags: [infra, store, driver, insights]
  links:
    - target: infra-service-operations
      type: refines
sources:
  - packages/ingest-server/src/stores/runtime-stores.ts
  - packages/ingest-server/src/config/env.ts
  - packages/ingest-server/src/stores/clickhouse-record-store.ts
  - packages/ingest-server/src/stores/clickhouse-record-store.test.ts
  - packages/cli/src/lib/service-profile.ts
---
# Store / Insights 드라이버 선택

## 목적 ^purpose

`STORE_DRIVER`와 `INSIGHTS_DRIVER` 환경변수에 따른 스토어 드라이버 선택 기준과 각 드라이버의 특성을 정의한다.

## Ingest Store Driver (STORE_DRIVER) ^overview

| 드라이버 | 설정 | 비고 |
|---------|------|------|
| `memory` | (기본) | D1+`:memory:` 자동 업그레이드, insights 활성. 실패 시 InMemory fallback |
| `sqlite` | `SQLITE_PATH` (선택) | node-sqlite 위의 D1 core store. 미설정 시 `:memory:` |
| `pg` | `TRACE_DATABASE_URL` 필수 | Drizzle + PostgreSQL (운영, `packages/store`) |
| `d1` | `SQLITE_PATH` | `sqlite`의 deprecation alias — 경고 1회 후 sqlite로 처리 |
| `clickhouse` | - | server 모드 미지원 — 경고 1회 후 SQLite로 처리. `ClickhouseRecordStore`·`ClickHouseAnalyticsStore`는 런타임 미배선 |

- D1 store: 4개 core (Record, Trace, Session, Verdict) + 나머지 InMemory
- CF Worker(`src/worker.ts`)는 D1 바인딩으로 store를 직접 만든다 (이 선택 경로 미사용)
- `stores/runtime-stores.ts` `createRuntimeStores`가 server·worker 모드의 단일 선택 진입점 (`resolveStoreDriver`로 d1 alias 해석)
- 상세: `docs/specs/ingest/ingest-infra-system/ingest-store-drivers.todo.md`

## Insights Driver (INSIGHTS_DRIVER)

| 드라이버 | 설정 | 비고 |
|---------|------|------|
| `local` | (기본) | DrizzleInsightsStore (SQLite) |
| `app-hub` | `APP_HUB_ENDPOINT`, `APP_HUB_PROJECT_ID`, `APP_HUB_CREDENTIAL` | AppHubInsightsStore (Google App Hub) |

- `InsightsStore` 포트: `ingest-server/src/ports/insights-store.port.ts` — 읽기 12메서드 + `collect()` 쓰기
- local 모드: ingest pipeline이 같은 SQLite DB에 기록, `collect()` no-op
- app-hub 모드: `collect()`에서 App Hub API로 전달, 읽기도 App Hub
- 프로필: `~/.qa-sdk/service-profile.json` — CLI `qa-sdk service mode local|prod`로 전환
- fail-open: insights 수집 실패가 ingest 파이프라인을 차단하지 않음
- memory 모드에서 D1+`:memory:` 자동 업그레이드 — insights 기본 활성화
- D1 초기화 실패 시 순수 InMemory fallback (insights 비활성)
- 상세: `docs/specs/ingest/insights-api-spec.md`
