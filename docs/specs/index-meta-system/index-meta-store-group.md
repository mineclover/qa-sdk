---
def:
  id: index-meta-store-group
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  tags: [tier-infra]
  links:
    - target: index-meta-store-contract
      type: contains
    - target: index-meta-store-resolution
      type: contains
---

# Index Meta Store 그룹

## 목적 ^purpose

index-meta 저장소 문서를 저장 계약과 주소 해석/재사용 경로로 분리해 persistence 책임과 resolution 책임을 각각 설명한다.

## 구성 ^overview

overview: 총 2개 멤버.
- `index-meta-store-contract`: 설계 목적, 역할 분리, 저장 타입, 인터페이스, 동작 규칙을 정리한 문서.
- `index-meta-store-resolution`: 구현 예시, DB 상태, 주소 해석, decode 없는 재사용 전략을 정리한 문서.

원본: `docs/specs/indexing/index-meta/store.spec.md` (`index-meta-store`)
