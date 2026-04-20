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
---

# Query Rules (PolicyRule Store) — 소비자 기대 시나리오

## 목적 ^purpose

`query-rules`(PolicyRule CRUD + 충돌 전략 + Memory/SQL 어댑터)가 `query-system`에 의존할 때 기대하는 계약. rules는 query-system이 제공하는 저장소 드라이버, REST 엔드포인트, gate 연동 전제 위에서 일관된 규칙 해소를 보장한다.

## 시나리오 1: PolicyRuleStore 다중 구현 대체 ^overview

**전제**: `query-system.md`가 query-service 환경별 저장소(Node Sqlite / D1 / InMemory)를 각각 지원한다고 선언한다.

**동작**: 테스트에서 `InMemoryPolicyRuleStore` 주입, production 에서 `SqlPolicyRuleStore` 주입 동일 코드 경로 호출.

**기대**:
- 같은 `PolicyRule` 입력 → 같은 insert/findById/findByIndex 결과
- 어댑터 간 ID 생성 규칙(UUID) 동일
- InMemory 어댑터는 `:memory:` SqliteDriver 와 동등한 결과 보장

**실패 시 수정 대상**: `query-system.md` §"저장소 레이어" — 어댑터 간 계약 불일치가 있으면 테스트 통과 ≠ 운영 통과. port 인터페이스 고정 필요.

## 시나리오 2: priority 동률 latest-wins ^overview

**전제**: `query-rules`가 "priority 기반, 같은 priority 시 latest-wins" 충돌 전략을 명시.

**동작**: 같은 pattern + priority 를 가진 rule A(updatedAt=t1), B(updatedAt=t2, t2>t1)가 존재할 때 resolve 호출.

**기대**:
- B 가 적용됨 (latest-wins)
- A 는 store 에 남아있으나 resolve 결과에는 미노출
- timestamp 비교는 `compareTimestamps` 사용 (문자열 비교 금지)

**실패 시 수정 대상**: `query-system.md` — latest-wins 정의가 모호하면 timestamp 해석(tz, precision) 차이로 우선 rule 이 환경별로 다름.

## 시나리오 3: force=true 충돌 강제 생성 ^overview

**전제**: `query-rules`의 `POST /rules?force=true` 가 기존 규칙과 충돌해도 강제 생성을 허용.

**동작**: 동일 pattern + indexId + versionId 규칙이 존재할 때 force 없이 POST → 충돌 에러. force=true 로 재시도.

**기대**:
- force 없이 → 409 Conflict 응답
- force=true → 201 Created + 기존 rule 은 보존 (deprecate 또는 priority 낮춤)
- audit log 에 force 사용 기록

**실패 시 수정 대상**: `query-system.md`의 query-api — force 동작이 "기존 rule 삭제" 인지 "비활성화" 인지 명문화. 삭제라면 rollback 불가 위험 고지.

## 시나리오 4: gate 통합 경로 fail-open ^overview

**전제**: `query-system.md`가 "GATE_SERVICE_URL 미설정 → NoopGateStateClient, 호출 실패 시 gateFailureMode 따라 fail-open/fail-closed" 를 규정.

**동작**: rule resolve 가 gate 상태를 합성해야 하는 상황에서 gate-service 가 타임아웃.

**기대**:
- `gateFailureMode: "open"` → rule 결과에 gate 상태 생략 + warning metric
- `gateFailureMode: "closed"` → 해당 rule 평가 실패로 reject
- 기본값은 fail-open (CLAUDE.md §"Fail-open" 규약)

**실패 시 수정 대상**: `query-system.md` §"서비스 의존" — gateFailureMode 기본값이 선언되지 않으면 환경별로 정책이 달라 장애 시점 rule 평가가 비결정적.
