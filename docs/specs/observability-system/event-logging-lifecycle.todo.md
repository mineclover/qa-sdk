---
def:
  id: event-logging-lifecycle-todo
  type: knowledge
  knowledge_kind: proposal
  tier: component
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: operation
  svc: observability
  tags: [observability, logging, ingest]
  links:
    - target: event-logging-lifecycle
      type: traces_to
---

# Event Logging Lifecycle — TODO

## 목적 ^purpose

event logging lifecycle의 남은 실행 작업만 추적한다. 구현된 사실은 `event-logging-lifecycle` spec과 관련 rule/test 문서가 소유한다.

## 실행 항목

### Actionable — 실행 가능

- [x] Default log event taxonomy policy
  - [x] `svc_log.<level>` event key를 core vocabulary 또는 mapping pack에서 어떻게 다룰지 결정
  - [x] default key를 금지하고 서비스가 `eventKey`를 명시하게 할지 결정
  - [x] 결정 후 `log-ingest-bridge`와 `service-event-adoption-rule` 정렬

- [ ] Event taxonomy gate smoke
  - [ ] registry service running 조건에서 `pnpm gate:event-taxonomy` 결과 캡처
  - [ ] 실패 시 service-level check/assert 경로 문서화

### Deferred — 조건부 대기

- [ ] End-to-end lifecycle BDD
  - [ ] logger -> ingest -> taxonomy gate happy path contract 작성
  - [ ] default `svc_log.<level>` 미등록 failure/warn path contract 작성
