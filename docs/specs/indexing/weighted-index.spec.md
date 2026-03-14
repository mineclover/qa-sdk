# weighted-index 스펙

> 가중진법(weighted positional notation) 기반 다차원 인덱스 ↔ 정수 변환 라이브러리.
> 레이블 조합(역할, 액션, API, 테넌트 등)을 단일 정수 ID로 인코딩/디코딩하고, 버전 관리를 통해 DB 연결성을 유지한다.

패키지: `weighted-index`

> 기반 원리는 [`foundation.md`](foundation.md), 사용 패턴은 [`patterns.md`](patterns.md), 프로젝트 관례는 [`conventions.md`](conventions.md)를 참조한다.

## 상태

implemented

### weighted-index 고유 원칙

1. **성능 계층을 명시적으로 분리한다.** 검증이 포함된 안전 API와 검증을 생략한 hot-path API를 명확히 구분한다. 경계 검사 비용이 병목이 될 때만 `Unsafe` 변형을 사용한다.

2. **런타임 의존성을 갖지 않는다.** 서버, Worker, 브라우저, 테스트 환경 어디서든 추가 설치 없이 동작한다. 순수 함수 유틸리티(`calc.ts`, `bitmask.ts`, `obfuscate.ts`)는 WeightedIndex 인스턴스조차 필요 없다.

3. **컴파일 타임에 오류를 잡는다.** TypeScript strict + schema inference로 잘못된 레이블 참조나 타입 불일치를 빌드 시점에 발견한다.

---

## 1. 핵심 수학 공식

**d차원, 1-based 좌표** 기준:

```
encode: id = Σ (x_i - 1) * Π_{j=i+1}^{d} N_j
decode: x_i = floor(id / weight_i) mod N_i + 1
```

- `shape[i]` = i번째 차원의 최댓값 (1 이상 정수)
- 유효 id 범위: `[0, size-1]`  (size = Π N_i)
- 유효 coords 범위: `coords[i] ∈ [1, shape[i]]`

**전단사(bijection) 보장**: 1..N 순번 인덱스 + 위 공식 → 겹침 없음, 빈 값 없음.

---

## 2. 모듈 구조

```
src/
  errors.ts          # 에러 클래스 계층 (리프 — 의존 없음)
  validators.ts      # 공유 검증 유틸 (errors에만 의존)
  weighted-index.ts  # 핵심 수학 엔진 (errors, validators에만 의존)
  label-registry.ts  # 레이블 버전 관리 (errors, validators에만 의존)
  prefix-registry.ts # 레이블 조합(prefix) + 버전 관리 (weighted-index, label-registry 위에서 조율)
  calc.ts            # 가중치·범위 쿼리 계산 유틸 (리프 — 의존 없음, 순수 함수)
  bitmask.ts         # 비트마스크 권한 연산 유틸 (리프 — 의존 없음, 순수 함수)
  obfuscate.ts       # 전단사 비트 변환 + 직렬화 유틸 (리프 — 의존 없음, 순수 함수)
  index.ts           # 공개 API 재수출
```

### 의존 레이어

```
┌─────────────────────────────────────────┐
│  prefix-registry.ts  (조율 레이어)        │
├──────────────┬──────────────────────────┤
│ weighted-    │  label-registry.ts        │
│ index.ts     │                           │
├──────────────┴──────────────────────────┤
│  validators.ts                           │
├─────────────────────────────────────────┤
│  errors.ts                               │
└─────────────────────────────────────────┘

독립 유틸 (어느 레이어에도 의존하지 않음):
  calc.ts · bitmask.ts · obfuscate.ts
```

순환 의존 없음. 독립 유틸은 WeightedIndex 인스턴스 없이도 사용 가능.

### 빌드

`tsup` 으로 ESM + CJS 동시 출력:

```
dist/
  index.js      # ESM  (import)
  index.cjs     # CJS  (require)
  index.d.ts    # TypeScript 선언
  index.d.cts   # CJS용 TypeScript 선언
```

```json
// package.json exports
{
  ".": {
    "types":   "./dist/index.d.ts",
    "import":  "./dist/index.js",
    "require": "./dist/index.cjs"
  }
}
```

---

## 3. WeightedIndex

### 역할
`shape` 배열을 받아 다차원 좌표 ↔ 정수 변환을 수행하는 핵심 연산 클래스.

### 생성자

```ts
new WeightedIndex(shape: number[], labels?: string[])
```

- `shape`: 각 차원의 최댓값 배열 (양의 정수, 비어있으면 `ShapeError`)
- `labels`: 차원 이름 배열 (기본값: `dim_0`, `dim_1`, ...)
- `size > Number.MAX_SAFE_INTEGER`이면 `ShapeError`

### 공개 API

| 메서드 | 설명 |
|---|---|
| `encode(coords)` | 좌표 → 정수. 경계 검사 포함. |
| `decode(index)` | 정수 → 좌표 배열. 경계 검사 포함. |
| `encodeFromRecord(record)` | `{ label: value }` → 정수. |
| `decodeToRecord(index)` | 정수 → `{ label: value }`. |
| `encodeUnsafe(coords)` | 경계 검사 생략. hot-path 전용. **잘못된 입력 → 오류 없이 잘못된 결과 반환.** |
| `decodeUnsafe(index)` | 경계 검사 생략. hot-path 전용. |
| `decodeTo(index, out)` | 사전 할당 버퍼에 기록. 배열 할당 없음. |
| `decodeToUnsafe(index, out)` | 검사 없는 버퍼 기록. |

### 읽기 전용 속성

| 속성 | 타입 | 설명 |
|---|---|---|
| `shape` | `readonly number[]` | 각 차원 최댓값 |
| `labels` | `readonly string[]` | 차원 이름 |
| `size` | `number` | 전체 조합 수 |

### 성능 특성
- `weights`, `shapeBuf` → `Float64Array` (tight-loop에서 property 접근 최소화)
- `encodeUnsafe` / `decodeUnsafe` → 입력 신뢰 시 경계 검사 비용 제거
- `decodeTo` → 호출자 버퍼 재사용으로 GC 압박 없음

### 차원 순서와 캐시 지역성

shape 배열의 **마지막 차원이 stride = 1**이 된다. 가장 자주 변하는 차원(inner loop)을 마지막에 배치하면, 순회 시 ID가 1씩 증가해 bitmask의 같은 byte 내에서 이동한다. 차원 순서가 반대면 매 순회마다 멀리 떨어진 byte에 접근하게 된다.

```ts
// ✅ 가장 자주 변하는 차원을 마지막에
// 에피소드 시뮬: env와 agent 수는 고정, t는 tight-loop
const wi = new WeightedIndex([envCount, agentCount]);
// t는 외부 Map으로 관리 — 아래 "열린 차원" 참고

// ✅ 권한 검사: action이 가장 자주 변함
const wi = new WeightedIndex([resourceCount, roleCount, actionCount]);
// action 순회 시 ID가 1씩 증가 → 같은 byte 안에서 이동

// ❌ action을 첫 번째에 두면
const wi = new WeightedIndex([actionCount, resourceCount, roleCount]);
// action 순회 시 ID가 resourceCount×roleCount만큼 점프 → byte 경계를 넘어 분산
```

### 열린 차원 분리 원칙

상한이 알려지지 않은 값은 WeightedIndex 차원에 포함하지 않는다. 타임스텝 `t`처럼 무한히 증가하는 축은 외부 Map의 키로 관리하고, 각 키마다 독립된 WeightedIndex ID 공간을 운용한다.

```ts
const wi = new WeightedIndex([envCount, agentCount]); // 닫힌 차원만

// t는 Map 키 — 실제 등장한 t만큼만 메모리 사용
const maskAt = new Map<number, Uint8Array>();
function getMask(t: number): Uint8Array {
  if (!maskAt.has(t)) maskAt.set(t, createMask(wi.size));
  return maskAt.get(t)!;
}
```

타임스텝을 WeightedIndex에 넣으면: `t_max`를 추정해야 하고, 초과 시 오류가 발생하며, 전체 space를 미리 할당해야 한다. 반면 외부 Map은 실제 등장한 t만큼만 메모리를 사용한다.

---

## 4. LabelRegistry

### 역할
레이블(차원)별로 원천 데이터 entity ID 목록을 버전 단위로 관리한다.
`ids` 배열 위치가 곧 1-based 순번 인덱스: `ids[0] → 1`, `ids[1] → 2`, ...

### 타입

```ts
interface LabelVersionEntry<TId extends EntityId = EntityId> {
  version: string;      // ":" 포함 불가
  ids: TId[];           // append-only; 순서가 인덱스를 결정
  createdAt?: string;
  changelog?: string;
}

type EntityId = string | number;
```

### 생성 방법

```ts
// 팩토리 (권장): schema 자동 추론
const labels = createLabelRegistry({
  role:   [{ version: "v1", ids: [1, 2, 3] }],
  action: [{ version: "v1", ids: ["read", "write"] }],
});
// LabelRegistry<{ role: number; action: string }>

// 직접 생성 (런타임 동적 사용 시)
new LabelRegistry(defs)
```

### 공개 API

| 메서드 | 설명 |
|---|---|
| `getMax(label, version)` | 해당 버전의 entity 수 (= max) |
| `getLatestMax(label)` | 최신 버전의 max |
| `getIndex(label, version, entityId)` | entity ID → 1-based 인덱스 (타입 검증 포함) |
| `getEntityId(label, version, index)` | 1-based 인덱스 → entity ID (타입 검증 포함) |
| `getLatestVersion(label)` | 최신 버전 식별자 |
| `getVersions(label)` | 전체 버전 목록 |
| `hasLabel(label)` | 레이블 존재 여부 |
| `hasVersion(label, version)` | 버전 존재 여부 |
| `labelNames` | 등록된 레이블 이름 목록 |

### 내부 API (PrefixRegistry 전용)

| 메서드 | 설명 |
|---|---|
| `_getMaxRaw(label, version)` | 타입 없는 max 조회 |
| `_getIndexRaw(label, version, entityId)` | 타입 없는 인덱스 조회 |
| `_getEntityIdRaw(label, version, index)` | 타입 없는 entity ID 조회 |

### 불변식
- ids 배열은 append-only. 기존 순서 변경 시 인덱스가 바뀌므로 금지.
- 동일 버전 내 중복 entity ID 불가 → 생성자에서 검증.
- `-0` 은 `0` 으로 정규화: JavaScript Map/Set 에서 `-0 === 0` 이므로, `-0` 과 `0` 을 동시에 등록하면 중복으로 처리된다.

---

## 5. PrefixRegistry

### 역할
레이블 조합(prefix)과 그 버전을 관리한다.
`VersionedIndex = { prefix, v, id }` 를 DB 저장 단위로 사용.

### 핵심 개념

| 개념 | 설명 |
|---|---|
| **Prefix** | 레이블들의 순서 있는 조합. 예) `api_perm = [role, action, api, tenant]` |
| **PrefixVersion** | 각 레이블별로 어느 LabelVersion을 사용할지의 스냅샷. |
| **shape** | PrefixVersion에서 각 레이블의 max를 모은 배열. LabelRegistry에서 동적 도출. |
| **VersionedIndex** | `{ prefix, v, id }` — prefix=조회 key, v=decode 메타데이터, id=인코딩 결과 정수 |

### 타입

```ts
interface PrefixVersionEntry {
  version: string;                       // ":" 포함 불가
  labelVersions: Record<string, string>; // label → LabelVersion 스냅샷
  createdAt?: string;
  changelog?: string;
}

interface PrefixDefinition {
  labels: string[];           // 레이블 순서 (고정)
  versions: PrefixVersionEntry[];
}

interface VersionedIndex {
  prefix: string;
  v: string;
  id: number;
}
```

### 생성자

```ts
new PrefixRegistry(labels: LabelRegistry<any>, prefixes: Record<string, PrefixDefinition>)
```

- 생성 시 모든 prefix 정의를 검증 (`_validatePrefixDef`)
- `LabelRegistry`에 없는 label/version 참조 시 즉시 오류

### 인코딩/디코딩 API

| 메서드 | 입력 | 출력 | 설명 |
|---|---|---|---|
| `encode(prefix, coords, version?)` | `number[]` | `VersionedIndex` | 1-based 좌표 배열 → VersionedIndex |
| `encodeFromRecord(prefix, record, version?)` | `Record<string, number>` | `VersionedIndex` | `{ label: index }` 레코드 → VersionedIndex |
| `encodeFromIds(prefix, ids, version?)` | `Record<string, EntityId>` | `VersionedIndex` | entity ID 레코드 → VersionedIndex |
| `decode(vi)` | `VersionedIndex` | `number[]` | → 1-based 좌표 배열 |
| `decodeToRecord(vi)` | `VersionedIndex` | `Record<string, number>` | → `{ label: index }` |
| `decodeToIds(vi)` | `VersionedIndex` | `Record<string, EntityId>` | → entity ID 레코드 |

### 직렬화

```ts
serialize(vi: VersionedIndex): string  // "prefix:v:id"
parse(serialized: string): VersionedIndex
```

- 형식: `"{prefix}:{v}:{id}"` — DB 단일 컬럼 저장용
- `prefix`, `v`, `id` 모두 비어있으면 `SerializeError` (`:pv1:0`, `api_perm::0`, `api_perm:pv1:` 모두 거부)
- `parse` 시 prefix·version 존재 검증 포함

### 버전 관리 API

| 메서드 | 설명 |
|---|---|
| `getCurrentVersion(prefix)` | 가장 최근에 등록된 버전 반환 |
| `getPrefixVersions(prefix)` | 전체 버전 목록 반환 |
| `getShape(prefix, version?)` | 해당 버전의 shape 배열 반환 |
| `getIndex(prefix, version?)` | 캐시된 WeightedIndex 인스턴스 반환 |
| `isCurrent(vi)` | 해당 VersionedIndex가 현재 버전인지 확인 |

### 마이그레이션

```ts
type CoordMigrator = (
  oldCoords: number[],
  oldLabels: readonly string[],
  newLabels: readonly string[]
) => number[];

migrate(vi: VersionedIndex, toVersion: string, migrator: CoordMigrator): VersionedIndex
```

검증 순서:
1. 반환 배열 길이 ≠ 목표 버전 shape 길이 → `MigrateError`
2. 각 좌표가 `[1, shape[i]]` 범위 밖이거나 정수가 아님 → `MigrateError` (인덱스·레이블 이름 명시)
3. 검증 통과 후 `encodeUnsafe` 로 인코딩

> `encode()` 에 위임하지 않고 직접 검증하여 `CoordError` 대신 `MigrateError` 를 던진다.

### Diff

```ts
interface PrefixVersionDiff {
  prefix: string;
  from: string;
  to: string;
  changedLabels: Array<{
    label: string;
    fromLabelVersion: string;
    fromMax: number;
    toLabelVersion: string;
    toMax: number;
  }>;
}

diff(prefix: string, fromVersion: string, toVersion: string): PrefixVersionDiff
```

두 버전 사이에서 labelVersion이 변경된 레이블과 max 변화량을 반환.

### WeightedIndex 캐시

- 내부 Map: `"{prefix}:{version}" → WeightedIndex` 인스턴스
- 동일 prefix+version 조합은 첫 호출 시 1회 생성 후 재사용

---

## 6. 계산 유틸리티 (calc.ts)

WeightedIndex 인스턴스 없이 순수 함수로 가중치·범위 쿼리를 계산한다.
DOM 의존 없음. 서버, Worker, 테스트 환경 모두 사용 가능.

### 함수

| 함수 | 설명 |
|---|---|
| `calcWeights(shape)` | shape 배열 → 가중치 배열. `W[i] = Π_{j>i} shape[j]` |
| `partialQueryBase(weights, fixedCoords)` | 고정 차원만의 기저 합산. 자유 차원(null)은 기여 없음. |
| `describeRangeFormula(weights, fixedCoords, labels)` | 범위 쿼리를 사람이 읽기 좋은 수식 문자열로 변환. |

### `calcWeights`

```ts
calcWeights([8, 4, 5, 4])  // → [80, 20, 4, 1]
// W[i] = product of all shape[j] where j > i
// Last weight is always 1.
```

WeightedIndex 내부 weights와 동일한 공식. `encode = Σ (x_i − 1) × W[i]`.

### `partialQueryBase`

```ts
// Fix role=4, env=1 with weights [80, 20, 4, 1]
partialQueryBase([80, 20, 4, 1], [null, null, 4, 1])  // → 12
// (4-1)*4 + (1-1)*1 = 12 + 0 = 12
```

범위 쿼리에서 고정 차원의 기저값을 미리 계산. 자유 차원을 반복할 때 `base + offset` 패턴으로 사용.

### `describeRangeFormula`

```ts
describeRangeFormula(
  [80, 20, 4, 1],
  [null, null, 4, 1],
  ["resource", "action", "role", "env"]
)
// → "12 + (resource−1)×80 + (action−1)×20"
```

- 모두 고정이면 숫자 상수 문자열 반환
- base=0이면 선행 "0 +" 없이 자유 항만 반환
- 자유 차원이 없으면 순수 숫자 문자열 반환

---

## 7. 비트마스크 유틸리티 (bitmask.ts)

권한 ID를 비트 위치로 저장하는 Uint8Array 기반 권한 마스크.
O(1) 단일 권한 조회, O(size/8) 마스크 연산.

### 권한 저장 원리

```
id = wi.encode([resource, action, role, env])  // 0-based 정수
                                               // e.g. 640슬롯 → 80바이트
hasPerm = (mask[id >> 3] & (1 << (id & 7))) !== 0
```

640슬롯 인덱스 → 80 bytes. 문자열 배열 대비 메모리 6,400배 절약.

### 단일 비트 연산

| 함수 | 설명 | 복잡도 |
|---|---|---|
| `createMask(size)` | `ceil(size/8)` 바이트 zero-filled Uint8Array 생성 | O(size/8) |
| `setBit(mask, id)` | id 위치 비트 설정 | O(1) |
| `clearBit(mask, id)` | id 위치 비트 해제 | O(1) |
| `hasBit(mask, id)` | id 위치 비트 검사 | O(1) |

### 배치 연산

| 함수 | 설명 | 복잡도 |
|---|---|---|
| `buildMask(size, ids)` | iterable의 모든 id를 setBit | O(|ids|) |
| `hasAnyBit(mask, ids)` | ids 중 하나라도 set이면 true | O(|ids|) |
| `hasAllBits(mask, ids)` | ids 전부 set이어야 true | O(|ids|) |
| `popcount(mask)` | set된 비트 수 반환 (Hamming weight) | O(size/8) |

### 마스크 대수 (Mask Algebra)

| 함수 | 설명 | 복잡도 |
|---|---|---|
| `maskAnd(a, b)` | 교집합 — 두 마스크 모두에 set된 비트 | O(size/8) |
| `maskOr(a, b)` | 합집합 — 어느 한쪽이라도 set된 비트 | O(size/8) |
| `masksOverlap(a, b)` | (a AND b) ≠ 0 이면 true | O(size/8) |

### 사용 예시

```ts
import { WeightedIndex } from "weighted-index";
import { createMask, setBit, hasBit, hasAnyBit, buildMask, popcount } from "weighted-index";

const wi = new WeightedIndex([8, 4, 5, 4]);  // resource×action×role×env

// 사용자 권한 마스크 구성
const mask = createMask(wi.size);
setBit(mask, wi.encode([3, 2, 4, 1]));  // database·write·admin·production

// O(1) 단일 권한 확인
const id = wi.encode([3, 2, 4, 1]);
console.log(hasBit(mask, id));  // true

// admin이 production에서 가진 모든 권한 ID → 일괄 확인
const adminProdIds = [];
for (let r = 1; r <= 8; r++)
  for (let a = 1; a <= 4; a++)
    adminProdIds.push(wi.encode([r, a, 4, 1]));

const hasAnyAdminProd = hasAnyBit(mask, adminProdIds);
console.log(popcount(mask));  // 설정된 권한 수
```

---

## 8. 에러 계층

```
WeightedIndexError (base)
├── ShapeError          # shape 정의 오류 (0 이하 차원, 빈 배열, 중복 ID 등)
├── CoordError          # encode 좌표가 유효하지 않음
├── IndexRangeError     # decode index가 [0, size-1] 범위 초과
├── BufferError         # decodeTo 버퍼가 shape.length보다 작음
├── LabelNotFoundError  # 등록되지 않은 레이블 이름
├── VersionNotFoundError# 등록되지 않은 버전
├── EntityNotFoundError # 등록되지 않은 entity ID 또는 index
├── PrefixNotFoundError # 등록되지 않은 prefix 이름
├── SerializeError      # 직렬화/역직렬화 형식 오류 (빈 컴포넌트, ":" 포함 등)
└── MigrateError        # migrator가 잘못된 좌표 배열 반환 (길이 불일치, 범위 초과, 소수 등)
```

모든 에러는 `instanceof WeightedIndexError`로 한 번에 포착 가능. `e.name` = 클래스 이름.

---

## 9. 검증 규칙

| 규칙 | 적용 대상 | 에러 |
|---|---|---|
| `":" 포함 불가` | prefix 이름, 버전 식별자 | `SerializeError` |
| `비어있지 않아야 함` | prefix 이름, 버전 식별자, shape, labels, ids, parse 각 컴포넌트 | `SerializeError` / `ShapeError` |
| `양의 정수` | shape 각 차원값 | `ShapeError` |
| `중복 버전 불가` | label 버전, prefix 버전 | `ShapeError` |
| `중복 entity ID 불가` | 동일 버전 내 ids (`-0`은 `0`으로 정규화 후 비교) | `ShapeError` |
| `좌표 범위 [1, shape[i]]` | migrate 반환 좌표 | `MigrateError` |

---

## 10. 공개 API (index.ts)

```ts
// 핵심 클래스
export { WeightedIndex }
export { LabelRegistry, createLabelRegistry }
export { PrefixRegistry }

// 계산 유틸리티 (calc.ts)
export { calcWeights, partialQueryBase, describeRangeFormula }

// 비트마스크 유틸리티 (bitmask.ts)
export { createMask, setBit, clearBit, hasBit }
export { buildMask, hasAnyBit, hasAllBits, popcount }
export { maskAnd, maskOr, masksOverlap }

// 난독화 유틸리티 (obfuscate.ts)
export { calcBitWidth }
export { xorObfuscate, rotateLeft, rotateRight, reverseBits }
export { compose }
export { toHex, fromHex, toUUID, fromUUID }

// 타입
export type { LabelVersionEntry, EntityId, InferLabelSchema }
export type { PrefixVersionEntry, PrefixDefinition, VersionedIndex, PrefixVersionDiff, CoordMigrator }
export type { ObfuscateTransform }

// 에러
export { WeightedIndexError, ShapeError, CoordError, IndexRangeError, BufferError }
export { LabelNotFoundError, VersionNotFoundError, EntityNotFoundError }
export { PrefixNotFoundError, SerializeError, MigrateError }
```

---

## 11. 사용 예시

```ts
import { createLabelRegistry, PrefixRegistry } from "weighted-index";

const labels = createLabelRegistry({
  role:   [{ version: "v1", ids: [1, 2, 3] }],
  action: [{ version: "v1", ids: ["read", "write"] }],
  api:    [{ version: "v1", ids: ["/posts", "/users"] }],
  tenant: [{ version: "v1", ids: [100, 200, 300] }],
});

const prefixes = new PrefixRegistry(labels, {
  api_perm: {
    labels: ["role", "action", "api", "tenant"],
    versions: [
      {
        version: "pv1",
        labelVersions: { role: "v1", action: "v1", api: "v1", tenant: "v1" },
      },
    ],
  },
});

// 인코딩
const vi = prefixes.encodeFromIds("api_perm", {
  role: 2, action: "write", api: "/posts", tenant: 200,
});
// { prefix: "api_perm", v: "pv1", id: 13 }

// 직렬화 (DB 저장)
const serialized = prefixes.serialize(vi);  // "api_perm:pv1:13"

// 역직렬화 + 디코딩
const ids = prefixes.decodeToIds(prefixes.parse(serialized));
// { role: 2, action: "write", api: "/posts", tenant: 200 }
```

### 마이그레이션 예시

```ts
// label version 업그레이드 후 prefix version 추가
const labelsV2 = createLabelRegistry({
  role: [
    { version: "v1", ids: [1, 2, 3] },
    { version: "v2", ids: [1, 2, 3, 4] }, // superadmin 추가
  ],
  // ...
});

const registryV2 = new PrefixRegistry(labelsV2, {
  api_perm: {
    labels: ["role", "action", "api", "tenant"],
    versions: [
      { version: "pv1", labelVersions: { role: "v1", ... } },
      { version: "pv2", labelVersions: { role: "v2", ... } }, // role → v2
    ],
  },
});

// DB에 저장된 pv1 데이터를 pv2 로 변환
const oldVi = registryV2.parse("api_perm:pv1:5");
const newVi = registryV2.migrate(oldVi, "pv2", (coords) => coords); // role ID 변화 없으면 그대로
```

### 에러 처리 예시

```ts
import { EntityNotFoundError, VersionNotFoundError, WeightedIndexError } from "weighted-index";

try {
  prefixes.encodeFromIds("api_perm", { role: 999, ... });
} catch (e) {
  if (e instanceof EntityNotFoundError) {
    // entity ID 가 등록되지 않은 경우
  } else if (e instanceof WeightedIndexError) {
    // 그 외 라이브러리 에러
  } else {
    throw e;
  }
}
```

---

## 12. 난독화 유틸리티 (obfuscate.ts)

WeightedIndex의 정수 ID를 전단사(bijection) 비트 변환으로 난독화하고, hex 또는 UUID-like 문자열로 직렬화하는 유틸리티.

**독립 모듈**: WeightedIndex 인스턴스에 의존하지 않음. `size` 또는 `bitWidth`만 알면 사용 가능.

### 사용 목적

| 목적 | 적합 여부 | 대안 |
|---|---|---|
| API 응답·URL에서 내부 인덱스 구조 숨기기 | ✅ | — |
| 순번 예측 방지 (sequential ID scraping 방어) | ✅ | — |
| 암호학적 보안, 위변조 방지 | ❌ | HMAC, AES 등 |
| 단방향 변환 (역변환 불필요) | ❌ | SHA-256 등 해시 |

> **판단 기준**: 받은 토큰을 원래 ID로 복원해야 하면 obfuscate, 복원이 필요 없으면 해시.

### 복호화 방법 관리

복호화에는 인코딩과 동일한 `bitWidth`·`key`·`amount`가 필요하다.

- **`bitWidth`** → `calcBitWidth(wi.size)`로 항상 재계산 가능. shape에서 유도되므로 별도 저장 불필요.
- **`key`, `amount`** → 별도 보관 필요. 잃으면 복원 불가.
- **shape 버전 변경** → `wi.size`가 바뀌면 `bitWidth`도 달라진다. 이전 버전으로 발급한 토큰과 호환되지 않으므로 버전 전환 시 토큰 재발급 전략이 필요하다.

WeightedIndex 인스턴스와 별도로 관리할 수도 있고, 인스턴스에 묶어 관리할 수도 있다. 어느 방식이든 `bitWidth`와 파라미터를 함께 보존하는 것이 핵심이다.

### 핵심 개념

- `bitWidth = calcBitWidth(size)` → size를 알면 항상 고정된 비트 폭 계산 가능
- 모든 변환은 **bijection**: `decode(encode(id)) === id` 보장
- 변환 결과는 `[0, 2^bitWidth - 1]` 범위 (size-1 초과 가능 — 유효 WeightedIndex ID 범위가 아닐 수 있음)
- ⚠️ **bitWidth ≤ 30**: JavaScript bitwise 연산은 32비트 정수 기준. 실제 권한·QA 인덱스 크기에서는 문제없으나, size가 2^30(약 10억)을 초과하는 경우 BigInt 변형이 필요하다.
- 암호학적 안전성 보장 없음. 단순 난독화 목적.

---

### `calcBitWidth`

```ts
calcBitWidth(size: number): number
// Math.max(1, Math.ceil(Math.log2(size)))
// e.g. size=640 → 10, size=1024 → 10, size=1025 → 11
```

---

### 변환 함수

| 함수 | 베리에이션 파라미터 | 설명 |
|---|---|---|
| `xorObfuscate(id, bitWidth, key)` | `key: number` (0 ~ 2^bitWidth−1) | XOR 마스킹. key를 bitWidth 이내로 마스킹 후 XOR. 자기 역원. |
| `rotateLeft(id, bitWidth, amount)` | `amount: number` | 왼쪽 순환 시프트. amount는 `mod bitWidth`로 정규화. 음수 허용. |
| `rotateRight(id, bitWidth, amount)` | `amount: number` | 오른쪽 순환 시프트. amount는 `mod bitWidth`로 정규화. 음수 허용. |
| `reverseBits(id, bitWidth)` | 없음 | 비트 순서 반전. 자기 역원(self-inverse). |

**amount 정규화 규칙**: `((amount % bitWidth) + bitWidth) % bitWidth`

- `0` 또는 `bitWidth`의 배수 → identity (no-op)
- `amount > bitWidth` → modulo 감소: `rotateLeft(id, 8, 9) === rotateLeft(id, 8, 1)`
- 음수 → 반대 방향과 동치: `rotateLeft(id, 8, -1) === rotateLeft(id, 8, 7) === rotateRight(id, 8, 1)`

### 역변환 대응

| 변환 | 역변환 |
|---|---|
| `xorObfuscate(id, w, key)` | 동일 함수 재적용: `xorObfuscate(obf, w, key)` |
| `rotateLeft(id, w, k)` | `rotateRight(obf, w, k)` |
| `rotateRight(id, w, k)` | `rotateLeft(obf, w, k)` |
| `reverseBits(id, w)` | `reverseBits(obf, w)` |

---

### 조합

```ts
type ObfuscateTransform = (id: number, bitWidth: number) => number;

// 변환을 순서대로 체인. 각 변환이 bijection이면 합성도 bijection.
compose(...transforms: ObfuscateTransform[]): ObfuscateTransform
```

역변환은 역순으로 각 역변환 적용:

```ts
// encode: reverseBits → rotateLeft(3) → xorObfuscate(key)
// decode: xorObfuscate(key) → rotateRight(3) → reverseBits
```

---

### 직렬화

| 함수 | 설명 |
|---|---|
| `toHex(id, bitWidth)` | `ceil(bitWidth / 4)` 자리 hex 문자열. zero-padded. |
| `fromHex(hex, bitWidth)` | hex 문자열 → 정수. 길이 검증 포함. |
| `toUUID(id, bitWidth)` | 128비트로 zero-padded 후 UUID 형식(`8-4-4-4-12`) 출력. |
| `fromUUID(uuid)` | UUID 형식 문자열 → 정수. 대시 제거 후 parseInt. |

```ts
// toHex 예시
// size=640 → bitWidth=10 → hexLen=3
toHex(255, 10)     // → "0ff"
fromHex("0ff", 10) // → 255

// bitWidth=1 (최솟값) → hexLen=1
toHex(1, 1)        // → "1"
fromHex("1", 1)    // → 1

// toUUID 예시 (id를 128비트 최하위에 배치)
toUUID(12345, 10) // → "00000000-0000-0000-0000-000000003039"
fromUUID("00000000-0000-0000-0000-000000003039") // → 12345
```

`fromHex`는 대소문자를 모두 허용한다 (`"0FF"` === `"0ff"`). 길이가 맞지 않으면 `RangeError`.

---

### 사용 예시

```ts
import { WeightedIndex } from "weighted-index";
import { calcBitWidth, xorObfuscate, rotateLeft, rotateRight, toHex, fromHex } from "weighted-index";

const wi = new WeightedIndex([5, 10, 4]);
const bitWidth = calcBitWidth(wi.size); // 200 → 8

const id = wi.encode([3, 7, 2]); // e.g. 65

// 단순 XOR
const obf = xorObfuscate(id, bitWidth, 0xA3);  // 0b01000001 ^ 0b10100011 = 0b11100010
const hex = toHex(obf, bitWidth);               // "e2"
const back = xorObfuscate(fromHex(hex, bitWidth), bitWidth, 0xA3); // → 65

// rotate + XOR 조합
const obf2 = xorObfuscate(rotateLeft(id, bitWidth, 3), bitWidth, 0xA3);
const back2 = xorObfuscate(rotateRight(obf2, bitWidth, 0xA3), bitWidth, 3); // ← 주의: 역순
```

---

### bijection 보장 조건 요약

- `xorObfuscate`: key 값에 무관하게 항상 bijection.
- `rotateLeft/Right`: `amount ∈ [1, bitWidth−1]`. `amount=0`은 항등 변환(허용하되 무의미).
- `reverseBits`: 항상 bijection.
- `compose`: 각 변환이 bijection이면 합성도 bijection.

### 주의

- 복호화에는 동일한 `bitWidth`와 파라미터(`key`, `amount`)가 필요. 이를 잃으면 복원 불가.
- `bitWidth`는 인덱스 생성 시점의 `size`에 묶여 있음. shape 변경(버전 업) 시 `bitWidth`도 재계산 필요.
