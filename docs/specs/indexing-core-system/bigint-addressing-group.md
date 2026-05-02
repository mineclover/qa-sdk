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
---

# BigInt 주소 체계 그룹

## 목적 ^purpose

BigInt 주소 체계 스펙을 런타임 API와 전환/성능 전략으로 분리해 Number 한계를 넘는 운영 시나리오를 단계별로 설명한다.

## 구성 ^overview

- `bigint-addressing-runtime`: NumberType 선택, BigInt API, layout protocol, 동등성 규칙을 정리한 문서.
- `bigint-addressing-rollout`: 마이그레이션 경로와 성능 특성을 운영 전략으로 정리한 문서.

원본: `docs/specs/indexing/bigint-addressing.spec.md` (`bigint-addressing`)
