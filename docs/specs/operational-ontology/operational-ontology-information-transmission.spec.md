---
def:
  id: operational-ontology-information-transmission
  type: knowledge
  knowledge_kind: concept
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [cross-scope, structural]
  links:
    - target: operational-ontology-data-facets
      type: depends_on
    - target: meta-semantic-ir
      type: depends_on
    - target: operational-ontology-edge-assertion
      type: depends_on
---

# Operational Ontology Information Transmission — 정보를 전달하는 개념

## 목적 ^purpose

정보가 시스템 안에서 어떻게 전달되는지를 operational ontology의 핵심 개념으로 정의한다. 목표는 edge를 단순 연결선으로 보지 않고, `어떤 facet의 정보가 어떤 계약 아래 어디로 전달되는가`를 first-class semantics로 다루는 것이다.

## 구성 ^overview

정보 전달은 최소한 아래 요소를 가진다.

- `source information`
- `source facet`
- `target information`
- `target facet`
- `transmission contract`
- `transmission medium`
- `transmission direction`

이 전달 개념은 단순 transport를 뜻하지 않는다. 코드 호출, 이벤트 발행, 상태 반영, projection 생성, 관측 로그 생성까지 모두 포함할 수 있다.

## 정의 ^defines

### 전달의 종류

초기 전달 semantics는 아래 네 가지로 본다.

1. **contract descent**
   상위가 하위에 계약/정합성 규칙을 전달
2. **production to consumption**
   생산된 정보가 소비 지점으로 전달
3. **storage projection**
   저장된 정보가 조회/검색/파생 뷰로 전달
4. **observation emission**
   정보나 경로의 상태가 관측 이벤트로 전달

이 분리는 meta-semantic의 계약 하향과 파이프 실행 개념을 operational ontology 쪽에서 재사용하는 방식이다. [meta-semantic-concepts.spec.md](/Users/junwoobang/workflow/qa-sdk/docs/specs/meta-semantic/meta-semantic-concepts.spec.md#L59), [meta-semantic-ir.spec.md](/Users/junwoobang/workflow/qa-sdk/docs/specs/meta-semantic/meta-semantic-ir.spec.md#L21)

### edge의 재해석

`EdgeCoord`는 단순 graph fact이지만, operational하게는 정보 전달의 단위가 된다.

```text
Node(source) -- Edge(assertion) --> Node(target)
```

이때 edge는 아래를 함께 암시한다.

- 어떤 facet에서 시작했는가
- 어떤 facet으로 도착했는가
- 전달이 어떤 규칙/계약에 의해 정당화되는가

즉 edge는 relation fact이면서 transmission fact이기도 하다.

### 우선순위

지금 단계에서 중요한 것은 transport 표준화가 아니라 전달 semantics의 분류다.

- 무엇이 전달되는가
- 왜 전달되는가
- 전달 이후 무엇이 바뀌는가

이 세 가지가 먼저 정리되어야 이후 protocol, serialization, runtime delivery를 붙일 수 있다.
