---
def:
  id: df-narrative-proof-operational-cases
  type: knowledge
  knowledge_kind: narrative
  level: leaf
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
    - target: df-narrative-context
      type: depends_on
    - target: df-state-model
      type: depends_on
---
# Decision Flow — 서사 증명: 운영 사례

## 목적 ^purpose

decision-flow의 서사 모델이 실제 의사결정과 세션 영속 환경에서도 유지된다는 점을 운영 사례로 증명한다.

## 구성 ^overview

- 장 10: 실제 의사결정 — Auto IntentLink 안정화 판단
- 장 11: 세션을 넘어서 — 결정 이력이 영속된다

## 장 10: 실제 의사결정 — Auto IntentLink 안정화 판단

### 배경

Auto IntentLink 발견 기능이 추가된 뒤, 안정화가 필요한지 판단해야 했다.

### 과정

stabilization flow 기준:

- 버그 빈도: low
- 성능 상태: healthy
- 코드 품질: acceptable
- 판정: stable

### 결론

실제 사례에서도 decision-flow는 "왜 지금은 안정화보다 관찰이 맞는가"를 구조적으로 설명한다.

## 장 11: 세션을 넘어서 — 결정 이력이 영속된다

### 질문

프로세스가 끝나도 결정 이력은 이어지는가?

### 증명

`~/.qa-sdk/decision-flow.sqlite`에 FlowInstance가 저장되어 복수 프로세스에 걸쳐 결정 진행이 가능하다. 이전 선택과 verdict가 다음 실행 시점에도 다시 읽힌다.

### 결론

서사는 일회성 메모가 아니라 영속되는 운영 자산이다. 세션을 넘어도 같은 좌표계 위에서 이어진다.
