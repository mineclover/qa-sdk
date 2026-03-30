---
def:
  id: sdk-dim-views
  address: def_document:v2:342194
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: index-meta
  tags: [data, runtime, structural]
  links:
    - target: address-spec
      type: depends_on
---
# sdk-dim-views

## 목적 ^purpose

DimCapacityInfo(용량 정보)와 DimFullView(전체 주소 공간 뷰). 축별 capacity, headroom, stride를 조회한다.

그룹: [sdk-system.md](sdk-system.md)
원본: `docs/specs/indexing/index-meta/sdk.spec.md`

## 구성 ^overview

- **DimCapacityInfo**: 축별 `total`(등록 entries 수), `capacity`(할당 주소 공간), `headroom`(추가 가능 슬롯 수)을 제공한다
- **headroom 의미**: headroom > 0이면 버전 변경 없이 새 entry 추가가 가능하며, 0이면 새 version 생성이 필요하다
- **DimFullView**: 전체 capacity 범위의 position별 상태(`normal`/`reserved`/`empty`)를 포함하는 주소 공간 뷰
- **Client 모드**: `entries()`, `constants()` — 등록된 entries만 반환하며 capacity 정보를 노출하지 않는다 (프론트엔드용)
- **Full 모드**: `dimFullView()` — 모든 position(1..capacity)의 상태를 포함하여 백엔드 주소 추론에 사용한다
- **kind 분류**: `reserved`(슬롯 마커, `_`/`~` 등), `normal`(정규 도메인 값), `empty`(headroom 빈 슬롯)
- **BigInt 대응**: Number 범위를 초과하는 용량은 `registry.getCapacityInfo()`의 `VersionCapacityInfo`(sizeBigInt 포함)로 별도 조회한다

## 상태

implemented

## 1. DimCapacityInfo — 용량 정보

```ts
interface DimCapacityInfo {
  /** 현재 등록된 entries 수 */
  total: number;
  /** 할당된 주소 공간 크기 */
  capacity: number;
  /** 추가 가능한 슬롯 수 (capacity - total) */
  headroom: number;
}
```

### headroom의 의미

headroom > 0이면 **버전 변경 없이** 새 entry를 추가할 수 있는 여유 공간이 있다.
일부러 빈 공간으로 남겨둔 것은 서비스 시나리오 상 추가 가능한 영역이다.

> **Note**: `DimCapacityInfo`는 Number 값만 반환한다. BigInt 용량 정보가 필요하면 `registry.getCapacityInfo(indexId, versionId)`로 `VersionCapacityInfo`(sizeBigInt, fitsNumber, numberType 포함)를 조회한다. 상세: [../indexing-core-system/bigint-addressing-group.md](../indexing-core-system/bigint-addressing-group.md)

```ts
const info = tracking.dimCapacity("action");
// { total: 5, capacity: 8, headroom: 3 }
// -> 3개의 action을 더 추가할 수 있음
```

### 용량 관리 라이프사이클

```
1. dimCapacity()로 headroom 확인
2. headroom > 0이면 -> 관리 레이어에서 entry 추가
3. SDK 재생성으로 동기화
4. headroom = 0이면 -> 새 version 생성 (capacity 확장) 후 마이그레이션
```

entry 추가는 SDK가 수행하지 않는다. 관리 레이어(레지스트리/DB)에서 수행한 뒤 SDK를 재생성해 동기화한다.

## 2. DimFullView — 전체 주소 공간 뷰

```ts
interface DimEntryView {
  /** 1-based position */
  position: number;
  /** entity 값. empty slot이면 null */
  value: EntityId | null;
  /** normal = 정규 도메인 값, reserved = 슬롯 마커, empty = headroom 빈 슬롯 */
  kind: "normal" | "reserved" | "empty";
}

interface DimFullView {
  dimId: string;
  snapshotId: string;
  total: number;
  capacity: number;
  headroom: number;
  positions: readonly DimEntryView[];
}
```

### 두 가지 엔트리 제공 모드

엔트리를 제공할 때 두 가지 모드가 있다:

| 모드 | 메서드 | capacity 정보 | 용도 |
|------|--------|-------------|------|
| **Client** | `entries()`, `constants()` | **미포함** | 프론트엔드/소비 클라이언트 |
| **Full** | `dimFullView()` | **포함** | 백엔드 주소 추론 |

**Client 모드**: 등록된 entries만 반환한다. 클라이언트는 capacity, headroom, 빈 슬롯의 존재를 알 필요가 없다.

**Full 모드**: 전체 capacity 포함 주소 공간을 반환한다. 백엔드에서 주소를 추론해야 할 때 사용한다. 모든 position(1..capacity)의 상태를 포함하므로 빈 슬롯, 예약 마커, 정규 엔티티를 한눈에 파악할 수 있다.

```ts
const perm = sdk.client("perm", "v1");

// Client 모드 — capacity 정보 없음
perm.entries("role");
// -> ["_", "~", "admin", "editor", "viewer"]

perm.constants("role");
// -> { admin: "admin", editor: "editor", viewer: "viewer" }

// Full 모드 — 백엔드 주소 추론용
perm.dimFullView("role");
// -> {
//   dimId: "role", snapshotId: "v1",
//   total: 5, capacity: 10, headroom: 5,
//   positions: [
//     { position: 1, value: "_",      kind: "reserved" },
//     { position: 2, value: "~",      kind: "reserved" },
//     { position: 3, value: "admin",  kind: "normal" },
//     { position: 4, value: "editor", kind: "normal" },
//     { position: 5, value: "viewer", kind: "normal" },
//     { position: 6, value: null,     kind: "empty" },
//     { position: 7, value: null,     kind: "empty" },
//     { position: 8, value: null,     kind: "empty" },
//     { position: 9, value: null,     kind: "empty" },
//     { position: 10, value: null,    kind: "empty" },
//   ]
// }
```

### kind 분류 기준

| kind | 조건 | 의미 |
|------|------|------|
| `reserved` | `typeof entry === "string" && reservedTokens.has(entry)` | 슬롯 마커 (encode/decode 가능, 도메인 상수 제외) |
| `normal` | entry가 존재하고 reserved가 아님 | 정규 도메인 값 |
| `empty` | position > entries.length (capacity 범위 내 빈 슬롯) | headroom — 추가 가능한 영역 |
