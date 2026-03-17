# Capacity Guard — 주소 공간 용량 검증

> **상위 개념**: Prefix 정의 → shape product → 주소 공간 크기
> **관련 문서**: [`tier-architecture.md`](tier-architecture.md) (Tier 1 스키마 선언), [`api-reference.md`](api-reference.md)

---

## 1. 문제

### 1.1 Number 정밀도 한계

weighted-index의 encode/decode는 JavaScript `Number` 연산 기반이다.
shape product(모든 dim capacity의 곱)가 `Number.MAX_SAFE_INTEGER`(2^53 - 1)를 초과하면 정밀도가 손실된다.

```
shape = [1000, 1000, 1000, 1000, 1000, 1000]
product = 10^18 > 2^53 ≈ 9 × 10^15
→ WeightedIndex 생성자에서 ShapeError
```

### 1.2 UUID 변환 시 숨은 한계

UUID(128bit, 32 hex chars)에서 schema/version/shard를 빼면 index 영역은 보통 24~28 hex chars.
`16^24 ≈ 10^28`이므로 UUID의 표현 용량 자체는 Number를 훨씬 초과한다.

현재 `createLayoutProtocol`의 serialize/parse는 `Number` 기반이므로:

| 연산 | 코드 | 한계 |
|------|------|------|
| 최대값 검증 | `16 ** indexChars - 1` | indexChars > 13 → 오버플로 |
| serialize | `addr.index.toString(16)` | 2^53 초과 → 정밀도 손실 |
| parse | `parseInt(hex, 16)` | 14+ hex chars → 정밀도 손실 |

shape product가 2^53 이내라면 UUID의 index 영역이 넓어도 **실제 값**은 작으므로 문제없다.
하지만 shape product > 2^53인 스키마를 UUID로 직렬화하려 하면 **조용히 잘못된 값**이 생성된다.

### 1.3 현재 동작의 문제

- `WeightedIndex` 생성자의 `ShapeError`는 **원인 설명이 부족**하다
- 어떤 prefix가 BigInt를 요구하는지 **메타데이터가 없다**
- 소비자(PrefixDecoder, 마이크로서비스)가 **사전에 판단할 수 없다**
- strict/lenient 선택지가 없어 **모든 초과가 즉시 에러**다

---

## 2. 설계

### 2.1 NumberType 선언

prefix 정의 시 주소 값의 수치 타입을 선언한다.

```ts
type NumberType = "number" | "bigint";
```

| 값 | 의미 |
|---|---|
| `"number"` | shape product ≤ 2^53. Number 기반 encode/decode/serialize 가능 |
| `"bigint"` | shape product > 2^53. Number 기반 연산 차단. 메타데이터만 기록 |

**생략 시 자동 감지**: shape product를 BigInt로 정확히 계산하여 결정.

```ts
// prefix 정의 예시
const hugeIndex = defineTable("huge", {
  dims: [dimA, dimB, dimC, dimD, dimE, dimF],
  numberType: "bigint",  // 명시 선언
  versions: { v1: { ... } },
});
```

### 2.2 Strict 모드

`MetaRegistryInput`에 `strict` 플래그를 추가한다.

```ts
interface MetaRegistryInput {
  dims: Record<string, DimInput>;
  indices: Record<string, IndexInput>;
  address?: AddressConfig;
  strict?: boolean;  // 기본 true
}
```

| 상황 | `strict: true` (기본) | `strict: false` |
|------|---------------------|-----------------|
| `"number"` 선언 + 초과 | 즉시 `CapacityOverflowError` | 경고 수집, `"bigint"`로 보정 |
| `"bigint"` 선언 | 생성 허용, 연산 시 에러 | 동일 |
| 미선언 + 초과 | 자동 `"bigint"`, 연산 시 에러 | 동일 |
| 미선언 + 이내 | 자동 `"number"`, 정상 | 동일 |

`strict: false`일 때 수집된 경고는 `registry.capacityWarnings`로 조회 가능.

### 2.3 선택 가능한 경로

`numberType` 선언 × shape product × strict 조합에 따른 결과:

| 선언 | shape product | strict | 결과 |
|------|--------------|--------|------|
| 생략 | ≤ 2^53 | - | 자동 `"number"` — 모든 encode/decode/serialize 정상 |
| 생략 | > 2^53 | - | 자동 `"bigint"` — Number 연산 차단, 메타데이터만 기록 |
| `"number"` | ≤ 2^53 | - | `"number"` — 정상 |
| `"number"` | > 2^53 | `true` | **즉시 `CapacityOverflowError`** — 선언과 실제 불일치 |
| `"number"` | > 2^53 | `false` | 경고 수집 + `"bigint"` 승격 |
| `"bigint"` | ≤ 2^53 | - | `"bigint"` 유지 — Number 연산 차단 (사용자 의도) |
| `"bigint"` | > 2^53 | - | `"bigint"` — 정상, Number 연산 차단 |

**핵심 원칙:**
- 생략하면 시스템이 최적 타입을 자동 감지한다.
- `"number"` 선언은 "Number 범위 안에 있어야 한다"는 제약을 건다.
- `"bigint"` 선언은 shape 크기와 무관하게 Number 연산을 차단한다.
- `strict`는 `"number"` 선언 + 초과 시에만 동작이 달라진다.

### 2.4 검증 시점 및 전파

```
┌─ 스키마 정의 ──────────────────────────────────────────────┐
│                                                            │
│  1. MetaRegistry 생성자                                     │
│     shape product를 BigInt로 계산                           │
│     numberType 확정 (선언 또는 자동 감지)                     │
│     strict 분기 → 에러 또는 경고                             │
│                                                            │
│  2. compileSchema (선언적 DSL)                              │
│     capacity 곱 오버플로 감지                                │
│     CompositeVersionSpec에 numberType 기록                   │
│                                                            │
│  3. lintSchema (codegen)                                    │
│     capacity 초과 진단 → warning/info                        │
│                                                            │
└────────────────────────────────────────────────────────────┘

┌─ 런타임 ───────────────────────────────────────────────────┐
│                                                            │
│  4. createCodec / _getWeightedIndex                        │
│     numberType === "bigint" → CapacityOverflowError         │
│     "Number 기반 encode/decode를 사용할 수 없습니다"          │
│                                                            │
│  5. serialize / parse                                       │
│     numberType === "bigint" → CapacityOverflowError         │
│     "UUID 변환에 BigInt 주소를 사용할 수 없습니다"             │
│                                                            │
│  6. PrefixDecoder                                           │
│     main/ref DecodeMap.numberType === "bigint" → 생성 시 에러  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 2.5 에러 메시지 원칙

모든 에러는 **원인 + 조치 방법**을 포함한다.

```
CapacityOverflowError:
  Index "permission/v3": shape product (1.2 × 10^18) exceeds
  Number.MAX_SAFE_INTEGER (2^53).
  → Declare numberType: "bigint" or reduce dim capacities.

CapacityOverflowError:
  Cannot serialize "permission/v3" to UUID: index requires
  BigInt addressing (numberType: "bigint").
  → Number-based layout protocol does not support BigInt values.
```

---

## 3. 타입 변경

### 3.1 입력 타입

```ts
// IndexInput — prefix 정의 시 사용자가 전달
interface IndexInput {
  dims: string[];
  versions: Record<string, IndexVersionInput>;
  numberType?: NumberType;  // 생략 시 자동 감지
}

// MetaRegistryInput
interface MetaRegistryInput {
  dims: Record<string, DimInput>;
  indices: Record<string, IndexInput>;
  address?: AddressConfig;
  strict?: boolean;         // 기본 true
}
```

### 3.2 내부 저장 타입

```ts
// IndexDef — 확정된 내부 표현
interface IndexDef {
  id: string;
  dims: readonly string[];
  description?: string;
  domain?: string;
  numberType: NumberType;   // 확정된 값
}
```

### 3.3 전송 타입

```ts
// DecodeMap — 외부 서비스로 전송되는 디코딩 번들
interface DecodeMap {
  indexId: string;
  versionId: string;
  shape: number[];
  size: number;
  dims: DecodeMapDim[];
  address?: AddressConfig;
  numberType?: NumberType;  // 소비자가 사전 판단 가능
}
```

### 3.4 용량 분석 타입

```ts
// 특정 version의 capacity 분석 결과
interface VersionCapacityInfo {
  indexId: string;
  versionId: string;
  shape: readonly number[];
  /** Number 기준 size. 초과 시 Number.MAX_SAFE_INTEGER로 캡. */
  sizeNumber: number;
  /** 정확한 BigInt 값. */
  sizeBigInt: bigint;
  /** Number로 표현 가능한지. */
  fitsNumber: boolean;
  /** 확정된 numberType. */
  numberType: NumberType;
}
```

### 3.5 에러 타입

```ts
class CapacityOverflowError extends IndexMetaError {
  readonly indexId: string;
  readonly versionId: string;
  readonly productBig: bigint;
}
```

---

## 4. 헬퍼 함수

```ts
/** shape product를 BigInt로 정확히 계산. */
function computeShapeProductBig(shape: readonly number[]): bigint;

/** Number.MAX_SAFE_INTEGER 이내인지 판별. */
function fitsNumber(shape: readonly number[]): boolean;
```

---

## 5. 동작 예시

### 5.1 일반 스키마 (Number 이내)

```ts
// shape product = 3 × 3 × 3 = 27 ≤ 2^53
const registry = new MetaRegistry({
  dims: { role: ..., action: ..., resource: ... },
  indices: {
    perm: {
      dims: ["role", "action", "resource"],
      // numberType 생략 → 자동 감지 → "number"
      versions: { v1: { ... } },
    },
  },
});

registry.createCodec("perm", "v1");  // 정상
registry.serialize(vv, "layout:uuid");  // 정상
```

### 5.2 대형 스키마 (Number 초과, 명시 선언)

```ts
const registry = new MetaRegistry({
  dims: { ... },  // 6개 dim × capacity 1000
  indices: {
    huge: {
      dims: ["a", "b", "c", "d", "e", "f"],
      numberType: "bigint",  // 명시 선언
      versions: { v1: { ... } },
    },
  },
});
// 생성 성공 — numberType: "bigint"로 기록

registry.createCodec("huge", "v1");
// → CapacityOverflowError:
//   Index "huge/v1" requires BigInt addressing (numberType: "bigint").
//   Number-based encode/decode is not available.

registry.serialize(vv, "layout:uuid");
// → CapacityOverflowError:
//   Cannot serialize "huge/v1" to UUID: index requires BigInt addressing.
```

### 5.3 대형 스키마 (자동 감지)

```ts
const registry = new MetaRegistry({
  dims: { ... },
  indices: {
    huge: {
      dims: ["a", "b", "c", "d", "e", "f"],
      // numberType 생략 → 자동 감지 → "bigint"
      versions: { v1: { ... } },
    },
  },
});
// strict: true (기본) → 생성 성공, numberType: "bigint" 자동 설정
// encode/decode/serialize 호출 시 CapacityOverflowError
```

### 5.4 불일치 감지 (strict: true)

```ts
const registry = new MetaRegistry({
  dims: { ... },
  indices: {
    huge: {
      dims: ["a", "b", "c", "d", "e", "f"],
      numberType: "number",  // 선언은 number인데 실제로는 초과
      versions: { v1: { ... } },
    },
  },
  strict: true,
});
// → CapacityOverflowError:
//   Index "huge/v1": shape product (10^18) exceeds Number.MAX_SAFE_INTEGER.
//   Declare numberType: "bigint" or reduce dim sizes.
```

### 5.5 불일치 허용 (strict: false)

```ts
const registry = new MetaRegistry({
  dims: { ... },
  indices: {
    huge: {
      dims: ["a", "b", "c", "d", "e", "f"],
      numberType: "number",
      versions: { v1: { ... } },
    },
  },
  strict: false,
});
// 생성 성공 — numberType "bigint"로 보정, 경고 수집

registry.capacityWarnings;
// → ["Index \"huge/v1\": shape product (10^18) exceeds Number.MAX_SAFE_INTEGER. numberType corrected to \"bigint\"."]
```

### 5.6 DecodeMap 소비자 사전 판단

```ts
const bundle = resolver.getDecodeMapBundle("huge", "v1");
// bundle.map.numberType === "bigint"

if (bundle.map.numberType === "bigint") {
  // BigInt 전용 경로 또는 에러 처리
  console.warn("이 prefix는 BigInt 주소 공간입니다.");
} else {
  const decoder = new PrefixDecoder(bundle);
  decoder.decode(42);
}
```

---

## 6. 제약사항

| 제약 | 설명 |
|------|------|
| **BigInt 경로는 별도 API** | `MetaCodecBig`, `createCodecBig()`, `serializeBig()`/`parseBig()`로 BigInt encode/decode 제공. 기존 Number API(`MetaCodec`, `createCodec()`)와 병렬 구조 |
| **Number 타입 유지** | `VersionedValue.value`, `SemanticAddress.index`는 `number` 유지. BigInt 전용 타입은 `VersionedValueBig`, `SemanticAddressBig`으로 분리. TypeScript number/bigint 연산 비호환으로 union 불가 |
| **capacity 필드 캡핑** | `CompositeVersionSpec.capacity`는 `number` 타입이므로, 초과 시 `Number.MAX_SAFE_INTEGER`로 캡. 정확한 값은 `VersionCapacityInfo.sizeBigInt`로 조회 |

---

## 7. 수정 대상 파일

| 파일 | 변경 |
|------|------|
| `types.ts` | `NumberType`, `IndexInput.numberType`, `IndexDef.numberType`, `MetaRegistryInput.strict`, `DecodeMap.numberType`, `VersionCapacityInfo` |
| `errors.ts` | `CapacityOverflowError` 추가 |
| `meta-registry.ts` | 생성자 capacity guard, `_getWeightedIndex` guard, `serialize`/`parse` guard, `capacityWarnings` getter, `computeShapeProductBig`/`fitsNumber` |
| `compile-schema.ts` | capacity 곱 오버플로 감지, `CompositeVersionSpec.numberType` |
| `codegen.ts` | `lintSchema`에 capacity 초과 진단 추가 |
| `meta-resolver.ts` | `DecodeMap`에 `numberType` 포함 |
| `prefix-decoder.ts` | `numberType === "bigint"` 시 생성 차단 |
| `index.ts` | 새 타입/함수/에러 export |
