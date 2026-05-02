---
def:
  id: nest-service-kit-test
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
    - target: nest-service-kit
      type: refines
    - target: nest-service-bootstrap
      type: depends_on
    - target: nest-service-event-envelope
      type: depends_on
    - target: nest-service-port-contract
      type: depends_on
sources:
  - packages/nest-service-kit/src/bootstrap.test.ts
  - packages/nest-service-kit/src/event-envelope.test.ts
---

# Nest Service Kit — Validation Mapping

## 목적 ^purpose

`@qa-sdk/nest-service-kit`의 bootstrap, telemetry/log warning wiring, requester-aware event envelope, no-op publisher contract를 어떤 테스트가 검증하는지 연결한다.

## 검증 매핑 ^defines

| 검증 표면 | 테스트 |
|-----------|--------|
| Fastify bootstrap, shutdown hook, logger/warn bridge | `packages/nest-service-kit/src/bootstrap.test.ts` |
| optional WebSocket adapter wiring | `packages/nest-service-kit/src/bootstrap.test.ts` |
| requester-aware event envelope fields | `packages/nest-service-kit/src/event-envelope.test.ts` |
| `NoopEventPublisher` publish contract | `packages/nest-service-kit/src/event-envelope.test.ts` |

## 검증 명령

```bash
pnpm --filter @qa-sdk/nest-service-kit test
```
