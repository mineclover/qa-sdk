---
def:
  id: data-object-codegen
  level: leaf
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: operation
  links:
    - target: data-object-binding
      type: depends_on
---

# DataObject Codegen — 바인딩 → Typed SDK 코드 생성

## 목적 ^purpose

DataObjectBinding 배열에서 TypeScript 타입 안전 코드를 자동 생성한다.
순수 함수. I/O 없음. 결정론적.

## ^defines

### generateDataObjectBindings

```ts
// 참조: codegen-core/src/data-object-typescript.ts
function generateDataObjectBindings(
  bindings: readonly DataObjectBinding[],
  options?: DataObjectCodegenOptions,
): DataObjectCodegenResult
```

### 생성 파일 3종

| 파일 | 내용 |
|------|------|
| `data-objects.ts` | 바인딩 상수 (`ORDERS_BINDING`) + 타입 (`OrdersBinding`) |
| `binding-registry.ts` | `createBindingRegistry()` — 모든 바인딩 자동 등록 |
| `lineage-types.ts` | `BoundSchemaId`, `BoundPrefixId` 유니온 + 컬럼 타입 |

### 네이밍 규칙

| 입력 | 상수명 | 타입명 |
|------|--------|--------|
| schemaId: "orders" | `ORDERS_BINDING` | `OrdersBinding` |
| schemaId: "members" | `MEMBERS_BINDING` | `MembersBinding` |

### 결정론성

- 같은 입력 → 같은 `contentHash` (SHA-256 hex 12자)
- 바인딩 순서 무관 (정렬 후 해시)
- timestamp는 파일 내용에 포함되나 hash 계산에 미포함

## 테스트

`codegen-core/src/data-object-typescript.test.ts` — 8건

## ^consumes

- `DataObjectBinding` 타입 (core/data-object/types.ts와 동일 구조)
- `toPascal`, `toConstKey` (codegen-core/naming.ts)
