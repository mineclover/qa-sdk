# BigInt 주소 체계 스펙

> `Number.MAX_SAFE_INTEGER`(2^53)를 초과하는 shape product에 대한 BigInt 기반 주소 인코딩/디코딩.
> weighted-index와 index-meta 양쪽에 걸치는 횡단 스펙.

관련 스펙: [weighted-index.spec.md](weighted-index.spec.md) · [index-meta/codec.spec.md](index-meta/codec.spec.md) · [index-meta/registry.spec.md](index-meta/registry.spec.md)
용량 가드 문서: [index-meta/docs/capacity-guard.md](../../packages/index-meta/docs/capacity-guard.md)

## 상태

implemented

---

## 1. 목적

### Number의 한계

JavaScript의 `Number`는 IEEE 754 double-precision으로, 정수 정밀도가 `2^53 - 1 = 9,007,199,254,740,991`까지만 보장된다.

shape product가 2^53을 초과하면:
- encode/decode에서 **정밀도 손실** 발생 → 잘못된 좌표 복원
- 주소 범위 계산에서 **경계 오류** → 범위 누락 또는 중복
- 직렬화에서 hex 변환 오류 → 주소 충돌

### BigInt 해법

native `bigint` 타입으로 임의 정밀도 정수 연산을 제공하여, shape product 크기에 관계없이 정확한 주소 변환을 보장한다.

---

## 2. NumberType 선택

### 타입 정의

```ts
type NumberType = "number" | "bigint";
```

### 자동 감지

```ts
function computeShapeProductBig(shape: readonly number[]): bigint
function fitsNumber(shape: readonly number[]): boolean
// fitsNumber = computeShapeProductBig(shape) <= BigInt(Number.MAX_SAFE_INTEGER)
```

`IndexInput.numberType`이 생략되면 `fitsNumber(shape)`로 자동 결정한다.

### 3-Tier 감지 흐름

| 단계 | 컴포넌트 | 동작 |
|---|---|---|
| Definition | `MetaRegistry` 생성자 | shape product BigInt 계산, numberType 결정 |
| Compilation | `compileSchema` | capacity overflow 탐지, numberType 저장 |
| Runtime | `createCodec` / `serialize` | numberType 위반 시 에러 |

### strict / non-strict 모드

| 상황 | strict=true (기본) | strict=false |
|---|---|---|
| `"number"` 선언, shape > 2^53 | `CapacityOverflowError` | 자동 `"bigint"` 승격 + warning |
| `"bigint"` 선언, shape ≤ 2^53 | warning (불필요한 bigint) | warning |
| 미선언, shape > 2^53 | 자동 `"bigint"` | 자동 `"bigint"` |

### CapacityOverflowError

```ts
class CapacityOverflowError extends IndexMetaError {
  readonly indexId: string;
  readonly versionId: string;
  readonly productBig: bigint;
  constructor(indexId: string, versionId: string, productBig: bigint, detail?: string)
}
```

---

## 3. weighted-index BigInt API

### WeightedIndexBig

Number 기반 `WeightedIndex`와 동일한 mixed-radix 알고리즘을 BigInt로 구현.

```ts
class WeightedIndexBig {
  readonly shape: readonly bigint[];
  readonly labels: readonly string[];
  readonly size: bigint;
  readonly strides: readonly bigint[];

  constructor(shape: bigint[], labels?: string[])

  encode(coords: bigint[]): bigint       // 1-based 좌표 → 0-based 인덱스
  decode(index: bigint): bigint[]        // 0-based 인덱스 → 1-based 좌표
  encodeUnsafe(coords: bigint[]): bigint // bounds 검증 없이
  decodeUnsafe(index: bigint): bigint[]  // bounds 검증 없이
}
```

### 범위 연산

```ts
function calcWeightsBig(shape: readonly bigint[]): bigint[]
function calcAddressRangesBig(
  shape: readonly bigint[],
  constraints: ReadonlyArray<CoordConstraint>,
): [bigint, bigint][]
function mergeRangesBig(ranges: [bigint, bigint][]): [bigint, bigint][]
function containsAddressBig(address: bigint, ranges: readonly [bigint, bigint][]): boolean
```

### 시뮬레이션 유틸리티

```ts
function simEncodeBig(shape: readonly bigint[], coords: readonly bigint[]): bigint
function simDecodeBig(shape: readonly bigint[], index: bigint): bigint[]
function simPackUUIDBig(
  prefixChars: number, prefixVal: number,
  versionChars: number, versionVal: number,
  shardChars: number, shardVal: number,
  indexVal: bigint,
): string
function simPackHexBig(
  totalChars: number,
  prefixChars: number, prefixVal: number,
  versionChars: number, versionVal: number,
  shardChars: number, shardVal: number,
  indexVal: bigint,
): string
```

### 용량 유틸리티

```ts
function maxProductBig(indexBudget: number): bigint         // 16^indexBudget
function utilizationBig(approxProduct: number, indexBudget: number): number  // % (0-100+)
function dimMaxBig(indexBudget: number, productOfOthers: number): string     // 포맷된 문자열
```

---

## 4. BigInt layout protocol

### SemanticAddressBig

```ts
interface SemanticAddressBig {
  readonly schema:  string;
  readonly version: string;
  readonly index:   bigint;
  readonly shard?:  number;
}
```

### VersionedValueBig

```ts
interface VersionedValueBig {
  indexId: string;
  versionId: string;
  value: bigint;
}
```

### AddressProtocolBig

```ts
interface AddressProtocolBig {
  readonly name: string;
  test(input: string): boolean;
  serialize(addr: SemanticAddressBig): string;
  parse(input: string): SemanticAddressBig;
}
```

### createLayoutProtocolBig

```ts
function createLayoutProtocolBig(opts: LayoutProtocolOptions): AddressProtocolBig
```

Number 기반 `createLayoutProtocol`과 동일한 layout 기반 직렬화를 BigInt로 수행.

**핵심 차이점**:
- index 필드 최대값: `(1n << BigInt(indexChars * 4)) - 1n` (임의 hex 자릿수 지원)
- hex 파싱: `BigInt("0x" + raw)` (정밀도 손실 없음)
- UUID 패킹: BigInt 비트 시프트로 128-bit 구성

### 변환 함수

```ts
function fromVersionedValueBig(vv: VersionedValueBig): SemanticAddressBig
function toVersionedValueBig(addr: SemanticAddressBig): VersionedValueBig
```

---

## 5. index-meta BigInt API

### MetaCodecBig

MetaCodec의 BigInt 변형. DecodeMap을 받아 bigint 기반 encode/decode를 수행.

```ts
class MetaCodecBig {
  constructor(map: DecodeMap)

  readonly indexId: string;
  readonly versionId: string;
  readonly size: bigint;
  readonly shape: readonly bigint[];
  readonly strides: readonly bigint[];
  readonly dimIds: readonly string[];

  encode(entityIds: Record<string, EntityId>): VersionedValueBig
  decode(vvb: VersionedValueBig): Readonly<Record<string, EntityId>>
  decodeValue(value: bigint): Readonly<Record<string, EntityId>>
  matchRanges(partial: Record<string, EntityId | null>): [bigint, bigint][]
  decodeBatch(values: readonly bigint[]): Readonly<Record<string, EntityId>>[]
  toDecodeMap(): DecodeMap
}
```

### MetaRegistry BigInt 메서드

```ts
class MetaRegistry {
  /** BigInt 코덱 생성 — number/bigint 모두 지원 */
  createCodecBig(indexId: string, versionId: string): MetaCodecBig

  /** 용량 정보 조회 */
  getCapacityInfo(indexId: string, versionId: string): VersionCapacityInfo
}

interface VersionCapacityInfo {
  indexId: string;
  versionId: string;
  shape: readonly number[];
  sizeNumber: number;      // MAX_SAFE_INTEGER로 캡
  sizeBigInt: bigint;      // 정확한 BigInt 곱
  fitsNumber: boolean;     // shape product ≤ 2^53 여부
  numberType: NumberType;
}
```

### Number 전용 메서드의 BigInt 차단

BigInt index에 대해 다음 호출은 `CapacityOverflowError`를 발생시킨다:

| 차단되는 메서드 | 이유 |
|---|---|
| `createCodec()` | Number 기반 WeightedIndex 사용 불가 |
| `getWeightedIndex()` | Number shape 정밀도 손실 |
| `serialize(vv)` | Number value 정밀도 손실 |
| `parse(input)` | Number value 정밀도 손실 |

→ BigInt index에는 `createCodecBig()` + BigInt layout protocol 사용.

---

## 6. Number/BigInt 동등성 (INV-9)

shape product ≤ 2^53인 범위에서, Number 경로와 BigInt 경로의 결과는 **동일**해야 한다.

```
∀ shape where product(shape) ≤ 2^53:
  WeightedIndex.encode(coords) === Number(WeightedIndexBig.encode(bigintCoords))
  WeightedIndex.decode(index)  === WeightedIndexBig.decode(BigInt(index)).map(Number)

∀ entityIds:
  MetaCodec.encode(entityIds).value === Number(MetaCodecBig.encode(entityIds).value)
  MetaCodec.decode(vv) === MetaCodecBig.decode(vvb)  // (deep equal)
```

이 불변조건은 Number → BigInt 마이그레이션의 안전성을 보장한다.

---

## 7. 마이그레이션 경로

### Number → BigInt 전환 시나리오

shape이 성장하여 2^53을 초과할 때:

1. `numberType`을 `"bigint"`로 변경 (또는 생략하여 자동 감지)
2. 기존 Number 값을 `BigInt(value)`로 변환
3. `createCodecBig()` 사용으로 전환
4. 직렬화를 BigInt layout protocol로 변경

### PrefixDecoder BigInt 제한

`PrefixDecoder`는 경량 decode-only 모듈로, **BigInt index를 지원하지 않는다**.

- `DecodeMap.numberType === "bigint"`인 경우 생성 시 에러
- BigInt decode가 필요하면 `MetaCodecBig`을 직접 사용

### 하위 호환

- Number API는 변경 없이 유지
- BigInt API는 독립적으로 추가 (별도 클래스/함수)
- 공존 가능: 같은 registry에서 일부 index는 Number, 일부는 BigInt

---

## 8. 성능 특성

| 연산 | Number | BigInt | 비율 |
|---|---|---|---|
| encode (단일) | ~0.5μs | ~1.2μs | 2-3x 느림 |
| decode (단일) | ~0.4μs | ~1.0μs | 2-3x 느림 |
| calcAddressRanges | ~2μs | ~5μs | 2-3x 느림 |
| UUID pack | ~3μs | ~0.8μs | **4x 빠름** (BigInt 비트 시프트) |
| matchRanges (10 dims) | ~15μs | ~35μs | 2-3x 느림 |

### 사용 시점 판단 기준

| 조건 | 권장 |
|---|---|
| shape product ≤ 2^53 | Number (성능 우위) |
| shape product > 2^53 | BigInt (정확성 필수) |
| UUID 직렬화 중심 | BigInt (비트 시프트 이점) |
| 대량 batch decode | Number (총 누적 차이 큼) |
