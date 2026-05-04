---
def:
  id: sim-decision-view
  type: spec
  tier: system
  level: leaf
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: operation
  svc: sim-decision-view
  tags: [simulator, contract, view, dto]
  links:
    - target: system-libraries
      type: refines
  sources:
    - packages/sim-decision-view/src/alert-event-view.ts
    - packages/sim-decision-view/src/audit-trace-view.ts
    - packages/sim-decision-view/src/conversion.ts
    - packages/sim-decision-view/src/resource-decision-view.ts
    - packages/sim-decision-view/src/safety-decision-view.ts
---

# sim-decision-view

## 목적 ^purpose

controller 결정 객체(safety/resource verdict, alert event, audit trace)가 producer(canary controller)와 consumer(approval-api, sim-handles, dashboard) 양쪽에서 동일한 view shape로 직렬화되도록 DTO SSOT를 고정한다. 본 패키지에서 type 과 conversion 함수를 import 하지 않은 producer/consumer 는 typecheck 시점에 drift 가 검출된다.

## 구성 ^overview

다섯 개 view 모듈로 구성된다.

- `safety-decision-view.ts` — `SafetyDecisionRecordView`, `SafetyVerdict`, `SafetyCategory`, `CategoryVerdict`, `SafetyAction` 타입.
- `resource-decision-view.ts` — `ResourceDecisionRecordView`, `ResourceVerdict`, `ResourceCategory`, `ResourceRejection`, `ResourceAction` 타입.
- `alert-event-view.ts` — `AlertEventView` 타입 (controller 가 발신하는 alert payload shape).
- `audit-trace-view.ts` — `AuditTraceView` 타입 (decision 의 nested audit chain).
- `conversion.ts` — `toSafetyDecisionView`, `toResourceDecisionView`, `toAlertEventView`, `toAuditTraceView` 변환 함수와 대응 input 타입.

원본 결정 모델은 `docs/superpowers/specs/2026-04-28-canary-scaling/01-decision-model.md` 의 `SafetyDecisionRecord` / `ResourceDecisionRecord` 정의를 따른다 — 본 spec 은 그 record 를 view 직렬화 boundary 로 좁힌 것이다.
