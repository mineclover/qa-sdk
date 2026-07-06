---
def:
  id: index-arch-group
  tier: system
  address: def_document:v2:137220
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [structural]
  links:
    - target: index-arch-layers
      type: contains
    - target: index-arch-traceability
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
  - packages/weighted-index/src/protocol/semantic-address.ts
  - packages/weighted-index/src/protocol/semantic-address.test.ts
  - packages/weighted-index/src/protocol/pack-format.ts
  - packages/weighted-index/src/protocol/pack-format.test.ts
  - packages/weighted-index/src/protocol/capacity-planner.ts
  - packages/weighted-index/src/protocol/capacity-planner.test.ts
  - packages/index-meta/src/meta-registry.ts
  - packages/index-meta/src/meta-registry.test.ts
  - packages/index-meta/src/meta-resolver.ts
  - packages/index-meta/src/meta-resolver.test.ts
  - packages/index-meta/src/meta-codec.ts
  - packages/index-meta/src/meta-codec.test.ts
  - packages/index-meta/src/address-protocol-manager.ts
  - packages/index-meta/src/address-protocol-manager.test.ts
  - packages/spec-core/src/semantic-indexing-pack/index.ts
  - packages/spec-core/src/semantic-indexing-pack/types.ts
  - packages/spec-core/src/semantic-indexing-pack/manifest.ts
  - packages/spec-core/src/semantic-indexing-pack/classify.ts
  - packages/spec-core/src/semantic-indexing-pack/compatibility.ts
  - packages/spec-core/src/semantic-indexing-pack/report.ts
  - packages/spec-core/src/semantic-indexing-pack/grounding.ts
  - packages/spec-core/src/semantic-indexing-pack/semantic-indexing-pack.test.ts

---

# 인덱싱 아키텍처 그룹

## 목적 ^purpose

인덱싱 아키텍처 문서를 레이어 구조와 검증/추적 경계로 분리해 구현 단계와 문서 책임을 각각 독립적으로 설명한다.

## 구성 ^overview

- `index-arch-layers`: vocabulary에서 semantic까지 레이어별 책임과 완료 상태를 정리한 문서.
- `index-arch-traceability`: 문서 투영, 식별자 규약, 검증 파이프라인, 구현 추적을 정리한 문서.

원본: `docs/specs/indexing/architecture.md` (`indexing-architecture`)
