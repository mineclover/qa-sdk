---
def:
  id: bigint-addressing-group
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  tags: [tier-infra]
  links:
    - target: bigint-addressing-runtime
      type: contains
    - target: bigint-addressing-rollout
      type: contains
---

# BigInt 주소 체계 그룹

## 목적 ^purpose

BigInt 주소 체계 스펙을 런타임 API와 전환/성능 전략으로 분리해 Number 한계를 넘는 운영 시나리오를 단계별로 설명한다.

## 구성 ^overview

overview: 총 2개 멤버.
- `bigint-addressing-runtime`: NumberType 선택, BigInt API, layout protocol, 동등성 규칙을 정리한 문서.
- `bigint-addressing-rollout`: 마이그레이션 경로와 성능 특성을 운영 전략으로 정리한 문서.

원본: `docs/specs/indexing/bigint-addressing.spec.md` (`bigint-addressing`)
