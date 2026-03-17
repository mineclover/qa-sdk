> 메인 문서: [`README.md`](../README.md)
> 네이밍 체계: [`naming.md`](naming.md) · PositionEngine 설계: [`position-engine.md`](position-engine.md)

## API 레퍼런스

### `new MetaRegistry(input)`

생성자에서 모든 검증을 수행한다. 검증 통과 후에는 불변.

```ts
new MetaRegistry(input: MetaRegistryInput)
```

### 핵심 API

```ts
// 특정 version에 특화된 독립 코덱 생성
createCodec(indexId: string, versionId: string): MetaCodec

// 버전별 활성 인덱스 집합 반환
getActiveManifest(indexId: string, versionId: string): IndexActiveManifest

// 특정 entry의 active 여부 반환 (entryFlags 기반)
isEntryActive(dimId: string, snapshotId: string, oneBasedIndex: number): boolean

// 생성자에 전달한 입력의 deep clone 반환 (복제/fork 패턴에 사용)
toInput(): MetaRegistryInput

// VersionedValue ↔ 프로토콜 문자열 (AddressConverter에 위임)
// protocol 생략 시 기본 프로토콜 (address 미설정: colon, 설정: layout)
serialize(vv: VersionedValue, protocol?: string): string
parse(input: string, protocol?: string): VersionedValue

// AddressConverter 접근 및 기본 프로토콜
get converter(): AddressConverter
get defaultProtocol(): string
```

### MetaCodec API

```ts
// DecodeMap으로 직접 생성하거나, registry.createCodec()으로 생성
new MetaCodec(map: DecodeMap)

// 엔티티 ID 레코드 → VersionedValue (inactive 강제 없음)
encode(entityIds: Record<string, EntityId>): VersionedValue

// VersionedValue → 엔티티 ID 레코드 (indexId/versionId 일치 검증, inactive도 decode 가능)
decode(vv: VersionedValue): Readonly<Record<string, EntityId>>

// value만으로 decode (indexId/versionId 검증 없음)
decodeValue(value: number): Readonly<Record<string, EntityId>>

// 부분 좌표 패턴에 매칭되는 value 범위 목록 반환 (DB BETWEEN 쿼리용)
// partial의 각 dim: EntityId 지정 → 해당 값만, null/생략 → 와일드카드
matchRanges(partial: Record<string, EntityId | null>): [number, number][]

get indexId(): string
get versionId(): string
get size(): number
get shape(): readonly number[]
toDecodeMap(): DecodeMap

// DecodeMap의 구조 검증 (shape/dims 길이 불일치, 빈 entries 등). 실패 시 ValidationError
validateDecodeMap(map: DecodeMap): void  // standalone 함수로 export
```

### Capacity Guard API

```ts
import { computeShapeProductBig, fitsNumber } from "index-meta";
import { CapacityOverflowError } from "index-meta";
import type { NumberType, VersionCapacityInfo } from "index-meta";

// shape product를 BigInt로 정확히 계산
computeShapeProductBig(shape: readonly number[]): bigint

// Number.MAX_SAFE_INTEGER 이내인지 판별
fitsNumber(shape: readonly number[]): boolean

// strict: false일 때 수집된 capacity 경고 조회
registry.capacityWarnings: readonly string[]

// 특정 version의 capacity 분석 결과
registry.getCapacityInfo(indexId, versionId): VersionCapacityInfo
// → { indexId, versionId, shape, sizeNumber, sizeBigInt, fitsNumber, numberType }
```

### MetaCodecBig API

```ts
import { MetaCodecBig } from "index-meta";
import type { VersionedValueBig } from "index-meta";

// DecodeMap으로 생성 (BigInt-aware 검증, size 캡 허용)
new MetaCodecBig(map: DecodeMap)

// BigInt 기반 encode/decode — WeightedIndexBig 내부 사용
encode(entityIds: Record<string, EntityId>): VersionedValueBig
decode(vvb: VersionedValueBig): Readonly<Record<string, EntityId>>
decodeValue(value: bigint): Readonly<Record<string, EntityId>>
decodeBatch(values: readonly bigint[]): Readonly<Record<string, EntityId>>[]

// BigInt 범위 쿼리
matchRanges(partial: Record<string, EntityId | null>): [bigint, bigint][]

get indexId(): string
get versionId(): string
get size(): bigint
get shape(): readonly bigint[]
get strides(): readonly bigint[]
get dimIds(): readonly string[]
toDecodeMap(): DecodeMap
```

### BigInt 직렬화 API

```ts
// BigInt 코덱 생성 — numberType과 무관하게 사용 가능
registry.createCodecBig(indexId, versionId): MetaCodecBig

// BigInt layout protocol로 직렬화/파싱 (address config 필수)
registry.serializeBig(vvb: VersionedValueBig): string
registry.parseBig(input: string): VersionedValueBig
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

### Diff & Validation API

```ts
// 두 스냅샷 간 diff (entries 변화, 추가/이동 항목)
snapshotDiff(dimId: string, fromSnapshotId: string, toSnapshotId: string): SnapshotDiff

// 두 버전 간 diff (dim별 snapshot 변화, shape 변화)
versionDiff(indexId: string, fromVersionId: string, toVersionId: string): VersionDiff

// migration indexMap의 정합성 검증 (누락/범위 초과 등). 실패 시 ValidationError
validateMigration(dimId: string, fromSnapshotId: string, toSnapshotId: string): void
```

### 즉시 마이그레이션 API

```ts
import { migrateAddress, migrateValue, migrateBatch, migrateCrossIndex, completeCrossIndex } from "index-meta";

// 직렬화 주소 → targetVersion (read-repair)
migrateAddress(registry, serialized, targetVersion, protocol?): MigrateResult

// VV → targetVersion
migrateValue(registry, vv, targetVersion): Omit<MigrateResult, "serialized">

// 주소 배열 일괄 마이그레이션
migrateBatch(registry, addresses, targetVersion, protocol?): Array<MigrateResult & { original: string }>

// 다른 index로 정보 전이
migrateCrossIndex(registry, vv, targetIndexId, targetVersionId, additionalEntityIds?): CrossIndexMigrateResult

// CrossIndexPartialResult 완성
completeCrossIndex(registry, partial, additionalEntityIds): VersionedValue
```

### Coordinate Query Layer API

```ts
import { composeQuery, deepDecode } from "index-meta";

// 하위 index 조건으로 상위 index의 주소 범위 계산
composeQuery(target: { indexId, versionId }, refDimId: string, constraint: Record<string, EntityId>, registry): [number, number][]

// 중첩 index 재귀 decode (visited set으로 순환 방지, maxDepth 제한)
deepDecode(address: VersionedValue, registry, maxDepth?: number): { layers: Map<string, Record<string, EntityId>>, path: VersionedValue[] }
```

```ts
import { queryAcrossVersions, entityVersionSpan, translateConstraint } from "index-meta";

// entity 기준으로 여러 version의 범위 반환
queryAcrossVersions(indexId, versionIds, constraint: Record<string, EntityId | null>, registry): Map<string, [number, number][]>

// entity가 존재하는 version 목록 (activeOnly 옵션)
entityVersionSpan(indexId, dimId, entityId, registry, options?): string[]

// 버전 간 좌표 제약 변환 (migration edge 우선, fallback: EntityId 기반)
translateConstraint(indexId, fromVersion, toVersion, constraint: Record<string, CoordConstraint>, registry): Record<string, CoordConstraint> | null
```

```ts
import { matchRules, resolvePolicy, detectConflicts } from "index-meta";

// 좌표에 매칭되는 규칙 목록 (구체성 순 정렬)
matchRules<T>(coord, rules: { pattern, value: T }[], shape): { pattern, value: T }[]

// 전략별 정책 해석 (most-specific | priority | first-match | collect)
resolvePolicy<T>(coord, rules, shape, strategy): T | T[] | undefined

// 규칙 간 충돌 감지 (패턴 겹침 + 값 불일치)
detectConflicts<T>(rules, shape, eq?): { ruleA, ruleB, overlap }[]
```

### 게이트 제어 API

```ts
import {
  ADDRESS_GATE, computeStateRanges, checkGate, classifyAddress,
  encodableRanges, decodableRanges, activeRanges, positionsToConstraint,
} from "index-meta";
import type { DimStateSpec, AddressState, GateResult, AddressStateStore } from "index-meta";

// dim별 상태 → composite 주소 구간 계산
computeStateRanges(shape, specs): { reservedRanges, inactiveRanges, openRanges }

// 주소의 encode/decode 허용 여부 — O(log n)
checkGate(address, reservedRanges, inactiveRanges, openRanges): GateResult

// 주소 상태만 반환
classifyAddress(address, reservedRanges, inactiveRanges, openRanges): AddressState

// 구간 집합 조회 헬퍼
encodableRanges(capacity, reservedRanges, inactiveRanges): [number, number][]
decodableRanges(capacity, reservedRanges, openRanges): [number, number][]
activeRanges(capacity, reservedRanges, inactiveRanges, openRanges): [number, number][]

// position 목록 → CoordConstraint 문자열
positionsToConstraint(positions): string
```

### Gate-Aware Query API

`gate-aware-query.ts`는 RelationalEngine(의미적, 동기) + GateEngine(물리적, 비동기)을 결합 없이 합성하는 유틸리티.

```ts
import { gateFilterRanges, gateAwareResolve, buildDenialSpecs } from "index-meta";
import type { GateAwareResult } from "index-meta";

// matchRanges 결과에서 gate 차단 주소 제거
// mode: "encodable" | "decodable" | "active"
gateFilterRanges(ranges, gateRecord, mode): [number, number][]

// policy 결과 + gate 상태 → GateAwareResult
// policyResult: 이미 계산된 resolvePolicy 결과 (null이면 policy deny)
// gateRecord: AddressStateStore에서 조회한 캐시 레코드 (null이면 전체 active)
gateAwareResolve<T>(policyResult, address, gateRecord): GateAwareResult<T> | null

// 규칙 거부 position → DimStateSpec[] 변환 (선택적 gate 반영용)
buildDenialSpecs(deniedPositions, dimIndex, state?): DimStateSpec[]

// GateAwareResult<T>
interface GateAwareResult<T> {
  value: T | T[];
  matchedRules: PolicyRule<T>[];
  strategy: ConflictStrategy;
  gateBlocked: boolean;
  gateState: AddressState | null;
  permitted: boolean;  // policy allow AND gate active
}
```

### AddressProtocolManager API

`AddressProtocolManager`(APM)는 AddressConfig 기반 프로토콜 관리 + 텍스트 프로토콜 자동 감지를 담당한다.

```ts
import { AddressProtocolManager } from "index-meta";
import type { FallbackStats } from "index-meta";

const apm = new AddressProtocolManager(indexId, versionId, size, addressConfig?);

// 프로토콜별 직렬화/파싱
apm.serialize(vv: VersionedValue, protocol?: string): string
apm.parse(input: string, protocol?: string): VersionedValue

// 프로토콜 자동 감지 (파싱 없이 포맷만 판별)
apm.detect(input: string): string | null  // "colon" | "uri" | "compact" | "layout" | null

// layout 프로토콜의 fallback 통계
apm.getFallbackStats(): FallbackStats

// 지원 프로토콜 목록
apm.protocols: readonly string[]
```

### PrefixDecoder API

`PrefixDecoder`는 MetaCodec + AddressProtocolManager를 결합한 decode 전용 facade. `number | string` 혼합 입력 자동 처리, index_ref 1-level 확장, 프로토콜 감지를 제공한다. `index-meta/decode` 경량 진입점으로 사용.

```ts
import { PrefixDecoder } from "index-meta/decode";
import type { PrefixDecoderConfig, PrefixDeepDecodeResult } from "index-meta/decode";

// 생성: DecodeMap + 선택적 refs (index_ref 확장용)
const decoder = new PrefixDecoder(config: PrefixDecoderConfig);
// PrefixDecoderConfig = { map: DecodeMap; refs?: Record<string, DecodeMap> }

// ── Identity ──
decoder.indexId: string
decoder.versionId: string
decoder.size: number
decoder.shape: readonly number[]
decoder.strides: readonly number[]
decoder.dimIds: readonly string[]

// ── L1 Address: input → VersionedValue ──
// number → 직접 VersionedValue 구성, string → 프로토콜 자동 감지 후 파싱
decoder.resolve(input: number | string): VersionedValue

// ── L2 Info: input → entity record ──
decoder.decode(input: number | string): Record<string, EntityId>

// ── L2+ Deep: index_ref dim을 1-level 확장 ──
decoder.decodeDeep(input: number | string): PrefixDeepDecodeResult
// → { entities: Record<string, EntityId>, refs: Record<string, Record<string, EntityId>> }
// refs에 해당 dim의 참조 index decode 결과 포함. ref 코덱 없으면 빈 객체.

// ── Batch ──
decoder.decodeBatch(inputs: (number | string)[]): Record<string, EntityId>[]

// ── Query (MetaCodec 위임) ──
decoder.matchRanges(partial: Record<string, EntityId | null>): [number, number][]
decoder.enumerate(partial: Record<string, EntityId | null>): number[]

// ── Ref ──
decoder.hasRef(dimId: string): boolean
decoder.resolveRef(value: number, dimId: string): Record<string, EntityId>

// ── Encode (대칭) ──
decoder.encode(entities: Record<string, EntityId>): VersionedValue

// ── Serialize (APM 위임) ──
decoder.serialize(vv: VersionedValue, protocol?: string): string

// ── Detect (프로토콜 감지) ──
decoder.detect(input: string): string | null  // "colon" | "uri" | "compact" | "layout" | null

// ── Export ──
decoder.toDecodeMap(): DecodeMap
```

### Resolver API

`MetaResolver`는 MetaRegistry의 데이터를 외부 소비용 번들로 변환한다. DB 동기화, 프론트엔드 전송, API 응답 등에 사용.

```ts
import { MetaResolver } from "index-meta";

const resolver = new MetaResolver(registry);

// 특정 version의 디코딩 최소 번들 (외부에서 MetaRegistry 없이 decode 가능)
resolver.getDecodeMap(indexId: string, versionId: string): DecodeMap

// DecodeMap + index_ref 참조 DecodeMap 번들 (PrefixDecoder 생성용)
// JSON 직렬화 → 마이크로서비스 전송 → new PrefixDecoder(bundle) 패턴
resolver.getDecodeMapBundle(indexId: string, versionId: string): PrefixDecoderConfig

// dim의 모든 snapshot (버전 range). 각 snapshot에 capacity/headroom 포함.
resolver.getDimRange(dimId: string): DimRange

// index의 모든 version (shape/size/dims 포함). 각 dim에 capacity/headroom 포함.
resolver.getIndexRange(indexId: string): IndexRange

// 전체 데이터셋 (index별 + dim별 그룹핑)
resolver.getDataset(): MetaDataset
```

#### DecodeMap 외부 디코딩 예시

```ts
import { calcWeights, WeightedIndex } from "weighted-index";

const map = resolver.getDecodeMap("perm", "v1");
// → { shape: [3,3,3], size: 27, dims: [{dimId:"role", entries:[...]}, ...] }

// 방법 1: WeightedIndex 사용 (권장)
const wi = new WeightedIndex([...map.shape]);
const coords = wi.decode(value);
const result: Record<string, string> = {};
for (let i = 0; i < map.dims.length; i++) {
  result[map.dims[i].dimId] = map.dims[i].entries[coords[i] - 1];
}

// 방법 2: calcWeights + 수동 디코딩 (의존성 최소화)
const weights = calcWeights(map.shape);
let remaining = value;
for (let i = 0; i < map.dims.length; i++) {
  const coord = Math.floor(remaining / weights[i]) + 1;
  remaining = remaining % weights[i];
  result[map.dims[i].dimId] = map.dims[i].entries[coord - 1];
}
```
