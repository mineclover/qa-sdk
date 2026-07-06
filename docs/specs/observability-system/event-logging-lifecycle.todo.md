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
sources:
  - docs/specs/observability-system/event-logging-lifecycle.spec.md
  - docs/specs/observability-system/event-logging-lifecycle.rule.md
  - docs/specs/observability-system/event-logging-lifecycle.test.md
  - packages/logger/src/transport/ingest-forwarder.test.ts
  - packages/ingest-server/src/routes/ingest.test.ts
  - packages/registry-service/src/core/seed-events.test.ts
  - packages/registry-service/src/modules/events/event.controller.test.ts
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
  - [x] service/catalog level taxonomy check/assert API는 registry-service 테스트로 검증

### Deferred — 조건부 대기

- [ ] End-to-end lifecycle BDD
  - [ ] logger -> ingest -> taxonomy gate happy path contract 작성
  - [ ] default `svc_log.<level>` 미등록 failure/warn path contract 작성

## 완료된 근거

- Default log event taxonomy policy는 `event-logging-lifecycle.spec.md`와 `event-logging-lifecycle.rule.md`의 current contract로 승격됐다.
- Unit/service level 검증 표면은 `event-logging-lifecycle.test.md`가 소유한다.
- 이 문서의 남은 항목은 live registry service를 요구하는 smoke와 end-to-end BDD뿐이다.
