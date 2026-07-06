---
def:
  id: nest-service-event-envelope-rule
  type: spec
  tier: component
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  svc: nest-service-kit
  tags: [observability, event, contract]
  links:
    - target: nest-service-event-envelope
      type: constrains
sources:
  - packages/nest-service-kit/src/event-envelope.ts
  - packages/nest-service-kit/src/event-envelope.test.ts
  - packages/nest-service-kit/src/ports.ts
---

# Nest Service Event Envelope — Observability Rule

## 목적 ^purpose

requester-aware event envelope가 event, audit, metric, trace, log 해석에 필요한 최소 observability field를 잃지 않도록 규칙을 정의한다.

## 규칙 ^constraint

- envelope는 `eventKey`, `eventVersion`, `producerService`를 가져야 한다.
- requester/behavior/request path/subject/effect/outcome은 observability와 audit 해석에 필요한 경우 함께 기록한다.
- payload는 service-specific evidence를 담되, event intent를 대체하지 않는다.

## 검증 ^validation

```bash
corepack pnpm --filter @qa-sdk/nest-service-kit test event-envelope
```
