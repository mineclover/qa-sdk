---
def:
  id: definition-mgmt-consistency-rules
  type: design
  tier: component
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [structural]
  links:
    - target: definition-management
      type: refines
    - target: definition-taxonomy
      type: depends_on
    - target: definition-state-model
      type: depends_on
    - target: definition-mgmt-feedback-loop
      type: depends_on
---

# Definition Management — 일관성 규칙

## 목적 ^purpose

definition 관리 전반에서 깨지면 안 되는 일관성 규칙을 정리한다. 좌표 불변, 단일 개념 원칙, 상태 좌표화, 피드백 순환 유지 조건을 명시한다.

## 구성 ^overview

- 좌표 주소 불변
- 문서 단위 단일 개념
- 상태 변경의 좌표화
- 피드백 순환 유지

## 좌표 주소는 불변

scope × aspect × depth가 주소를 결정한다. 한번 부여된 주소는 변하지 않는다. level, lifecycle, tags, revision/version은 메타데이터이므로 주소에 포함하지 않는다.

## 모든 정의는 하나의 개념

문서든 코드 단위든 하나의 개념과 그 구성을 참조하는 완결된 정의여야 한다. 여러 개념이 섞이면 분할한다.

## 모든 상태 변경은 좌표화

하네스 전이, 게이트 실행, 그래프 변경, 수렴 분석은 모두 prefix 좌표가 있어야 한다. "언제 어디서 무엇이 변했는가"를 좌표로 추적할 수 있어야 한다.

## 피드백은 순환

관측 → 분석 → 의사결정 → 문서 갱신 → 코드 변경 → 관측. 어느 지점에서 시작해도 순환이 끊어지지 않아야 한다.
