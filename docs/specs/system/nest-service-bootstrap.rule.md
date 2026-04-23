---
def:
  id: nest-service-bootstrap-rule
  type: spec
  tier: component
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  svc: nest-service-kit
  tags: [observability, runtime, contract]
  links:
    - target: nest-service-bootstrap
      type: constrains
---

# Nest Service Bootstrap — Observability Rule

## 목적 ^purpose

bootstrap 단계의 telemetry, audit log, runtime log, metric, trace wiring이 누락되지 않도록 observability contract를 정의한다.

## 규칙 ^constraint

- service bootstrap은 telemetry init과 shutdown flush를 함께 소유한다.
- startup/shutdown log는 service boot 상태를 남겨야 한다.
- port conflict warning은 runtime log surface로 노출되어야 한다.
- WebSocket adapter는 optional이지만, 활성화 시 trace/log lifecycle 안에 포함되어야 한다.
