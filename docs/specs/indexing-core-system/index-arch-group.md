---
def:
  id: index-arch-group
  level: module
  address: def_document:v1:1072
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [structural, tier-infra]
  links:
    - target: index-arch-layers
      type: contains
    - target: index-arch-traceability
      type: contains
---

# 인덱싱 아키텍처 그룹

## 목적 ^purpose

인덱싱 아키텍처 문서를 레이어 구조와 검증/추적 경계로 분리해 구현 단계와 문서 책임을 각각 독립적으로 설명한다.

## 구성 ^overview

- `index-arch-layers`: vocabulary에서 semantic까지 레이어별 책임과 완료 상태를 정리한 문서.
- `index-arch-traceability`: 문서 투영, 식별자 규약, 검증 파이프라인, 구현 추적을 정리한 문서.

원본: `docs/specs/indexing/architecture.md` (`indexing-architecture`)
