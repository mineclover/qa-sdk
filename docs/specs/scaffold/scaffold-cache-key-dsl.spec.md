---
def:
  id: scaffold-cache-key-dsl
  type: spec
  tier: system
  level: leaf
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: operation
  svc: scaffold
  tags: [scaffold, cache, dsl, governance, prefix]
  links:
    - target: scaffold-governance-metadata
      type: refines
    - target: scaffold-openmetadata-storage
      type: depends_on
  sources:
    - packages/architecture-schematics/src/governance/cache-key-dsl.ts
    - packages/architecture-schematics/src/governance/cache-key-dsl.test.ts
---

# scaffold cache key DSL

## 목적 ^purpose

cache key DSL은 Redis/read model/idempotency/lock key의 prefix를 임의 문자열이 아니라 등록된 1차원 namespace로 관리하고, concrete key를 `prefix:version:id...` 형태로 생성하는 계약이다.

## 구성 ^overview

- `CacheKeyDefinition.id`: 사람이 읽는 kebab-case identifier.
- `prefix`: concrete key의 첫 segment이며 DSL에서 관리되는 안정 namespace다.
- `version`: `v1` 형식의 cache key schema version이다.
- `purpose`: `read_model`, `idempotency`, `lock`, `projection`, `lookup` 중 하나다.
- `segments`: key 뒤에 붙는 identity segment 목록이며 순서가 schema다.
- `ttl`: `short`, `medium`, `long`, `none` 중 하나다.
- `openmetadataEntity`: read model/projection key가 나타내는 OpenMetadata entity FQN이다.

## 검증 규칙

- id/prefix는 kebab-case여야 한다.
- version은 `vN` 형식이어야 한다.
- prefix는 manifest 안에서 중복될 수 없다.
- read model/projection key는 OpenMetadata entity mapping을 가져야 한다.
- PII segment는 raw value를 key에 넣지 않고 `hash` encoding을 사용해야 한다.
- idempotency 외 key는 TTL policy를 명시해야 한다.

