---
def:
  id: wi-api
  address: def_document:v1:3225
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: weighted-index
  tags: [tier-infra]
  links:
    - target: wi-math
      type: implements
---
# Weighted-Index 퍼블릭 API

## 목적 ^purpose

WeightedIndex(encode/decode/encodeFromRecord/decodeToRecord), LabelRegistry(레이블 관리), PrefixCodec(시맨틱 주소 직렬화/파싱)의 퍼블릭 API.

## 구성 ^overview

퍼블릭 API는 3개 계층으로 구성된다. 모든 export는 `packages/weighted-index/src/index.ts`에서 관리.

- **WeightedIndex / WeightedIndexBig** — 순수 정수 인코딩/디코딩
- **LabelRegistry** — 문자열 ↔ 정수 매핑 (vocab 레이어)
- **PrefixCodec** — 레이블 조합(prefix) + 버전 관리 + 직렬화

## WeightedIndex API

생성: `new WeightedIndex(shape: number[], labels?: string[])` — shape product가 `MAX_SAFE_INTEGER`를 초과하면 에러.

### 안전한 API (경계 검사 포함)

| 메서드 | 시그니처 | 설명 |
|--------|----------|------|
| `encode` | `(coords: number[]) → number` | 좌표(1-based) → 정수 |
| `decode` | `(index: number) → number[]` | 정수 → 좌표(1-based) |
| `encodeFromRecord` | `(rec: Record<string, number>) → number` | `{ label: value }` → 정수 |
| `decodeToRecord` | `(index: number) → Record<string, number>` | 정수 → `{ label: value }` |
| `decodeTo` | `(index: number, out: number[]) → void` | 버퍼 기록 (할당 제로) |

### Hot-path API (경계 검사 생략)

`encodeUnsafe`, `decodeUnsafe`, `decodeToUnsafe` — 검증된 내부 경로 전용. 외부 입력 금지.

### Batch API

| 메서드 | 입출력 | 설명 |
|--------|--------|------|
| `encodeBatch` | `Coord[] → Uint32Array` | 배치 정변환 |
| `decodeBatch` | `Uint32Array → number[][]` | 배치 역변환 |
| `encodeBatchFlat` | `Float64Array → Float64Array` | row-major zero-copy |
| `decodeBatchFlat` | `Float64Array → Float64Array` | row-major zero-copy |

### 읽기 전용 속성

- `shape: readonly number[]` — 각 차원의 크기
- `labels: readonly string[]` — 각 차원의 이름
- `strides: readonly number[]` — 각 차원의 가중치 (`strides[i] = Π_{j>i} shape[j]`)
- `size: number` — 총 주소 공간 크기 (`Π shape[i]`)

## LabelRegistry API

`createLabelRegistry(defs)` 팩토리로 생성. TypeScript가 레이블별 entity ID 타입을 자동 추론.

```typescript
const labels = createLabelRegistry({
  role:   [{ version: "v1", ids: [1, 2, 3] }],       // TId: number
  action: [{ version: "v1", ids: ["read", "write"] }], // TId: string
});
labels.getIndex("role", "v1", 1);     // ✓ number
labels.getIndex("role", "v1", "hi");  // ✗ 컴파일 에러
```

핵심 메서드: `getIndex`, `getEntityId`, `getMax`, `getLatestVersion`, `getVersions`.

## PrefixCodec API

`new PrefixCodec(labels, prefixes)` — LabelRegistry와 prefix 정의를 결합.

| 메서드 | 설명 |
|--------|------|
| `encode(prefix, coords, version?)` | 좌표 → VersionedIndex |
| `encodeFromIds(prefix, ids, version?)` | 엔티티 ID → VersionedIndex |
| `decode(vi)` | VersionedIndex → 좌표 |
| `decodeToIds(vi)` | VersionedIndex → 엔티티 ID |
| `serialize(vi)` | VersionedIndex → `"prefix:version:id"` |
| `parse(serialized)` | 문자열 → VersionedIndex |
| `migrate(vi, toVersion, migrator)` | 구버전 → 신버전 좌표 변환 |
| `diff(prefix, from, to)` | 두 버전 간 변경 내역 |

## PartialBinder

`createBinder(codec, prefix, fixed)` — SDK 컨텍스트 고정 후 나머지 차원만으로 인코딩. 체이닝 가능 (`bind()`).

## 에러 계층

모든 에러는 `WeightedIndexError`를 상속. `instanceof`로 분기 가능: `ShapeError`, `CoordError`, `IndexRangeError`, `BufferError`, `LabelNotFoundError`, `VersionNotFoundError`, `EntityNotFoundError`, `PrefixNotFoundError`, `SerializeError`, `MigrateError`.

## 소스 위치

- `packages/weighted-index/src/index.ts` — 모든 public export
- `packages/weighted-index/src/math/weighted-index.ts`
- `packages/weighted-index/src/vocab/label-registry.ts`
- `packages/weighted-index/src/vocab/prefix-registry.ts`
- `packages/weighted-index/src/vocab/partial-binder.ts`
