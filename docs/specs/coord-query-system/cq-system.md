---
def:
  id: cq-system
  tier: system
  address: def_document:v2:68618
  scope: feature
  aspect: codec_func
  depth: overview
  lifecycle: approved
  layer: domain
  svc: query-service
  tags: [structural, entry-point]
  links:
    - target: cq-policy-resolver
      type: contains
    - target: cq-cross-index
      type: contains
    - target: cq-version-query
      type: contains
    - target: cq-relational-engine
      type: contains
    - target: wi-system
      type: depends_on
sources:
  - packages/index-meta/src/policy-resolver.ts
  - packages/index-meta/src/cross-index-query.ts
  - packages/index-meta/src/version-query.ts
  - packages/index-meta/src/relational-engine.ts
  - packages/query-service/src/lib/query-service.ts
  - packages/query-service/src/routes/query.ts
  - packages/query-service/src/app.test.ts
---

# Coordinate Query 시스템

## 목적 ^purpose

닫힌 좌표 공간 위의 패턴 포함 관계, 정책 해소, cross-index 합성 질의, 버전 횡단 탐색을 다루는 n차원 연산 계층. range algebra 위에 lattice, policy, join, version 연산을 쌓는다.

소스: `packages/index-meta/src/policy-resolver.ts`, `packages/index-meta/src/cross-index-query.ts`, `packages/index-meta/src/version-query.ts`, `packages/index-meta/src/relational-engine.ts`, `packages/query-service/src/lib/query-service.ts`

## 구성 ^overview

- `cq-policy-resolver`: PolicyRule 집합에서 특정 좌표에 적용되는 정책을 해소하는 함수.
- `cq-cross-index`: `index_ref` dim을 통해 하위 index 조건을 상위 index 주소 범위로 변환하는 함수.
- `cq-version-query`: 동일 index의 여러 version을 횡단해 entity 기준 range 조회, entity span 조회, constraint 변환을 수행하는 함수.
- `cq-relational-engine`: policy-resolver, cross-index-query, version-query를 통합하여 단일 질의 인터페이스를 제공하는 오케스트레이터.
