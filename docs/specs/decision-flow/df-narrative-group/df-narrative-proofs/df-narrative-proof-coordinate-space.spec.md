---
def:
  id: df-narrative-proof-coordinate-space
  type: knowledge
  knowledge_kind: narrative
  tier: component
  scope: feature
  aspect: scenario
  depth: validation
  lifecycle: approved
  layer: domain
  svc: decision-flow
  tags: [decision, testing]
  links:
    - target: df-narrative-proofs
      type: refines
    - target: df-axis-model
      type: depends_on
    - target: df-vector-analysis
      type: depends_on
    - target: decision-standard-group
      type: depends_on
---
# Decision Flow — 서사 증명: 좌표 공간

## 목적 ^purpose

decision-flow의 좌표 공간이 실제 결정을 압축하고 비교 가능한 구조로 만든다는 점을 증명한다. 축 압축, 반복 패턴 발견, 벡터 차이 분석을 하나의 cluster로 묶는다.

## 구성 ^overview

- 장 1: 축은 결정의 구조를 압축한다.
- 장 2: 반복 결정에서 패턴이 드러난다.
- 장 3: 두 결정의 차이를 축으로 설명한다.

## 장 1: 축은 결정의 구조를 압축한다

### 질문

소프트웨어 설계에서 반복되는 결정은 수십 개의 변수가 얽혀 있다. 이 복잡함을 소수의 축으로 줄일 수 있는가?

### 증명

`component-design` 플로우를 3개 축(scope, architecture, testing)으로 정의한다.
3×3×3 = 27 경로 → 1D 정수 주소 공간.

- 같은 선택 → 항상 같은 주소
- 다른 선택 → 다른 주소
- 주소 → 원래 선택 복원

### 결론

3개 축이 27가지 결정 경로를 정수 하나로 압축한다. 일정, 팀 역량 같은 변수는 축이 아니라 근거(Evidence)로 기록된다.

## 장 2: 반복 결정에서 패턴이 드러난다

### 질문

개별 결정은 일회성처럼 보인다. 축으로 투영하면 반복 패턴이 보이는가?

### 증명

infra 팀은 5회 반복해서 `extend → integrated → integration`을 선택한다.
PatternDetector가 빈도 5, 평균 confidence > 0.7로 감지하여 정책 후보를 만든다.

frontend 팀은 같은 기간에 다양한 경로를 선택해 패턴이 나타나지 않는다.

### 결론

같은 좌표에 반복 투영되는 점은 자동 정책 후보가 된다. 축이 없으면 패턴을 볼 수 없고, 축이 있으면 반복 경로가 드러난다.

## 장 3: 두 결정의 차이를 축으로 설명한다

### 질문

왜 A 팀은 `new`를, B 팀은 `extend`를 선택했는가?

### 증명

두 FlowInstance 비교 결과:

- divergencePoint: `scope` (첫 번째 core gate)
- evidence diff: A는 data 근거, B는 precedent 근거

### 결론

벡터 차이는 "어느 축에서 갈렸고, 근거가 어떻게 달랐는가"를 설명한다. core gate에서 갈리면 후속 결정 전체에 cascade된다.
