---
def:
  id: index-meta-sdk-spec
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
---
# IndexSDK 스펙

## 목적 ^purpose

MetaRegistryInput 하나로 즉시 사용 가능한 경량 소비 레이어.
개발자는 entity name만 입력하면, 내부에서 VersionedValue로 압축·해석한다.

패키지 인덱스: [README.md](README.md)
코덱: [codec.spec.md](codec.spec.md)
슬롯 마커: [../slot-marker.spec.md](../slot-marker.spec.md)

---

## 상태

implemented

---

## 역할

```
MetaRegistry (게이트웨이)       MetaCodec (정보 해석)      IndexSDK (소비 레이어)
├── serialize/parse            ├── encode/decode          ├── client() → IndexClient
├── createCodec()              └── decodeValue            │   ├── encode/decode
└── validate                                              │   ├── constants()
                                                          │   ├── dimCapacity()
                                                          │   └── entries()
                                                          └── constants() (dim-level)
```

IndexSDK는 MetaRegistry + MetaCodec + MetaResolver를 내부에서 조합한다.
개발자는 이 세 클래스를 직접 조합할 필요 없이, `createIndexSDK(input)` 하나로 시작한다.

---

## 설계 원칙

### 1. 버전 고정

`client(indexId, versionId)`로 index + version을 한 번 바인딩하면, 이후 모든 호출에서 indexId/versionId를 반복하지 않는다.

```ts
const tracking = sdk.client("tracking", "v1");

// indexId, versionId 생략 — client에 고정됨
tracking.encode({ action: "click", page: "home" });
tracking.decode(vv);
```

### 2. 예약 토큰 필터링

`constants()`는 도메인에서 사용하는 정규 값만 반환한다.
슬롯 마커(`"_"`, `"~"`, `"?"`)와 inactive 항목은 자동 제외된다.

이 분리 덕분에:
- 코드젠 시 정규 도메인 값만 포함된 상수 객체가 생성된다
- IDE 자동완성에 마커가 노출되지 않는다
- 마커를 사용해야 하는 경우 `entries()`로 전체 목록을 참조한다

### 3. 캐싱

- 동일 `indexId + versionId` 조합의 client는 내부 캐싱으로 재생성 비용 없음
- `constants()` 결과도 dimId별로 캐싱됨
- `Object.freeze()`로 불변성 보장

### 4. 환경 무관

`index-meta/client` 진입점으로 사용 시 Node.js 전용 의존성 없이 동작.
브라우저, Edge 런타임, 프론트엔드에서 안전하게 사용 가능.

---

## API

### createIndexSDK

```ts
function createIndexSDK(input: MetaRegistryInput, options?: IndexSDKOptions): IndexSDK;

interface IndexSDKOptions {
  /**
   * constants()에서 제외할 예약 토큰 셋.
   * 테이블마다 사용하는 예약 토큰이 다를 수 있으므로 오버라이드 가능.
   * 생략 시 RESERVED_TOKENS ({"_", "~", "?"}).
   */
  reservedTokens?: ReadonlySet<string>;
}
```

### IndexSDK

```ts
interface IndexSDK {
  /** index + version에 고정된 클라이언트 생성 (캐싱됨) */
  client(indexId: string, versionId: string): IndexClient;

  /** dim + snapshot에서 직접 상수 추출 (index 바인딩 없음, 캐싱됨) */
  constants(dimId: string, snapshotId: string): Readonly<Record<string, EntityId>>;

  /** 내부 MetaRegistry 접근 (직렬화, 고급 조회 등) */
  readonly registry: MetaRegistry;
}
```

### IndexClient

```ts
interface IndexClient {
  /** entity names → VersionedValue */
  encode(entities: Record<string, EntityId>): VersionedValue;

  /** VersionedValue → entity names (indexId/versionId 검증 포함) */
  decode(vv: VersionedValue): Readonly<Record<string, EntityId>>;

  /** value(정수) → entity names (indexId/versionId 검증 없음) */
  decodeValue(value: number): Readonly<Record<string, EntityId>>;

  /** 부분 매칭 범위 조회 (DB BETWEEN 쿼리용) */
  matchRanges(partial: Record<string, EntityId | null>): [number, number][];

  /** 이 client에 바인딩된 dim의 entries 배열 반환 (예약 토큰 포함) */
  entries(dimId: string): readonly EntityId[];

  /** dim entries를 enum-like 상수 객체로 반환 (예약 토큰 + inactive 제외, 캐싱됨) */
  constants(dimId: string): Readonly<Record<string, EntityId>>;

  /** dim별 용량 정보 반환 */
  dimCapacity(dimId: string): DimCapacityInfo;

  /** dim의 전체 주소 공간 뷰 (capacity 포함, 백엔드 주소 추론용) */
  dimFullView(dimId: string): DimFullView;

  /** DecodeMap 반환 (다른 서비스로 전달해 독립 decode에 사용) */
  toDecodeMap(): DecodeMap;

  readonly indexId: string;
  readonly versionId: string;
  readonly size: number;
  readonly shape: readonly number[];
}
```

---

## 예약 토큰 (RESERVED_TOKENS)

```ts
export const RESERVED_TOKENS: ReadonlySet<string> = new Set(["_", "~", "?"]);
```

### 기본 토큰

| 토큰 | 역할 | 의미 |
|------|------|------|
| `"_"` | **null** | 값 없음, 미결정, 해당 없음 |
| `"~"` | **other** | 정의된 카테고리에 해당하지 않음 |
| `"?"` | **unknown** | 존재하지만 식별 불가 |

### 오버라이드

테이블마다 사용하는 예약 토큰이 다를 수 있다:

```ts
// number_enum에서 NaN 추가
createIndexSDK(input, {
  reservedTokens: new Set(["_", "~", "?", "NaN"]),
});

// 예약 토큰 필터링 비활성화
createIndexSDK(input, {
  reservedTokens: new Set(),
});
```

### entries() vs constants() vs dimFullView() 차이

| 메서드 | 예약 토큰 | inactive 항목 | 빈 슬롯 | capacity 정보 | 용도 |
|--------|----------|--------------|---------|-------------|------|
| `entries(dimId)` | **포함** | **포함** | **미포함** | **없음** | 전체 entries 참조, 마커 접근 |
| `constants(dimId)` | **제외** | **제외** | **미포함** | **없음** | 코드젠, IDE 자동완성, 도메인 상수 |
| `dimFullView(dimId)` | **포함** | **포함** | **포함** | **있음** | 백엔드 주소 추론, 관리 UI |

```ts
const tracking = sdk.client("tracking", "v1");

// entries — 전체 (마커 포함)
tracking.entries("action");
// → ["_", "~", "click", "view", "scroll"]

// constants — 정규 도메인 값만
tracking.constants("action");
// → { click: "click", view: "view", scroll: "scroll" }
```

---

## constants() 빌드 로직

```
entries 배열 순회
  ├── 예약 토큰인가? → 제외  (reservedTokens.has(entry))
  ├── inactive인가?  → 제외  (activeIndices에 없음)
  └── 통과           → result[String(entry)] = entry
```

### string_enum 결과

```ts
entries: ["_", "~", "admin", "editor", "viewer"]
constants → { admin: "admin", editor: "editor", viewer: "viewer" }
```

### number_enum 결과

```ts
entries: [10, 20, 30]
constants → { "10": 10, "20": 20, "30": 30 }
```

### inactive 필터링

entryFlags로 `deprecated` 등으로 표시된 항목은 constants에서 제외된다.
entries와 encode/decode에서는 여전히 유효하다 (기존 데이터 decode 보장).

```ts
// position 3 (editor)가 inactive
snapshots: {
  v1: {
    entries: ["_", "admin", "editor", "viewer"],
    entryFlags: { 3: { status: "inactive" } },
  },
}

// constants에서 editor 제외
tracking.constants("role");
// → { admin: "admin", viewer: "viewer" }

// entries에는 여전히 포함
tracking.entries("role");
// → ["_", "admin", "editor", "viewer"]

// encode/decode도 정상 동작 (기존 데이터)
tracking.decode(editorVV);
// → { role: "editor", ... }
```

---

## DimCapacityInfo — 용량 정보

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

> **Note**: `DimCapacityInfo`는 Number 값만 반환한다. BigInt 용량 정보가 필요하면 `registry.getCapacityInfo(indexId, versionId)`로 `VersionCapacityInfo`(sizeBigInt, fitsNumber, numberType 포함)를 조회한다. 상세: [bigint-addressing.spec.md](../bigint-addressing.spec.md)

```ts
const info = tracking.dimCapacity("action");
// { total: 5, capacity: 8, headroom: 3 }
// → 3개의 action을 더 추가할 수 있음
```

### 용량 관리 라이프사이클

```
1. dimCapacity()로 headroom 확인
2. headroom > 0이면 → 관리 레이어에서 entry 추가
3. SDK 재생성으로 동기화
4. headroom = 0이면 → 새 version 생성 (capacity 확장) 후 마이그레이션
```

entry 추가는 SDK가 수행하지 않는다. 관리 레이어(레지스트리/DB)에서 수행한 뒤 SDK를 재생성해 동기화한다.

---

## DimFullView — 전체 주소 공간 뷰

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
| **Client** | `entries()`, `constants()` | **미포함** | 프론트엔드·소비 클라이언트 |
| **Full** | `dimFullView()` | **포함** | 백엔드 주소 추론 |

**Client 모드**: 등록된 entries만 반환한다. 클라이언트는 capacity, headroom, 빈 슬롯의 존재를 알 필요가 없다.

**Full 모드**: 전체 capacity 포함 주소 공간을 반환한다. 백엔드에서 주소를 추론해야 할 때 사용한다. 모든 position(1..capacity)의 상태를 포함하므로 빈 슬롯, 예약 마커, 정규 엔티티를 한눈에 파악할 수 있다.

```ts
const perm = sdk.client("perm", "v1");

// Client 모드 — capacity 정보 없음
perm.entries("role");
// → ["_", "~", "admin", "editor", "viewer"]

perm.constants("role");
// → { admin: "admin", editor: "editor", viewer: "viewer" }

// Full 모드 — 백엔드 주소 추론용
perm.dimFullView("role");
// → {
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

---

## SDK-level constants

IndexClient와 별개로, SDK에서 직접 dim + snapshot을 지정해 상수를 추출할 수 있다.
특정 index에 바인딩되지 않은 dim-level 상수가 필요한 경우에 사용한다.

```ts
const sdk = createIndexSDK(input);

// index 바인딩 없이 dim의 상수 추출
const roles = sdk.constants("role", "v1");
// → { admin: "admin", editor: "editor", viewer: "viewer" }

// index에 바인딩된 상수는 client.constants()
const perm = sdk.client("perm", "v1");
const actions = perm.constants("action");
```

SDK-level `constants()`도 동일한 필터링 규칙(예약 토큰 + inactive 제외)이 적용되며, 결과는 캐싱된다.

---

## 캐싱 전략

| 대상 | 캐시 키 | 범위 | 무효화 |
|------|---------|------|--------|
| IndexClient | `${indexId}:${versionId}` | IndexSDK 인스턴스 | SDK 재생성 |
| client.constants() | `dimId` | IndexClient 인스턴스 | SDK 재생성 |
| sdk.constants() | `${dimId}:${snapshotId}` | IndexSDK 인스턴스 | SDK 재생성 |

SDK는 immutable 스냅샷이다. 스키마가 변경되면(entry 추가, version 변경 등) 새 SDK 인스턴스를 생성한다.

---

## 에러

| 에러 | 발생 조건 |
|------|----------|
| `DimNotFoundError` | `entries()`, `constants()`, `dimCapacity()`에 존재하지 않는 dimId 전달 |
| `IndexNotFoundError` | `client()`에 존재하지 않는 indexId 전달 (MetaRegistry에서 발생) |
| `IndexVersionNotFoundError` | `client()`에 존재하지 않는 versionId 전달 |
| `EntryNotFoundError` | `encode()`에 entries에 없는 entity ID 전달 |

---

## 사용 패턴

### 기본 encode/decode

```ts
import { createIndexSDK } from "index-meta/client";

const sdk = createIndexSDK(schemaInput);
const tracking = sdk.client("tracking", "v1");

const vv = tracking.encode({ action: "click", page: "home" });
// → { indexId: "tracking", versionId: "v1", value: 0 }

const decoded = tracking.decode(vv);
// → { action: "click", page: "home" }
```

### 상수 기반 코딩

```ts
const perm = sdk.client("perm", "v1");
const ROLE = perm.constants("role");
const ACTION = perm.constants("action");

// IDE 자동완성: ROLE.admin, ROLE.editor, ROLE.viewer
const vv = perm.encode({ role: ROLE.admin, action: ACTION.read });
```

### 범위 쿼리

```ts
const ranges = perm.matchRanges({ role: "admin", action: null });
// → [[lo, hi], ...] — DB WHERE value BETWEEN lo AND hi
```

### DecodeMap 전달

```ts
const map = tracking.toDecodeMap();
// → JSON.stringify(map) → 프론트엔드/마이크로서비스로 전달

// 수신 측에서 MetaCodec으로 독립 decode
import { MetaCodec } from "index-meta/client";
const codec = new MetaCodec(map);
codec.decodeValue(valueFromDB);
```

### 용량 확인

```ts
const info = tracking.dimCapacity("action");
if (info.headroom > 0) {
  console.log(`${info.headroom}개의 action을 더 추가할 수 있음`);
} else {
  console.log("capacity 확장 필요 — 새 version 생성 필요");
}
```

---

## 진입점

| 진입점 | 포함 범위 | 환경 |
|--------|----------|------|
| `index-meta/client` | SDK + Core (MetaCodec, MetaResolver) + Errors + Types | 브라우저, Edge, Node.js |
| `index-meta` | 위 전체 + SQL 어댑터 + 마이그레이션 + 분산 클라이언트 | Node.js |

`index-meta/client`는 Node.js 전용 의존성(better-sqlite3 등)을 포함하지 않는다.
