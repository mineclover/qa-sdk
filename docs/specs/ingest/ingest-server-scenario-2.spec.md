---
def:
  id: ingest-server-scenario-2
  scope: feature
  aspect: scenario
  depth: specification
  lifecycle: draft
  svc: ingest-server
  links:
    - target: ingest-system
      type: refines
    - target: ingest-interface-pipeline
      type: depends_on
    - target: scenario-store-spec
      type: depends_on
---
# Phase 2 verdict 활성화

## 목적 ^purpose

ScenarioSpec 등록 이후 ingest-server의 Phase 2 verdict 계산이 실제 세션 이벤트를 기반으로 활성화되고, verdict 조회까지 이어지는 운영 기준 시나리오를 정의한다.

## 행위자 ^actor

- **QA 엔지니어**: ScenarioSpec을 설계하고 등록하는 사람
- **클라이언트 SDK**: shopping-web 서비스에서 @qa-sdk/sdk를 사용하여 이벤트를 전송
- **ingest-server**: Phase 1(수집/저장) + Phase 2(verdict 계산) 파이프라인 실행

## 사전 조건 ^preconditions

- ingest-server가 STORE_DRIVER=memory로 기동 (port 3200)
- Catalog에 `page_view`, `cart_event`, `order_event` prefix가 active 상태로 등록
- ScenarioSpecStore가 비어 있음 (Phase 2 verdict 계산이 비활성 상태)
- 클라이언트 SDK가 초기화 (ServiceBootConfig에 `qa_session_id` 포함)
- convergence 실패가 Phase 2 verdict/활성화를 차단하지 않는 격리 보장

## 스텝 ^steps

1. QA 엔지니어가 "checkout-flow" ScenarioSpec을 작성 → `POST /v1/scenarios` 전송
2. ingest-server가 `compileSpec()`으로 구조 검증 → 201 응답 (`{ accepted: true, scenario_id: "checkout-flow" }`)
3. `GET /v1/scenarios` 호출 → items 배열에 등록된 ScenarioSpec 1건 확인
4. 클라이언트 SDK가 `sdk.track("page.view", { url: "/products" })` 호출 → `POST /v1/ingest` 전송
5. ingest-server Phase 1: Record 생성 + Trace/Session 저장 → 202 응답
6. 클라이언트 SDK가 `sdk.track("cart.add", { product_id: "P001", quantity: 1 })` 호출 → 같은 `qa_session_id`로 전송
7. 클라이언트 SDK가 `sdk.track("order.create", { order_id: "ORD-001" })` 호출 → 같은 `qa_session_id`로 전송
8. ingest-server Phase 2 활성화: ScenarioSpecStore에 시나리오가 존재하므로 `computePendingVerdicts` 실행
9. Phase 2가 session의 Record 시퀀스를 ScenarioSpec steps와 매칭 → VerdictReport 생성
10. `GET /v1/sessions/:sessionId/verdicts` 호출 → verdict 결과 조회

## 검증 ^assertions

- `POST /v1/scenarios` → 201, `accepted: true`
- `GET /v1/scenarios` → items.length === 1, items[0].scenario_id === "checkout-flow"
- 각 `POST /v1/ingest` → 202, `accepted: true`
- Session에 3건의 Record가 축적 (qa_session_id 기준 그룹핑)
- Phase 2가 실행되어 VerdictStore에 verdict 1건 이상 생성
- `GET /v1/sessions/:sessionId/verdicts` → 200, items 배열에 verdict 존재
- VerdictReport.overall_verdict가 "pass" | "fail" | "warn" 중 하나 (unknown이 아닌 유효한 판정)
- VerdictReport.step_matches 배열의 길이가 ScenarioSpec.steps 길이와 일치
- VerdictReport.missing_steps: 모든 required step이 매칭되었으면 빈 배열
- VerdictReport.computed_at이 ISO-8601 UTC 형식
- convergence 파이프라인이 실패하더라도 verdict 계산은 정상 완료 (에러 격리)

## 변형 ^variants

### V1: 필수 스텝 누락 → fail verdict

- ScenarioSpec에 `order.complete` step을 required로 포함하되 해당 이벤트를 전송하지 않음
- VerdictReport.overall_verdict === "fail"
- VerdictReport.missing_steps에 누락된 step_id 포함

### V2: optional 스텝이 있는 시나리오

- ScenarioSpec에 `cart.remove` step을 `kind: "optional"`로 정의
- 해당 이벤트 미전송 시에도 overall_verdict가 fail이 아님
- optional step의 StepMatch.verdict === "unknown" (매칭 노드 없음)

### V3: branch 스텝을 가진 시나리오

- ScenarioSpec에 `payment.card` / `payment.transfer` 두 갈래 `kind: "branch"` step 정의
- 한쪽만 이벤트 전송 → 매칭된 branch의 verdict가 pass, 전체 verdict 영향 없음

### V4: verdict 강제 재계산

- 추가 이벤트 전송 후 `POST /v1/traces/:traceId/verdicts/recompute` 호출
- 기존 verdict 삭제 + 새 VerdictReport 생성
- 응답의 computed 배열에 재계산 항목 포함

### V5: 잘못된 ScenarioSpec 등록 시도

- steps 배열이 비어 있거나 scenario_id 누락 → `POST /v1/scenarios` → 400
- ScenarioSpecStore에 저장되지 않음
- Phase 2 동작에 영향 없음

### V6: convergence 실패 시 Phase 2 격리 검증

- CONVERGENCE_ENABLED=true 상태에서 convergence 파이프라인에 오류 주입
- Phase 2 verdict 계산은 영향 없이 정상 완료
- verdict 결과 조회 가능

## 재검토 트리거 ^update-trigger

- ingest-interface-pipeline: Phase 2 처리 경로 변경 시
- scenario-store-spec: ScenarioSpec 구조 또는 ScenarioSpecStore 인터페이스 변경 시
- verdict-spec: VerdictReport 필드 또는 Verdict enum 변경 시
- compute-pending-verdicts: 매칭 알고리즘 또는 verdict 판정 로직 변경 시
- convergence 격리 정책 변경 시
