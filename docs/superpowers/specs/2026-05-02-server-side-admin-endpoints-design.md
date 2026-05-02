# 2026-05-02 — Server-side admin endpoints (design)

> 본 문서는 design spec 의 §4 (sim-decision-view Input/View 매핑) 영역
> clarification 등록을 위한 stub. 원본 design spec 의 다른 섹션은 본 문서가
> 점진적으로 흡수한다.

## §4 — sim-decision-view Input/View 매핑

### Input 타입 vs View 타입 (역할 분리)

- **Input 타입** (`SafetyDecisionRecordInput`, `ResourceDecisionRecordInput`,
  `AlertEventRecordInput`, `AuditTraceInput`)
  - producer (canary-controller `DecisionBuilderService` 의 `SafetyDecisionRecord` /
    `ResourceDecisionRecord`) shape 을 그대로 mirror.
  - controller 어휘를 그대로 받음: safety action 은 `weight-update | noop`,
    resource action 은 `scale(reason) | noop`.
  - controller 가 직접 ring buffer / conversion 함수 입력으로 push 가능 (typecheck pass).

- **View 타입** (`SafetyDecisionRecordView`, `ResourceDecisionRecordView`,
  `AlertEventView`, `AuditTraceView`)
  - API consumer 친화 어휘: safety action 은 `weight-update | rollback | hold`,
    resource action 은 `scale | rejected | hold`.
  - HTTP API endpoint 응답 shape.

- **Conversion 함수** (`toSafetyDecisionView`, `toResourceDecisionView`,
  `toAlertEventView`, `toAuditTraceView`)
  - Input → View 의 단방향 normalize.
  - safety: `noop → hold`, `weight-update + verdict=rollback → rollback`.
  - resource: `noop + verdict=rejected → rejected`, `noop → hold`, `scale.reason → drop`.
  - reason 은 `triggerSignals[0]` 에서 파생, 없으면 verdict literal fallback.

이 설계는 controller 내부 어휘 변경 (예: `noop` 추가) 이 외부 API surface 에
직접 노출되는 것을 막고, normalize 단계에서 흡수한다.

### 기록 SSOT (DecisionRingBuffer)

`DecisionRingBuffer.appendSafety` / `appendResource` 는 Input 타입 (controller
record shape) 을 그대로 받는다. endpoint query 시점에 `toSafetyDecisionView` /
`toResourceDecisionView` 가 normalize 하여 응답한다.

상세는 Task 1.5 / 1.7 defect note 참조: `docs/superpowers/plans/2026-05-02-server-side-admin-endpoints/A-stage-1a-shared-and-decisions.md`.
