---
def:
  id: convergence-layer-group
  level: module
  tier: system
  address: def_document:v2:68617
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: domain
  svc: convergence
  tags: [structural]
  links:
    - target: convergence-comparators
      type: contains
    - target: convergence-advisors
      type: contains
---

# Convergence Layer 그룹

## 목적 ^purpose

수렴 계층 문서를 비교 도구와 추천/사이클 관리 도구로 나눠 관측 기반 수렴 로직의 역할을 더 작은 단위로 정리한다.

## 구성 ^overview

- `convergence-comparators`: symbol/decision 비교와 causal discovery를 정리한 문서.
- `convergence-advisors`: simplification, boundary 추천, cycle, 구현 매핑을 정리한 문서.

원본: `docs/specs/spec-engine/convergence-layer.md` (`convergence-layer-spec`)
