# pack-format 스펙

> ID 컨테이너 포맷 정의, 수평 확장 가능한 레지스트리, hex 직렬화, shape 용량 적합성 분석.
> 인코딩 결과(정수)를 **어떤 크기·형식의 컨테이너에 담을 것인가**를 설계 시점에 결정하기 위한 도구.

패키지: `weighted-index`

> 수학 엔진은 [`weighted-index.spec.md`](weighted-index.spec.md), 근본 원리는 [`foundation.md`](foundation.md)를 참조한다.
> 관심사 루트 문서: [`README.md`](README.md)

## 상태

implemented

---

## 근본 목표

WeightedIndex가 만들어내는 정수 ID는 그 자체로는 크기 제약이 없다.
그러나 실제 시스템에서는 이 ID를 **고정 크기 컨테이너**(UUID, 64-bit integer, ObjectId 등)에 담아 저장·전송해야 한다.

pack-format 모듈이 해결하는 문제:

1. **설계 시점 적합성 검증** — "이 shape의 곱이 UUID 32 hex chars에 들어가는가?"
2. **다중 포맷 동시 비교** — 하나의 shape에 대해 여러 컨테이너의 적합성을 한눈에 평가
3. **초과 시 자동 조정** — 들어가지 않을 때 비례 축소 + greedy fill로 최적 shape 추천
4. **수평 확장** — 내장 포맷 외에 커스텀 포맷을 정의·등록하여 동일한 분석 경로를 적용

---

## 1. PackFormat — 포맷 정의

### 역할

ID 컨테이너의 물리적 속성을 선언하는 불변 값 객체.

### 타입

```ts
interface PackFormat {
  readonly name:   string;            // 고유 식별 이름
  readonly chars:  number;            // hex 자릿수 (dash 제외)
  readonly bits:   number;            // = chars × 4
  readonly label:  string;            // 사람이 읽을 수 있는 설명
  readonly groups?: readonly number[]; // dash 그룹 크기 (합계 = chars)
}
```

### groups

dash-separated 출력 형식을 정의한다.

| 포맷 | groups | 출력 예시 |
|---|---|---|
| UUID | `[8, 4, 4, 4, 12]` | `abcd0100-0000-0000-0000-000000000042` |
| int64 | (없음) | `abcdef0123456789` |
| 커스텀 | `[4, 4, 4, 4, 4]` | `abcd-0100-0000-0000-0042` |

### defineFormat — 검증 팩토리

```ts
function defineFormat(opts: DefineFormatOptions): PackFormat
```

검증 규칙:
- `name` 비어있으면 `RangeError`
- `chars ≤ 0` 이면 `RangeError`
- `groups` 합계 ≠ `chars` 이면 `RangeError`
- `groups` 내 0 이하 값 포함 시 `RangeError`
- 결과는 `Object.freeze`로 불변

### 내장 포맷

```ts
const PACK_FORMATS = {
  int64:    { name: "int64",    chars: 16, bits:  64, label: "64-bit Integer" },
  objectId: { name: "objectId", chars: 24, bits:  96, label: "96-bit ObjectId" },
  uuid:     { name: "uuid",     chars: 32, bits: 128, label: "UUID (128-bit)",
              groups: [8, 4, 4, 4, 12] },
  sha1:     { name: "sha1",     chars: 40, bits: 160, label: "160-bit (SHA-1)" },
  sha256:   { name: "sha256",   chars: 64, bits: 256, label: "256-bit (SHA-256)" },
}
```

`PACK_FORMAT_LIST`: chars 오름차순 정렬된 읽기 전용 배열.

---

## 2. FormatRegistry — 수평 확장 레지스트리

### 역할

포맷 컬렉션을 관리한다. 내장 포맷을 기반으로 커스텀 포맷을 등록·조회·열거할 수 있다.

### 생성

```ts
// 내장 5개가 프리로드된 레지스트리
const reg = createFormatRegistry();

// 빈 레지스트리
const empty = new FormatRegistry();

// 특정 포맷만 포함
const minimal = new FormatRegistry([PACK_FORMATS.uuid, PACK_FORMATS.int64]);
```

### 공개 API

| 메서드 | 설명 |
|---|---|
| `register(format)` | 포맷 등록. 동일 이름이면 덮어쓴다. chainable. |
| `get(name)` | 이름으로 조회. 없으면 `undefined`. |
| `require(name)` | 이름으로 조회. 없으면 `RangeError`. |
| `has(name)` | 등록 여부 확인. |
| `remove(name)` | 포맷 제거. 내장 포맷도 제거 가능. |
| `list()` | chars 오름차순 정렬된 전체 목록. |
| `size` | 등록된 포맷 수. |
| `resolve(ref)` | 통합 해석 (아래 참조). |

### resolve — 유연한 용량 해석

| 입력 타입 | 동작 |
|---|---|
| `PackFormat` | 그대로 반환 (passthrough) |
| `string` | 레지스트리에서 이름으로 조회 (없으면 throw) |
| `number` | 해당 chars의 익명 포맷 자동 생성 |

### 확장 패턴

```ts
const reg = createFormatRegistry();
reg.register(defineFormat({ name: "cuid", chars: 20, label: "CUID" }));
reg.register(defineFormat({ name: "token96", chars: 24, label: "96-bit Token", groups: [8, 8, 8] }));

const fmt = reg.resolve("cuid");   // → PackFormat
const all = reg.list();            // → chars 오름차순 포맷 목록
```

---

## 3. formatHex / parseHex — 포맷별 직렬화

### 역할

raw hex 문자열과 dash-separated 포맷 문자열 간의 변환.
UUID 전용이었던 `packUUID`/`unpackUUID`를 포맷 독립적으로 일반화한 것.

### API

```ts
// groups 기반 dash 삽입
formatHex(format: PackFormat, rawHex: string): string

// dash 제거 + lowercase 정규화
parseHex(formatted: string): string
```

### 동작

- `format.groups`가 없거나 빈 배열이면 raw hex를 그대로 반환
- `format.groups`가 있으면 각 그룹 크기만큼 잘라서 `-`로 연결
- `parseHex`는 모든 `-`를 제거하고 소문자로 정규화. 포맷 객체 불필요.

---

## 4. hexBoundary / hexCeil / hexFloor — hex 자릿수 경계

### 역할

10진수 값이 hex 자릿수 경계에서 어떤 위치에 있는지 분석한다.
차원 크기를 설정할 때 "이 값은 몇 hex 자릿수를 소비하는가", "같은 자릿수로 최대 얼마까지 가능한가"를 답한다.

### hexBoundary

```ts
interface HexBoundary {
  value:       number;   // 입력값
  hexChars:    number;   // 필요 hex 자릿수
  hexMax:      number;   // 현재 자릿수 최댓값 (16^n - 1)
  hexCapacity: number;   // 현재 자릿수 슬롯 수 (16^n)
  utilization: number;   // value / hexCapacity
  nextHexMax:  number;   // 다음 자릿수 레벨 최댓값
}
```

### hexCeil / hexFloor

| 함수 | 설명 | 예시 |
|---|---|---|
| `hexCeil(v)` | v 이상의 첫 16^n 경계 | `hexCeil(1000) → 4096` |
| `hexFloor(v)` | v 이하의 마지막 16^n 경계 | `hexFloor(1000) → 256` |

---

## 5. fitShape — shape 용량 맞춤

### 역할

shape의 곱이 maxProduct를 초과할 때, 비례 축소 + greedy fill로 최대한 활용률을 높인 shape를 산출한다.

### API

```ts
function fitShape(opts: FitShapeOptions): FitShapeResult | null
```

이미 적합하면(곱 ≤ maxProduct) `null` 반환.

### 알고리즘

1. **비례 축소**: `ratio = (maxProduct / currentProduct) ^ (1 / freeDims)` → 각 dim에 floor 적용
2. **초과 보정**: floor 후에도 초과하면 가장 큰 free dim부터 1씩 감소
3. **greedy fill**: product ≤ maxProduct를 유지하면서 원본 값 이하로 dim을 1씩 증가. 원본이 큰 dim 우선.

### 옵션

| 옵션 | 설명 |
|---|---|
| `min` | 차원별 최솟값. 숫자 하나 = 전체 적용, 배열 = 개별 적용. |
| `fixed` | `Set<number>` — 이 인덱스의 차원은 축소하지 않음. |

### 불변식

- `result.product ≤ maxProduct` — 항상 보장
- `result.shape[i] ≤ shape[i]` — 원본 초과 없음
- `result.shape[i] ≥ min[i]` — 최솟값 준수
- `fixed`에 포함된 dim은 원본 그대로

---

## 6. fitLayout — shape + layout 통합

### 역할

fitShape + planLayout을 한 호출로 결합한다. 포맷, left 필드, shape을 입력하면 조정된 shape과 완성된 layout plan을 반환한다.

### API

```ts
function fitLayout(opts: FitLayoutOptions): FitLayoutResult | null
```

### capacity 해석

```ts
capacity: PackFormat | number | BuiltinFormatName
```

| 입력 | 동작 |
|---|---|
| `"uuid"` | 내장 이름 → `PACK_FORMATS.uuid` 조회 |
| `32` | 익명 128-bit 포맷 생성 |
| `defineFormat(...)` | 커스텀 포맷 직접 전달 |

### 반환값

```ts
interface FitLayoutResult extends FitShapeResult {
  plan:        LayoutPlan;    // planLayout 결과
  format:      PackFormat;    // 사용된 포맷
  indexBudget: number;        // index 필드에 사용 가능한 hex 자릿수
}
```

---

## 7. 테스트 커버리지 정의

각 API의 **근본적 목적**이 동작하는지 확인하기 위한 최소 필수 테스트 항목.

### 7.1 PackFormat / defineFormat

> 목적: 포맷 정의의 정합성 보장

| ID | 항목 | 검증 내용 |
|---|---|---|
| PF-1 | bits 자동 계산 | `bits === chars × 4` |
| PF-2 | groups 합 = chars | groups 합이 chars와 다르면 `RangeError` |
| PF-3 | groups 양수 검증 | 0 이하 그룹 값 → `RangeError` |
| PF-4 | chars 양수 검증 | `chars ≤ 0` → `RangeError` |
| PF-5 | name 필수 | 빈 문자열 → `RangeError` |
| PF-6 | 불변성 | 반환 객체 `Object.isFrozen === true` |
| PF-7 | groups 없는 포맷 | `groups` 미지정 → `undefined`, 기능 정상 |
| PF-8 | 내장 포맷 일관성 | `PACK_FORMAT_LIST` 전체에 대해 PF-1 검증 |

### 7.2 FormatRegistry

> 목적: 커스텀 포맷의 등록·조회·열거가 내장 포맷과 동일한 경로로 동작

| ID | 항목 | 검증 내용 |
|---|---|---|
| FR-1 | 내장 프리로드 | `createFormatRegistry().size === 5`, 모든 내장 이름 `has` 확인 |
| FR-2 | 커스텀 등록 | `register` 후 `get`으로 동일 객체 반환 |
| FR-3 | 등록 후 size 증가 | 커스텀 등록 → `size === 6` |
| FR-4 | 이름 중복 덮어쓰기 | 동일 이름 `register` → 마지막 포맷이 반환, `size` 불변 |
| FR-5 | remove | 삭제 후 `has === false`, `size` 감소 |
| FR-6 | list 정렬 | `list()` 결과가 `chars` 오름차순 |
| FR-7 | require 예외 | 미등록 이름 → `RangeError` |
| FR-8 | resolve — PackFormat | 객체 passthrough, 동일 참조 |
| FR-9 | resolve — string | 등록된 이름 → 해당 포맷 반환 |
| FR-10 | resolve — number | 숫자 → 익명 포맷, `chars`와 `bits` 일치 |
| FR-11 | resolve — 미등록 string | `RangeError` |
| FR-12 | 빈 레지스트리 | `new FormatRegistry()` → `size === 0`, `list() === []` |

### 7.3 formatHex / parseHex

> 목적: 포맷별 dash 직렬화의 정확성과 round-trip 보장

| ID | 항목 | 검증 내용 |
|---|---|---|
| FH-1 | UUID 그룹 적용 | 32자 raw hex → `8-4-4-4-12` 형식 |
| FH-2 | 그룹 없는 포맷 | raw hex 그대로 반환 |
| FH-3 | 커스텀 그룹 | `groups: [4,4,4]` 12자 → `xxxx-xxxx-xxxx` |
| FH-4 | parseHex dash 제거 | dash 포함 문자열 → 연속 lowercase hex |
| FH-5 | parseHex 대소문자 | 대문자 입력 → 소문자 출력 |
| FH-6 | round-trip | `parseHex(formatHex(fmt, raw)) === raw.toLowerCase()` |

### 7.4 hexBoundary / hexCeil / hexFloor

> 목적: 10진수 값의 hex 자릿수 경계 분석이 정확

| ID | 항목 | 검증 내용 |
|---|---|---|
| HB-1 | 경계 정확값 | `hexBoundary(16).hexChars === 1`, `utilization === 1.0` |
| HB-2 | 경계 직후 | `hexBoundary(17).hexChars === 2` |
| HB-3 | nextHexMax | `hexBoundary(1000).nextHexMax === 65535` |
| HB-4 | 0 이하 clamp | `hexBoundary(0).value === 1` |
| HC-1 | hexCeil 경계값 | `hexCeil(16) === 16` |
| HC-2 | hexCeil 비경계 | `hexCeil(17) === 256` |
| HF-1 | hexFloor 경계값 | `hexFloor(256) === 256` |
| HF-2 | hexFloor 비경계 | `hexFloor(1000) === 256` |

### 7.5 fitShape

> 목적: 용량 초과 shape을 축소했을 때 불변식 보장

| ID | 항목 | 검증 내용 |
|---|---|---|
| FS-1 | 이미 적합 → null | `product ≤ maxProduct` 일 때 `null` 반환 |
| FS-2 | 곱 상한 보장 | `result.product ≤ maxProduct` |
| FS-3 | 원본 이하 보장 | `result.shape[i] ≤ shape[i]` |
| FS-4 | 활용률 > 0.9 | 충분한 budget일 때 greedy fill이 90% 이상 채움 |
| FS-5 | min 준수 | `min: 5` → 모든 dim ≥ 5 |
| FS-6 | fixed dim 불변 | `fixed` 포함 dim은 원본 값 유지 |
| FS-7 | 단일 dim | 1차원 shape → 정확히 maxProduct으로 cap |
| FS-8 | 빈 shape → null | `shape: []` → `null` |
| FS-9 | fixed 단독 초과 → null | fixed dim 곱만으로 초과 시 `null` |
| FS-10 | boundaries 포함 | 결과에 각 dim의 `HexBoundary` 포함, 길이 = shape.length |

### 7.6 fitLayout

> 목적: shape + layout 통합 경로에서 포맷 해석과 plan 생성이 정확

| ID | 항목 | 검증 내용 |
|---|---|---|
| FL-1 | 내장 이름 해석 | `capacity: "int64"` → `result.format.name === "int64"` |
| FL-2 | PackFormat 전달 | 커스텀 포맷 객체 → `result.format` 동일 참조 |
| FL-3 | 숫자 전달 | `capacity: 16` → `result.format.chars === 16` |
| FL-4 | indexBudget 계산 | `format.chars - sum(left.chars) === indexBudget` |
| FL-5 | left 초과 → null | left 필드가 capacity 전체 소비 → `null` |
| FL-6 | 이미 적합 시 plan | shape이 이미 들어갈 때도 plan 포함 |
| FL-7 | 포맷 간 비교 | 같은 shape에 `int64` vs `uuid` → uuid가 더 큰 product |
| FL-8 | plan.layout 존재 | UUID 적합 시 `plan.layout` 정의됨 |
| FL-9 | format 반환 | 결과에 사용된 `format` 객체 포함 |

---

## 8. SemanticAddress — 프로토콜 독립 정보 좌표

### 역할

`(schema, version, index)` 삼중항을 프로토콜 독립적으로 표현하고, 다양한 직렬화 프로토콜 간 변환을 수행한다.

기존의 `VersionedIndex`(prefix-registry)와 `VersionedValue`(index-meta)는 동일한 개념을 다른 필드명으로 표현한 것이다. `SemanticAddress`는 이 둘의 통합 표현.

### 타입

```ts
interface SemanticAddress {
  readonly schema:  string;  // = prefix / indexId
  readonly version: string;  // = v / versionId
  readonly index:   number;  // = id / value
}

interface AddressProtocol {
  readonly name: string;
  test(input: string): boolean;
  serialize(addr: SemanticAddress): string;
  parse(input: string): SemanticAddress;
}
```

### 내장 프로토콜

| 프로토콜 | 형식 | 예시 | 용도 |
|---|---|---|---|
| `colonProtocol` | `schema:version:index` | `perm:v1:42` | DB 저장, 기존 호환 |
| `uriProtocol` | `wi://schema/version/index` | `wi://perm/v1/42` | 정보 좌표 URI |
| `compactProtocol` | `schema-version-index` | `perm-v1-42` | URL path, 파일명 |

### API

| 함수 | 설명 |
|---|---|
| `parseAddress(input)` | 자동 감지 파싱 (URI → colon → compact 순서) |
| `serializeAddress(addr, protocol)` | 지정 프로토콜로 직렬화 |
| `convertAddress(input, toProtocol)` | 프로토콜 간 변환 |
| `fromVersionedIndex(vi)` | `{ prefix, v, id }` → SemanticAddress |
| `toVersionedIndex(addr)` | SemanticAddress → `{ prefix, v, id }` |
| `fromVersionedValue(vv)` | `{ indexId, versionId, value }` → SemanticAddress |
| `toVersionedValue(addr)` | SemanticAddress → `{ indexId, versionId, value }` |

### 테스트 커버리지

> 목적: 프로토콜 간 round-trip과 기존 타입 호환성 보장

| ID | 항목 | 검증 내용 |
|---|---|---|
| SA-1 | colon round-trip | `parse(serialize(addr)) === addr` |
| SA-2 | uri round-trip | `parse(serialize(addr)) === addr` |
| SA-3 | compact round-trip | `parse(serialize(addr)) === addr` |
| SA-4 | auto-detect colon | `parseAddress("perm:v1:42")` → colon 프로토콜로 감지 |
| SA-5 | auto-detect uri | `parseAddress("wi://perm/v1/42")` → uri 프로토콜로 감지 |
| SA-6 | auto-detect compact | `parseAddress("perm-v1-42")` → compact 프로토콜로 감지 |
| SA-7 | 3 프로토콜 동치 | 세 프로토콜의 parse 결과가 동일한 SemanticAddress |
| SA-8 | cross-convert | `colon → uri → compact → colon` round-trip |
| SA-9 | VersionedIndex 호환 | `toVersionedIndex(fromVersionedIndex(vi)) === vi` |
| SA-10 | VersionedValue 호환 | `toVersionedValue(fromVersionedValue(vv)) === vv` |
| SA-11 | compact dash 포함 schema | `"api-perm-v1-42"` → `schema="api-perm"` |
| SA-12 | malformed 거부 | 각 프로토콜이 잘못된 입력에 `SyntaxError` |
| SA-13 | 미인식 형식 | `parseAddress("???")` → `SyntaxError` |

---

## 9. uuid-layout과의 관계

| 모듈 | 관심사 | 의존 방향 |
|---|---|---|
| `uuid-layout` | 필드 위치 배정, pack/unpack | ← pack-format이 참조 |
| `pack-format` | 포맷 정의, 적합성, shape 축소 | → uuid-layout의 `planLayout`, `charsForMax` 사용 |

`pack-format`은 `uuid-layout` 위에 구축되며, UUID뿐 아니라 모든 hex 기반 포맷에 적용되는 상위 추상이다.
`uuid-layout`의 `packUUID`/`unpackUUID`는 UUID 전용 fast-path로 유지하되, 포맷 독립적 경로는 `formatHex`/`parseHex`를 사용한다.
