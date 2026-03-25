---
def:
  id: df-causal-mapping
  scope: flow
  aspect: relation
  depth: specification
  lifecycle: approved
  tags: [decision]
  links:
    - target: df-observation-space
      type: depends_on
    - target: df-state-model
      type: depends_on
---
# Decision Flow X↔Y 인과 매핑

## 목적 ^purpose

비즈니스 요구(X)와 기술 구현(Y)을 의사결정 좌표로 연결하는 인과 증명 경로. "특정 코드가 왜 그렇게 작성되었는지"를 좌표로 추적한다.

## 구성 ^overview

매핑 경로: X(비즈니스 요구) → 의사결정 좌표(FlowEngine gate 순회) → Y(기술 구현, DecisionNode).
양방향 참조: DecisionNode.flowInstanceId → FlowInstance, FlowInstance.dkgDecisionId → DecisionNode.
