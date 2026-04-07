# 재귀적 분해 — fold/algebra 패턴

## 목적

비즈니스 분해 좌표계의 재귀적 분해 구조를 `SchemaAlgebra` 패턴으로 표현한다. 분해 트리(구조)와 taxonomy 해석(algebra)을 분리하여, 하나의 공유 트리에 여러 taxonomy를 교체 적용할 수 있게 한다.

## schema-algebra 참조

참조: `oa-sdk/docs/guides/schema-algebra.md`

비즈니스 기획도 패싯처럼 개념이 커지면 분리된다. 이 재귀적 분해에 `oa-sdk`의 `SchemaAlgebra` 패턴이 적용된다.

```
schema-algebra                         비즈니스 분해 좌표계
────────────────                       ────────────────────
스키마 트리 (재귀 구조)                → 비즈니스 분해 트리 (재귀 구조)
foldSchema(tree, algebra) → T         → fold(biz_tree, taxonomy) → 해석 결과
SchemaAlgebra<T> (순수 해석 함수)      → 각 taxonomy = 해석 algebra
순회와 해석의 분리                     → 분해 구조와 taxonomy 해석의 분리
T를 바꾸면 다른 결과                   → taxonomy를 바꾸면 다른 관점
```

## 핵심 원칙

1. **분해 트리는 하나** — 비즈니스 기획이 정의하는 재귀 구조가 공유 SSOT
2. **해석은 교체 가능** — 같은 노드에 다른 taxonomy algebra를 적용하면 다른 산출물
3. **순회와 해석 분리** — 트리 탐색 로직은 공유, 각 taxonomy는 해석만 담당

## 해석 예시

"이벤트 수집" 노드에 각 taxonomy algebra 적용:

```
fold("이벤트 수집", definition)      → scope:data, aspect:event_contract
fold("이벤트 수집", structural)      → boundary:ingest, facet:collection
fold("이벤트 수집", observability)   → trace:browser_event, level:app_data
fold("이벤트 수집", PM)             → deliverable:수집파이프라인, checkpoint:E2E통과
fold("이벤트 수집", df)             → DecisionUnit:"수집 방식 결정"
```

## 재귀 분해

```
이벤트 수집 (capability)
├── 브라우저 SDK 수집      ← 개념이 커져서 분리
├── 서버 사이드 수집
└── 프로토콜 협상
```

각 하위 노드도 동일하게 모든 taxonomy algebra로 해석 가능. 순환 참조 방지는 `SchemaAlgebra`의 stack/set 기반 패턴을 따른다.

## Product Algebra — 다중 taxonomy 동시 적용

`SchemaAlgebra`의 product 패턴으로 하나의 순회에서 여러 taxonomy 해석을 동시에 얻는다.

```
fold("이벤트 수집", product(definition, structural, PM))
→ {
    definition: { scope: "data", aspect: "event_contract" },
    structural: { boundary: "ingest", facet: "collection" },
    PM:         { deliverable: "수집파이프라인" },
  }
```

이것이 document addressing contract의 **교차점 표현**이다.
