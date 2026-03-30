---
def:
  id: wi-layout-protocol
  address: def_document:v2:412836
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: weighted-index
  tags: [contract, runtime, structural]
  links:
    - target: wi-semantic-address
      type: depends_on
    - target: wi-pack-format-def
      type: depends_on
---
# createLayoutProtocol

## 목적 ^purpose

SemanticAddress를 UUID/hex 컨테이너에 패킹하는 레이아웃 프로토콜 팩토리. DB 저장/조회에 최적화된 이진 직렬화를 제공한다.

## 구성 ^overview

Layout 프로토콜은 3개 레이어로 구성된다.

- **uuid-layout.ts** — UUID 128비트 필드 배치 (`createUUIDLayout`, `packUUID`, `unpackUUID`, `planLayout`)
- **semantic-address.ts** — `createLayoutProtocol()` / `createLayoutProtocolBig()` 팩토리
- **layout-fit.ts** — 시뮬레이터 계산 (`analyzeLayoutSim`, `simPackUUID`, `computeLayoutViewModel`)
- **bit-field-layout.ts** — 범용 비트 필드 pack/unpack (`bitPack`, `bitUnpack`, `bitPackToHex`)

## UUID Layout 구조

```
┌─────────────────────────────────────────────────────────────────────┐
│  left fields → [gap: zero-fill] ← right fields                    │
│  xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx  (32 hex chars, 8-4-4-4-12) │
└─────────────────────────────────────────────────────────────────────┘
```

- Left fields: char 0부터 오른쪽으로 배치 (schema, version)
- Right fields: char 31부터 왼쪽으로 배치 (index, shard)
- Gap: zero-fill. left와 right 사이의 여백

## createUUIDLayout

```typescript
const layout = createUUIDLayout({
  left:  [{ name: "prefix", chars: 4 }, { name: "version", chars: 2 }],
  right: [{ name: "index",  chars: 6 }],
});
// left + right ≤ 32 chars
```

## planLayout — 범용 필드 배치

`charsForMax(maxValue)` — 값 0~maxValue를 표현하는 최소 hex 자릿수.

```typescript
const plan = planLayout({
  left:  [{ name: "schema", maxValue: 15 }, { name: "version", maxValue: 3 }],
  right: [{ name: "index", maxValue: 1023 }],
});
// plan.fields: [{ name, chars, start, bits }], plan.totalChars, plan.gapChars
```

## createLayoutProtocol — 프로토콜 팩토리

```typescript
const proto = createLayoutProtocol({
  format: PACK_FORMATS.uuid,
  schemaChars: 4,
  versionChars: 2,
  schemas: { perm: 1, auth: 2 },
  versions: { v1: 1, v2: 2 },
  sharding: { type: "modulo", chars: 1, numShards: 4 },  // 선택
});

proto.serialize({ schema: "perm", version: "v1", index: 42 });
// → "00010001-0000-0000-0000-00000000002a"

proto.parse("00010001-0000-0000-0000-00000000002a");
// → { schema: "perm", version: "v1", index: 42 }
```

BigInt 버전: `createLayoutProtocolBig(opts)` — index가 bigint인 `SemanticAddressBig` 지원.

## Layout Simulator (layout-fit.ts)

인터랙티브 UI 시뮬레이터를 위한 순수 계산 함수 모음.

| 함수 | 설명 |
|------|------|
| `analyzeLayoutSim(cfg)` | UUID 예산 분석 (indexBudget, maxProduct, uniformMax) |
| `dimMaxForBudget(budget, others)` | 한 차원의 최댓값 (다른 차원 고정 시) |
| `autoBalancedShape(numDims, budget)` | 균등 배분 초기 shape |
| `clampShape(shape, budget, mode)` | 상호 제약에 맞게 shape 축소 |
| `computeLayoutViewModel(analysis, shape, mode)` | Number/BigInt 모드별 정합 ViewModel |
| `simEncode/simDecode` | 경량 mixed-radix 변환 (검증 없음) |
| `simPackUUID/simPackHex` | 시뮬레이터용 UUID/hex 패킹 |

LayoutViewMode: `"number"` (MAX_SAFE_INTEGER 캡) / `"bigint"` (전체 포맷 용량).

## BitFieldLayout — 범용 비트 필드

```typescript
const layout = createBitFieldLayout([
  { name: "type", bits: 4 },
  { name: "id", bits: 12 },
  { name: "seq", bits: 16 },
]);
const packed = bitPack(layout, { type: 3, id: 100, seq: 5000 });
const unpacked = bitUnpack(layout, packed);
// → { type: 3, id: 100, seq: 5000 }
```

추가: `bitPackToBytes`, `bitUnpackFromBytes`, `bitPackToHex`, `bitUnpackFromHex`, `analyzeBitVsHex`.

## binary-axis.ts — ArrayBuffer 직렬화

`packAxis(shape, strides)` / `unpackAxis(buffer)` — 워커/WASM/네트워크 간 zero-copy 전송.

```
Layout (little-endian):
  [4 bytes] dimCount
  [dimCount × 4 bytes] shape (uint32[])
  [dimCount × 8 bytes] strides (float64[])
  [4 bytes] totalSize
```

`fromPackedAxis(buffer)` → WeightedIndex, `toPackedAxis(wi)` → ArrayBuffer.

## 소스 위치

- `packages/weighted-index/src/protocol/uuid-layout.ts`
- `packages/weighted-index/src/protocol/semantic-address.ts`
- `packages/weighted-index/src/protocol/bit-field-layout.ts`
- `packages/weighted-index/src/math/layout-fit.ts`
- `packages/weighted-index/src/math/binary-axis.ts`
