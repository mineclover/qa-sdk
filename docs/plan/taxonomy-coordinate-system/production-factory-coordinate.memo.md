---
status: draft
sources:
  - packages/taxonomy-engine/src/schema/ir.ts
  - packages/taxonomy-engine/src/parser/index.ts
  - packages/taxonomy-engine/src/validate/index.ts
  - packages/taxonomy-engine/src/indexer/index.ts
  - packages/taxonomy-engine/src/query/walk-by-coordinate.ts
  - packages/taxonomy-engine/src/query/walk-relation.ts
  - packages/taxonomy-engine/__tests__/dogfooding.test.ts
  - packages/taxonomy-engine/__tests__/dogfooding-def-catalog.test.ts
  - packages/taxonomy-engine/__tests__/dogfooding-lesson-builder.test.ts
  - packages/taxonomy-engine/__tests__/dogfooding-dkg.test.ts
  - packages/taxonomy-engine/__tests__/dogfooding-ingest.test.ts
  - docs/taxonomies/qa-sdk-coordinate-system.yaml
  - docs/taxonomies/qa-sdk-def-catalog.yaml
  - docs/taxonomies/lesson-builder-content.yaml
  - docs/taxonomies/dkg-schema.yaml
  - docs/taxonomies/ingest-coords.yaml
  - docs/specs/system/meta-taxonomy.spec.md
  - docs/specs/system/dual-coordinate-system.spec.md
---

# Production Factory Coordinate — 정의 이후의 구현 거버넌스 좌표

## 목적

데이터와 taxonomy 좌표가 정의된 뒤, 그 정의에 매칭되는 구현과 검증을 어떻게 반복적으로 구체화할지 정한다. 여기서 factory는 생성 패턴이나 코드 생성 API가 아니라, 설계 환경과 구현 환경에서 같은 구조 규범을 적용하게 만드는 구현 거버넌스 좌표다.

## 문제

현재 청사진은 "무엇을 어떻게 분류할 것인가"에 집중한다.

```
비즈니스 분해 좌표
  → taxonomy algebra
  → 좌표 행렬
  → 문서/데이터 identity
```

하지만 데이터가 정의된 다음에는 아래 질문이 남는다.

- 이 정의로 어떤 구현 단위를 반복해서 만들 수 있는가
- 어떤 제약을 만족해야 같은 구조로 인정되는가
- 제약 때문에 구현이 불가능해질 때 무엇을 완화하거나 분리해야 하는가
- 구현 단위가 다음 버전으로 발전할 때 어떤 규칙을 따른다
- 관측 결과가 다시 factory 규칙을 어떻게 수정하게 만드는가

즉 taxonomy는 "의미 위치"를 만들고, factory는 그 위치에서 "구현과 검증이 따라야 할 반복 가능한 거버넌스 규범"을 만든다.

## 좌표계 안의 위치

factory는 별도 최상위 taxonomy가 아니라, 비즈니스 분해 좌표 위에 얹히는 구현 거버넌스 plane이다.

```
서비스 레지스트리
  ↓
비즈니스 분해 좌표                 "무엇의 어느 부분인가"
  ↓
taxonomy algebra                   "어떤 관점으로 해석하는가"
  ↓
implementation governance coordinate
                                    "어떤 규칙으로 반복 구현/검증하는가"
  ↓
implementation family / run / observation
                                      "무엇이 규칙을 지켰고 어디서 조정됐는가"
```

factory coordinate는 다음 4가지를 고정한다.

| 축 | 질문 | 예 |
|---|---|---|
| `target` | 어떤 비즈니스 분해 노드를 구현 대상으로 삼는가 | event-ingest / schema-sync |
| `norm` | 어떤 구조 규범을 적용하는가 | schema-first / corridor-consistent |
| `unit` | 어떤 구현/검증 단위로 닫는가 | node bundle / corridor / checkpoint lattice |
| `adjustment` | 불가능한 구현이 생길 때 어떤 조정이 가능한가 | relax / split / defer / escalate |
| `evolution` | 반복 실행과 버전 전이를 어떻게 판단하는가 | append-only / supersede / fork |

## Factory의 의미

factory는 "객체를 만들어주는 생성자"가 아니다. operational ontology가 정의한 구조 좌표와 실제 구현 및 검증을 매칭하는 규범 단위다.

| 역할 | 질문 |
|---|---|
| 구조 매칭 | 이 구현이 어떤 ontology 좌표를 실현하는가 |
| 단위 폐쇄 | 어디까지가 하나의 구현/검증 단위인가 |
| 제약 강제 | 어떤 규칙을 만족해야 같은 구조로 인정되는가 |
| 제약 조정 | 규칙이 구현을 막을 때 무엇을 완화/분할/보류/에스컬레이션하는가 |
| 반복 관측 | 같은 규범이 반복 구현에서 계속 지켜졌는가 |

## operational-ontology와 연결

`operational-ontology`의 현재 구조에서는 implementation governance plane이 schema plane과 instance plane 사이에 들어간다.

```
Schema plane
  → Validation plane
  → Implementation Governance plane
  → Instance / Projection plane
  → Persistence / Observation plane
```

따라서 schema가 "정의할 수 있는 것의 문법"이라면 factory는 "그 문법이 어떤 구현과 검증으로 구체화되어야 하는지 강제하고, 불가능한 제약을 조정하는 규범"이다.

## 의사결정 기록

1. factory는 GoF 생성 패턴이나 코드 생성 API가 아니다.
2. factory의 구현 대상은 구조 좌표와 구현/검증 surface를 매칭하는 governance evaluator다.
3. evaluator는 기존 schema validation, projector, persistence 로직을 대체하지 않고 그 사이의 정합성 판정만 담당한다.
4. 규범 위반은 즉시 실패로만 끝내지 않고 `relax`, `split`, `defer`, `escalate` 조정 후보를 남긴다.
5. core identity나 relation grammar 충돌은 자동 완화하지 않고 에스컬레이션한다.

## 규범 적용 family

factory가 관리하는 것은 단발 객체가 아니라 같은 구조 좌표와 규범 아래 반복 구현되는 family다.

```
factory: event-record-observation-factory
  ├── run 2026-04-11T10:00Z
  │   └── checkpoint lattice v1 (compliant)
  ├── run 2026-04-11T11:00Z
  │   └── checkpoint lattice v2 (constraint adjusted)
  └── evolution edge: v1 superseded_by v2 + adjustment record
```

이 family 단위가 있어야 "같은 정의가 반복 구현되며, 같은 규범을 지켰는지 또는 어떤 제약을 조정했는지"를 관측할 수 있다.

## 제약 조정 원칙

factory는 제약을 무조건 강하게 만들기 위한 장치가 아니다. 일관성을 강제하되 구현 불가능한 상태를 만들면 안 된다.

조정 순서는 다음을 기본값으로 둔다.

1. `relax` — optional facet, optional edge, capacity 같은 완화 가능한 제약을 낮춘다.
2. `split` — 하나의 구현 단위가 너무 커서 불가능하면 더 작은 검증 단위로 나눈다.
3. `defer` — 구조 일관성을 깨지 않는 범위에서 후속 enrichment로 미룬다.
4. `escalate` — identity, required facet, relation grammar 같은 core 제약은 사람 결정으로 올린다.

## 미해결 질문

1. factory coordinate를 frontmatter에 직접 기록할지, operational-ontology registry에 별도 객체로 둘지
2. norm identity를 사람이 읽는 ID로 둘지, taxonomy 교차로 canonical key를 만들지
3. evolution 정책을 relation taxonomy의 relation category로 표현할지, factory 전용 축으로 둘지
4. 실패한 factory run을 observation으로만 남길지, 별도 governance 상태로 저장할지
