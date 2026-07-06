---
def:
  tier: component
  id: table-schema-api-spec
  address: def_document:v2:342208
  scope: interface
  aspect: api_contract
  depth: specification
  svc: index-meta
  lifecycle: approved
  layer: domain
  tags: [entry-point, contract, runtime]
  links:
    - target: table-schema-spec
      type: refines
sources:
  - packages/index-meta/src/table-def.ts
  - packages/index-meta/src/table-def.test.ts
  - packages/index-meta/src/compile-schema.ts
  - packages/index-meta/src/compile-schema.test.ts
  - packages/index-meta/src/index.ts
---

# defineTable / compileSchema API

## 목적 ^purpose

`defineTable`과 `compileSchema` 두 공개 API의 시그니처와 검증 규칙을 정의한다.
defineTable은 단일 테이블을 생성하고, compileSchema는 테이블 배열을 위상정렬 후 CompiledSchema로 변환한다.

## 1. defineTable API

```ts
function defineTable(id: string, input: {
  source?: { kind: { type: "string_enum" } | { type: "number_enum" } };
  dims?: TableDef[];
  versions: Record<string, TableVersion>;
  description?: string;
}): TableDef
```

### 검증 규칙

| 규칙 | 에러 |
|------|------|
| id 비어있음 | `ValidationError` |
| id에 `:` 포함 | `ValidationError` |
| source와 dims 동시 선언 | `ValidationError` |
| source도 dims도 없음 | `ValidationError` |
| versions 비어있음 | `ValidationError` |
| versionId 비어있음 / `:` 포함 | `ValidationError` |
| leaf version에 capacity 없음 | `ValidationError` |
| capacity가 양의 정수가 아님 | `ValidationError` |
| composite version에 refs 없음 | `ValidationError` |
| refs에 선언된 dim 누락 | `ValidationError` |
| refs의 key가 dims에 없는 id | `ValidationError` |
| `ref.prefix !== dimId` | `ValidationError` |
| ref.prefix / ref.version 비어있음 | `ValidationError` |
| composite version에 capacity 선언 | `ValidationError` |

---

## 2. compileSchema API

```ts
function compileSchema(defs: TableDef[]): CompiledSchema
```

`TableDef` 배열을 받아 의존성 순서대로 처리하고, capacity가 계산된 `CompiledSchema`를 반환한다.

### 내부 처리 단계

```
① collectAllDefs  — 재귀로 dims 참조를 따라가 모든 TableDef 수집
                    (인자에 직접 넘기지 않아도 dims 체인에 있으면 자동 포함)
② topologicalSort — leaf 먼저, composite 나중. 순환 참조 시 ValidationError.
③ spec 빌드      — 정렬된 순서대로 처리:
                    leaf     → LeafTableSpec (capacity 그대로)
                    composite → CompositeVersionSpec (capacity = dim capacity 곱)
```

### 검증 규칙

| 규칙 | 에러 |
|------|------|
| 동일 id를 가진 서로 다른 TableDef 객체 | `ValidationError` |
| 순환 의존성 | `ValidationError` |
| composite가 참조하는 prefix가 specMap에 없음 | `ValidationError` |
| composite가 참조하는 version이 해당 spec에 없음 | `ValidationError` |

## source-backed 주의점

- `defineTable`은 `dims` 배열을 복사하지만, nested `TableDef` 객체 자체를 deep copy하지 않는다.
- `compileSchema`는 인자로 직접 넘기지 않은 dim chain의 `TableDef`를 자동 수집한다.
- 현재 API는 reserved slot 필드를 검증하거나 컴파일 출력에 보존하지 않는다.
