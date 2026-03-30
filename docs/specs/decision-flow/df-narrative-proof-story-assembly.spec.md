---
def:
  id: df-narrative-proof-story-assembly
  type: knowledge
  knowledge_kind: narrative
  level: leaf
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
    - target: df-narrative-structure
      type: depends_on
    - target: df-narrative-context
      type: depends_on
---
# Decision Flow — 서사 증명: 서사 조립과 컨텍스트

## 목적 ^purpose

개별 gate 선택이 서사가 되고, ContextProvider와 계층적 컨텍스트 조립이 다음 결정을 쉽게 만든다는 점을 증명한다.

## 구성 ^overview

- 장 7: 개별 결정이 모여 서사가 된다.
- 장 8: 시스템의 역할은 결정을 쉽게 만드는 것이다.
- 장 9: 시스템 구조를 관통하여 맥락을 조합한다.

## 장 7: 개별 결정이 모여 서사가 된다

### 질문

개별 gate 선택은 단편적이다. 이것들이 모여 하나의 이야기가 되는가?

### 증명

`buildNarrative()`는 배경 → 여정 → 도달 → 산출 → 회고 구조를 추출한다.
`extractPivotPoints()`는 core gate만 뽑아 서사의 주요 차원을 보여주고,
`findNarrativeDivergence()`는 두 서사의 분기점과 근거 차이를 비교한다.

### 결론

결정 → 서사 → 패턴 → 정책 → 자동화라는 축적 흐름이 가능하다. 같은 점에 다른 근거로 도달하면 다른 서사로 기록된다.

## 장 8: 시스템의 역할은 결정을 쉽게 만드는 것이다

### 질문

이 시스템은 기록 시스템인가, 결정 지원 시스템인가?

### 증명

`ContextProvider.provide()`는 이력, 패턴, 정책, 인지 모델 힌트, 열린 질문을 한 번에 표면화한다.
결정할수록 다음 결정의 컨텍스트가 풍부해진다.

### 결론

핵심 가치는 기록이 아니라 컨텍스트 제공이다. 과거가 미래의 결정을 쉽게 만드는 것이 이 좌표계의 본질이다.

## 장 9: 시스템 구조를 관통하여 맥락을 조합한다

### 질문

decision-flow는 독립 모듈인가, 시스템 통합 지점인가?

### 증명

`assembleHierarchicalContext()`는 domain → DSL → prefix → dim → entry 5레벨을 조합해, prefix 하나로 도메인 경계와 DSL 불변조건, 차원 headroom까지 표면화한다.

### 결론

decision-flow는 단독 모듈이 아니라 시스템 구조를 관통해 맥락을 조합하는 통합 지점이다.
