---
def:
  tier: component
  id: df-state-model
  address: def_document:v2:205959
  scope: state
  aspect: domain_state
  depth: specification
  lifecycle: approved
  layer: domain
  svc: decision-flow
  tags: [decision, cross-scope]
  links:
    - target: df-constraint
      type: depends_on
---
# Decision Flow 상태 모델

## 목적 ^purpose

FlowInstance의 생명주기(pending→active→completed/abandoned/blocked)와 서사 구조(배경→여정→도달→산출→회고)를 정의한다. 과정(active→completed)과 결론(verdict)은 시간축이 다르다.

## 생명주기 ^state-def:lifecycle

```
pending → active → completed → (시간 경과) → verdict 기록
                 → abandoned
                 → blocked
```

## 서사 구조 ^state-def:narrative

```
배경(context)   왜 이 결정이 필요했는가
  ↓
여정(journey)   각 gate에서 무엇을 선택하고 왜 그랬는가
  ↓
도달(destination)  결정 공간에서의 최종 위치 (정수 주소로 압축)
  ↓
산출(outcome)   이 결정이 만들어낸 것
  ↓
회고(reflection)  이 서사에서 배운 것 (나중에 추가 가능)
```
