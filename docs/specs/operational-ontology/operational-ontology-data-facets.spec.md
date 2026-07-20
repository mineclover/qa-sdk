---
def:
  tier: component
  id: operational-ontology-data-facets
  type: spec
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [cross-scope, structural]
  links:
    - target: operational-ontology-system
      type: traces_to
    - target: meta-semantic-concepts
      type: traces_to
    - target: tracking-three-axes
      type: traces_to
    - target: meta-semantic-ir
      type: traces_to
  sources:
    - packages/operational-ontology/src/internal/runtime-core.ts
    - packages/operational-ontology/src/internal/projector-shared.ts
    - packages/operational-ontology/src/internal/lineage-projector.ts
    - packages/operational-ontology/src/projectors-lineage.test.ts
---

# Operational Ontology Data Facets — 정보를 데이터 패싯으로 다루기

## 목적 ^purpose

`operational-ontology`에서 정보를 독립 개체나 문서 단위보다 먼저 **데이터 패싯**으로 다루는 원칙을 정의한다. 목표는 schema를 과도하게 고정하기 전에, 정보가 어떤 역할로 존재하고 어떤 방식으로 흐르는지부터 안정적으로 분해하는 것이다.

## 구성 ^overview

초기 canonical data facet은 meta-semantic과 동일한 5역할을 따른다.

- `definition` — 정보의 형태와 의미를 정의
- `management` — 정보의 정합성과 계약을 관리
- `production` — 정보가 생성되는 시작점
- `consumption` — 정보가 읽히거나 사용되는 지점
- `storage` — 정보가 보존되는 방식과 위치

이 5역할은 정보의 종류를 분류하는 것이 아니라, **같은 정보가 시스템 안에서 어떤 역할로 존재하는가**를 분리하는 기준이다. [meta-semantic-concepts.spec.md](../meta-semantic/meta-semantic-concepts.spec.md#L51), [tracking-three-axes.spec.md](../system/tracking-three-axes.spec.md#L64), [meta-semantic-ir.spec.md](../meta-semantic/meta-semantic-ir.spec.md#L16)

## 정의 ^defines

### 왜 패싯이 먼저인가

schema만 먼저 세우면 taxonomy는 정적 분류 체계로 굳기 쉽다. 하지만 operational ontology의 목적은 정적 분류보다도:

- 정보가 어디서 정의되는가
- 누가 그것의 정합성을 책임지는가
- 어디서 생성되는가
- 누가 소비하는가
- 어디에 저장되는가

를 추적 가능한 좌표로 만드는 것이다.

따라서 schema는 frame으로 남겨두고, 실제 모델링 우선순위는 data facet이 된다.

### operational-ontology에서의 해석

정보 하나는 아래처럼 facet bundle로 읽는다.

```text
Information
  ├── definition facet
  ├── management facet
  ├── production facet
  ├── consumption facet
  └── storage facet
```

여기서:

- `NodeCoord`는 정보의 canonical identity를 담당한다.
- data facet은 그 정보가 시스템에서 맡는 역할을 담당한다.
- `EdgeCoord`는 facet 간 연결 사실을 기록한다.
- `TraversalCoord`는 facet 흐름의 route를 기록한다.

즉 node가 먼저 존재하고 facet이 붙는 것이 아니라, **정보를 facet bundle로 분해한 뒤 그 묶음을 operational coordinate로 다루는 것**에 가깝다.

### 최소 우선순위

내부 안정화 단계에서는 아래 3가지를 먼저 잡는다.

1. 어떤 정보를 5개 facet 중 어디에 배치할 것인가
2. facet 간 연결이 어떤 전달 semantics를 가지는가
3. 그 흐름을 시뮬레이션할 때 어떤 결과를 비교할 것인가

이 세 가지가 안정화되기 전에는 schema를 세부적으로 늘리는 것을 지양한다.
