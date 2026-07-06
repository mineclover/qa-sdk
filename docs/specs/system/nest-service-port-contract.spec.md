---
def:
  id: nest-service-port-contract
  type: spec
  tier: system
  level: leaf
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: operation
  svc: nest-service-kit
  tags: [contract, runtime, structural]
  links:
    - target: nest-service-kit
      type: refines
    - target: architecture-revealing-code-convention
      type: depends_on
    - target: nest-service-kit-rule
      type: traces_to
    - target: nest-service-kit-test
      type: traces_to
    - target: nest-service-port-contract-test
      type: traces_to
sources:
  - packages/nest-service-kit/src/ports.ts
  - packages/nest-service-kit/src/event-envelope.ts
  - packages/nest-service-kit/src/event-envelope.test.ts
---

# Nest Service Port Contract

## 목적 ^purpose

application layer가 broker, outbox, transaction implementation에 직접 결합되지 않도록 minimal port surface를 정의한다.

## Port surface ^defines

| port | 역할 |
|------|------|
| `EventPublisherPort` | application layer가 semantic event를 publish하는 표준 surface |
| `MessageBusPort` | topic-aware infra adapter surface |
| `OutboxStorePort` | outbox append surface |
| `UnitOfWorkPort` | transaction boundary surface |
| `NoopEventPublisher` | template/test용 no-op publisher |
| `OutboxEventPublisher` | publish를 outbox append로 위임하는 adapter |

## 규칙 ^constraint

- application service는 abstract port만 import 한다.
- infra adapter만 broker, DB, queue, outbox implementation을 안다.
- `NoopEventPublisher`는 template, test, local scaffold baseline용이다. production event delivery를 대체하지 않는다.
- `OutboxEventPublisher`는 outbox append adapter이지 transport adapter가 아니다.
