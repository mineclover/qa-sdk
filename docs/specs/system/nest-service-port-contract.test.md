---
def:
  id: nest-service-port-contract-test
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: operation
  svc: nest-service-kit
  tags: [testing, runtime, contract]
  links:
    - target: nest-service-port-contract
      type: refines
sources:
  - packages/nest-service-kit/src/event-envelope.test.ts
---

# Nest Service Port Contract — Validation Mapping

## 목적 ^purpose

port contract 중 현재 baseline에서 기계화된 publish surface 검증을 어떤 테스트가 담당하는지 연결한다.

## 검증 매핑 ^defines

| 검증 표면 | 테스트 |
|-----------|--------|
| `NoopEventPublisher.publish()`가 envelope를 그대로 기록하는 contract | `packages/nest-service-kit/src/event-envelope.test.ts` |
