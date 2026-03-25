---
def:
  id: df-system
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  tags: [decision, entry-point]
  links:
    - target: df-axis-model
      type: contains
    - target: df-observation-space
      type: contains
    - target: df-vector-analysis
      type: contains
    - target: df-constraint
      type: contains
    - target: df-state-model
      type: contains
    - target: df-serialization
      type: contains
    - target: df-causal-mapping
      type: contains
---
# Decision Flow 시스템

## 목적 ^purpose

인간의 복잡한 결정 과정을 사전 설계된 직교 축으로 투영하여, "왜 이 결정을 했는가"를 좌표 주소로 증명하는 다차원 벡터 공간 모델. qa-sdk의 좌표 인코딩과 동형 — 데이터 이벤트의 "어디서"를 좌표로 표현하듯, 의사결정의 "왜"를 좌표로 표현한다.

## 구성 ^overview

7개 정의로 구성: 축 모델(11축 3층), 관찰 공간(5 prefix), 벡터 분석(diff/distribution/pattern), 구조적 제약(게이트 무게/계층), 상태 모델(서사 구조), 직렬화(SemanticAddress), 인과 매핑(X↔Y).
