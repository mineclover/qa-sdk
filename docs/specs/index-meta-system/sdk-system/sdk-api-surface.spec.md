---
def:
  tier: component
  id: sdk-api-surface
  address: def_document:v2:412831
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: index-meta
  tags: [entry-point, contract, runtime]
  links:
    - target: sdk-dim-views
      type: depends_on
    - target: index-meta-store-group
      type: depends_on
sources:
  - packages/index-meta/src/index-sdk.ts
  - packages/index-meta/src/client.ts
  - packages/index-meta/src/index.ts
  - packages/index-meta/src/meta-codec.test.ts
  - packages/index-meta/src/meta-resolver.test.ts
  - packages/index-meta/src/capacity-guard.test.ts
  - packages/index-meta/package.json
---
# sdk-api-surface

## 목적 ^purpose

index-meta SDK의 퍼블릭 API. MetaCodec 위에 구축된 encode/decode/matchRanges/toDecodeMap 소비 인터페이스.

그룹: [sdk-system.md](sdk-system.md)
원본: `docs/specs/indexing/index-meta/sdk.spec.md`

## 구성 ^overview

- **createIndexSDK**: MetaRegistryInput으로 SDK 인스턴스를 생성하며, reservedTokens 오버라이드 옵션 지원
- **IndexSDK**: client(index+version 바인딩), constants(dim+snapshot 직접 상수 추출), registry(내부 MetaRegistry 접근) 제공
- **IndexClient 핵심 API**: encode(entity→정수), decode(정수→entity), matchRanges(부분 매칭 범위 쿼리), toDecodeMap(독립 decode용 맵 전달)
- **상수 기반 코딩**: constants()로 enum-like 객체를 반환하여 IDE 자동완성과 타입 안전성 확보
- **캐싱 전략**: SDK는 `MetaRegistryInput` snapshot을 기준으로 생성되며, IndexClient와 constants는 키 기반 캐싱으로 재생성 시에만 무효화
- **진입점 분리**: index-meta/client(브라우저/Edge/Node.js, Node 전용 의존성 제외)와 index-meta(SQL 어댑터/마이그레이션 포함, Node.js 전용)
- **에러 체계**: DimNotFoundError, IndexNotFoundError, IndexVersionNotFoundError, EntryNotFoundError 4종으로 명확한 발생 조건 구분

## 상태

implemented

## 1. createIndexSDK

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

## 2. IndexSDK

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

## 3. IndexClient

```ts
interface IndexClient {
  /** entity names -> VersionedValue */
  encode(entities: Record<string, EntityId>): VersionedValue;

  /** VersionedValue -> entity names (indexId/versionId 검증 포함) */
  decode(vv: VersionedValue): Readonly<Record<string, EntityId>>;

  /** value(정수) -> entity names (indexId/versionId 검증 없음) */
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

## 4. 사용 패턴

### 기본 encode/decode

```ts
import { createIndexSDK } from "index-meta/client";

const sdk = createIndexSDK(schemaInput);
const tracking = sdk.client("tracking", "v1");

const vv = tracking.encode({ action: "click", page: "home" });
// -> { indexId: "tracking", versionId: "v1", value: 0 }

const decoded = tracking.decode(vv);
// -> { action: "click", page: "home" }
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
// -> [[lo, hi], ...] — DB WHERE value BETWEEN lo AND hi
```

### DecodeMap 전달

```ts
const map = tracking.toDecodeMap();
// -> JSON.stringify(map) -> 프론트엔드/마이크로서비스로 전달

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

## 5. 캐싱 전략

| 대상 | 캐시 키 | 범위 | 무효화 |
|------|---------|------|--------|
| IndexClient | `${indexId}:${versionId}` | IndexSDK 인스턴스 | SDK 재생성 |
| client.constants() | `dimId` | IndexClient 인스턴스 | SDK 재생성 |
| sdk.constants() | `${dimId}:${snapshotId}` | IndexSDK 인스턴스 | SDK 재생성 |

SDK는 immutable 스냅샷이다. 스키마가 변경되면(entry 추가, version 변경 등) 새 SDK 인스턴스를 생성한다.

## 6. 에러

| 에러 | 발생 조건 |
|------|----------|
| `DimNotFoundError` | `entries()`, `constants()`, `dimCapacity()`에 존재하지 않는 dimId 전달 |
| `IndexNotFoundError` | `client()`에 존재하지 않는 indexId 전달 (MetaRegistry에서 발생) |
| `IndexVersionNotFoundError` | `client()`에 존재하지 않는 versionId 전달 |
| `EntryNotFoundError` | `encode()`에 entries에 없는 entity ID 전달 |

## 7. 진입점

| 진입점 | 포함 범위 | 환경 |
|--------|----------|------|
| `index-meta/client` | SDK + Core (MetaCodec, MetaResolver) + Errors + Types | 브라우저, Edge, Node.js |
| `index-meta` | 위 전체 + SQL 어댑터 + 마이그레이션 + 분산 클라이언트 | Node.js |

`index-meta/client`는 Node.js 전용 의존성(better-sqlite3 등)을 포함하지 않는다.

## source-backed 주의점

- `IndexClient`는 serialize/parse를 직접 노출하지 않는다. serialized address 처리가 필요하면 `sdk.registry`나 lower-level registry/codec API를 사용한다.
- `IndexSDK`는 `IndexMetaStore`를 직접 읽지 않는다. store에서 만든 entries/snapshots를 `MetaRegistryInput`으로 전달한 뒤 SDK를 생성하는 구조다.
- `index-meta/client` export는 SDK/core/errors/types로 제한되고, SQL adapters/migration/distributed client는 main `index-meta` entrypoint에 남는다.
