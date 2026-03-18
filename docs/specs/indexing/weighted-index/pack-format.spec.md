# pack-format 스펙

> ID 컨테이너 포맷 정의, 수평 확장 가능한 레지스트리, hex 직렬화, shape 용량 적합성 분석,
> 프로토콜 독립 SemanticAddress 표현, 양방향 프로토콜 변환.
> 인코딩 결과(정수)를 **어떤 크기·형식의 컨테이너에 담고, 어떤 프로토콜로 직렬화할 것인가**를 설계 시점에 결정하기 위한 도구.

패키지: `weighted-index`

> 수학 엔진은 [`core.spec.md`](core.spec.md), 근본 원리는 [`foundation.md`](../foundation.md)를 참조한다.
> 패키지 인덱스: [README.md](README.md)

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
4. **headroom 기반 capacity 제안** — 차원별 성장 패턴에 따른 여유 확보로 버전 업 빈도 최소화
5. **수평 확장** — 내장 포맷 외에 커스텀 포맷을 정의·등록하여 동일한 분석 경로를 적용

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

## 7. planCapacity — growth-aware capacity 제안

### 역할

차원별 현재 entry 수와 성장 힌트를 기반으로 **headroom이 포함된 최적 capacity**를 제안한다.
fitShape/fitLayout가 "초과 시 축소"를 담당한다면, planCapacity는 **"설계 시점에 적절한 여유를 확보"**를 담당한다.

### 근본 문제

capacity를 현재 entry 수에 딱 맞게 설정하면:
- entry 추가 시마다 version bump (shape 변경 → 모든 주소 재인코딩)
- 버전 관리 부담이 누적

planCapacity는 성장 패턴을 고려해 **한 번의 설정으로 오래 유지되는 capacity**를 추천한다.

### API

```ts
function planCapacity(opts: PlanCapacityOptions): CapacityPlanResult
```

### growth — 예상 추가 entry 수

추상적 배율이 아니라, 실제 enum을 정의해보고 예상되는 변동량을 직접 지정한다.

```ts
interface CapacityPlanDim {
  name: string;
  current: number;   // 현재 entry 수 (실제 열거한 항목 수)
  growth?: number;   // 예상 추가 entry 수. 미지정 시 current (= 2배 headroom)
}
```

| growth 값 | 의미 | 예시: current=5 | 결과 |
|---|---|---|---|
| 미지정 | current만큼 추가 (기본 2배) | 5+5=10 | 16 |
| `0` | 추가 없음 (tight fit) | 5+0=5 | 8 |
| `3` | 3개 추가 예상 | 5+3=8 | 8 |
| `50` | 대량 추가 예상 | 5+50=55 | 64 |

### 2의 거듭제곱 정렬

모든 추천값은 2의 거듭제곱(8, 16, 32, 64, 128, 256...)으로 정렬된다.
이유: hex 자릿수 경계와 자연스럽게 정렬되어 레이아웃이 깔끔하고, 한 단계 확장 시에도 hex 자릿수가 안정적으로 유지된다.

```
current=5, growing → 5×2=10 → nextPow2(10) = 16 (1 hex char)
current=20, growing → 20×2=40 → nextPow2(40) = 64 (2 hex chars)
current=100, growing → 100×2=200 → nextPow2(200) = 256 (2 hex chars)
```

### 포맷 초과 시 축소

추천 shape의 곱이 포맷 예산을 초과하면 `fitShape`로 축소하되, 각 차원의 current 이하로는 내려가지 않는다 (min 보호).

### 샤딩 권장

`growth / current > 1.0`인 차원이 하나라도 있으면 `shardingAdvised: true`를 반환한다.
예상 추가량이 현재 크기를 초과하는 차원은 변동성이 높으므로, 샤딩 레이어를 미리 레이아웃에 배치하는 것이 안정적이다.

### 사용 예시

```ts
// 실제로 열거해본 결과:
//   role: admin, editor, viewer, guest, moderator (5개, 3개 추가 예상)
//   action: read, write, delete, approve (4개, 거의 안 변함)
//   resource: articles, users, settings, billing (4개, 2개 추가 가능)

const plan = planCapacity({
  dims: [
    { name: "role",     current: 5, growth: 3 },   // 5+3=8  → 8
    { name: "action",   current: 4, growth: 0 },   // 4+0=4  → 4
    { name: "resource", current: 4, growth: 2 },   // 4+2=6  → 8
  ],
  left: [{ name: "prefix", chars: 4 }, { name: "version", chars: 2 }],
  capacity: "uuid",
});
// plan.shape = [8, 4, 8]
// plan.product = 256
// plan.fits = true
// plan.shardingAdvised = false (모든 growth/current ≤ 1.0)
// plan.dims[0].headroom = 0.375 (8-5)/8
```

### defineTable 연동 워크플로우

```
① planCapacity()로 최적 capacity 산출
     ↓
② defineTable()에 capacity 적용
     ↓
③ compileSchema()로 diff 확인
     ↓
④ 운영 중 entry가 capacity에 접근하면
   → planCapacity()를 다시 실행해 다음 capacity 산출
   → 새 version 추가 (기존 주소는 유지)
```

---

## 8. 테스트 커버리지 정의

각 API의 **근본적 목적**이 동작하는지 확인하기 위한 최소 필수 테스트 항목.

### 8.1 PackFormat / defineFormat

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

### 8.2 FormatRegistry

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

### 8.3 formatHex / parseHex

> 목적: 포맷별 dash 직렬화의 정확성과 round-trip 보장

| ID | 항목 | 검증 내용 |
|---|---|---|
| FH-1 | UUID 그룹 적용 | 32자 raw hex → `8-4-4-4-12` 형식 |
| FH-2 | 그룹 없는 포맷 | raw hex 그대로 반환 |
| FH-3 | 커스텀 그룹 | `groups: [4,4,4]` 12자 → `xxxx-xxxx-xxxx` |
| FH-4 | parseHex dash 제거 | dash 포함 문자열 → 연속 lowercase hex |
| FH-5 | parseHex 대소문자 | 대문자 입력 → 소문자 출력 |
| FH-6 | round-trip | `parseHex(formatHex(fmt, raw)) === raw.toLowerCase()` |

### 8.4 hexBoundary / hexCeil / hexFloor

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

### 8.5 fitShape

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

### 8.6 fitLayout

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

### 8.7 planCapacity

> 목적: growth 기반 headroom 제안이 정확하고 포맷 제약 내에서 동작

| ID | 항목 | 검증 내용 |
|---|---|---|
| PC-1 | 기본(growth 미지정) | current+current → nextPow2. 예: 5→16, 8→16 |
| PC-2 | growth=0 | current → nextPow2. 예: 5→8, 8→8 (추가 여유 없음) |
| PC-3 | 명시적 growth | current+growth → nextPow2. 예: 5+3=8→8, 3+10=13→16 |
| PC-4 | growth/current > 1.0 → shardingAdvised | 변동성 높은 dim 존재 시 true |
| PC-5 | 모두 growth/current ≤ 1.0 → no sharding | `shardingAdvised === false` |
| PC-6 | headroom 계산 | `(recommended - current) / recommended` |
| PC-7 | growth 입력값 반영 | dims[].growth에 입력값(또는 기본값) 포함 |
| PC-8 | 포맷 초과 시 축소 | fitShape 위임, current ≥ min 보장 |
| PC-9 | shardChars 영향 | shard 자릿수만큼 indexBudget 감소 |
| PC-10 | plan 포함 | 결과에 LayoutPlan(prefix, version, index 필드) 포함 |
| PC-11 | 빈 dims | shape=[], product=1, fits=true |
| PC-12 | hexChars 정보 | 각 dim의 recommended에 대한 hex 자릿수 포함 |
| PC-13 | 실제 enum 시나리오 | 권한 시스템 열거 → capacity → headroom 검증 |

---

## 9. SemanticAddress — 프로토콜 독립 정보 좌표

### 역할

`(schema, version, index)` 삼중항을 프로토콜 독립적으로 표현하고, 다양한 직렬화 프로토콜 간 변환을 수행한다.

`VersionedValue`와 `VersionedIndex`는 동일한 개념을 다른 필드명으로 표현한 것이다. 둘 다 weighted-index에서 정의되며(`VersionedValue`는 semantic-address, `VersionedIndex`는 prefix-registry), `SemanticAddress`는 이 둘의 프로토콜 독립 통합 표현이다.

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

## 10. createLayoutProtocol — hex container 프로토콜

### 역할

`PackFormat`을 기반으로 SemanticAddress를 hex container에 담는 `AddressProtocol`을 생성한다.
schema/version은 문자열 ↔ 숫자 매핑을 통해 hex 필드로 인코딩된다.

### 레이아웃 구조

```
[schema | version | ...gap... | index]
 ← left                    right →
```

left 필드(schema + version)는 char 0부터, right 필드(index)는 마지막 char부터 역방향으로 배치. 중간은 0으로 채움.

### API

```ts
function createLayoutProtocol(opts: LayoutProtocolOptions): AddressProtocol

interface LayoutProtocolOptions {
  format:       PackFormat;              // 컨테이너 포맷
  schemaChars:  number;                  // schema hex 자릿수
  versionChars: number;                  // version hex 자릿수
  schemas:      Record<string, number>;  // schema 이름 ↔ 숫자
  versions:     Record<string, number>;  // version 이름 ↔ 숫자
}
```

생성된 프로토콜의 `name`은 `"layout:{format.name}"` 형식.

### 테스트 커버리지

| ID | 항목 | 검증 내용 |
|---|---|---|
| LP-1 | UUID round-trip | serialize → parse가 원본 SemanticAddress 복원 |
| LP-2 | int64 round-trip | 16 hex chars, dash 없음, round-trip 성공 |
| LP-3 | custom groups | 커스텀 dash 패턴 적용, round-trip 성공 |
| LP-4 | test 감지 | UUID hex 패턴 인식, 텍스트 프로토콜 거부 |
| LP-5 | unknown schema 거부 | parse 시 매핑에 없는 schema 번호 → `SyntaxError` |
| LP-6 | unknown version 거부 | parse 시 매핑에 없는 version 번호 → `SyntaxError` |
| LP-7 | serialize unknown schema | 매핑에 없는 schema 이름 → `RangeError` |
| LP-8 | 용량 초과 | schema+version chars ≥ format.chars → `RangeError` |
| LP-9 | large index | 큰 index 값 round-trip 보존 |

---

## 11. AddressConverter — 통합 양방향 변환

### 역할

텍스트 프로토콜(colon, uri, compact)과 레이아웃 프로토콜(layout:uuid, layout:int64 등)을 하나의 인터페이스로 통합하여 모든 프로토콜 간 양방향 변환을 수행한다.

### API

```ts
class AddressConverter {
  register(protocol: AddressProtocol): this;
  get(name: string): AddressProtocol | undefined;
  require(name: string): AddressProtocol;
  protocols(): string[];
  parse(input: string): SemanticAddress;
  serialize(addr: SemanticAddress, protocolName: string): string;
  convert(input: string, to: string): string;
}

function createAddressConverter(): AddressConverter;
```

### 감지 우선순위

layout 프로토콜이 텍스트 프로토콜보다 먼저 시도된다 (hex 패턴이 compact의 dash 패턴과 겹칠 수 있으므로).

```
layout:* → uri → colon → compact
```

### 테스트 커버리지

> 목적: N개 프로토콜 간 N×N 양방향 변환의 정확성 보장

| ID | 항목 | 검증 내용 |
|---|---|---|
| AC-1 | 내장 프리로드 | `createAddressConverter().protocols()` → `["uri","colon","compact"]` |
| AC-2 | register 추가 | layout protocol 등록 후 `protocols()`에 포함 |
| AC-3 | text → text | colon↔uri, uri↔compact, compact↔colon 양방향 |
| AC-4 | text → layout | colon→uuid, uri→int64, compact→uuid 변환 |
| AC-5 | layout → text | uuid→colon, int64→uri, uuid→compact 변환 |
| AC-6 | layout → layout | uuid↔int64 양방향 |
| AC-7 | N×N round-trip | 5개 프로토콜 전체의 serialize→parse round-trip |
| AC-8 | chain round-trip | `colon→uuid→int64→uri→compact→colon` 체인 |
| AC-9 | 다중 schema | `doc:v2:100` 등 다른 schema/version round-trip |
| AC-10 | 다른 address 구분 | 다른 index → 다른 직렬화 결과 |
| AC-11 | 커스텀 format | `defineFormat` 커스텀 포맷으로 생성한 프로토콜 round-trip |

---

## 12. 외부 소비자: index-meta 통합 패턴

### 역할 분리

`weighted-index`는 순수 수학 + 직렬화 프로토콜을 제공하고, 상위 레이어(`index-meta`)가 스키마 의미 + 레지스트리 검증을 담당한다. 두 패키지의 책임은 명확히 분리된다:

```
weighted-index (이 패키지)
├── WeightedIndex            : 좌표 ↔ 정수 전단사 (Number, shape만 의존)
├── WeightedIndexBig         : 좌표 ↔ 정수 전단사 (BigInt, shape만 의존)
├── AddressConverter         : 프로토콜 변환 엔진
├── createLayoutProtocol     : hex 컨테이너 프로토콜 팩토리 (Number)
├── createLayoutProtocolBig  : hex 컨테이너 프로토콜 팩토리 (BigInt)
├── SemanticAddress          : 프로토콜 독립 좌표
└── fromVersionedValue       : VersionedValue ↔ SemanticAddress 어댑터

index-meta (외부 소비자)
├── MetaCodec.encode/decode        : 엔티티 ID ↔ VersionedValue (Number 경로)
├── MetaCodecBig.encode/decode     : 엔티티 ID ↔ VersionedValueBig (BigInt 경로)
├── MetaRegistry.serialize/parse   : AddressConverter에 위임 + 레지스트리 검증
├── MetaRegistry.serializeBig/parseBig : BigInt layout protocol + 검증
├── MetaRegistry.createCodec()     : Number 코덱 생성 (numberType guard)
├── MetaRegistry.createCodecBig()  : BigInt 코덱 생성
├── Capacity Guard                 : shape → numberType 자동 감지/검증
└── AddressConfig                  : layout 프로토콜 바인딩 설정
```

> **핵심 원칙**: `WeightedIndex`/`WeightedIndexBig`은 순수 수학이다 — 직렬화 포맷이나 `numberType`에 관여하지 않는다. Number/BigInt 엔진 선택과 포맷 적합성 판단은 상위 레이어(Capacity Guard)가 shape product를 사후 분석하여 수행한다.
> 검증: [`format-adapter.test.ts`](../../../../packages/weighted-index/src/format-adapter.test.ts) §1–§7

### 통합 흐름

index-meta의 `MetaRegistry`는 프로토콜 변환을 **자체 구현하지 않고** `AddressConverter`에 전적으로 위임한다. MetaRegistry가 추가하는 고유 가치는 **레지스트리 검증**(indexId/versionId 존재 확인, value 범위 검증)이다.

```ts
// MetaRegistry 내부 구조 (의사코드)
class MetaRegistry {
  private _converter: AddressConverter;  // weighted-index에서 가져옴

  constructor(input) {
    this._converter = createAddressConverter();          // text 프로토콜 기본 등록
    if (input.address) {
      this._converter.register(createLayoutProtocol({    // layout 프로토콜 추가
        format: input.address.format,
        schemas: input.address.schemas,
        versions: input.address.versions,
        ...
      }));
    }
  }

  serialize(vv, protocol?) {
    return this._converter.serialize(fromVersionedValue(vv), protocol);
  }

  parse(input, protocol?) {
    const addr = this._converter.parse(input);  // weighted-index가 파싱
    const vv = toVersionedValue(addr);
    this._validateRegistry(vv);                  // index-meta가 검증
    return vv;
  }
}
```

### AddressConfig를 통한 RDB PK 연동

`MetaRegistryInput.address`를 설정하면 VersionedValue를 UUID 등 고정 포맷 PK로 직렬화할 수 있다. 이 설정은 내부적으로 `createLayoutProtocol`에 전달된다.

```ts
import { MetaRegistry } from "index-meta";
import { PACK_FORMATS } from "weighted-index";

const registry = new MetaRegistry({
  dims: { /* ... */ },
  indices: { perm: { dims: ["role", "action"], versions: { v1: { /* ... */ } } } },
  address: {
    format: PACK_FORMATS.uuid,
    schemaChars: 4,
    versionChars: 2,
    schemas:  { perm: 1 },
    versions: { v1: 1 },
  },
});

// entity ID → UUID PK (codec.encode + serialize)
const codec = registry.createCodec("perm", "v1");
const pk = registry.serialize(codec.encode({ role: "admin", action: "read" }));
// → "00010001-0000-0000-0000-000000000000"

// UUID PK → entity ID (parse + codec.decode)
codec.decode(registry.parse(pk));
// → { role: "admin", action: "read" }

// 프로토콜 간 자유 변환 (converter 직접 사용)
registry.converter.convert(pk, "colon");  // → "perm:v1:0"
```

### 설계 원칙

1. **프로토콜 로직은 weighted-index에만 존재** — index-meta는 `AddressConverter`를 생성·등록만 하고, 직렬화/파싱 자체를 구현하지 않는다.
2. **레지스트리 검증은 index-meta에만 존재** — `parse()` 시 indexId/versionId 존재 여부와 value 범위를 검증하는 것은 MetaRegistry의 고유 책임이다.
3. **AddressConverter는 독립 사용 가능** — index-meta 없이도 `weighted-index`의 AddressConverter를 직접 사용하여 프로토콜 변환을 수행할 수 있다.

---

## 13. 모듈 관계

```
semantic-address.ts
  ├── AddressConverter, AddressProtocol
  ├── 텍스트 프로토콜 (colon, uri, compact)
  ├── createLayoutProtocol → formatHex/parseHex 사용
  └── SemanticAddress ↔ VersionedIndex / VersionedValue 어댑터
        │
pack-format.ts
  ├── PackFormat, FormatRegistry, defineFormat
  ├── formatHex / parseHex
  ├── hexBoundary / hexCeil / hexFloor
  ├── fitShape / fitLayout
  └── planLayout, charsForMax 사용 ──→ uuid-layout.ts
                                        ├── createUUIDLayout
                                        ├── packUUID / unpackUUID (UUID 전용 fast-path)
                                        └── UUIDLayout, LayoutPlan
```

| 모듈 | 관심사 |
|---|---|
| `uuid-layout` | 필드 위치 배정, UUID 전용 pack/unpack |
| `pack-format` | 포맷 정의, 적합성, shape 축소, hex 직렬화 |
| `semantic-address` | 프로토콜 독립 좌표 표현, 양방향 프로토콜 변환 |

`semantic-address`는 `pack-format` 위에 구축되며, `formatHex`/`parseHex`를 통해 레이아웃 프로토콜을 구현한다.
`pack-format`은 `uuid-layout` 위에 구축되며, `planLayout`/`charsForMax`를 통해 용량 분석을 수행한다.
`uuid-layout`의 `packUUID`/`unpackUUID`는 UUID 전용 fast-path로 유지한다.

---

## 14. 커스텀 포맷 등록 절차

> [`conventions.md`](../conventions.md) § 4에 표준화된 6단계 프로세스 정의.
> defineFormat → fitLayout → FormatRegistry → createLayoutProtocol → AddressConverter → round-trip 검증
