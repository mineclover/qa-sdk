---
def:
  id: bigint-addressing-group
  tier: system
  address: def_document:v2:342018
  scope: data
  aspect: domain_data
  depth: overview
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [structural, cross-scope]
  links:
    - target: bigint-addressing-runtime
      type: contains
    - target: bigint-addressing-rollout
      type: contains
    - target: indexing-core-system
      type: depends_on
sources:
  - packages/weighted-index/src/math/weighted-index-big.ts
  - packages/weighted-index/src/math/weighted-index-big.test.ts
  - packages/weighted-index/src/math/layout-fit-bigint.test.ts
  - packages/weighted-index/src/bench-bigint-uuid.test.ts
  - packages/index-meta/src/meta-codec-big.ts
  - packages/index-meta/src/meta-codec-big.test.ts
  - packages/index-meta/src/prefix-decoder-big.ts
  - packages/index-meta/src/prefix-decoder-big.test.ts
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

---

# BigInt 주소 체계 그룹

## 목적 ^purpose

BigInt 주소 체계 스펙을 런타임 API와 전환/성능 전략으로 분리해 Number 한계를 넘는 운영 시나리오를 단계별로 설명한다.

## 구성 ^overview

- `bigint-addressing-runtime`: NumberType 선택, BigInt API, layout protocol, 동등성 규칙을 정리한 문서.
- `bigint-addressing-rollout`: 마이그레이션 경로와 성능 특성을 운영 전략으로 정리한 문서.

원본: `docs/specs/indexing/bigint-addressing.spec.md` (`bigint-addressing`)
