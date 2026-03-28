---
def:
  id: df-narrative-structure
  address: def_document:v2:205958
  scope: state
  aspect: domain_state
  depth: specification
  lifecycle: approved
  layer: domain
  svc: decision-flow
  tags: [decision]
  links:
    - target: df-state-model
      type: depends_on
---
# Decision Flow — 서사 구조

## 목적 ^purpose

서사의 구조: 배경(context) → 여정(journey) → 도달(destination) → 산출(outcome) → 회고(reflection). 코어 전환점이 서사의 주요 차원을 결정한다.

## 구성 ^overview

- **서사 5단계**: 배경(왜 필요했나) → 여정(gate별 선택과 근거) → 도달(최종 위치, 정수 압축) → 산출(코드/설정 변경) → 회고(패턴/교훈)
- **코어 전환점**: weight="core"인 gate 선택이 결정 공간의 주요 차원을 결정 — 서사 요약 시 코어만 읽으면 충분
- **서사 불변성**: 결정이 바뀌면 기존 서사 위에 새 서사가 쌓임 (덮어쓰기 아님)
- **서사 비교**: 같은 배경에서 다른 도달에 이른 경우, 분기 gate와 근거 차이가 비교의 핵심

---


## 관련 소스

증명 코드: `packages/decision-flow/src/proof.test.ts` (125 tests)

## 서사의 구조

의사결정 서사는 다음 흐름을 따른다:

```
배경(context)  → 여정(journey) → 도달(destination) → 산출(outcome) → 회고(reflection)
```

- **배경**: 왜 이 결정이 필요했는가. 사건, 관측, 요구.
- **여정**: 각 gate에서 무엇을 선택하고 왜 그랬는가. 개별 결정의 축적.
- **도달**: 결정 공간에서의 최종 위치. 여정 전체가 정수 하나로 압축된다.
- **산출**: 이 결정이 만들어낸 것. 코드, 축, prefix, 설정 변경.
- **회고**: 이 서사에서 배운 것. 패턴, 교훈, 열린 질문. 나중에 추가할 수 있다.

서사는 불변이다. 결정이 바뀌면 기존 서사 위에 새 서사가 쌓인다.

### 코어 전환점 (Pivot Points)

모든 gate가 동등하지 않다.
코어 gate(weight="core")에서의 선택이 결정 공간의 **주요 차원**을 결정한다.
서사를 요약할 때는 코어 전환점만 읽으면 된다.

```
한 줄 요약:
  "기존 모듈의 응답 시간이 SLA를 초과 → [범위 결정=new] → module:packages/new-component"

  배경                              코어 전환점           산출
```

### 서사 비교 — 같은 출발, 다른 도달

같은 배경에서 시작한 두 서사가 다른 곳에 도달했을 때,
**어느 gate에서 갈렸고, 그 gate의 근거가 어떻게 달랐는지**가 서사 비교의 핵심이다.

```
서사 A: SLA 초과 → scope=new (data: "신규 성능 요구") → module:new-mod
서사 B: SLA 초과 → scope=extend (precedent: "기존 패턴 유지") → extension:ext-mod

분기점: scope (코어 gate)
이유 차이: A는 data 근거, B는 precedent 근거
```
