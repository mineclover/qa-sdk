# weighted-index 스펙

> 가중진법(weighted positional notation) 기반 다차원 인덱스 ↔ 정수 변환 라이브러리.
> 레이블 조합(역할, 액션, API, 테넌트 등)을 단일 정수 ID로 인코딩/디코딩하고, 버전 관리를 통해 DB 연결성을 유지한다.

패키지: `weighted-index`

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
  errors.ts          # 에러 클래스 계층
  validators.ts      # 공유 검증 유틸 (assertNoColon, assertPositiveInt, assertNonEmptyArray, formatList)
  weighted-index.ts  # 핵심 수학 엔진
  label-registry.ts  # 레이블 버전 관리
  prefix-registry.ts # 레이블 조합(prefix) + 버전 관리
  calc.ts            # 가중치·범위 쿼리 계산 유틸 (DOM 없음, 순수 함수)
  bitmask.ts         # 비트마스크 권한 연산 유틸 (DOM 없음, 순수 함수)
  index.ts           # 공개 API 재수출
```

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

// 타입
export type { LabelVersionEntry, EntityId, InferLabelSchema }
export type { PrefixVersionEntry, PrefixDefinition, VersionedIndex, PrefixVersionDiff, CoordMigrator }

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
