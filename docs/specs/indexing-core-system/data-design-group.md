---
def:
  id: data-design-group
  tier: system
  address: def_document:v2:342020
  scope: data
  aspect: domain_data
  depth: overview
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [structural, cross-scope]
  links:
    - target: data-design-compression
      type: contains
    - target: data-design-catalog
      type: contains
    - target: indexing-core-system
      type: depends_on
sources:
  - packages/weighted-index/src/index.ts
  - packages/weighted-index/src/math/weighted-index.ts
  - packages/weighted-index/src/math/weighted-index.test.ts
  - packages/weighted-index/src/math/calc.ts
  - packages/weighted-index/src/math/calc.test.ts
  - packages/weighted-index/package.json
  - packages/weighted-index/src/vocab/label-registry.ts
  - packages/weighted-index/src/vocab/label-registry.test.ts
  - packages/weighted-index/src/vocab/prefix-registry.ts
  - packages/weighted-index/src/vocab/prefix-registry.test.ts
  - packages/weighted-index/src/vocab/partial-binder.ts
  - packages/weighted-index/src/vocab/partial-binder.test.ts
  - packages/index-meta/src/meta-registry.ts
  - packages/index-meta/src/meta-registry.test.ts
  - packages/index-meta/src/meta-resolver.ts
  - packages/index-meta/src/meta-resolver.test.ts
  - packages/index-meta/src/meta-codec.ts
  - packages/index-meta/src/meta-codec.test.ts
  - packages/index-meta/src/address-protocol-manager.ts
  - packages/index-meta/src/address-protocol-manager.test.ts
  - packages/address-index/src/index.ts
  - packages/address-index/src/types.ts
  - packages/address-index/src/port.ts
  - packages/address-index/src/memory-store.ts
  - packages/address-index/src/address-index.test.ts
  - packages/address-index/package.json
  - packages/tag-search/src/index.ts
  - packages/tag-search/src/types.ts
  - packages/tag-search/src/port.ts
  - packages/tag-search/src/memory-store.ts
  - packages/tag-search/src/search.test.ts
  - packages/tag-search/package.json

---

# 좌표 시스템 데이터 설계 그룹

## 목적 ^purpose

좌표 시스템의 데이터 설계를 주소 압축/범위 제어와 카탈로그 운영 원칙으로 나눠 재사용 가능한 단위로 정리한다.

## 구성 ^overview

- `data-design-compression`: 닫힌 조합 공간을 정수 주소로 압축하고 상위 차원에 편입하는 원리.
- `data-design-catalog`: entity 이름, prefix 카탈로그, 설계 원칙을 운영 관점에서 정리한 문서.

원본: `docs/specs/indexing/data-design.md` (`data-design-spec`)
