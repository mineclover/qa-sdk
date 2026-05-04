---
def:
  id: sim-identifier-grammar
  type: spec
  tier: system
  level: leaf
  scope: interface
  aspect: cli_contract
  depth: specification
  lifecycle: approved
  layer: operation
  svc: sim-identifier-grammar
  tags: [simulator, grammar, contract, identifier]
  links:
    - target: system-libraries
      type: refines
  sources:
    - packages/sim-identifier-grammar/src/index.ts
    - packages/sim-identifier-grammar/src/cache-key.ts
    - packages/sim-identifier-grammar/src/cycle-id.ts
    - packages/sim-identifier-grammar/src/decision-category.ts
    - packages/sim-identifier-grammar/src/decision-id.ts
    - packages/sim-identifier-grammar/src/decision-signal.ts
    - packages/sim-identifier-grammar/src/event-name.ts
    - packages/sim-identifier-grammar/src/http-header.ts
    - packages/sim-identifier-grammar/src/idempotency-key.ts
    - packages/sim-identifier-grammar/src/image-tag.ts
    - packages/sim-identifier-grammar/src/label-key.ts
    - packages/sim-identifier-grammar/src/pubsub-channel.ts
    - packages/sim-identifier-grammar/src/replication-slot.ts
    - packages/sim-identifier-grammar/src/schema-hash.ts
    - packages/sim-identifier-grammar/src/service-prefix.ts
    - packages/sim-identifier-grammar/src/version-tag.ts
---

# sim-identifier-grammar

## 목적 ^purpose

enterprise-pm 시뮬레이션의 식별자(cache key, cycle id, decision id, event name, image tag 등)를 합성/역분해/검증하는 grammar SSOT. producer/consumer가 같은 형식으로 식별자를 다루도록 한다.

## 구성 ^overview

identifier 종류별 builder/parser/validator export로 구성된다.

- `service-prefix.ts`, `version-tag.ts`, `image-tag.ts` — service prefix, version tag, image tag 식별자 grammar.
- `http-header.ts`, `event-name.ts`, `pubsub-channel.ts`, `label-key.ts` — 통신/라벨 식별자 grammar.
- `decision-id.ts`, `decision-category.ts`, `decision-signal.ts`, `cycle-id.ts` — decision/cycle 식별자 grammar.
- `cache-key.ts`, `idempotency-key.ts`, `replication-slot.ts`, `schema-hash.ts` — cache, idempotency, replication, schema hash 식별자 grammar.
- `index.ts` — 위 모듈의 공개 export surface.
