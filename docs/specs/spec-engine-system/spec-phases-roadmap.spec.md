---
def:
  id: spec-phases-roadmap
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  svc: spec-core
  tags: [tier-system]
  links:
    - target: convergence-layer-spec
      type: refines
    - target: spec-engine-phases
      type: refines
---

# Spec Engine 단계 - 핵심 로드맵

## 목적 ^purpose

spec-engine의 패키지 분리 원칙, 의존 그래프, Phase 1-3 구현 로드맵을 정리해 현재 완료된 핵심 경로를 설명한다.

## 핵심 단계

- 패키지 분리 원칙은 spec-core를 순수 TS 커널로 유지하고, 상위 소비 계층을 뒤에 붙이는 데 있다.
- 의존 그래프는 커널 -> 소비 경로 -> 시나리오 검증 순으로 확장돼야 한다.
- Phase 1-3은 이미 구현된 핵심 경로를 설명하며, 설계와 소비를 실제 검증 루프에 연결한다.

## 운영 의미

- 로드맵은 "무엇이 먼저 고정돼야 하는가"를 보여주는 우선순위 문서다.
- 선택적 관측/확장 단계는 `spec-phases-runtime`으로 분리한다.
