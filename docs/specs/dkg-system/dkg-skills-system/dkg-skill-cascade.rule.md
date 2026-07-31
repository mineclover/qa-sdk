---
def:
  id: dkg-skill-cascade-observability
  type: rule
  tier: component
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [observability, convention, runtime, failure]
  links:
    - target: dkg-skill-cascade
      type: constrains
sources:
  - packages/dkg/src/skills/runtime-usage-audit.ts
  - packages/dkg/src/skills/runtime-usage-audit.test.ts
  - packages/ingest-server/src/lib/convergence-pipeline.ts
  - packages/ingest-server/src/lib/convergence-e2e.test.ts
---

# DKG cascade observability rule

## 목적 ^purpose

변경 영향 분석과 DSL ownership 검토가 정적 그래프만으로 완료되었다고 판정되지 않도록,
runtime evidence의 수집·freshness·범위를 명시적으로 확인한다.

## 관측 evidence ^constraint

- `usage_snapshots`는 집계된 historical metric이며 active consumer의 증거로 자동 승격하지 않는다.
- `flow_evidence_records`는 ingest의 `address_context`와 trace/session/event 범위를 보존하는 raw runtime evidence다.
- `cli_audit_events`는 CLI 실행 경로의 audit event이며 business flow evidence와 분리한다.
- flow observation recovery는 fresh evidence와 현재 실행 records가 함께 있을 때만 허용한다. evidence가 없거나 stale이면 observation을 자동 해소하지 않는다.
- metric, log, trace, audit event가 어느 범위의 prefix를 관측했는지 출력되어야 하며, synthetic/test 입력은 운영 business evidence로 분류하지 않는다.
- self-check는 회복된 observation과 의도적으로 유지한 metric issue를 별도 출력하고, evidence freshness·human decision·미해결 graph 상태 중 유지 이유를 표시해야 한다.

## DSL ownership 입력 정책 ^constraint

- source/consumer/flow/rationale 중 하나라도 없는 ownership 결정은 validation error/failure로 거부한다.
- 실패 경로에서는 DecisionNode·ownership edge·observation resolution을 저장하지 않는다.
- 사람이 기록한 DecisionNode만 후속 audit 입력으로 사용하며 owner DSL 자동 추론은 금지한다.

## 검증 경로 ^overview

`POST /v1/ingest` → Phase 2 완료 알림 → convergence flush →
`saveFlowEvidence()`의 순서를 `packages/ingest-server/src/lib/convergence-e2e.test.ts`가
검증한다. 정적 영향 분석의 persisted read model 합산은
`packages/dkg/src/skills/runtime-usage-audit.test.ts`가 검증한다.
