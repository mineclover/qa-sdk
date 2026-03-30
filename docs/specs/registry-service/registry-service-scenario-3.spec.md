---
def:
  id: registry-service-scenario-3
  scope: feature
  aspect: scenario
  depth: specification
  lifecycle: draft
  svc: registry-service
  links:
    - target: registry-system
      type: refines
    - target: registry-seed-module
      type: depends_on
---
# DKG 그래프 동기화

## 목적 ^purpose

DEMO_CATALOG seed 이후 registry-service가 DKG 그래프, 대시보드 메트릭, 다이어그램, definition-service sync를 fail-open 원칙으로 일관되게 파생하는 기준 시나리오를 정의한다.

운영자가 DEMO_CATALOG로 registry를 seed하고, bootstrapDkg로 빌드된 DKG 그래프에서 다이어그램과 메트릭을 파생 조회하는 기준 시나리오.

## 행위자 ^actor

- **플랫폼 운영자** — registry seed를 트리거하고 DKG 파생 데이터를 확인한다.
- **registry-service** (port 3300) — seed 수행, DKG 그래프 빌드, dashboard/diagram API 제공.
- **SeedService** — `OnModuleInit`에서 startup seed를 실행하며 definition-service sync를 fail-open으로 호출한다.
- **DashboardService / DiagramService** — DKG 그래프에서 메트릭, 다이어그램 등을 파생 계산한다.

## 사전 조건 ^preconditions

- registry-service가 `RuntimeModule` (= `AppModule` + `SeedModule`) 구성으로 기동됨
- `DEMO_CATALOG`가 유효한 카탈로그 객체로 존재함 (축, prefix, table 포함)
- D1/SQLite DB가 초기 상태 (빈 DB 또는 이전 seed 데이터 존재)
- `DEV_DASHBOARD_ENABLED=true`로 대시보드 기능이 활성화됨
- definition-service (port 3700)가 기동 중이거나, 미기동 시 sync 실패를 fail-open으로 처리

## 스텝 ^steps

1. registry-service 기동 → `SeedService.onModuleInit()` 자동 실행. `DEMO_CATALOG` 해시를 비교하여 변경 시 auto-reseed 수행
2. seed 단계 확인 → `seedDemoCatalog()`, `seedConfigs()` (DkgConfig, PatternRules), `seedEndpoints()` (dev/prod URL), `seedEventSchemas()` (event-catalog 기반), 축 프로필 seed가 순차 실행
3. `bootstrapDkg` 실행 → DEMO_CATALOG에서 DKG 그래프 빌드. 15종 노드 (Prefix, Axis, Service, Endpoint, EventSchema 등)와 18종 엣지가 생성됨
4. definition-service sync 트리거 → `definitionClient.triggerSync()` fail-open 호출. 실패 시 런타임 기동을 차단하지 않음
5. `GET /api/dashboard/overview` → DKG 그래프 기반 시스템 개요 조회. 노드/엣지 수, 서비스 수, prefix 수 등 요약 데이터 반환
6. `GET /api/dashboard/metrics` → `collectMetrics()`로 파생된 메트릭 조회. prefix 카운트, 축별 entry 수, 서비스별 prefix 분포 등
7. `GET /api/dashboard/flow-map` → 서비스 간 데이터 흐름 맵 조회
8. `GET /api/diagrams` → `listAllDiagrams()`로 파생된 다이어그램 목록 조회. Mermaid 형식 다이어그램 kind/id 목록 반환
9. `GET /api/diagrams/:kind/:id` → 특정 다이어그램 상세 조회. Mermaid 마크다운이 포함된 응답 확인
10. `GET /api/services/svc-owners` → seed된 서비스의 prefix → serviceId 매핑이 DKG 그래프와 정합적인지 확인
11. `POST /api/dashboard/collect` → 대시보드 데이터 수동 재수집 트리거
12. `GET /api/dashboard/schema` → DKG 스키마 구조 조회

## 검증 ^assertions

- seed는 `RuntimeModule`에서만 실행되며, `AppModule` 자체에는 seed side effect가 없다
- `DEMO_CATALOG` 해시가 이전과 동일하면 reseed를 건너뛴다 (auto-reseed 조건)
- seed 후 `GET /prefixes`에서 카탈로그의 모든 prefix가 등록되어 있다
- DKG 그래프의 노드 수는 카탈로그에서 동적 파생한다 (하드코딩 금지: `Object.keys(DEMO_CATALOG.axes).length` 등)
- `listAllDiagrams()` 결과는 빈 배열이 아니며, 각 항목에 유효한 `kind`와 `id`가 있다
- `collectMetrics()` 결과에 prefix count, axis count, service count가 포함된다
- service-skills 자동 관측이 DKG에 ObservationNode로 기록된다 (`subjects[]`, `finding`, `intent` 포함)
- definition-service sync 실패 시 런타임 기동이 차단되지 않는다 (fail-open)
- seed 완료 후 `GET /api/decode-map`에서 유효한 DecodeMap이 반환된다

## 변형 ^variants

- **V1 — definition-service 미기동 상태에서 seed**: definition-service가 내려간 상태에서 registry-service 기동 → seed 정상 완료. `triggerSync()` 실패는 경고만 남기고 기동 진행
- **V2 — 카탈로그 변경 후 재기동**: `DEMO_CATALOG`에 새 prefix 추가 후 재기동 → 해시 변경 감지 → auto-reseed 수행. DKG 그래프에 새 노드가 추가됨. `GET /api/dashboard/metrics`에 반영
- **V3 — DEV_DASHBOARD_ENABLED=false**: 대시보드 비활성화 상태 → `/api/dashboard/*`, `/api/diagrams`, `/dev/*` 경로가 provider 없이 동작하지 않음. 핵심 registry API (`/prefixes`, `/api/services`)는 정상
- **V4 — WebSocket 실시간 갱신**: `DEV_DASHBOARD_ENABLED=true`에서 `/dev/ws` 연결 → 카탈로그 변경 시 WebSocket push로 대시보드 갱신 이벤트 수신
- **V5 — 빈 DB에서 최초 seed**: 완전히 새로운 DB에서 기동 → DDL 생성 + seed가 한 번에 수행. 모든 파생 API가 정상 응답

## 재검토 트리거 ^update-trigger

- `SeedService` seed 단계(함수 목록)가 추가/변경될 때
- DKG 노드/엣지 타입이 확장될 때 (현재 15종/18종)
- `DashboardModule` 또는 `DiagramService`의 API surface가 변경될 때
- `DEMO_CATALOG` 해시 비교 메커니즘이 변경될 때
- definition-service sync 연동 방식이 변경될 때
