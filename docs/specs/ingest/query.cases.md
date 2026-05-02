---
def:
  id: query-api-spec-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: mediation
  svc: ingest-server
  tags: [scenario, query-api, pagination]
  links:
    - target: query-api-spec
      type: refines
    - target: query-system
      type: depends_on
---

# Query API (ingest) — 소비자 기대 시나리오

## 목적 ^purpose

`query-api-spec`(trace/session/record cursor pagination, 읽기 전용 API)이 `query-system`에 의존할 때 기대하는 계약. query-api 는 query-system 이 제공하는 Store 포트(GraphStore/RecordStore/TraceStore/SessionStore)와 규칙 해소 경로가 안정적으로 제공되어야 pagination 을 일관되게 수행한다.

## 시나리오 1: cursor 기반 페이지네이션 정합성 ^overview

**전제**: `query-system`의 query-api 가 `base64url` 인코딩 cursor 기반 pagination 을 제공, 기본 50건 / 최대 200건.

**동작**: `GET /v1/traces?limit=50` → next cursor 받고 → `GET /v1/traces?cursor=<c>&limit=50` 반복.

**기대**:
- 같은 입력 데이터 → 같은 페이지 순서 (timestamp asc 고정)
- `limit > 200` → 200 으로 자동 clamp
- `limit <= 0` → 400 에러
- 잘못된 cursor (base64url 디코드 실패) → 400

**실패 시 수정 대상**: `query-system.md` — cursor 포맷과 clamping 규칙이 query-api 서비스별로 달라지면 클라이언트 재시도 로직이 무한루프.

## 시나리오 2: 존재하지 않는 리소스 404 ^overview

**전제**: query-api 가 `GET /v1/traces/:traceId`, `/v1/sessions/:sessionId`, `/v1/records/:recordId` 에서 404 를 정상 응답으로 정의.

**동작**: 삭제되었거나 미존재 traceId 조회.

**기대**:
- 404 Not Found 응답 (throw 또는 500 금지)
- 응답 바디에 `{ error, traceId }` 포함
- 내부적으로 Store 포트의 `find` 가 `undefined` 반환하면 404 매핑

**실패 시 수정 대상**: `query-system.md` §"Store 포트 의존" — Store 인터페이스가 "null vs throw" 혼합이면 api 가 방어적 구현으로 오염.

## 시나리오 3: RuntimeGraph 재구성 계약 ^overview

**전제**: query-api 가 `GET /v1/traces/:traceId/graph` 로 reconstruction 된 RuntimeGraph(노드+엣지) 반환.

**동작**: Phase 2 비동기 재구성이 완료된 trace 에 대한 graph 조회.

**기대**:
- 노드/엣지는 timestamp 오름차순
- 아직 재구성 안된 trace → 503 또는 `{ status: "pending" }` 응답 (명시)
- graph 포맷은 pipeline-system 의 `pipeline-phase-flow` Phase 2 출력과 동일

**실패 시 수정 대상**: `query-system.md` — RuntimeGraph 스키마가 pipeline Phase 2 출력과 binding 되지 않으면 api 는 재구성 미완 상태를 에러로 판정하거나 stale 데이터를 응답.

## 시나리오 4: record/trace/session 의존 포트 주입 ^overview

**전제**: query-api 가 "GraphStore, RecordStore, TraceStore, SessionStore 4개 포트 주입" 을 의존으로 선언.

**동작**: query-service 부팅 시 `createServiceBootConfig("query-service")` 로 포트 주입.

**기대**:
- 포트 누락 시 서비스 시작 실패 (명시적 에러)
- D1 환경과 Node Sqlite 환경이 같은 포트 인터페이스로 동작
- test 에서 InMemory 구현 교체 가능 (테스트 패턴 스펙 준수)

**실패 시 수정 대상**: `query-system.md` §"저장소 레이어" — 포트 주입 방식이 DI 컨테이너 여부에 따라 다르면 환경 간 migration 이 서비스 재작성으로 이어짐.
