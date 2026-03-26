---
def:
  id: behavior-traversal-group
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  svc: weighted-index
  tags: [structural, tier-infra]
  links:
    - target: behavior-traversal-axis
      type: contains
    - target: behavior-traversal-query
      type: contains
---

# 행위 축 탐색 그룹

## 목적 ^purpose

행위 축 탐색 스펙을 정적 타입 관계와 동적 질의/내부 모델로 분리해 탐색 계층의 전제와 구현 포인트를 나눠 설명한다.

## 구성 ^overview

- `behavior-traversal-axis`: 좌표 타입 시스템과 행위 축의 관계, 최소 탐색 단위를 정리한 문서.
- `behavior-traversal-query`: 질의 패턴, DSL, 내부 모델, 다음 단계 구현 포인트를 정리한 문서.

원본: `docs/specs/indexing/behavioral-traversal.md` (`behavioral-traversal`)
