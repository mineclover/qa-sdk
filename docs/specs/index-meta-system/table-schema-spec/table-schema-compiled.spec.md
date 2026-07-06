---
def:
  tier: component
  id: table-schema-compiled-spec
  address: def_document:v2:342209
  scope: data
  aspect: domain_data
  depth: specification
  svc: index-meta
  lifecycle: approved
  layer: domain
  tags: [data, structural, runtime]
  links:
    - target: table-schema-spec
      type: refines
sources:
  - packages/index-meta/src/compile-schema.ts
  - packages/index-meta/src/compile-schema.test.ts
  - packages/index-meta/src/table-def.ts
  - packages/index-meta/src/index.ts
---

# CompiledSchema 출력 타입

## 목적 ^purpose

`compileSchema`의 출력인 `CompiledSchema` 인터페이스와 하위 타입(TableSpec, SchemaDiff)을 정의한다.
capacity 변화만 추적하는 diff 메커니즘을 명세한다.

## 1. CompiledSchema

```ts
interface CompiledSchema {
  readonly tables: readonly TableSpec[];
  getTable(id: string): TableSpec | undefined;
  diff(from: CompiledSchema): SchemaDiff;
}
```

## 2. TableSpec

```ts
type TableSpec = LeafTableSpec | CompositeTableSpec;

interface LeafTableSpec {
  kind: "leaf";
  id: string;
  entryKind: { type: "string_enum" } | { type: "number_enum" };
  versions: ReadonlyMap<string, LeafVersionSpec>;  // versionId → { versionId, capacity }
  description?: string;
}

interface CompositeTableSpec {
  kind: "composite";
  id: string;
  versions: ReadonlyMap<string, CompositeVersionSpec>;
  description?: string;
}

interface CompositeVersionSpec {
  versionId: string;
  capacity: number;    // 자동 계산: 모든 dim capacity의 곱
  dims: CompositeVersionDim[];
}

interface CompositeVersionDim {
  dimId: string;
  ref: { prefix: string; version: string; capacity: number };
}
```

## 3. diff

`diff(from)`은 **capacity 변화만** 감지한다. entries 변화는 스키마 관심사가 아니다.

```ts
interface SchemaDiff {
  added: TableSpec[];           // from에 없던 테이블
  removed: string[];            // to에 없는 테이블 id
  changed: TableVersionChange[];
}

interface TableVersionChange {
  tableId: string;
  addedVersions: VersionCapacityChange[];   // 새로 추가된 버전 또는 capacity 변경
  removedVersions: string[];
}

interface VersionCapacityChange {
  versionId: string;
  capacity: number;
  previousCapacity?: number;  // capacity가 변경된 경우
}
```

## source-backed 주의점

- `diff(from)`은 table id 추가/삭제와 version capacity 변화만 본다.
- entries, reserved marker, description 변화는 `SchemaDiff` 대상이 아니다.
- composite capacity는 compile 시 참조 version capacity를 곱해 계산하며, 출력 dim ref에는 capacity가 함께 포함된다.
