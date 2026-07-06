---
def:
  id: nest-service-kit
  type: design
  tier: layout
  owner_system: nest-service-kit
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: operation
  svc: nest-service-kit
  tags: [entry-point, runtime, structural, template]
  links:
    - target: service-definition-standard
      type: refines
    - target: architecture-revealing-code-convention
      type: depends_on
    - target: event-intent-definition-rule
      type: depends_on
    - target: nest-service-bootstrap
      type: refs
    - target: nest-service-event-envelope
      type: refs
    - target: nest-service-port-contract
      type: refs
    - target: nest-service-kit-rule
      type: traces_to
    - target: nest-service-kit-test
      type: traces_to
sources:
  - packages/nest-service-kit/src/index.ts
  - packages/nest-service-kit/src/bootstrap.ts
  - packages/nest-service-kit/src/event-envelope.ts
  - packages/nest-service-kit/src/ports.ts
---

# Nest Service Kit

## 목적 ^purpose

NestJS 기반 서비스가 같은 bootstrap/event/port vocabulary로 시작할 수 있게 하는 pack root다. 목적은 각 서비스가 부트스트랩, requester-aware event envelope, application-to-infra port surface를 제각각 다시 만들지 않고, 같은 starting kit 위에서 service-specific behavior만 소유하게 하는 것이다.

## 구성 ^overview

- `nest-service-bootstrap`: Fastify Nest app bootstrap, telemetry init, shutdown hook, optional WebSocket adapter.
- `nest-service-event-envelope`: requester, behavior unit, request path, subject, effect, outcome를 담는 event envelope component.
- `nest-service-port-contract`: application layer가 의존하는 `EventPublisherPort`, `MessageBusPort`, `OutboxStorePort`, `UnitOfWorkPort`.

## Pack boundary ^constraint

- 이 pack root는 public export와 조망만 소유한다.
- runtime behavior는 `nest-service-bootstrap`, data contract는 `nest-service-event-envelope`, application import surface는 `nest-service-port-contract`가 소유한다.
- 서비스 템플릿은 이 pack을 baseline으로 소비하되, 실제 domain adapter와 service-specific docs closure는 각 서비스가 소유한다.
