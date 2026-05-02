---
def:
  id: nest-service-bootstrap-test
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: operation
  svc: nest-service-kit
  tags: [testing, observability, runtime]
  links:
    - target: nest-service-bootstrap
      type: refines
sources:
  - packages/nest-service-kit/src/bootstrap.test.ts
---

# Nest Service Bootstrap — Validation Mapping

## 목적 ^purpose

bootstrap helper의 telemetry, logger warning bridge, shutdown hook, optional WebSocket wiring을 어떤 테스트가 검증하는지 연결한다.

## 검증 매핑 ^defines

| 검증 표면 | 테스트 |
|-----------|--------|
| Fastify bootstrap + shutdown hook | `packages/nest-service-kit/src/bootstrap.test.ts` |
| telemetry/logger warn bridge | `packages/nest-service-kit/src/bootstrap.test.ts` |
| optional WebSocket adapter | `packages/nest-service-kit/src/bootstrap.test.ts` |
