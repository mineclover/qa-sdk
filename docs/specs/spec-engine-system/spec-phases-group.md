---
def:
  id: spec-phases-group
  level: module
  address: def_document:v1:1072
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: domain
  svc: spec-core
  tags: [structural, tier-system]
  links:
    - target: spec-phases-roadmap
      type: contains
    - target: spec-phases-runtime
      type: contains
---

# Spec Engine 단계 그룹

## 목적 ^purpose

spec-engine 구현 단계 문서를 핵심 로드맵과 선택적 확장/runtime 단계로 나눠, 이미 끝난 것과 아직 미착수인 것을 분리해 설명한다.

## 구성 ^overview

- `spec-phases-roadmap`: 패키지 분리 원칙, 의존 그래프, Phase 1-3을 정리한 문서.
- `spec-phases-runtime`: Phase 4-5와 기술 스택, 선택적 확장 방향을 정리한 문서.

원본: `docs/specs/spec-engine/phases.md` (`spec-engine-phases`)
