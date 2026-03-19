# weighted-index 모듈 구조

## 개요

weighted-index는 세 개의 내부 모듈로 구성된다.

```
weighted-index/
  math/       — 순수 정수 연산 (encode/decode, stride, bitmask)
  vocab/      — 문자열 ↔ 정수 매핑 (LabelRegistry, PrefixCodec)
  protocol/   — 직렬화 형식 (PackFormat, SemanticAddress, UUID layout)
  obfuscate/  — 주소 난독화 변환
```

의존 방향:

```
math ← vocab
math    (protocol은 독립)
```

- `vocab/`는 `math/`에 의존 (WeightedIndex, errors, validators)
- `protocol/`은 다른 모듈에 의존하지 않음
- `math/`는 다른 모듈에 의존하지 않음

## import 경로

### 기존 방식 (변경 없음)

```ts
import { WeightedIndex, LabelRegistry, PackFormat } from "weighted-index";
```

루트 entry point가 모든 모듈을 re-export하므로 기존 코드 변경 불필요.

### 모듈별 import

특정 모듈만 필요할 때 subpath import를 사용한다.

```ts
// math 모듈만 import (순수 연산)
import { WeightedIndex, calcWeights, createMask } from "weighted-index/math";

// vocab 모듈만 import (라벨 매핑)
import { LabelRegistry, PrefixCodec, createBinder } from "weighted-index/vocab";

// protocol 모듈만 import (직렬화)
import { PACK_FORMATS, createLayoutProtocol, fitLayout } from "weighted-index/protocol";
```

### 가속기 패키지에서 타입 공유

`weighted-index/math`는 가속기 패키지(weighted-wasm, weighted-gpu)와 공유하는 타입을 export한다.

```ts
import type {
  Shape,           // readonly number[] — 각 차원 크기
  Coord,           // readonly number[] — 1-based 좌표
  Strides,         // readonly number[] — stride 배열
  BatchEncoder,    // 동기 배치 인코더 인터페이스
  AsyncBatchEncoder, // 비동기 배치 인코더 인터페이스 (GPU)
} from "weighted-index/math";
```

## 공유 타입 상세

### 좌표 규약

세 패키지(weighted-index, weighted-wasm, weighted-gpu)가 동일한 규약을 따른다.

| 타입 | 정의 | 규약 |
|------|------|------|
| `Shape` | `readonly number[]` | 각 원소 ≥ 1 |
| `Coord` | `readonly number[]` | coord[i] ∈ [1, shape[i]] (1-based) |
| `Strides` | `readonly number[]` | strides[i] = Π_{j>i} shape[j] |
| Address | `number` | ∈ [0, Π shape[i] - 1] (0-based) |

인코딩 공식:
```
encode: address = Σ (coord[i] - 1) × strides[i]
decode: coord[i] = ⌊address / strides[i]⌋ % shape[i] + 1
```

### BatchEncoder

동기 배치 연산. JS fallback과 WASM이 구현한다.

```ts
interface BatchEncoder {
  encodeBatch(coords: readonly Coord[]): Uint32Array;
  decodeBatch(addrs: Uint32Array): number[][];
}
```

### AsyncBatchEncoder

비동기 배치 연산. GPU가 구현한다 (dispatch → readback 비동기).

```ts
interface AsyncBatchEncoder {
  encodeBatch(coords: readonly Coord[]): Promise<Uint32Array>;
  decodeBatch(addrs: Uint32Array): Promise<number[][]>;
}
```

## 가속기 구현 예시

### weighted-wasm에서 BatchEncoder 구현

```ts
import type { BatchEncoder, Strides, Coord } from "weighted-index/math";
import { calcWeights } from "weighted-index/math";

function createWasmBatchEncoder(shape: Shape): BatchEncoder {
  const strides = calcWeights([...shape]);
  return {
    encodeBatch(coords) { return encodeBatch(strides, coords); },
    decodeBatch(addrs)  { return decodeBatch(strides, shape, addrs); },
  };
}
```

### weighted-gpu에서 AsyncBatchEncoder 구현

```ts
import type { AsyncBatchEncoder, Shape } from "weighted-index/math";

// GPUEncoder.create(shape) 가 AsyncBatchEncoder를 반환
const gpu: AsyncBatchEncoder = await GPUEncoder.create(shape);
```

### 런타임 백엔드 선택

```ts
import type { BatchEncoder, AsyncBatchEncoder } from "weighted-index/math";

async function selectEncoder(shape: Shape): Promise<BatchEncoder | AsyncBatchEncoder> {
  // 1. GPU 사용 가능하면 GPU
  if (await GPUEncoder.isAvailable()) {
    const gpu = await GPUEncoder.create(shape);
    if (gpu) return gpu;
  }

  // 2. WASM 사용 가능하면 WASM
  if (await initWasm()) {
    return createWasmBatchEncoder(shape);
  }

  // 3. JS fallback
  return createJsBatchEncoder(shape);
}
```

## 모듈 구성 상세

### math/ — 순수 정수 연산

가속기가 구현하는 동일 수학의 **기준(canonical) 구현**.

| 파일 | 역할 |
|------|------|
| `types.ts` | 공유 타입 (Shape, Coord, BatchEncoder 등) |
| `calc.ts` | calcWeights, calcAddressRanges, range algebra |
| `calc-big.ts` | BigInt 기반 계산 (2^53 초과) |
| `weighted-index.ts` | WeightedIndex 클래스 (Number) |
| `weighted-index-big.ts` | WeightedIndexBig 클래스 (BigInt) |
| `bitmask.ts` | O(1) 비트마스크 연산 |
| `layout-fit.ts` | 레이아웃 시뮬레이터 (Number/BigInt) |
| `pattern-lattice.ts` | 패턴 격자 연산 (meet, join, specificity) |
| `errors.ts` | 에러 클래스 계층 |
| `validators.ts` | 공유 검증 유틸리티 |

### vocab/ — 문자열 ↔ 정수 매핑

| 파일 | 역할 |
|------|------|
| `label-registry.ts` | entity ID ↔ 1-based index 매핑 |
| `prefix-registry.ts` | 레이블 조합 + 버전 관리 + encode/decode |
| `partial-binder.ts` | 차원 부분 바인딩 (curried encoder) |

### protocol/ — 직렬화 형식

| 파일 | 역할 |
|------|------|
| `uuid-layout.ts` | UUID 128-bit 필드 패킹 |
| `pack-format.ts` | 포맷 정의 + 레지스트리 + hex 유틸 |
| `semantic-address.ts` | colon/URI/compact/layout 프로토콜 |
| `capacity-planner.ts` | shape 축소 + 용량 추천 |
| `bit-field-layout.ts` | 비트 레벨 가변 폭 패킹 |
