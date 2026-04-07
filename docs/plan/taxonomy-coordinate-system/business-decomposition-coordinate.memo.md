# 비즈니스 분해 좌표계

## 목적

서비스 레지스트리(최상위)와 각 taxonomy 해석(최하위) 사이의 빈 중간층을 채운다. taxonomy 독립적인 비즈니스 분해 좌표를 정의하여, 모든 taxonomy가 "같은 부분"을 가리킬 수 있게 한다.

## 코끼리 문제

여러 taxonomy가 하나의 대상(코끼리)을 각자의 관점으로 해석한다. 그런데 "코끼리의 어느 부분"을 말하는지 공유된 체계가 없으면, 각 taxonomy의 해석이 같은 부분을 가리키는지 알 수 없다.

```
서비스 레지스트리 (최상위) — "어떤 코끼리인가"
    serviceId: gate-service, ingest-server, ...
        │
        ▼
    비즈니스 분해 좌표 — "코끼리의 어느 부분인가"     ← 이것이 없다
        이벤트 수집, 디코딩, 게이트 판정, ...
        │
        ▼
    각 taxonomy가 그 부분을 자기 관점으로 해석
```

## 분해 기준: 비즈니스 기획

| 분해 기준 | 안정성 | taxonomy 독립성 | 판단 |
|-----------|:-----:|:--------------:|------|
| 코드 단위 | 낮음 | 낮음 (구현 종속) | 리팩토링하면 좌표가 흔들린다 |
| 도메인 단위 | 중간 | 중간 | 도메인 모델링 관점에 의존 |
| **비즈니스 기획** | **높음** | **높음** | 코드/도메인은 "어떻게"의 결과, 기획은 "왜"의 원인 |

비즈니스 기획이 가장 적합하다. 원인 쪽이 안정적이고, 모든 taxonomy가 공통 참조할 수 있다.

## 재귀적 분해 — fold/algebra 패턴

비즈니스 기획도 패싯처럼 개념이 커지면 분리된다. 이 재귀적 분해에 `oa-sdk`의 `SchemaAlgebra` 패턴이 적용된다.

참조: `oa-sdk/docs/guides/schema-algebra.md`

```
schema-algebra                         비즈니스 분해 좌표계
────────────────                       ────────────────────
스키마 트리 (재귀 구조)                → 비즈니스 분해 트리 (재귀 구조)
foldSchema(tree, algebra) → T         → fold(biz_tree, taxonomy) → 해석 결과
SchemaAlgebra<T> (순수 해석 함수)      → 각 taxonomy = 해석 algebra
순회와 해석의 분리                     → 분해 구조와 taxonomy 해석의 분리
T를 바꾸면 다른 결과                   → taxonomy를 바꾸면 다른 관점
```

### 핵심 원칙

1. **분해 트리는 하나** — 비즈니스 기획이 정의하는 재귀 구조가 공유 SSOT
2. **해석은 교체 가능** — 같은 노드에 다른 taxonomy algebra를 적용하면 다른 산출물
3. **순회와 해석 분리** — 트리 탐색 로직은 공유, 각 taxonomy는 해석만 담당

### 해석 예시

"이벤트 수집" 노드에 각 taxonomy algebra 적용:

```
fold("이벤트 수집", definition)      → scope:data, aspect:event_contract
fold("이벤트 수집", structural)      → boundary:ingest, facet:collection
fold("이벤트 수집", observability)   → trace:browser_event, level:app_data
fold("이벤트 수집", PM)             → deliverable:수집파이프라인, checkpoint:E2E통과
fold("이벤트 수집", df)             → DecisionUnit:"수집 방식 결정"
```

### 재귀 분해

```
이벤트 수집 (capability)
├── 브라우저 SDK 수집      ← 개념이 커져서 분리
├── 서버 사이드 수집
└── 프로토콜 협상
```

각 하위 노드도 동일하게 모든 taxonomy algebra로 해석 가능. 순환 참조 방지는 `SchemaAlgebra`의 stack/set 기반 패턴을 따른다.

### Product Algebra — 다중 taxonomy 동시 적용

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

## 미해결 질문

1. 비즈니스 분해 트리의 관리 주체 — 서비스 레지스트리 확장인가 별도 체계인가
2. 비즈니스 분해 노드의 식별자 체계 — 서비스 레지스트리 아래 어떤 형식인가
3. 분해 깊이 제한 — contains depth 4 경고 규칙과의 관계
4. 기획 문서가 없는 기존 시스템의 역호환 — 기존 문서에 비즈니스 분해 좌표를 어떻게 부여하는가
