---
def:
  id: query-rules-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: domain
  svc: query-service
  tags: [scenario, query, policy-rule]
  links:
    - target: query-rules
      type: refines
    - target: query-system
      type: depends_on
sources:
  - packages/query-service/src/app.test.ts
  - packages/query-service/src/lib/rule-service.ts
  - packages/query-service/src/stores/policy-rule-store.ts
  - packages/query-service/src/stores/in-memory-policy-rule-store.ts
  - packages/query-service/src/stores/sql-policy-rule-store.ts
  - packages/query-service/src/lib/query-service.ts
---

# Query Rules (PolicyRule Store) — 소비자 기대 시나리오

## 목적 ^purpose

`query-rules`(PolicyRule CRUD + 충돌 전략 + Memory/SQL 어댑터)가 `query-system`에 의존할 때 기대하는 계약. rules는 query-system이 제공하는 저장소 드라이버, REST 엔드포인트, gate 연동 전제 위에서 일관된 규칙 해소를 보장한다.

소스: `packages/query-service/src/app.test.ts`, `packages/query-service/src/lib/rule-service.ts`, `packages/query-service/src/stores/policy-rule-store.ts`

## 시나리오 1: PolicyRuleStore 다중 구현 대체 ^overview

**전제**: `query-system.md`가 query-service 환경별 저장소(Node Sqlite / D1 / InMemory)를 각각 지원한다고 선언한다.

**동작**: 테스트에서 `InMemoryPolicyRuleStore` 주입, production 에서 `SqlPolicyRuleStore` 주입 동일 코드 경로 호출.

**기대**:
- 같은 `PolicyRule` 입력 → 같은 insert/findById/findByIndex 결과
- 어댑터 간 ID 생성 규칙(UUID) 동일
- InMemory 어댑터는 `:memory:` SqliteDriver 와 동등한 결과 보장

**실패 시 수정 대상**: `query-system.md` §"저장소 레이어" — 어댑터 간 계약 불일치가 있으면 테스트 통과 ≠ 운영 통과. port 인터페이스 고정 필요.

## 시나리오 2: 저장소 충돌 감지와 resolve 전략 분리 ^overview

**전제**: `query-rules`는 저장소 CRUD와 충돌 감지를 담당하고, 최종 정책 선택은 `/resolve`에 전달된 `rules`와 `strategy`가 담당한다.

**동작**: 서로 겹치는 pattern을 가진 규칙을 `POST /rules`로 생성하고, 별도 `POST /resolve` 호출에서 priority 전략을 사용한다.

**기대**:
- 저장소 생성/수정은 충돌을 감지하고 `force=true`가 아니면 409를 반환한다.
- 저장소는 latest-wins를 직접 적용하지 않는다.
- `/resolve`는 요청 body의 `strategy` 또는 `QUERY_DEFAULT_STRATEGY`에 따라 `most-specific`, `priority`, `collect`, `first-match`를 적용한다.

**실패 시 수정 대상**: `query-rules`와 `query-api`의 책임 경계. 저장소가 resolution 전략을 암묵 적용하면 CRUD 결과와 질의 결과가 분리되지 않는다.

## 시나리오 3: force=true 충돌 강제 생성 ^overview

**전제**: `query-rules`의 `POST /rules?force=true` 가 기존 규칙과 충돌해도 강제 생성을 허용.

**동작**: 동일 pattern + indexId + versionId 규칙이 존재할 때 force 없이 POST → 충돌 에러. force=true 로 재시도.

**기대**:
- force 없이 → 409 Conflict 응답
- force=true → 201 Created + 기존 rule 은 보존
- 응답에는 `conflicts` 배열이 포함되어 소비자가 force 사용 결과를 확인할 수 있다.

**실패 시 수정 대상**: `query-system.md`의 query-api — force 동작이 "기존 rule 삭제" 인지 "보존 생성" 인지 명문화. 현재 계약은 보존 생성이다.

## 시나리오 4: gate 통합 경로 fail-open ^overview

**전제**: `query-system.md`가 "GATE_SERVICE_URL 미설정 → NoopGateStateClient, 호출 실패 시 gateFailureMode 따라 fail-open/fail-closed" 를 규정.

**동작**: rule resolve 가 gate 상태를 합성해야 하는 상황에서 gate-service 가 타임아웃.

**기대**:
- `gateFailureMode: "fail-open"` → gate 상태 없이 질의 진행
- `gateFailureMode: "fail-closed"` → 503 `SERVICE_UNAVAILABLE`
- 기본값은 fail-open (CLAUDE.md §"Fail-open" 규약)

**실패 시 수정 대상**: `query-system.md` §"서비스 의존" — gateFailureMode 기본값이 선언되지 않으면 환경별로 정책이 달라 장애 시점 rule 평가가 비결정적.
