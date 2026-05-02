---
def:
  id: event-logging-lifecycle-memo
  type: knowledge
  knowledge_kind: narrative
  tier: component
  level: leaf
  scope: flow
  aspect: process_flow
  depth: validation
  lifecycle: draft
  layer: operation
  svc: observability
  tags: [observability, logging, ingest, review]
  links:
    - target: event-logging-lifecycle
      type: traces_to
---

# Event Logging Lifecycle — Review Memo

## 목적 ^purpose

event logging lifecycle 기능 리뷰 중 확인한 판정과 검증 결과를 기록한다. 지속 계약은 `event-logging-lifecycle` spec/rule/test/cases 문서가 소유하고, 이 문서는 시점성 review evidence만 소유한다.

## 2026-04-21 리뷰 기록

- `IngestForwarder` 구현은 명시 `eventKey`를 우선하고, 없으면 `svc_log.<level>` fallback을 만든다.
- 현재 event-catalog에는 `svc_log.*`가 core event 또는 active mapping pack으로 등록되어 있지 않다.
- 따라서 fallback key는 진단용이며, taxonomy-clean domain/production event는 명시 `eventKey`를 사용해야 한다.
- `pnpm gate:event-taxonomy`는 `localhost:3300` registry-service 미기동으로 실패했다. drift 판정 전 단계에서 막힌 것이므로 registry-service 실행 후 재시도해야 한다.
- CLI usability review에서 `docs collect` text header가 `docs status:`로 출력되는 혼선을 고쳤고, JSON `counts.relatedDocuments`를 추가했다. 기존 `counts.familyMembers`는 호환용으로 유지한다.
