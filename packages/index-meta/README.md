# index-meta

`weighted-index`의 **스키마 메타 DB**.

`WeightedIndex`가 정수 ↔ 좌표 변환의 수학을 담당한다면, `index-meta`는 각 축이 무엇을 의미하는지, 각 위치에 어떤 엔티티가 있는지를 선언하고 관리한다. 선언된 스키마를 바탕으로 엔티티 ID로 직접 인코딩/디코딩하고, 버전이 올라가도 값의 의미를 추적할 수 있다.

```
weighted-index    정수 ↔ n차원 좌표 변환 (순수 수학)
index-meta        각 축의 의미 + 엔티티 목록 + 버전 관리 + active manifest
데이터 레이어     실제 값 저장 (VersionedValue: indexId + versionId + value)
```

> 스펙 문서: [`docs/specs/indexing/index-meta.spec.md`](../../docs/specs/indexing/index-meta.spec.md)

---

## 설치

```bash
pnpm add index-meta
```

---

## 핵심 개념

| 개념 | 설명 |
|---|---|
| **DimDef** | 축(dimension) 슬롯. `kind`로 들어오는 값의 타입을 선언한다. |
| **DimSnapshot** | 특정 시점의 항목 목록. `entries[i-1]`이 1-based 좌표 `i`의 EntityId. append-only. |
| **IndexDef** | 순서 있는 dim 조합. 이 순서가 WeightedIndex의 shape을 결정한다. |
| **IndexVersion** | IndexDef의 각 dim에서 어느 DimSnapshot을 쓸지 고정한 버전 스냅샷. |
| **VersionedValue** | DB 저장 단위. `{ indexId, versionId, value }`. 직렬화: `"indexId:versionId:value"`. |
| **IndexActiveManifest** | 특정 버전에서 현재 active한 좌표 집합. 프로그래밍 레이어가 선택지 필터에 사용. |

### EntityId가 행(row) 고유 식별자

각 entries 항목은 고유한 EntityId를 가진다. 버전이 올라가도 같은 EntityId가 새 스냅샷에 존재하면 `decode → re-encode` 패턴으로 자동 대응할 수 있다. 구성이 같다면 명시적 migration이 불필요하다.

---

## 시작하기

```ts
import { MetaRegistry } from "index-meta";

const registry = new MetaRegistry({
  dims: {
    role: {
      kind: { type: "string_enum" },
      snapshots: {
        v1: { entries: ["admin", "editor", "viewer"] },
      },
    },
    action: {
      kind: { type: "string_enum" },
      snapshots: {
        v1: { entries: ["read", "write", "delete"] },
      },
    },
  },
  indices: {
    perm: {
      dims: ["role", "action"],   // 순서 = WeightedIndex shape 순서
      versions: {
        iv1: { snapshots: { role: "v1", action: "v1" } },
      },
    },
  },
});

// 엔티티 ID로 인코딩 → VersionedValue
const vv = registry.encode("perm", "iv1", { role: "editor", action: "write" });
// { indexId: "perm", versionId: "iv1", value: 4 }

// DB 저장용 문자열 직렬화
const serialized = registry.serialize(vv); // "perm:iv1:4"

// 역직렬화 + 디코딩
const ids = registry.decode(registry.parse(serialized));
// { role: "editor", action: "write" }
```

---

## DimKind: 축 값 타입 선언

각 dim이 받는 값의 종류를 선언한다. 인코딩 방식이 아니라 **값의 의미**를 정의한다.

### `string_enum`

entries가 문자열. 값 자체가 고유 키.

```ts
role: {
  kind: { type: "string_enum" },
  snapshots: {
    v1: { entries: ["admin", "editor", "viewer"] },
  },
}
```

### `number_enum`

entries가 숫자. 숫자 값 자체가 고유 키. 다른 index와 참조 관계 없음.

```ts
tenant_id: {
  kind: { type: "number_enum" },
  snapshots: {
    v1: { entries: [1001, 1002, 1003] },
  },
}
```

### `index_ref`

entries가 숫자이지만, 그 값이 다른 `WeightedIndex`의 1D 압축 결과. `indexId`로 어느 index 계열의 값만 받는지 선언한다.

```ts
doc_state: {
  kind: { type: "index_ref", indexId: "document_meta" },
  snapshots: {
    v1: { entries: [0, 2, 3] },  // document_meta index의 압축값들
  },
}
```

> `versionId`는 스키마 정의 관심사가 아니다. 데이터 적재 시 값과 함께 전달한다.

**DimKind 선택 기준:**

| 상황 | DimKind |
|---|---|
| 값이 문자열 식별자 | `string_enum` |
| 값이 숫자 식별자 (다른 index와 무관) | `number_enum` |
| 값이 다른 index의 encode() 결과 | `index_ref` |

---

## 버전 관리

### DimSnapshot 버전

dim의 항목 목록이 시간이 지남에 따라 변할 때 새 snapshot을 추가한다.

```ts
role: {
  kind: { type: "string_enum" },
  snapshots: {
    v1: { entries: ["admin", "editor", "viewer"] },
    v2: { entries: ["admin", "editor", "viewer", "guest"] }, // guest 추가
  },
}
```

**entries는 append-only.** 한 번 부여된 1-based 좌표는 불변이다. 항목을 추가할 때는 항상 배열 끝에 붙인다. 기존 위치를 변경하면 안 된다.

### IndexVersion

IndexDef의 각 dim에서 어느 DimSnapshot을 사용할지 고정한다.

```ts
perm: {
  dims: ["role", "action", "resource"],
  versions: {
    // v1: role의 v1 snapshot 사용 (total=3)
    v1: { snapshots: { role: "v1", action: "v1", resource: "v1" } },
    // v2: role이 v2로 교체 (total=4로 확장)
    v2: { snapshots: { role: "v2", action: "v1", resource: "v1" } },
  },
}
```

버전이 올라갈 때 WeightedIndex shape이 변경되므로, 버전별로 독립적인 value 공간을 가진다.

---

## Active/Inactive 관리

특정 항목을 삭제하지 않고 비활성화할 수 있다. entries에서 제거하면 좌표가 깨지므로, `entryFlags`로 inactive 처리한다.

```ts
action: {
  kind: { type: "string_enum" },
  snapshots: {
    v1: { entries: ["read", "write", "delete"] },
    v2: {
      entries: ["read", "write", "delete"],  // 배열 유지
      entryFlags: {
        3: {  // 1-based. delete(3번)을 비활성화
          status: "inactive",
          reason: "deprecated in v2",
          updatedAt: "2026-03-01",
        },
      },
    },
  },
}
```

### IndexActiveManifest로 선택지 필터링

```ts
const manifest = registry.getActiveManifest("perm", "v2");
// {
//   indexId: "perm", versionId: "v2",
//   dims: [
//     { dimId: "role",   snapshotId: "v2", total: 4, activeIndices: [1,2,3,4] },
//     { dimId: "action", snapshotId: "v2", total: 3, activeIndices: [1,2] },  // delete 제외
//     { dimId: "resource", ... }
//   ]
// }

const actionDim = manifest.dims.find(d => d.dimId === "action")!;
// 프로그래밍 레이어에서 activeIndices만 허용하는 필터로 활용
const activeActions = actionDim.activeIndices.map(i =>
  registry.getDimSnapshot("action", actionDim.snapshotId).entries[i - 1]
);
// ["read", "write"]
```

**중요:** `encode`와 `decode`는 inactive를 강제하지 않는다. 기존에 inactive 항목으로 인코딩된 값도 항상 decode할 수 있다. active/inactive 강제는 호출자(프로그래밍 레이어)의 책임이다.

---

## 버전 간 이동

### EntityId 기반 암묵적 이동 (권장)

같은 EntityId가 두 버전 모두에 존재하면, `decode → re-encode` 패턴으로 자동 대응된다.

```ts
// v1에 저장된 값
const old = registry.parse("perm:v1:8");
const entityIds = registry.decode(old);
// { role: "viewer", action: "read", resource: "articles" }

// v2로 re-encode — idToIndex가 v2 snapshot에서 자동으로 위치를 찾는다
const migrated = registry.encode("perm", "v2", entityIds);
// { indexId: "perm", versionId: "v2", value: ... }
```

구성이 같다면 명시적 migration 없이 버전 간 이동이 가능하다.

### Migration: 좌표 수준 명시적 이동

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

---

## 예약 항목(Reserved Entry) 관례

`encode()`는 모든 차원에 반드시 값이 있어야 한다. 값이 없으면 에러다. 그러나 실제 도메인에서는 정규 분류 밖의 상태가 존재한다 — 값 미지정, 분류 불가, 식별 불가 등. 이런 상태가 에러가 되면 안 되므로, entries에 해당 상태를 나타내는 **예약 항목**을 포함해야 한다.

핵심: **dim이 어떤 예약 항목을 허용하는지 명시적으로 선언한다.** 선언하지 않으면 모든 entry가 정규 도메인 값이며, 값 없이 encode를 시도하면 에러로 처리해야 한다. 허용한다면 프로젝트 전체에서 동일한 토큰을 사용해야 한다.

### 표준 토큰

`string_enum` 표준 예약 토큰 — **예약어**이므로 정규 도메인 값으로 사용 금지:

| 토큰 | 의미 |
|---|---|
| `"_"` | **null** — 값이 없거나 아직 결정되지 않음 |
| `"~"` | **other** — 정의된 카테고리에 해당하지 않음 |
| `"?"` | **unknown** — 값이 존재하지만 식별 불가 |

`number_enum` / `index_ref`는 기본 `0`, 충돌 시 `description`에 대체 토큰을 명시한다.

### 규칙

1. 예약 항목은 **entries 배열의 앞쪽에 배치**. 순서: `"_"` → `"~"` → `"?"`.
2. `description`에 `reserved: [position]=token (의미)` 형식으로 선언.
3. `reserved:` 선언이 없으면 예약 항목 없음. 모든 entry가 정규 값.

```ts
// ── null만 허용 ───────────────────────────────────────────────────
priority: {
  kind: { type: "string_enum" },
  description: 'reserved: [1]="_" (미지정)',
  snapshots: {
    v1: { entries: ["_", "low", "medium", "high"] },
  },
}

// ── null + other 허용 ─────────────────────────────────────────────
category: {
  kind: { type: "string_enum" },
  description: 'reserved: [1]="_" (미분류), [2]="~" (기타)',
  snapshots: {
    v1: { entries: ["_", "~", "tech", "science", "art"] },
  },
}

// ── 예약 항목 없음 — 값은 반드시 정규 도메인 값 ───────────────────
role: {
  kind: { type: "string_enum" },
  snapshots: {
    v1: { entries: ["admin", "editor", "viewer"] },
  },
}
```

### 소비자 판단

1. `description`에 `reserved:` 선언이 **있으면**: 해당 토큰이 예약 항목. `"_"`, `"~"`, `"?"` 표준 토큰은 토큰 자체로 의미 확정.
2. `reserved:` 선언이 **없으면**: 모든 entry가 정규 값. 값 없이 encode할 수 없으므로 호출자가 에러 처리.

### 마이그레이션에서의 활용

새 차원이 추가될 때 기존 데이터에 예약 토큰을 기본값으로 할당:

```ts
// v1: role × action (2차원) → v2: role × action × env (3차원)
const ids = registry.decode(oldV1Value);
const migrated = registry.encode("perm", "v2", {
  ...ids,
  env: 0,  // reserved: "환경 미지정"
});
```

---

## entryRefs: 셀 수준 index 참조

dim의 kind가 `string_enum`이어도, 특정 위치의 entry 하나가 다른 index의 압축값인 경우 `entryRefs`로 선언한다.

```ts
role: {
  kind: { type: "string_enum" },
  snapshots: {
    v1: {
      entries: ["admin", 42, "viewer"],  // index 2 = 42 (perm index의 압축값)
      entryRefs: {
        2: { indexId: "perm", versionId: "iv1" }, // 엔진 확장에 versionId가 필요
      },
    },
  },
}
```

**dim-level `index_ref`와의 차이:**

| | dim-level (`DimKind`) | entry-level (`entryRefs`) |
|---|---|---|
| 선언 위치 | `kind.type = "index_ref"` | `snapshot.entryRefs[pos]` |
| 적용 범위 | 해당 축 전체 | 특정 위치 하나 |
| `versionId` 수집 | 안 함 (데이터 적재 시 관리) | 함 (엔진 확장에 필요) |

---

## 중첩 index (index_ref 계층)

`index_ref` dim을 사용하면 index를 중첩할 수 있다.

```ts
const registry = new MetaRegistry({
  dims: {
    format: {
      kind: { type: "string_enum" },
      snapshots: { fv1: { entries: ["pdf", "html"] } },
    },
    lang: {
      kind: { type: "string_enum" },
      snapshots: { lv1: { entries: ["ko", "en"] } },
    },
    // doc_meta index의 압축값을 저장하는 dim
    quality_tier: {
      kind: { type: "index_ref", indexId: "doc_meta" },
      snapshots: {
        qtv1: { entries: [0, 2] }, // pdf/ko=0, html/ko=2 (doc_meta 압축값)
      },
    },
  },
  indices: {
    doc_meta: {
      dims: ["format", "lang"],
      versions: { dmv1: { snapshots: { format: "fv1", lang: "lv1" } } },
    },
    article: {
      dims: ["quality_tier"],
      versions: { av1: { snapshots: { quality_tier: "qtv1" } } },
    },
  },
});

// outer encode
const vv = registry.encode("article", "av1", { quality_tier: 2 });

// outer decode → doc_meta 압축값(=2) 반환
const outer = registry.decode(vv);
// { quality_tier: 2 }

// inner decode → format + lang 복원
const inner = registry.decode({ indexId: "doc_meta", versionId: "dmv1", value: 2 });
// { format: "html", lang: "ko" }
```

`MetaRegistry.decode()`는 EntityId 수준에서 중단한다. `index_ref` dim의 경우 반환된 숫자 값을 inner index로 재귀 decode하는 것은 호출자의 책임이다.

---

## API 레퍼런스

### `new MetaRegistry(input)`

생성자에서 모든 검증을 수행한다. 검증 통과 후에는 불변.

```ts
new MetaRegistry(input: MetaRegistryInput)
```

### 핵심 API

```ts
// 버전별 활성 인덱스 집합 반환
getActiveManifest(indexId: string, versionId: string): IndexActiveManifest

// 엔티티 ID 레코드 → VersionedValue (inactive 강제 없음)
encode(indexId: string, versionId: string, entityIds: Record<string, EntityId>): VersionedValue

// VersionedValue → 엔티티 ID 레코드 (inactive 값도 항상 decode 가능)
decode(vv: VersionedValue): Record<string, EntityId>

// VersionedValue ↔ 문자열 직렬화 ("indexId:versionId:value")
serialize(vv: VersionedValue): string
parse(serialized: string): VersionedValue
```

### 조회 API

```ts
getDimDef(dimId: string): DimDef
getDimSnapshot(dimId: string, snapshotId: string): DimSnapshot
getIndexDef(indexId: string): IndexDef
getIndexVersion(indexId: string, versionId: string): IndexVersion
getWeightedIndex(indexId: string, versionId: string): WeightedIndex  // 캐시됨

get dimIds(): readonly string[]
get indexIds(): readonly string[]
getVersionIds(indexId: string): readonly string[]
getSnapshotIds(dimId: string): readonly string[]
```

### Migration API

```ts
// 직접 등록된 migration 반환. 없으면 MigrationNotFoundError
getMigration(dimId: string, fromSnapshotId: string, toSnapshotId: string): DimSnapshotMigration

// BFS로 경로를 찾아 indexMap 체인 적용. 최종 1-based index 반환
traceMigration(dimId: string, fromSnapshotId: string, toSnapshotId: string, index: number): number
```

---

## 에러 처리

모든 에러는 `IndexMetaError`를 상속한다.

```ts
import {
  IndexMetaError,
  DimNotFoundError,
  SnapshotNotFoundError,
  IndexNotFoundError,
  IndexVersionNotFoundError,
  EntryNotFoundError,
  MigrationNotFoundError,
  ValidationError,
  ParseError,
} from "index-meta";
```

| 에러 | 발생 조건 |
|---|---|
| `DimNotFoundError` | 등록되지 않은 dimId |
| `SnapshotNotFoundError` | 등록되지 않은 snapshotId |
| `IndexNotFoundError` | 등록되지 않은 indexId (parse, index_ref 교차검증 등) |
| `IndexVersionNotFoundError` | 등록되지 않은 versionId |
| `EntryNotFoundError` | encode 시 EntityId를 snapshot에서 찾지 못함 |
| `MigrationNotFoundError` | getMigration 직접 조회 실패 / traceMigration 경로 없음 |
| `ValidationError` | 입력 데이터 제약 조건 위반 (중복 ID, 빈 entries, 범위 오류 등) |
| `ParseError` | serialize 문자열 형식 오류 |

```ts
try {
  const vv = registry.encode("perm", "iv1", { role: "unknown_role", action: "read" });
} catch (e) {
  if (e instanceof EntryNotFoundError) {
    // EntityId가 snapshot에 없음
  } else if (e instanceof IndexMetaError) {
    // 그 외 라이브러리 에러
  } else {
    throw e;
  }
}
```

---

## 공개 API

```ts
// 클래스
export { MetaRegistry } from "index-meta";

// 입력 타입
export type {
  MetaRegistryInput,
  DimInput,
  DimSnapshotInput,
  DimSnapshotMigration,
  IndexInput,
  IndexVersionInput,
} from "index-meta";

// 조회/출력 타입
export type {
  EntityId,
  DimKind,
  EntryStatus,
  EntryFlag,
  EntryIndexRef,
  DimDef,
  DimSnapshot,
  IndexDef,
  IndexVersion,
  VersionedValue,
  DimActiveSet,
  IndexActiveManifest,
} from "index-meta";

// 에러
export {
  IndexMetaError,
  DimNotFoundError,
  SnapshotNotFoundError,
  IndexNotFoundError,
  IndexVersionNotFoundError,
  EntryNotFoundError,
  MigrationNotFoundError,
  ValidationError,
  ParseError,
} from "index-meta";
```

---

## 빌드

```bash
pnpm build       # tsup → dist/ (ESM + CJS)
pnpm test        # vitest
pnpm typecheck   # tsc --noEmit
```
