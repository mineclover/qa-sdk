---
def:
  id: sdk-api-surface
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  tags: [tier-infra]
  links:
    - target: sdk-dim-views
      type: depends_on
    - target: index-meta-store
      type: depends_on
---
# sdk-api-surface

## 목적 ^purpose

index-meta SDK의 퍼블릭 API. MetaCodec 위에 구축된 encode/decode/resolve/serialize 통합 인터페이스.

index-meta SDK의 퍼블릭 API. MetaCodec 위에 구축된 encode/decode/resolve/serialize 통합 인터페이스.

그룹: [sdk-system.md](sdk-system.md)
원본: `docs/specs/indexing/index-meta/sdk.spec.md`

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
