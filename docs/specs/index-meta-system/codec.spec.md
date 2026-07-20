---
def:
  tier: component
  id: index-codec-spec
  address: def_document:v2:68775
  scope: feature
  aspect: func_def
  depth: specification
  svc: index-meta
  lifecycle: approved
  layer: domain
  tags: [runtime, structural, contract]
  links:
    - target: address-spec
      type: depends_on
    - target: canonical-format-spec
      type: depends_on
    - target: index-meta-store-group
      type: depends_on
sources:
  - packages/index-meta/src/meta-codec.ts
  - packages/index-meta/src/meta-codec.test.ts
  - packages/index-meta/src/meta-codec-big.ts
  - packages/index-meta/src/meta-codec-big.test.ts
  - packages/index-meta/src/meta-registry.ts
  - packages/index-meta/src/meta-registry.test.ts
  - packages/index-meta/src/meta-resolver.ts
  - packages/index-meta/src/meta-resolver.test.ts
---

# MetaCodec 스펙

## 목적 ^purpose

DecodeMap 기반 독립 encode/decode 모듈.
MetaRegistry 없이 entity ID ↔ VersionedValue 변환을 수행한다.

디코딩 파이프라인: [../pipeline-system/pipeline.md](../pipeline-system/pipeline.md)

## 구성 ^overview

- **관심사 분리**: MetaRegistry는 스키마/주소 직렬화, MetaCodec은 entity ID ↔ 1차원 주소 변환만 담당
- **위임 구조**: 내부적으로 weighted-index의 LabelRegistry + PrefixCodec에 위임하여 로직 중복 제거
- **생성 경로 2가지**: MetaRegistry.createCodec() 또는 DecodeMap 직접 전달로 독립 생성 가능
- **API 4종**: encode(entityIds→VV), decode(VV→entityIds), decodeValue(value만으로 decode), toDecodeMap(deep clone)
- **에러 매핑**: weighted-index 에러(EntityNotFoundError, CoordError)를 index-meta 에러(EntryNotFoundError, ValidationError)로 변환
- **버전 이동**: v1 decode → v2 re-encode로 버전 간 마이그레이션 지원
- **독립 운용**: 서버에서 수신한 DecodeMap JSON만으로 MetaRegistry 없이 decode 가능
- **불변성 보장**: decode 반환값은 Object.freeze(), toDecodeMap()은 structuredClone deep copy

## 참조

패키지 인덱스: [index-meta-system.md](index-meta-system.md)
운영 흐름: `[S2, A1]` encode · `[S5, A5, D1]` decode — [runtime-flow-paths.spec.md](../apm-system/apm-runtime-system/runtime-flow-paths.spec.md)

## 상태

implemented

---

## 설계 원칙

### 관심사 분리

```
MetaRegistry (주소 게이트웨이)          MetaCodec (정보 해석)
├── 스키마 관리 (dims, indices)         ├── encode(entityIds) → VersionedValue
├── 주소 직렬화 (serialize/parse)       ├── decode(vv) → entityIds
├── createCodec() → MetaCodec          └── decodeValue(value) → entityIds
└── 검증 (ID 유효성, value 범위)
```

- **MetaRegistry**는 전체 스키마를 보관하고 주소 직렬화를 담당한다.
- **MetaCodec**은 특정 index version에 특화되어 entity ID ↔ 1차원 주소 변환만 수행한다.
- MetaCodec은 `DecodeMap`(shape + entries) 하나로 동작한다. MetaRegistry 의존 없음.

### weighted-index 위임

MetaCodec은 내부적으로 `weighted-index`의 `LabelRegistry` + `PrefixCodec`에 위임한다.

```
DecodeMap
  ├── dims[].entries → LabelRegistry (entity ID ↔ 1-based index)
  └── shape + dims   → PrefixCodec (좌표 배열 ↔ 1차원 정수 + entity 기반 encode/decode)
```

로직 중복 없이 weighted-index의 검증된 구현을 재사용한다.

---

## 생성 경로

### 1. MetaRegistry.createCodec()

MetaRegistry가 내부 데이터에서 DecodeMap을 빌드해 MetaCodec을 생성한다.

```ts
const reg = new MetaRegistry(input);
const codec = reg.createCodec("perm", "v1");
```

### 2. DecodeMap으로 직접 생성

MetaResolver.getDecodeMap() 또는 JSON 전송된 DecodeMap으로 독립 생성.

```ts
// MetaResolver 경유
const resolver = new MetaResolver(reg);
const map = resolver.getDecodeMap("perm", "v1");
const codec = new MetaCodec(map);

// JSON 수신 후 독립 생성 (MetaRegistry 불필요)
const received: DecodeMap = JSON.parse(jsonFromServer);
const codec = new MetaCodec(received);
```

---

## API

```ts
class MetaCodec {
  constructor(map: DecodeMap)

  /** entity ID → VersionedValue */
  encode(entityIds: Record<string, EntityId>): VersionedValue

  /** VersionedValue → entity ID (indexId/versionId 일치 검증) */
  decode(vv: VersionedValue): Readonly<Record<string, EntityId>>

  /** value만으로 decode (검증 없이) */
  decodeValue(value: number): Readonly<Record<string, EntityId>>

  /** DecodeMap deep clone 반환 */
  toDecodeMap(): DecodeMap

  get indexId(): string
  get versionId(): string
  get size(): number
  get shape(): readonly number[]
}
```

---

## 에러 매핑

MetaCodec은 weighted-index의 에러를 index-meta 에러로 변환한다.

| weighted-index 에러 | → index-meta 에러 | 발생 조건 |
|---|---|---|
| `EntityNotFoundError` | `EntryNotFoundError` | entries에 없는 entity ID로 encode 시도 |
| `CoordError` | `ValidationError` | dim 누락 등 좌표 구성 오류 |

---

## 사용 패턴

### 기본 encode/decode

```ts
const codec = reg.createCodec("perm", "v1");
const vv = codec.encode({ role: "editor", action: "write" });
const ids = codec.decode(vv);
// { role: "editor", action: "write" }
```

### encode → serialize → parse → decode (PK 왕복)

```ts
const codec = reg.createCodec("perm", "v1");
const pk = reg.serialize(codec.encode(entityIds));       // entity → PK
const restored = codec.decode(reg.parse(pk));             // PK → entity
```

### decode → re-encode (버전 이동)

```ts
const v1 = reg.createCodec("perm", "v1");
const v2 = reg.createCodec("perm", "v2");

const ids = v1.decode(oldVV);    // v1에서 entity 추출
const newVV = v2.encode(ids);    // v2로 re-encode
```

### 독립 운용 (MetaRegistry 없이)

```ts
// 서버에서 DecodeMap 번들 수신
const map: DecodeMap = await fetch("/api/decode-map/perm/v1").then(r => r.json());
const codec = new MetaCodec(map);

// MetaRegistry 없이 decode
const ids = codec.decodeValue(valueFromDB);
```

---

## 불변성

- `decode()`, `decodeValue()` 반환값은 `Object.freeze()` 적용.
- `toDecodeMap()`은 `structuredClone`으로 deep copy 반환.

---

## MetaCodecBig — BigInt 대응

`meta-codec-big.ts`의 `MetaCodecBig` 클래스. `Number.MAX_SAFE_INTEGER(2^53)` 한계를 초과하는 주소 공간을 지원한다.

### MetaCodec과의 차이

| | MetaCodec | MetaCodecBig |
|---|---|---|
| 내부 구현 | LabelRegistry + PrefixCodec 위임 | WeightedIndexBig + 직접 label 매핑 |
| value 타입 | `number` | `bigint` |
| 반환 타입 | `VersionedValue` | `VersionedValueBig` |
| 추가 API | - | `matchRanges(partial)` → `[bigint, bigint][]` |
| 사용 기준 | totalSpace <= 2^53 | totalSpace > 2^53 |

### API

```ts
class MetaCodecBig {
  constructor(map: DecodeMap)

  encode(entityIds: Record<string, EntityId>): VersionedValueBig
  decode(vvb: VersionedValueBig): Readonly<Record<string, EntityId>>
  decodeValue(value: bigint): Readonly<Record<string, EntityId>>
  matchRanges(partial: Record<string, EntityId>): readonly [bigint, bigint][]
  toDecodeMap(): DecodeMap

  get indexId(): string
  get versionId(): string
  get size(): bigint
  get shape(): readonly number[]
}
```

### 사용 가이드

- Capacity Guard(`capacity-guard.ts`)가 safePrecision 판정 — totalSpace > 2^53이면 `MetaCodecBig` 필수.
- `MetaRegistry.createCodecBig(indexId, versionId)` 또는 `new MetaCodecBig(decodeMap)` 로 생성.
- `matchRanges(partial)`: 부분 entity 조건으로 주소 범위 쿼리. `calcAddressRangesBig`에 위임.
