---
def:
  tier: component
  id: schema-layer-implementation-spec
  scope: feature
  aspect: func_def
  depth: specification
  svc: weighted-index
  lifecycle: approved
  layer: domain
  tags: [runtime, structural, observability]
  links:
    - target: schema-layer-spec
      type: refines
sources:
  - packages/index-meta/src/table-def.ts
  - packages/index-meta/src/table-def.test.ts
  - packages/index-meta/src/compile-schema.ts
  - packages/index-meta/src/compile-schema.test.ts
  - packages/index-meta/src/schema-sync.ts
  - packages/index-meta/src/schema-sync.test.ts
  - packages/weighted-index/src/vocab/label-registry.ts
  - packages/weighted-index/src/vocab/label-registry.test.ts
  - packages/weighted-index/src/vocab/prefix-registry.ts
  - packages/weighted-index/src/vocab/prefix-registry.test.ts
  - packages/weighted-index/src/vocab/partial-binder.ts
  - packages/weighted-index/src/vocab/partial-binder.test.ts
  - packages/spec-core/src/semantic-indexing-pack/index.ts
  - packages/spec-core/src/semantic-indexing-pack/types.ts
  - packages/spec-core/src/semantic-indexing-pack/manifest.ts
  - packages/spec-core/src/semantic-indexing-pack/classify.ts
  - packages/spec-core/src/semantic-indexing-pack/compatibility.ts
  - packages/spec-core/src/semantic-indexing-pack/report.ts
  - packages/spec-core/src/semantic-indexing-pack/grounding.ts
  - packages/spec-core/src/semantic-indexing-pack/semantic-indexing-pack.test.ts
  - packages/spec-core/src/spec/prefix-spec.types.ts

---

# Schema Layer — 구현 대응과 설계 원칙

## 목적 ^purpose

현재 구현(PrefixDef, DimRef 등)과 Layer 2 스키마 개념의 매핑 관계를 정리하고,
PrefixDef 분리 계획, 구현 순서, 핵심 설계 원칙을 명시한다.

## 현재 구현과의 대응

| Layer 2 개념 | 현재 구현 | 상태 |
|---|---|---|
| SchemaDefinition | PrefixDef (부분) | ○ 확장 필요 |
| SchemaAxis | DimRef (부분) | ○ valueType 추가 필요 |
| category (6종) | 없음 | ○ 신규 |
| fragment | 없음 | ○ 신규 |
| constraint | 없음 | ○ 신규 |
| required/optional/multi | 없음 | ○ 신규 |
| validation pipeline | 없음 | ○ 신규 |

### PrefixDef 분리 계획

현재 PrefixDef가 Layer 1과 Layer 2를 동시에 담고 있다:

```
현재:
  PrefixDef = labels + dims(axis/prefix_ref/table_ref) + versions
              ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~   ~~~~~~~~
              Layer 1 + Layer 2 혼재                     Layer 1

분리 후:
  CoordinateDef: labels + dims(axis/prefix_ref만) + versions   ← Layer 1
  SchemaDef: category + axes(SchemaAxis) + constraints + fragments  ← Layer 2
```

---

## 구현 순서

| 단계 | 내용 | 의존 |
|---|---|---|
| 1 | Vocabulary 정리 (이미 완료) | — |
| 2 | Coordinate canonical form (이미 완료) | Layer 0 |
| 3 | **Base schema 6종 타입 정의** | Layer 0 + 1 |
| 4 | **Fragment 시스템** | Layer 2 타입 |
| 5 | **Constraint DSL** | Layer 2 타입 + Fragment |
| 6 | Semantic plugin interface | Layer 2 완성 후 |

---

## 핵심 설계 원칙

1. **"도메인 개념"이 아니라 "구조 슬롯"을 정의하라**: 스키마 종류는 6개. 도메인 변형은 설정으로 푼다.
2. **상속보다 조합**: fragment composition. 클래스 계층 금지.
3. **Schema validates composition, not truth**: 구조적 제약만. 의미 추론은 외부.
4. **고정 좌표계 위에서 동작**: 축이 이미 고정되어 있으므로 스키마는 "어떤 조합이 유효한가"만 판단.
