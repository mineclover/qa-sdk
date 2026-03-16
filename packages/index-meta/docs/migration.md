> 메인 문서: [`README.md`](../README.md)
> PositionEngine 마이그레이션 설계: [`position-engine.md`](position-engine.md) §3

## 마이그레이션

버전 간 데이터 이동과 cross-index 정보 전이를 지원한다.

### EntityId 기반 암묵적 이동 (권장)

같은 EntityId가 두 버전 모두에 존재하면, `decode → re-encode` 패턴으로 자동 대응된다.

```ts
const v1 = registry.createCodec("perm", "v1");
const v2 = registry.createCodec("perm", "v2");

// v1에 저장된 값
const old = registry.parse("perm:v1:8");
const entityIds = v1.decode(old);
// { role: "viewer", action: "read", resource: "articles" }

// v2로 re-encode — idToIndex가 v2 snapshot에서 자동으로 위치를 찾는다
const migrated = v2.encode(entityIds);
// { indexId: "perm", versionId: "v2", value: ... }
```

구성이 같다면 명시적 migration 없이 버전 간 이동이 가능하다.

### 좌표 수준 명시적 이동

entries의 순서가 바뀌거나, 같은 위치에 다른 엔티티가 들어오는 경우 `DimSnapshotMigration`으로 좌표 변환 동선을 기록한다.

```ts
category: {
  kind: { type: "string_enum" },
  snapshots: {
    s1: { entries: ["tech", "science", "art"] },         // science=2, art=3
    s2: { entries: ["tech", "art", "science", "culture"] }, // art=2, science=3
  },
  migrations: [
    {
      fromSnapshotId: "s1",
      toSnapshotId: "s2",
      indexMap: {
        2: 3,  // s1의 2번(science) → s2의 3번
        3: 2,  // s1의 3번(art)     → s2의 2번
        // 1(tech)은 명시 없음 → identity (1 → 1)
      },
    },
  ],
}
```

#### `getMigration` — 직접 등록된 migration 조회

```ts
const mig = registry.getMigration("category", "s1", "s2");
// { fromSnapshotId: "s1", toSnapshotId: "s2", indexMap: { 2: 3, 3: 2 } }
```

#### `traceMigration` — BFS 체인

직접 연결이 없어도 등록된 migration edge를 따라 경로를 찾는다.

```ts
// s1→s2→s3 chain이 등록되어 있으면 s1→s3 직접 추적 가능
const newIndex = registry.traceMigration("category", "s1", "s3", 2);
// s1의 2번(science)이 s3에서 어디 있는지 반환
```

`indexMap`에 명시되지 않은 위치는 identity(동일 번호 유지)로 처리된다.

### 즉시 마이그레이션 유틸

read-repair 패턴을 지원한다. DB에서 읽은 주소를 최신 버전으로 즉시 변환하고 `migrated` 플래그로 변환 여부를 반환한다.

#### migrateAddress — 직렬화 문자열 마이그레이션

```ts
import { migrateAddress } from "index-meta";

const result = migrateAddress(registry, "perm:v1:8", "v2");
// { serialized: string, vv: VersionedValue, migrated: boolean }
if (result.migrated) {
  await db.update(id, result.serialized); // DB에 즉시 반영
}
```

이미 targetVersion이면 변환 없이 원본 반환 (`migrated: false`).

#### migrateValue — VersionedValue 수준 마이그레이션

직렬화/파싱 없이 VV 수준에서 동작한다.

```ts
import { migrateValue } from "index-meta";

const result = migrateValue(registry, vv, "v2");
// { vv: VersionedValue, migrated: boolean }
```

#### migrateBatch — 일괄 마이그레이션

혼재된 버전의 주소 배열을 일괄 처리한다. 이미 최신인 항목은 건너뛴다.

```ts
import { migrateBatch } from "index-meta";

const results = migrateBatch(registry, addresses, "v2");
const updates = results.filter(r => r.migrated);
// results[i]: { original: string, serialized: string, vv: VersionedValue, migrated: boolean }
```

### Cross-index 마이그레이션

서로 다른 index schema 간의 정보 전이 프로토콜. dim 이름이 겹치면 자동 carry-over하고, target에만 있는 새 dim은 호출자가 값을 판단해 제공한다.

```ts
import { migrateCrossIndex, completeCrossIndex } from "index-meta";

// perm:v1 (role, action) → perm_full:v1 (role, action, resource)
const result = migrateCrossIndex(registry, vv, "perm_full", "v1");

if (result.complete) {
  // 모든 dim이 carry-over됨 → result.vv 사용
} else {
  // result.partial.missingDimIds === ["resource"]
  // result.partial.carryOverEntityIds === { role: "editor", action: "write" }
  const newVV = completeCrossIndex(registry, result.partial, { resource: "posts" });
}
```

`additionalEntityIds`로 누락 dim을 즉시 채울 수도 있다.

```ts
const result = migrateCrossIndex(registry, vv, "perm_full", "v1", { resource: "posts" });
// → { complete: true, vv: VersionedValue, migrated: true }
```

source에 여분 dim이 있으면 target dims만 carry-over하고 나머지는 버린다.

**Note:** 이는 엄밀한 "마이그레이션"이 아니라 두 schema 간의 정보 전이 프로토콜이다. prefix가 바뀌면 dim 구성도 바뀌므로, 새 dim에 어떤 값을 줄지는 호출자가 판단해야 한다.
