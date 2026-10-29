---
def:
  tier: component
  id: insights-api-spec
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: operation
  svc: ingest-server
  tags: [contract, observability, runtime]
  links:
    - target: record-spec
      type: depends_on
    - target: trace-spec
      type: depends_on
    - target: session-spec
      type: depends_on
sources:
  - packages/ingest-server/src/routes/insights.ts
  - packages/ingest-server/src/routes/insights.test.ts
  - packages/ingest-server/src/ports/insights-store.port.ts
  - packages/ingest-server/src/stores/app-hub-insights-store.ts
  - packages/ingest-server/src/stores/drizzle-insights-store.ts
  - packages/ingest-server/src/insights-store.e2e.test.ts
  - packages/cli/src/commands/ingest.ts
---

# Insights API

## 목적 ^purpose

InsightsStore 포트를 통해 prefix 사용률, 서비스별 분포, 공출현 분석 등 인사이트를 조회하는 API 계약. INSIGHTS_DRIVER(local/app-hub)에 따라 저장소 구현체가 전환된다.

## 구성 ^overview

### InsightsStore 포트

`ingest-server/src/ports/insights-store.port.ts` — 읽기 12메서드 + 선택 메서드 `collect()`. `collect()`는 외부 저장소로 보내는 드라이버만 구현하고, 없으면 ingest가 batch를 만들지 않는다.

| 드라이버 | 구현체 | collect() 동작 | 읽기 소스 |
|----------|--------|---------------|----------|
| `local` | `DrizzleInsightsStore` | 구현 안 함 (ingest pipeline이 같은 DB에 이미 기록) | SQLite |
| `app-hub` | `AppHubInsightsStore` | App Hub API 전달 | App Hub API |

### 엔드포인트 (12개)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/v1/insights/summary` | 전체 수집 현황 (traces, records, sessions, services, eventKeys, errors) |
| GET | `/v1/insights/services` | 서비스별 trace/record 분포 |
| GET | `/v1/insights/event-keys` | 이벤트 키별 빈도 + 카테고리 |
| GET | `/v1/insights/prefixes` | address_context prefix 사용 빈도 |
| GET | `/v1/insights/timeline` | 시간대별 이벤트 분포 |
| GET | `/v1/insights/flows?limit=N` | trace별 이벤트 시퀀스 + prefix 집합 |
| GET | `/v1/insights/sessions` | 세션별 요약 (traces, records, services) |
| GET | `/v1/insights/coverage` | 이벤트 카테고리별 커버리지 |
| GET | `/v1/insights/permissions?limit=N` | 권한 체크 이벤트 히스토리 |
| GET | `/v1/insights/service-prefixes` | 서비스별 prefix 활성도 (ownedPrefixes 대비 gap) |
| GET | `/v1/insights/correlations?min_support=N` | prefix 공출현 Jaccard 분석 + IntentLink 자동 제안 |
| GET | `/v1/insights/errors?limit=N` | 에러 이벤트 히스토리 (서비스별/코드별 집계) |

### 수집 경로

```
ingest POST /v1/ingest
  → storeEnvelope (Phase 1: record/trace/session 저장)
  → insightsStore.collect(batch)
      local:   no-op (같은 DB에 이미 기록)
      app-hub: App Hub API로 전달 (fail-open)
```

### 프로필 시스템

`~/.qa-sdk/ingest-profile.json` — CLI `qa-sdk ingest mode dev|prod`로 전환.

서버 시작 시 프로필 파일을 환경변수 기본값으로 로딩. 환경변수가 명시 설정된 경우 프로필보다 우선.

### CLI 명령

| 명령 | 설명 |
|------|------|
| `qa-sdk ingest mode` | 현재 프로필 표시 |
| `qa-sdk ingest mode dev` | local 모드 전환 |
| `qa-sdk ingest mode prod` | app-hub 모드 전환 |
| `qa-sdk ingest mode --set key=value` | 개별 필드 수정 |
| `qa-sdk ingest insights` | 인사이트 종합 조회 |

### 핵심 파일

| 파일 | 역할 |
|------|------|
| `ingest-server/src/ports/insights-store.port.ts` | 포트 인터페이스 + 결과 타입 |
| `ingest-server/src/stores/drizzle-insights-store.ts` | SQLite 구현체 |
| `ingest-server/src/stores/app-hub-insights-store.ts` | App Hub 스텁 |
| `ingest-server/src/routes/insights.ts` | 라우트 (store 위임) |
| `ingest-server/src/config/env.ts` | INSIGHTS_DRIVER + 프로필 로딩 |
| `cli/src/commands/ingest.ts` | ingest mode / ingest insights CLI |
