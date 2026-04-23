---
def:
  id: nest-service-event-envelope
  type: spec
  tier: component
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  layer: operation
  svc: nest-service-kit
  tags: [event, observability, contract]
  links:
    - target: nest-service-kit
      type: refines
    - target: event-intent-definition-rule
      type: depends_on
    - target: nest-service-kit-rule
      type: traces_to
    - target: nest-service-kit-test
      type: traces_to
    - target: nest-service-event-envelope-rule
      type: traces_to
    - target: nest-service-event-envelope-cases
      type: traces_to
    - target: nest-service-event-envelope-test
      type: traces_to
---
sources:
  - packages/nest-service-kit/src/event-envelope.ts


# Nest Service Event Envelope

## 목적 ^purpose

Nest 서비스가 raw mutation이 아니라 requester-aware semantic event를 같은 envelope shape로 만들도록 requester/data-effect contract를 고정한다.

## Envelope fields ^defines

핵심 필드:

- identity: `eventId`, `eventKey`, `eventVersion`, `occurredAt`
- producer: `producerService`, `producerModule`
- request context: `requestId`, `correlationId`, `causationId`
- requester context: `requesterType`, `requesterId`, `actorRole`
- behavior context: `behaviorUnit`, `requestRoute`, `requestMethod`
- subject/effect: `subjectType`, `subjectId`, `effectKind`, `outcome`
- payload: service-specific evidence payload

## 규칙 ^constraint

- 같은 data delta라도 requester, request path, behavior unit, effect kind가 다르면 event intent가 달라질 수 있다.
- `payload`는 service-specific 확장을 허용하지만 envelope 밖의 core field는 request/effect semantics를 우선 소유한다.
- alert/insight에 소비되는 event는 가능하면 `requesterType`, `behaviorUnit`, `subjectType`, `effectKind`, `outcome`을 함께 채운다.
