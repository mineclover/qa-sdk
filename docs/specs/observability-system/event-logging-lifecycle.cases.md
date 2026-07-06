---
def:
  id: event-logging-lifecycle-cases
  type: spec
  tier: component
  level: leaf
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: operation
  svc: observability
  tags: [observability, logging, ingest, testing]
  links:
    - target: event-logging-lifecycle
      type: refines
    - target: event-logging-lifecycle-rule
      type: depends_on
sources:
  - packages/logger/src/transport/ingest-forwarder.test.ts
  - packages/ingest-server/src/lib/enrich-address-context.test.ts
  - packages/ingest-server/src/routes/ingest.test.ts
  - packages/registry-service/src/core/seed-events.test.ts
  - packages/registry-service/src/modules/events/event.controller.test.ts
---

# Event Logging Lifecycle — Cases

## 목적 ^purpose

event logging lifecycle의 사용자 관점 시나리오를 정리한다. 흐름의 권위는 `event-logging-lifecycle`, 판정 기준은 `event-logging-lifecycle-rule`이 소유하며, 이 문서는 기대 상황만 소유한다.

## 시나리오 ^defines

### C-001: Gate-clean coordinated domain log

- **Given** 서비스 로그에 `addressContext`와 adopted mapping pack/core vocabulary에 속한 명시 `eventKey`가 있다.
- **When** `IngestForwarder`가 pino log를 `EventRecord`로 변환하고 `/v1/ingest`로 전송한다.
- **Then** `addressContext`는 `address_context`로 저장되고, `event_key`는 명시 `eventKey`를 유지한다.
- **And** registry validation은 해당 event key를 known으로 판정해야 한다.

### C-002: Diagnostic fallback log

- **Given** 서비스 로그에 `addressContext`는 있지만 명시 `eventKey`가 없다.
- **When** `IngestForwarder`가 pino log를 `EventRecord`로 변환한다.
- **Then** `event_key`는 `svc_log.<level>` fallback으로 생성된다.
- **And** fallback key는 adoption-clean key로 자동 인정되지 않으므로, gate-clean이 필요하면 호출부가 명시 `eventKey`를 넣거나 별도 mapping pack을 채택해야 한다.

### C-003: Uncoordinated operational log

- **Given** 서비스 로그에 `addressContext`가 없다.
- **When** `IngestForwarder`가 pino log를 수신한다.
- **Then** 로그는 stdout 운영 로그로만 남고 ingest로 forward되지 않는다.

## 검증 표면 ^evidence

- `C-001`: logger test의 명시 `eventKey` 우선순위, `address_context` 전달, ingest route의 registry known/invalid validation mode, registry-service의 adoption materialization 및 taxonomy check/assert 테스트로 나뉘어 검증한다.
- `C-002`: logger test의 `svc_log.info` fallback 생성과 registry-service seed 테스트의 mapping adoption materialization 조건으로 검증한다. fallback key 자체의 gate-clean 여부는 별도 mapping pack/adoption이 생길 때만 바뀐다.
- `C-003`: logger test의 `addressContext` 없음/빈 객체 필터링으로 검증한다.
