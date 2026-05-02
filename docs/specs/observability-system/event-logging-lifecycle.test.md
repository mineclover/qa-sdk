---
def:
  id: event-logging-lifecycle-test
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
sources:
  - packages/logger/src/transport/ingest-forwarder.test.ts
  - packages/ingest-server/src/lib/enrich-address-context.test.ts
  - packages/registry-service/src/core/seed-events.test.ts
  - packages/registry-service/src/modules/events/event.controller.test.ts
---

# Event Logging Lifecycle — Validation Mapping

## 목적 ^purpose

event logging lifecycle이 어떤 테스트 표면으로 검증되는지 연결한다. 이 문서는 구현 사실이나 운영 규칙을 재정의하지 않고 evidence surface만 소유한다.

## 검증 매핑 ^defines

| 검증 표면 | 테스트 |
|-----------|--------|
| pino log -> EventRecord 변환 | `packages/logger/src/transport/ingest-forwarder.test.ts` |
| `addressContext` 없는 로그 필터링 | `packages/logger/src/transport/ingest-forwarder.test.ts` |
| `infra_context` + `address_context` merge | `packages/ingest-server/src/lib/enrich-address-context.test.ts` |
| event taxonomy pack/adoption materialization | `packages/registry-service/src/core/seed-events.test.ts` |
| taxonomy check/assert API | `packages/registry-service/src/modules/events/event.controller.test.ts` |

## 시나리오 매핑

| case | 검증 표면 |
|------|----------|
| `C-001` | 명시 `eventKey` 우선순위 + registry known event validation |
| `C-002` | `svc_log.<level>` fallback 생성 + fallback은 adoption-clean이 아님 |
| `C-003` | `addressContext` 없는 로그 필터링 |

## 소비 ^consumes

- `event-logging-lifecycle`
- `event-taxonomy-contracts-test`
- `ingest-interface-contract`
