---
def:
  id: observability-system-root
  type: spec
  tier: system
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  svc: observability
  links:
    - target: event-logging-lifecycle
      type: contains
  sources:
    - packages/logger/src/logger.ts
    - packages/logger/src/transport/ingest-forwarder.ts
    - packages/logger/src/transport/ingest-forwarder.test.ts
    - packages/apm/src/apm-logger.ts
    - packages/apm/src/apm-logger.test.ts
    - packages/core/src/lib/create-logger.ts
---
# Observability System Root
## 목적 ^purpose
로깅, 메트릭 수집, 트레이싱을 포함한 시스템 전체의 관측성 인프라를 관장한다.
