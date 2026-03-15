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
│  bitmask             — O(1) 비트 마스크 연산                     │
├───────────────────────────────────────────────────────────────┤
│  SemanticAddress     — 다중 프로토콜 주소 직렬화 (colon/uri/compact/layout) │
│  UUIDLayout          — 128비트 UUID에 구조화된 필드 패킹           │
│  PackFormat          — 컨테이너 포맷 레지스트리 (uuid/int64/sha256 등) │
├───────────────────────────────────────────────────────────────┤
│  CapacityPlanner     — 비례 축소, 용량 추천, 성장 예측             │
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

// Hot-path (경계 검사 생략, 입력이 신뢰된 경우만)
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

## 난독화 (obfuscate)

전단사(bijection) 비트 변환. 주소를 예측 불가능하게 만든다. **암호학적 보안은 아님.**

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
} from "weighted-index";
export type { CoordConstraint } from "weighted-index";

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
