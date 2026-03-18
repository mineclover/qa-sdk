# weighted-index

닫힌 패턴(closed pattern)의 **다차원 좌표 ↔ 1D 정수 전단사(bijection) 코덱**.

각 차원의 가능한 값이 유한하게 열거된 상태 공간을 하나의 정수(주소)로 압축하고, 그 정수만으로 원래 좌표를 복원한다. 레이블 버전 관리, 직렬화 프로토콜, 용량 계획까지 포함한다.

---

## 설치

```bash
pnpm add weighted-index
```

외부 런타임 의존성이 없다. (`fast-check`, `tsup`, `vitest`는 devDependencies.)

---

## 시작하기

```ts
import { WeightedIndex } from "weighted-index";

// shape: role(3) × action(3) × resource(3) = 27가지 상태
const wi = new WeightedIndex([3, 3, 3], ["role", "action", "resource"]);

// 좌표 → 정수 (1-based 좌표, 0-based 주소)
const address = wi.encode([2, 1, 3]); // → 5

// 정수 → 좌표
const coords = wi.decode(5); // → [2, 1, 3]

// 레이블 기반 접근
const addr = wi.encodeFromRecord({ role: 2, action: 1, resource: 3 }); // → 5
const rec  = wi.decodeToRecord(5); // → { role: 2, action: 1, resource: 3 }
```

---

## 아키텍처

```
┌───────────────────────────────────────────────────────────────┐
│  WeightedIndex       — 좌표 ↔ 1D 정수 전단사 (핵심 코덱)       │
├───────────────────────────────────────────────────────────────┤
│  LabelRegistry       — entity ID ↔ 1-based 인덱스 매핑 + 버전   │
│  PrefixCodec         — 레이블 조합(prefix) + 버전 관리 + 마이그레이션 │
├───────────────────────────────────────────────────────────────┤
│  calc                — 범위 연산 (merge/intersect/subtract/complement) │
│  pattern-lattice     — 패턴 포함 관계·meet/join·구체성 점수        │
│  bitmask             — O(1) 비트 마스크 연산                     │
├───────────────────────────────────────────────────────────────┤
│  SemanticAddress     — 다중 프로토콜 주소 직렬화 (colon/uri/compact/layout) │
│  UUIDLayout          — 128비트 UUID에 구조화된 필드 패킹           │
│  PackFormat          — 컨테이너 포맷 레지스트리 (uuid/int64/sha256 등) │
├───────────────────────────────────────────────────────────────┤
│  CapacityPlanner     — 비례 축소, 용량 추천, 성장 예측             │
│  BitFieldLayout      — 비트 레벨 가변 폭 필드 패킹 (저장 밀도 최적화)   │
│  Obfuscate           — 전단사 비트 변환 (XOR/rotate/reverse → hex/uuid/nanoid) │
└───────────────────────────────────────────────────────────────┘
```

---

## 핵심 개념

### WeightedIndex

가중진법(mixed radix)으로 다차원 좌표를 1D 정수로 압축한다.

- **공식:** `address = Σ (x_i − 1) × W[i]`, 여기서 `W[i] = Π_{j>i} shape[j]`
- **좌표:** 1-based (범위 `[1, shape[i]]`)
- **주소:** 0-based (범위 `[0, size-1]`)

```ts
const wi = new WeightedIndex([5, 2, 5, 2]);

wi.size;     // 100
wi.encode([3, 1, 4, 2]); // → 47
wi.decode(47);             // → [3, 1, 4, 2]

// Hot-path (경계 검사 생략, 내부적으로 검증된 입력 전용)
// ⚠️ 외부 입력(URL 파라미터, 사용자 입력 등)에 절대 사용 금지
wi.encodeUnsafe([3, 1, 4, 2]); // → 47
wi.decodeUnsafe(47);            // → [3, 1, 4, 2]

// 버퍼 재사용 (배열 할당 없음)
const buf = new Array(4);
wi.decodeTo(47, buf); // buf = [3, 1, 4, 2]
```

### LabelRegistry

entity ID ↔ 1-based 인덱스 매핑. 차원별 버전 관리 지원.

```ts
import { createLabelRegistry } from "weighted-index";

const labels = createLabelRegistry({
  role:   [{ version: "v1", ids: ["admin", "editor", "viewer"] }],
  action: [{ version: "v1", ids: ["read", "write", "delete"] }],
});

labels.getIndex("role", "v1", "editor");      // → 2
labels.getEntityId("role", "v1", 2);           // → "editor"
labels.getMax("role", "v1");                    // → 3
```

- entries는 **append-only** — 기존 순서 변경 금지, 새 항목은 끝에 추가
- 여러 버전을 등록해 독립적으로 관리

### PrefixCodec

레이블 조합(prefix)과 버전 스냅샷을 관리한다. LabelRegistry 위에서 동작.

```ts
import { PrefixCodec, createLabelRegistry } from "weighted-index";

const labels = createLabelRegistry({
  role:   [{ version: "v1", ids: ["admin", "editor", "viewer"] }],
  action: [{ version: "v1", ids: ["read", "write"] }],
});

const codec = new PrefixCodec(labels, [
  { prefix: "perm", labels: ["role", "action"],
    versions: [{ version: "pv1", labelVersions: { role: "v1", action: "v1" } }] },
]);

// entity ID → VersionedIndex
const vi = codec.encodeFromIds("perm", { role: "editor", action: "write" });
// { prefix: "perm", v: "pv1", id: 3 }

// 직렬화
codec.serialize(vi); // → "perm:pv1:3"

// 역직렬화 + 디코딩
const parsed = codec.parse("perm:pv1:3");
codec.decodeToIds(parsed); // → { role: "editor", action: "write" }
```

#### 버전 마이그레이션

```ts
const migrated = codec.migrate(vi, "pv2", (oldCoords, oldLabels, newLabels) => {
  // 좌표 변환 로직
  return [newCoords];
});
```

---

## 범위 연산 (calc)

부분 좌표 패턴에 매칭되는 주소 범위를 계산한다. DB `BETWEEN` 쿼리에 직접 활용.

```ts
import { calcAddressRanges, mergeRanges, containsAddress } from "weighted-index";

const shape = [3, 4, 5]; // role(3) × action(4) × resource(5)

// role=2인 모든 주소 범위
const ranges = calcAddressRanges(shape, ["2", null, null]);
// → [[20, 39]]  (role=2, action=*, resource=*)

// 범위 대수
mergeRanges([[0,5], [3,10]]);       // → [[0,10]]
containsAddress(25, [[20,39]]);     // → true (O(log n) 이진 탐색)
```

**CoordConstraint 형식:**
- `null` — 와일드카드 (모든 값)
- `"3"` — 단일 값
- `"2-5"` — 범위
- `"1,3,7-9"` — 유니온

```ts
import { intersectRanges, subtractRanges, complementRanges } from "weighted-index";

intersectRanges([[0,10]], [[5,20]]);    // → [[5,10]]
subtractRanges([[0,20]], [[5,10]]);     // → [[0,4], [11,20]]
complementRanges([[5,10]], 100);        // → [[0,4], [11,99]]
```

---

## 패턴 래티스 (pattern-lattice)

`CoordConstraint[]` 배열을 "패턴"으로 취급해, 패턴 간 포함 관계(partial order)와 lattice 연산(meet/join)을 제공한다. 범위 연산(calc)의 range algebra 위에 구축된다.

```ts
import {
  constraintContains, patternContains,
  patternMeet, patternJoin,
  patternSpecificity, coordMatchesPattern,
  rangesToConstraint,
} from "weighted-index";

const shape = [8, 4, 16]; // role × action × resource

// 포함 관계 판정
constraintContains("2-5", "3", 8);           // → true  (범위 ⊇ 단일값)
patternContains(shape,
  ["3", null, null],                          // A: role=3
  ["3", "2", null],                           // B: role=3, action=2
);                                            // → true  (A ⊇ B)

// Meet (교집합 패턴, greatest lower bound)
patternMeet(["1-5", null, null], ["3-8", null, null], shape);
// → ["3-5", null, null]

// Join (합집합 패턴, least upper bound)
patternJoin(["1-3", null, null], ["5-8", null, null], shape);
// → ["1-3,5-8", null, null]

// 구체성 점수: 0 (전체 와일드카드) ~ ndims (전체 고정)
patternSpecificity(["3", "2", null], shape); // → 1.625

// 좌표 매칭
coordMatchesPattern([3, 2, 5], ["3", null, null], shape); // → true

// 범위 → constraint 변환
rangesToConstraint([[1, 3], [7, 9]], 16); // → "1-3,7-9"
rangesToConstraint([[1, 8]], 8);           // → null (전체 범위 = 와일드카드)
```

**주요 래티스 속성:**

| 속성 | 설명 |
|---|---|
| 교환법칙 | `meet(A, B) = meet(B, A)`, `join(A, B) = join(B, A)` |
| 포함 보존 | `meet` 결과는 두 패턴 모두에 포함됨, `join` 결과는 두 패턴을 모두 포함함 |
| 공집합 처리 | 교집합이 비어 있으면 `patternMeet` → `null` |

---

## 비트마스크 (bitmask)

O(1) 비트 기반 권한 마스크.

```ts
import { createMask, setBit, hasBit, buildMask, maskOr, popcount } from "weighted-index";

const mask = createMask(100);     // 100 슬롯용 Uint8Array
setBit(mask, 42);                  // 42번 비트 설정
hasBit(mask, 42);                  // → true

const m1 = buildMask(100, [1, 3, 5]);
const m2 = buildMask(100, [2, 3, 4]);
const merged = maskOr(m1, m2);    // → 1,2,3,4,5 비트 설정
popcount(merged);                  // → 5
```

---

## 주소 직렬화 (SemanticAddress)

동일한 주소를 다양한 프로토콜로 직렬화한다.

```ts
import { parseAddress, serializeAddress, convertAddress } from "weighted-index";

const addr = { schema: "perm", version: "v1", index: 42 };

serializeAddress(addr, "colon");    // → "perm:v1:42"
serializeAddress(addr, "uri");      // → "wi://perm/v1/42"
serializeAddress(addr, "compact");  // → "perm-v1-42"

// 프로토콜 자동 감지
parseAddress("perm:v1:42");         // → { schema: "perm", version: "v1", index: 42 }
parseAddress("wi://perm/v1/42");    // → 동일

// 프로토콜 간 변환
convertAddress("perm:v1:42", "uri"); // → "wi://perm/v1/42"
```

### Layout 프로토콜 (UUID/int64 패킹)

hex 컨테이너에 구조화된 필드를 패킹한다. DB 기본 키나 UUID 필드에 직접 저장 가능.

```ts
import { createLayoutProtocol, PACK_FORMATS, AddressConverter } from "weighted-index";

const layout = createLayoutProtocol({
  format: PACK_FORMATS.uuid,
  schemaChars: 4,
  versionChars: 2,
  schemas: { perm: 1, content: 2 },
  versions: { v1: 1, v2: 2 },
});

// AddressConverter로 통합 관리
const converter = new AddressConverter();
converter.register(layout);

converter.serialize({ schema: "perm", version: "v1", index: 42 });
// → "00010001-0000-0000-0000-00000000002a"
```

---

## UUID 레이아웃 (uuid-layout)

128비트 UUID의 32 hex 자리에 여러 필드를 패킹한다.

```ts
import { createUUIDLayout, packUUID, unpackUUID, planLayout } from "weighted-index";

const layout = createUUIDLayout({
  left:  [{ name: "schema", chars: 4 }, { name: "version", chars: 2 }],
  right: [{ name: "index",  chars: 8 }],
});

packUUID(layout, { schema: 1, version: 1, index: 42 });
// → "00010001-0000-0000-0000-0000002a0000" (← 가운데 gap은 0-fill)

unpackUUID(layout, "00010001-0000-0000-0000-0000002a0000");
// → { schema: 1, version: 1, index: 42 }

// 자동 필드 크기 결정
const plan = planLayout({
  left:  [{ name: "schema", maxValue: 255 }, { name: "version", maxValue: 15 }],
  right: [{ name: "index", maxValue: 1_000_000 }],
});
// plan.fields[i].chars — 각 필드의 최소 hex 자릿수
```

---

## 포맷 레지스트리 (pack-format)

hex 기반 컨테이너 포맷 정의 및 관리.

```ts
import { PACK_FORMATS, createFormatRegistry, hexBoundary, hexCeil } from "weighted-index";

PACK_FORMATS.uuid;    // { name: "uuid",   chars: 32, bits: 128, groups: [8,4,4,4,12] }
PACK_FORMATS.int64;   // { name: "int64",  chars: 16, bits: 64 }
PACK_FORMATS.sha256;  // { name: "sha256", chars: 64, bits: 256 }

// hex 경계 분석
hexBoundary(100);  // { value: 100, hexChars: 2, max: 255, utilization: ~0.39 }
hexCeil(100);      // → 256 (다음 hex 경계)

// 커스텀 포맷
const registry = createFormatRegistry();
registry.register({ name: "cuid", chars: 24, bits: 96 });
```

---

## 용량 계획 (capacity-planner)

shape을 컨테이너에 맞게 비례 축소하거나, 성장을 고려한 용량을 추천한다.

### fitShape — 비례 축소

```ts
import { fitShape } from "weighted-index";

const result = fitShape({
  shape: [99999, 999, 99, 99],
  maxProduct: 16 ** 7,        // int28 (7 hex 자리)
});
// result.shape → [374, 37, 37, 37]  (비례 축소)
// result.product → 18_942_796
// result.utilization → ~0.07
```

### planCapacity — 성장 예측

```ts
import { planCapacity } from "weighted-index";

const plan = planCapacity({
  dims: [
    { current: 5,  growth: 10 },  // 현재 5, 최대 10 예상
    { current: 10 },              // growth 미지정 → current의 2배(20)가 기본값
    { current: 3,  growth: 5 },
  ],
  capacity: "uuid",               // 128비트 UUID 컨테이너
});
// plan.dims[i].recommended — power-of-2 정렬된 추천 용량
// plan.layout — UUID 레이아웃 계획
```

> `growth` 미지정 시 `current`와 동일한 값이 적용되어 `recommended = nextPow2(current × 2)` (2x headroom)가 된다.

---

## 비트 필드 레이아웃 (bit-field-layout)

hex-char(4비트) 경계 대신 **정확한 비트 경계**로 필드를 패킹한다. 필드의 max value가 16의 거듭제곱에 맞지 않을 때 낭비되는 비트를 회수.

```ts
import {
  createBitFieldLayout, bitPack, bitUnpack,
  bitPackToHex, bitPackToBytes,
  analyzeBitVsHex,
} from "weighted-index";

// 레이아웃 정의: 각 필드는 ⌈log₂(maxValue+1)⌉ 비트
const layout = createBitFieldLayout([
  { name: "prefix",  maxValue: 15 },    // 4 bits (hex과 동일)
  { name: "version", maxValue: 7 },     // 3 bits (hex: 4 → 1 bit 절약)
  { name: "shard",   maxValue: 3 },     // 2 bits (hex: 4 → 2 bit 절약)
  { name: "index",   maxValue: 99999 }, // 17 bits (hex: 20 → 3 bit 절약)
]);
// totalBits: 26 (hex 기준 32 → 6 bits 절약, 64× 용량 증가 가능)

// pack → bigint
const packed = bitPack(layout, { prefix: 10, version: 5, shard: 2, index: 42 });
const fields = bitUnpack(layout, packed);
// fields.index === 42n

// 다양한 출력 포맷
bitPackToHex(layout, { prefix: 10, version: 5, shard: 2, index: 42 });
// → hex 문자열 (디버그/표시용)

bitPackToBytes(layout, { prefix: 10, version: 5, shard: 2, index: 42 });
// → Uint8Array (저장/네트워크 전송용)
```

### BigInt 지원

모든 연산이 내부적으로 bigint로 수행되므로, 53비트를 초과하는 필드도 정밀도 손실 없이 처리.

```ts
const bigLayout = createBitFieldLayout([
  { name: "prefix",  maxValue: 15 },
  { name: "index",   maxValue: 0, bits: 119 },  // 119-bit 필드
]);

const packed = bitPack(bigLayout, { prefix: 15, index: (1n << 119n) - 1n });
const u = bitUnpack(bigLayout, packed);
// u.index === (1n << 119n) - 1n  ✓
```

### 밀도 분석

```ts
const analysis = analyzeBitVsHex([
  { name: "prefix",  maxValue: 15 },    // 4b vs 4b → 0 saved
  { name: "version", maxValue: 7 },     // 3b vs 4b → 1 saved
  { name: "shard",   maxValue: 3 },     // 2b vs 4b → 2 saved
  { name: "index",   maxValue: 99999 }, // 17b vs 20b → 3 saved
]);
// analysis.savedBits → 6
// analysis.capacityMultiplier → 64  (index에 6비트 추가 시 64× 더 많은 주소)
```

### uuid-layout과의 관계

| | uuid-layout (hex) | bit-field-layout |
|---|---|---|
| 경계 | 4비트 (hex char) | 1비트 |
| 출력 | hex 문자열 (UUID 포맷) | bigint / Uint8Array / hex |
| 디버깅 | 필드가 hex 위치로 직접 식별 | 비트 오프셋 계산 필요 |
| 밀도 | ~70-85% | ~95%+ |
| 용도 | 사람이 읽는 ID, DB UUID 컬럼 | 저장 밀도 중요한 경로 |

두 모듈은 병행 사용 가능: 저장은 bit-pack, 표시는 hex-format.

---

## 난독화 (obfuscate)

전단사(bijection) 비트 변환. 주소를 외관상 예측 불가능하게 만든다.

> **⚠️ 보안 경고**: 이 모듈은 식별자의 외관 변환 전용이며, 암호학적 보안을 제공하지 않는다.
> 접근 제어, 인가 토큰, 세션 ID 생성에 사용하지 말 것.
> - **XOR**: 단일 (평문, 암호문) 쌍으로 key 복원 가능 (`key = p XOR c`)
> - **Rotate**: 최대 `bitWidth - 1`개 후보 전수 탐색으로 파훼
> - **Reverse**: 키 없는 결정론적 변환, 누구나 즉시 역변환 가능
>
> 보안이 필요한 경우 AES-128-CTR 또는 Web Crypto API를 사용할 것.

```ts
import {
  xorObfuscate, rotateLeft, rotateRight, reverseBits, compose,
  calcBitWidth, toHex, fromHex, toUUID, fromUUID, toNanoId, fromNanoId,
} from "weighted-index";

const bitWidth = calcBitWidth(999);  // → 10

// 단일 변환
xorObfuscate(42, bitWidth, 0x2A7);  // → 난독화된 값 (self-inverse)

// 합성 변환 체인
const transform = compose(
  (id, bw) => xorObfuscate(id, bw, 0x2A7),
  (id, bw) => rotateLeft(id, bw, 3),
  (id, bw) => reverseBits(id, bw),
);
const obfuscated = transform(42, bitWidth);

// 다양한 인코딩
toHex(obfuscated, bitWidth);    // → "1a3"
toUUID(obfuscated, bitWidth);   // → "00000000-0000-0000-0000-0000000001a3"
toNanoId(obfuscated, bitWidth); // → compact URL-safe string
```

---

## 에러 계층

모든 에러는 `WeightedIndexError`를 상속한다.

```ts
import {
  WeightedIndexError, ShapeError, CoordError, IndexRangeError,
  BufferError, LabelNotFoundError, VersionNotFoundError,
  EntityNotFoundError, PrefixNotFoundError, SerializeError, MigrateError,
} from "weighted-index";
```

| 에러 | 발생 조건 |
|---|---|
| `ShapeError` | 유효하지 않은 shape 정의 |
| `CoordError` | 인코딩 시 좌표 범위 초과 |
| `IndexRangeError` | 디코딩 시 주소 범위 초과 |
| `BufferError` | `decodeTo` 버퍼 크기 부족 |
| `LabelNotFoundError` | 존재하지 않는 레이블 |
| `VersionNotFoundError` | 존재하지 않는 버전 |
| `EntityNotFoundError` | entity ID 또는 인덱스를 찾지 못함 |
| `PrefixNotFoundError` | 존재하지 않는 prefix |
| `SerializeError` | 직렬화 형식 오류 |
| `MigrateError` | 마이그레이션이 유효하지 않은 좌표 반환 |

---

## 설계 철학: 의미 보존 (Semantic Integrity)

이 시스템의 목적은 **정보 보호(information protection)가 아니라 정보의 의미를 잃지 않는 것(semantic integrity)**이다.

다차원 좌표가 1D 정수로 압축되고, 직렬화되고, 버전이 바뀌고, 난독화되고, UUID에 패킹되는 전체 생명주기에서 **원래 좌표의 의미가 훼손 없이 복원 가능해야 한다**는 것이 핵심 불변(invariant)이다.

```
좌표 → encode → 주소 → serialize → 문자열 → parse → 주소 → decode → 좌표
  ↕ (의미 보존)                                                ↕ (의미 보존)
 원본과 동일                                                  원본과 동일
```

따라서 아래의 모든 검증 조치는 "외부 공격 방어"가 아니라 **의미 오염 방지**를 목적으로 한다. NaN이 전파되면 좌표의 의미가 소실되고, 필드 오버플로우가 일어나면 인접 필드의 의미가 파괴되며, `0x2a`가 `42`로 파싱되면 동일한 주소에 두 가지 정규 표현이 생겨 의미의 동일성이 깨진다.

### 의미 보존을 위한 검증

| 위험 | 의미 오염 경로 | 방어 |
|------|---------------|------|
| NaN 전파 | `encodeUnsafe(잘못된 좌표)` → NaN → `hasBit(mask, NaN)` → 비트 0 검사 | bitmask에서 `Number.isInteger(id)` 검증 |
| 마스크 차원 불일치 | 서로 다른 버전의 마스크 교차 연산 → 일부 비트 묵살 | `maskAnd`/`maskOr`/`masksOverlap`에서 길이 불일치 거부 |
| 필드 오버플로우 | `toStructuredUUID`에 `bitWidth` 초과 값 → 인접 필드 침범 → 역파싱 시 전혀 다른 값 | 각 필드 값의 범위 검증 |
| hex 파싱 오류 | `fromHex("GG")` → NaN → 후속 연산에서 좌표 의미 소실 | hex 문자 유효성 검사 (`/^[0-9a-fA-F]+$/`) |
| 주소 표현 이중성 | `"perm:v1:0x2a"` = `"perm:v1:42"` → 같은 주소에 두 표현 → 서명/비교 불일치 | strict 10진수(`/^\d+$/`)만 허용 |

### Unsafe API와 의미 보존 경계

`encodeUnsafe`/`decodeUnsafe`는 검증을 생략하는 대신 **호출자가 의미 보존을 보장**해야 한다.

```
┌─────────────────────────────────────────────────────┐
│  외부 경계 (외부 입력, API, URL 파라미터)              │
│  → encode() / decode()  (검증 포함, 의미 보존 보장)    │
├─────────────────────────────────────────────────────┤
│  내부 경계 (MetaRegistry, 이미 검증된 좌표)            │
│  → encodeUnsafe() / decodeUnsafe()  (검증 생략)       │
│    호출자가 좌표 범위를 사전 보장해야 함                 │
└─────────────────────────────────────────────────────┘
```

잘못된 좌표가 Unsafe API에 진입하면 잘못된 인덱스를 **조용히** 반환하며, 이 값이 bitmask 검사, 직렬화, UUID 패킹까지 전파되어 의미 체계 전체가 오염될 수 있다. 외부 경계에서는 항상 안전한 API를 사용할 것.

### 난독화 모듈의 역할

`obfuscate/` 모듈은 **정보를 숨기는 것이 아니라 의미의 외관을 변환**한다.

주소 `42`를 XOR/rotate/reverse로 변환해도 원래 의미(좌표)는 역변환으로 완전히 복원된다. 이것이 "전단사(bijection) 보장"이다. 변환의 목적은 연속된 정수(`42, 43, 44`)가 외부에서 패턴으로 보이지 않게 하는 것이지, 비밀을 보호하는 것이 아니다.

| 변환 | 역변환 | 의미 보존 | 비밀 보호 |
|------|--------|-----------|-----------|
| `xorObfuscate(id, w, key)` | 동일 함수 재적용 (self-inverse) | **보장** | 없음 (key = p XOR c) |
| `rotateLeft(id, w, k)` | `rotateRight(id, w, k)` | **보장** | 없음 (brute-force) |
| `reverseBits(id, w)` | 동일 함수 재적용 (self-inverse) | **보장** | 없음 (키 없음) |

접근 제어나 인가가 필요하다면 이 모듈이 아닌 별도의 암호화 계층(AES, Web Crypto API)을 사용할 것.

### 운영 시 주의사항

- **에러 메시지 정보 노출**: `LabelNotFoundError`, `VersionNotFoundError` 등이 등록된 전체 레이블/버전 목록을 에러 메시지에 포함한다. 프로덕션 환경에서는 에러 메시지 필터링을 권장한다.
- **주소 공간 DoS**: `calcAddressRanges`에 대규모 제약 범위를 외부 입력으로 직접 전달하면 재귀 탐색 비용이 급증할 수 있다. 외부 API에서는 입력 크기를 제한할 것.
- **toUUID 이종 시스템 충돌**: 동일한 `id + bitWidth` 조합만 UUID 일관성을 보장한다. 서로 다른 `bitWidth` 간 충돌 가능하므로 단일 `bitWidth` 정책을 유지할 것.

---

## 공개 API

```ts
// ── 핵심 코덱 ─────────────────────────────────────────────
export { WeightedIndex } from "weighted-index";

// ── 레이블 & 프리픽스 ──────────────────────────────────────
export { LabelRegistry, createLabelRegistry, PrefixCodec } from "weighted-index";
export type {
  EntityId, LabelVersionEntry, InferLabelSchema,
  PrefixVersionEntry, PrefixDefinition, VersionedIndex,
  PrefixVersionDiff, CoordMigrator,
} from "weighted-index";

// ── 범위 연산 ──────────────────────────────────────────────
export {
  calcWeights, calcAddressRanges, partialQueryBase,
  mergeRanges, intersectRanges, subtractRanges, complementRanges,
  containsAddress, positionsToConstraint, describeRangeFormula,
  parseConstraintSegments, expandRanges,
} from "weighted-index";
export type { CoordConstraint } from "weighted-index";

// ── 패턴 래티스 ────────────────────────────────────────────
export {
  rangesToConstraint, constraintContains,
  patternContains, patternMeet, patternJoin,
  patternSpecificity, coordMatchesPattern,
} from "weighted-index";

// ── 비트마스크 ─────────────────────────────────────────────
export {
  createMask, setBit, clearBit, hasBit,
  buildMask, hasAnyBit, hasAllBits, popcount,
  maskAnd, maskOr, masksOverlap,
} from "weighted-index";

// ── UUID 레이아웃 ──────────────────────────────────────────
export { createUUIDLayout, packUUID, unpackUUID, charsForMax, planLayout } from "weighted-index";
export type { UUIDSlot, UUIDLayoutDef, UUIDLayout, LayoutFieldSpec, PlannedField, LayoutPlan } from "weighted-index";

// ── 포맷 레지스트리 ────────────────────────────────────────
export {
  PACK_FORMATS, PACK_FORMAT_LIST, defineFormat,
  FormatRegistry, createFormatRegistry,
  formatHex, parseHex, hexBoundary, hexCeil, hexFloor,
} from "weighted-index";
export type { PackFormat, BuiltinFormatName, DefineFormatOptions, HexBoundary } from "weighted-index";

// ── 용량 계획 ──────────────────────────────────────────────
export { fitShape, fitLayout, planCapacity } from "weighted-index";
export type {
  FitShapeOptions, FitShapeResult, FitLayoutOptions, FitLayoutResult,
  CapacityPlanDim, PlanCapacityOptions, CapacityRecommendation, CapacityPlanResult,
} from "weighted-index";

// ── 비트 필드 레이아웃 ────────────────────────────────────────
export {
  bitsForMax, createBitFieldLayout,
  bitPack, bitUnpack,
  bigintToBytes, bytesToBigint,
  bitPackToBytes, bitUnpackFromBytes,
  bitPackToHex, bitUnpackFromHex,
  analyzeBitVsHex,
} from "weighted-index";
export type {
  BitFieldSpec, BitField, BitFieldLayout,
  BitVsHexField, BitVsHexAnalysis,
} from "weighted-index";

// ── 주소 직렬화 ────────────────────────────────────────────
export {
  colonProtocol, uriProtocol, compactProtocol,
  parseAddress, serializeAddress, convertAddress,
  fromVersionedIndex, toVersionedIndex, fromVersionedValue, toVersionedValue,
  createLayoutProtocol, AddressConverter, createAddressConverter,
} from "weighted-index";
export type {
  SemanticAddress, VersionedValue, AddressProtocol,
  LayoutProtocolOptions, ShardingStrategy,
} from "weighted-index";

// ── 난독화 ─────────────────────────────────────────────────
export {
  calcBitWidth, xorObfuscate, rotateLeft, rotateRight, reverseBits, compose,
  toHex, fromHex, toUUID, fromUUID, toStructuredUUID, fromStructuredUUID,
  toNanoId, fromNanoId,
} from "weighted-index";
export type { UUIDField, ObfuscateTransform } from "weighted-index";

// ── 에러 ───────────────────────────────────────────────────
export {
  WeightedIndexError, ShapeError, CoordError, IndexRangeError, BufferError,
  LabelNotFoundError, VersionNotFoundError, EntityNotFoundError,
  PrefixNotFoundError, SerializeError, MigrateError,
} from "weighted-index";
```

---

## 빌드

```bash
pnpm build       # tsup → dist/ (ESM + CJS)
pnpm test        # vitest
pnpm typecheck   # tsc --noEmit
```

| 항목 | 값 |
|---|---|
| 포맷 | ESM + CJS (듀얼) |
| 타입 | `dist/index.d.ts` (자동 생성) |
| 소스맵 | ✓ |
| 트리쉐이킹 | ✓ |
| 외부 의존성 | 없음 |
