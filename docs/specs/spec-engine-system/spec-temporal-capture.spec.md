---
def:
  id: spec-temporal-capture
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  tags: [entry-point]
  links:
    - target: temporal-relations
      type: refines
---

# Spec 시간 관계 수집

## 목적 ^purpose

시간 순서 수집, 데이터 흐름 수집, FlowDefinition 연결을 분리해 temporal relation이 어떤 관찰을 추가해야 하는지 정리한다.

## 수집 경로

- 현재 co-occurrence만 보는 상태에서 벗어나려면 시간 순서와 데이터 흐름을 별도 수집해야 한다.
- FlowDefinition 연결은 이벤트 열과 설계된 정상 경로를 비교하는 기준점이 된다.
- 시간 관계 수집은 더 많은 이벤트를 추가하는 것이 아니라 기존 이벤트 사이의 순서를 모델링하는 작업이다.
