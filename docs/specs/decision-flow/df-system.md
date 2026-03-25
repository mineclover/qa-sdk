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
    - target: decision-standard-group
      type: contains
    - target: df-narrative
      type: contains
    - target: axis-decision-guide
      type: contains
    - target: df-narrative-group
      type: contains
---

# Decision Flow 시스템

## 목적 ^purpose

인간의 복잡한 결정 과정을 사전 설계된 직교 축으로 투영하여, "왜 이 결정을 했는가"를 좌표 주소로 증명하는 다차원 벡터 공간 모델. qa-sdk의 좌표 인코딩과 동형 — 데이터 이벤트의 "어디서"를 좌표로 표현하듯, 의사결정의 "왜"를 좌표로 표현한다.

## 구성 ^overview

overview: 총 10개 멤버.
- `df-axis-model`: 의사결정 도메인의 11개 축 정의.
- `df-observation-space`: 5개 prefix가 의사결정의 관찰 가능한 좌표 공간을 구성한다.
- `df-vector-analysis`: 투영된 결정 벡터들의 분포, 차이, 이동, 패턴을 분석하는 기능.
- `df-constraint`: 게이트 무게(core/structural/tactical), 인과 그래프(GateDependency), 결정 계층(strategic→tactical→operational→execution)과 컨텍스트 바운더리를 정의한다.
- `df-state-model`: FlowInstance의 생명주기(pending→active→completed/abandoned/blocked)와 서사 구조(배경→여정→도달→산출→회고)를 정의한다.
- `df-serialization`: 의사결정 좌표의 직렬화 형식.
- `df-causal-mapping`: 비즈니스 요구(X)와 기술 구현(Y)을 의사결정 좌표로 연결하는 인과 증명 경로.
- `decision-standard-group`: 새로운 요구사항을 기존 prefix 재사용/신규 prefix 정의 프로세스와 체크리스트로 분리한 그룹.
- `df-narrative`: 이 문서는 서사가 쌓이는 문서다.
- `axis-decision-guide`: 이 가이드는 qa-sdk 뿐 아니라 어떤 서비스에서든 재사용 가능하다.
