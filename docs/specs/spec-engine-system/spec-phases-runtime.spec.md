---
def:
  id: spec-phases-runtime
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  tags: [tier-system]
  links:
    - target: spec-engine-phases
      type: refines
    - target: spec-phases-roadmap
      type: depends_on
---

# Spec Engine 단계 - 관측과 확장

## 목적 ^purpose

spec-engine의 Phase 4-5, 기술 스택, 선택적 관측/확장 단계를 정리해 앞으로 붙일 runtime 성격의 작업 경계를 설명한다.

## 선택적 단계

- Phase 4는 관측 계층으로, core와 소비 경로가 안정화된 뒤 붙이는 선택적 단계다.
- Phase 5는 추가 확장 포인트를 다루며, 이미 고정된 커널 위에서만 안전하게 진행할 수 있다.
- 이 단계들은 완료된 로드맵과 달리 "붙일 수 있는 위치"를 정의하는 문서다.

## 기술 스택

- 기술 스택은 단계 우선순위를 바꾸는 이유가 아니라, 각 단계를 구현할 때 필요한 호스트 제약을 문서화하는 용도다.
- 따라서 기술 선택은 로드맵을 따르고, 확장은 `spec-phases-roadmap` 이후에만 붙는다.
