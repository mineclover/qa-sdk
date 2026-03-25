---
def:
  id: indexing-conventions
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: deprecated
---
# 인덱싱 시스템 관례

## 목적 ^purpose

`weighted-index`와 `index-meta`를 사용하는 프로젝트에서 따라야 하는 규칙.
기반 원리는 [`foundation.md`](foundation.md), 사용 패턴은 [`patterns.md`](patterns.md)를 참조한다.

---

## 1. ID 네이밍 제약

`VersionedValue`의 직렬화 형식이 `"{indexId}:{versionId}:{value}"`이므로, `:` 문자는 구분자로 예약되어 있다.

**규칙**: `dimId`, `snapshotId`, `indexId`, `versionId` 모두 `:` 문자를 포함할 수 없다.

```ts
// ✅ 유효
"perm", "iv1", "role", "v2"

// ❌ ValidationError
"ro:le", "v:1", "pe:rm", "iv:1"
```

MetaRegistry 생성자에서 강제한다. `:` 가 포함되면 `ValidationError`.

> **이유**: 직렬화 형식 `"{indexId}:{versionId}:{value}"`의 파싱은 마지막 두 콜론을 구분자로 사용한다. `indexId`는 콜론을 포함할 수 있지만, `versionId`에 콜론이 있으면 `parse()` 시 잘못된 분리가 발생한다. 생성자에서 모든 ID의 콜론을 금지해 이 문제를 원천 차단한다.

---

## 2. 예약 항목(Reserved Entry)

> 상세 스펙: [`slot-marker.spec.md`](slot-marker.spec.md) — 설계 원리, 테스트 코드, 수집 전략, 용량 영향.

entries에 **슬롯 마커(slot marker)**를 포함하여 "값 없음", "분류 불가", "선택하지 않음" 같은 열린 상황을 닫힌 패턴의 주소 공간 안에서 표현한다. 시스템은 마커를 특별 취급하지 않으며, 의미 해석은 도메인 레이어의 책임이다.

### 표준 토큰

**`string_enum`** — 예약어이므로 정규 도메인 값으로 사용 금지:

| 토큰 | 역할 | 의미 |
|---|---|---|
| `"_"` | **null** | 값 없음, 미결정, 해당 없음, 선택하지 않음 |
| `"~"` | **other** | 정의된 카테고리에 해당하지 않음, 마이그레이션 과도기 버퍼 |
| `"?"` | **unknown** | 값이 존재하지만 식별 불가, 파싱 실패 |

**`number_enum`**: `"NaN"` (숫자가 아닌 값). position만 예외적으로 문자열 저장.

**커스텀 마커**: 표준 토큰 외 추가 가능. `description`에 의미를 명시해야 한다.

### 규칙

1. **명시적 선언**: dim의 `description`에 `reserved: [position]=token (설명)` 형식으로 선언. 선언 없으면 예약 항목 없음.
2. **선두 배치**: 마커는 entries 배열 앞쪽에 배치. 순서: `"_"` → `"~"` → `"?"` → 커스텀 → 정규 엔티티.
3. **프로젝트 전체 일관성**: 동일한 의미에 동일한 토큰. dim마다 다른 표기 금지.
4. **코덱 투명성**: 코덱에 마커 특별 처리 로직 삽입 금지.

### 선언 예시

```ts
// null + other 허용
category: {
  kind: { type: "string_enum" },
  description: 'reserved: [1]="_" (미분류), [2]="~" (기타)',
  snapshots: {
    v1: { entries: ["_", "~", "tech", "science", "art"] },
  },
}

// 예약 항목 없음 — 값은 반드시 정규 도메인 값
role: {
  kind: { type: "string_enum" },
  snapshots: {
    v1: { entries: ["admin", "editor", "viewer"] },
  },
}
```

### 소비자 판단 절차

1. `description`에 `reserved:` 선언이 있는지 확인.
2. **있으면**: 선언된 position과 토큰으로 예약 항목 식별.
3. **없으면**: 모든 entry가 정규 도메인 값. 값 없이 encode할 수 없으므로 호출자가 에러 처리.

---

## 3. EntityId 정규화

- `-0`은 `0`으로 정규화된다. `entries` 배열에 저장될 때와 `idToIndex` Map에 등록될 때 모두 `0`으로 변환된다. `getDimSnapshot().entries`에서 `-0`이 반환되는 일은 없다.
- `-0`과 `0`은 같은 EntityId로 취급되므로 동일 snapshot에 함께 존재하면 `ValidationError`.
- 동일 snapshot 내 중복 EntityId는 `ValidationError`.

---

## 4. 커스텀 PackFormat 등록 절차

새 ID 컨테이너 포맷을 추가할 때 따라야 하는 표준 프로세스.

> 관련 스펙: [`weighted-index/pack-format.spec.md`](weighted-index/pack-format.spec.md)

### 4.1 포맷 정의

`defineFormat`으로 검증된 `PackFormat` 객체를 생성한다.

```ts
import { defineFormat } from "weighted-index";

const myFormat = defineFormat({
  name:   "cuid",           // 고유 식별 이름 (FormatRegistry 키)
  chars:  24,               // hex 자릿수 (dash 제외)
  label:  "CUID (96-bit)",  // 사람이 읽을 수 있는 설명
  groups: [8, 8, 8],        // dash 그룹 (선택, 합계 = chars)
});
```

**검증 규칙 (defineFormat이 강제)**:
- `name` 비어있으면 `RangeError`
- `chars ≤ 0` 이면 `RangeError`
- `groups` 합계 ≠ `chars` 이면 `RangeError`
- `groups` 내 0 이하 값이면 `RangeError`

### 4.2 체크리스트

| 단계 | 확인 사항 | 도구 |
|---|---|---|
| ① 용량 산정 | 현재 shape의 곱이 포맷에 들어가는가? | `fitLayout({ shape, left, capacity: myFormat })` |
| ② 필드 배치 | prefix + version + index가 chars 이내인가? | `planLayout()` 결과의 `totalChars` 확인 |
| ③ 포맷 등록 | `FormatRegistry`에 등록 | `reg.register(myFormat)` |
| ④ 프로토콜 생성 | 양방향 직렬화가 필요하면 layout protocol 생성 | `createLayoutProtocol({ format: myFormat, ... })` |
| ⑤ 변환기 등록 | `AddressConverter`에 프로토콜 등록 | `conv.register(layoutProtocol)` |
| ⑥ round-trip 검증 | 모든 등록 프로토콜과의 양방향 변환 확인 | `conv.convert(input, "layout:cuid")` round-trip |

### 4.3 전체 예시

```ts
import {
  defineFormat,
  createFormatRegistry,
  createLayoutProtocol,
  createAddressConverter,
  fitLayout,
  PACK_FORMATS,
} from "weighted-index";

// ── ① 포맷 정의 ──
const cuidFormat = defineFormat({
  name: "cuid", chars: 24, label: "CUID (96-bit)", groups: [8, 8, 8],
});

// ── ② 용량 검증 ──
const fit = fitLayout({
  shape: [100, 50, 20, 10],
  left:  [{ name: "prefix", chars: 4 }, { name: "version", chars: 2 }],
  capacity: cuidFormat,
});
// fit.indexBudget = 18, fit.product ≤ 16^18 → 충분

// ── ③ 포맷 레지스트리 등록 ──
const reg = createFormatRegistry();
reg.register(cuidFormat);
// reg.list()에서 chars 오름차순으로 cuid가 포함됨

// ── ④ 프로토콜 생성 ──
const cuidProto = createLayoutProtocol({
  format: cuidFormat,
  schemaChars: 4,
  versionChars: 2,
  schemas:  { perm: 1, doc: 2 },
  versions: { v1: 1, v2: 2 },
});

// ── ⑤ 변환기 등록 ──
const conv = createAddressConverter();
conv.register(cuidProto);

// ── ⑥ 양방향 검증 ──
const addr = { schema: "perm", version: "v1", index: 42 };
const cuid  = conv.serialize(addr, "layout:cuid");
// → "00010100-00000000-0000002a"
const colon = conv.convert(cuid, "colon");
// → "perm:v1:42"
const back  = conv.convert(colon, "layout:cuid");
// → "00010100-00000000-0000002a" (원본과 동일)
```

### 4.4 이름 규칙

| 대상 | 규칙 | 예시 |
|---|---|---|
| `PackFormat.name` | lowercase, 하이픈 허용, 고유 | `"cuid"`, `"token-48"` |
| `AddressProtocol.name` | layout protocol은 `"layout:{format.name}"` 자동 생성 | `"layout:cuid"` |
| `FormatRegistry` 키 | `PackFormat.name`과 동일 | `reg.get("cuid")` |

### 4.5 groups 설계 가이드

| 상황 | groups 설정 | 이유 |
|---|---|---|
| 내부 DB 저장 전용 | 생략 (연속 hex) | 가독성 불필요, 파싱 단순 |
| API 응답, 외부 노출 | 4~8자 단위 그룹 | 사람이 구분 가능 |
| UUID 호환 필요 | `[8, 4, 4, 4, 12]` 고정 | RFC 4122 준수 |
| 고정 필드 시각화 | 필드 크기에 맞춤 | 예: prefix=4, ver=2, idx=6 → `[4, 2, 6]` |

---

## 5. Snapshot Supply — entry 버전 공급 전략

> 근거: [`foundation.md`](foundation.md) §2–§3, [`version-operations.md`](../indexing/version-operations.md)

### 5.1 문제

서비스가 배포되면 특정 시점의 entry set으로 주소를 인코딩한다. 이후 entry가 append되면 새 배포는 확장된 entry set을 사용한다. **"이 주소가 어느 시점의 entry set으로 만들어졌는가"**를 추적하는 것이 entry snapshot이다.

```
배포 시점 1 (s1): role entries = ["admin", "editor", "viewer"]
배포 시점 2 (s2): role entries = ["admin", "editor", "viewer", "auditor"]
                                                                 ↑ append

stride 동일 (capacity headroom 내). v 세그먼트 변경 없음.
그러나 s1과 s2는 "유효한 entries 범위"가 다르다.
```

### 5.2 전략 정의

snapshot 정보를 **어디에 두느냐**는 prefix별로 선택 가능하다.

```typescript
type SnapshotSupply =
  | { type: "axis";     capacity: number }   // index 안에 축으로 인코딩
  | { type: "envelope" }                     // TransmissionEnvelope 메타에 태깅
  | { type: "context" }                      // address_context에 별도 키로
  | { type: "implicit" }                     // 추적 안 함, 항상 최신
```

### 5.3 전략별 상세

#### `axis` — index 안에 인코딩

`schema_version` 축을 composite의 **첫 번째 차원**에 추가한다. snapshot ID가 주소 정수 안에 포함되므로 자기 설명적이다.

```
dims = [schema_version, perm_svc, role]
capacity = [32, 10, 7]
stride = [70, 7, 1]

encode(s2, svc=5, role=3) = (2-1)×70 + (5-1)×7 + (3-1) = 100
주소: permission:v1:100
디코드: 100 → [s2, svc5, role3]  ← snapshot 자동 복원
```

| 특성 | |
|---|---|
| calcAddressRanges 필터 | 네이티브 — `{ positions: [1, 2] }` 로 s1+s2 동시 쿼리 |
| 자기 설명적 | ✓ 주소만으로 snapshot 복원 |
| address space 비용 | ×capacity (예: ×32) |
| 용도 | 크로스-버전 분석, 고빈도 축별 쿼리 |

**schema_version 축 규약:**
- 첫 번째 차원 (stride 최대 → 같은 version 주소가 연속 범위 → DB BETWEEN 유리)
- capacity 32 (32회 entry 변경까지 세대 교체 불필요)
- entry 네이밍: `"s1"`, `"s2"`, `"s3"`, ... (monotonic)

#### `envelope` — 엔벨로프 메타에 태깅

TransmissionEnvelope에 `entry_snapshot` 필드를 추가한다. 주소 자체에는 snapshot 정보가 없다.

```
dims = [perm_svc, role]
capacity = [10, 7]
stride = [7, 1]

encode(svc=5, role=3) = (5-1)×7 + (3-1) = 30
주소: permission:v1:30
엔벨로프: { entry_snapshot: "s2", records: [...] }
```

| 특성 | |
|---|---|
| calcAddressRanges 필터 | 불가 — 별도 WHERE 조건 필요 |
| 자기 설명적 | ✗ 엔벨로프 없이 snapshot 알 수 없음 |
| address space 비용 | 0 |
| 용도 | 수집/감사 로그, 이력 추적 |

#### `context` — address_context에 별도 키

주소와 함께 address_context에 `.snapshot` 접미 키로 저장한다.

```
주소: permission:v1:30
address_context: {
  "permission": "permission:v1:30",
  "permission.snapshot": "s2"
}
```

| 특성 | |
|---|---|
| calcAddressRanges 필터 | 불가 — JSONB WHERE 필요 |
| 자기 설명적 | △ address_context 있으면 복원 가능 |
| address space 비용 | 0 |
| 용도 | 혼합 워크로드 (일부 레코드만 snapshot 추적) |

#### `implicit` — 추적 안 함

snapshot 정보를 어디에도 저장하지 않는다. 디코드 시 항상 최신 entries 기준.

```
주소: permission:v1:30
snapshot 정보 없음
```

| 특성 | |
|---|---|
| calcAddressRanges 필터 | 불가 |
| 자기 설명적 | ✗ |
| address space 비용 | 0 |
| 용도 | 내부 도구, 개발 환경, snapshot 구분 불필요한 경우 |

### 5.4 전략 비교 요약

```
                  axis          envelope      context       implicit
───────────────────────────────────────────────────────────────────
snapshot 위치     index 안       envelope      address_ctx    없음
stride 영향      ×capacity      없음          없음           없음
Range Query      네이티브       별도 WHERE    별도 WHERE     불가
자기 설명적      ✓              ✗             △              ✗
wire 비용        address ↑      필드 1개      필드 1개       0
```

### 5.5 주소 형식 (공통)

모든 전략에서 주소 3세그먼트 형식은 동일하다:

```
{prefix} : {v} : {index}
   │        │      │
   │        │      └ 1D 정수 (axis 전략이면 schema_version 포함)
   │        └ stride를 확정한 version (v1, v3 등 — 기존 version ID)
   └ composite ID
```

`v` 세그먼트는 **stride가 변경된 version**이다. 별도 "generation ID"를 만들지 않고 기존 version ID(v1, v2, v3, ...)를 그대로 사용한다:

```
v1 생성 → stride 확정 → v = "v1"
v2 생성 → stride 동일 → v = "v1" (변경 없음)
v3 생성 → stride 변경 → v = "v3"
v4 생성 → stride 동일 → v = "v3" (변경 없음)
```

### 5.6 prefix는 capacity/stride를 동반 저장

모든 전략에서 공통. prefix 등록 시 capacity/stride 배열이 함께 저장된다. v 세그먼트만으로 stride를 조회할 수 있고, stride가 있으면 index를 디코드할 수 있다.

```typescript
{
  prefix: "perm",
  v: "v1",                              // stride를 확정한 version
  dims: ["perm_svc", "role"],           // axis 전략이면 ["schema_version", "perm_svc", "role"]
  capacity: [10, 7],                    // axis 전략이면 [32, 10, 7]
  stride: [7, 1],                       // axis 전략이면 [70, 7, 1]
  snapshotSupply: { type: "envelope" }, // 이 prefix의 전략
}
```

### 5.7 composite에 전략 설정

SchemaSnapshot의 composite 정의에 `snapshotSupply`를 명시한다:

```json
{
  "id": "k8s-dsl-v1",
  "axes": [
    { "id": "schema_version", "entries": ["s1"], "capacity": 32 },
    { "id": "k8s_cluster", "entries": ["prod-east", "staging"], "capacity": 32 },
    { "id": "k8s_service", "entries": ["gateway"], "capacity": 256 }
  ],
  "composites": [
    {
      "id": "k8s_workload_addr",
      "dims": ["k8s_cluster", "k8s_service"],
      "owner": "k8s-dsl-v1",
      "snapshotSupply": { "type": "envelope" }
    },
    {
      "id": "apm_signal",
      "dims": ["schema_version", "signal_type", "severity"],
      "owner": "k8s-dsl-v1",
      "snapshotSupply": { "type": "axis", "capacity": 32 }
    }
  ]
}
```

- `axis` 전략인 composite만 `schema_version`을 dims에 포함
- `schema_version` 축은 axes에 한번만 정의, 여러 composite이 공유 가능
- 전략이 명시되지 않으면 `implicit`로 간주

### 5.8 파이프라인 처리

```
Phase 1 ingest:
  snapshotSupply 확인 (prefix 메타) →
    axis     : 이미 index에 포함, 추가 처리 없음
    envelope : envelope.entry_snapshot → record 메타에 복사
    context  : address_context에서 .snapshot 키 검증
    implicit : skip

Query / Range Query:
    axis     : calcAddressRanges에 schema_version constraint 포함
    envelope : WHERE entry_snapshot = 's2' 별도 조건
    context  : WHERE address_context->>'prefix.snapshot' = 's2'
    implicit : snapshot 필터 불가
```

### 5.9 도입 시 체크리스트

| 단계 | axis | envelope | context | implicit |
|---|---|---|---|---|
| ① capacity 산정 | schema_version(32) 포함 Π < 2^53 | 변경 없음 | 변경 없음 | 변경 없음 |
| ② dims 구성 | schema_version 첫 번째 | 변경 없음 | 변경 없음 | 변경 없음 |
| ③ codegen | PREFIXES에 schema_version 포함 stride | PREFIXES에 snapshotSupply 명시 | 동일 | 동일 |
| ④ PartialBinder | boot-time에 schema_version 고정 | boot-time에 entry_snapshot 설정 | — | — |
| ⑤ 쿼리 | calcAddressRanges constraint | 별도 WHERE 조건 | JSONB 조건 | — |

---

## 6. 가속 지향 설계 규칙

> 근거: [`acceleration.md`](acceleration.md) — 하드웨어 가속 비전

인덱싱 시스템의 연산 특성이 하드웨어 가속에 적합한 상태를 유지하기 위한 규칙이다. 이 규칙은 FPGA 없이도 CPU 성능 최적화에 유효하다.

### 5.1 encode/decode에 분기를 넣지 않는다

WeightedIndex.encode/decode는 순수 곱셈/나눗셈/모듈러 연산이다. 조건 분기, 예외 처리, 동적 dispatch를 연산 경로에 삽입하면 가속 적합성이 깨진다.

**규칙**: 검증은 encode/decode 진입 전에 수행한다. 연산 경로 자체는 분기 없는 산술만.

```ts
// ✅ 검증 후 산술
this._validateCoords(coords);  // 경계 검사 (encode 전)
return this._encodeCore(coords); // 순수 산술 (분기 없음)

// ❌ 산술 중 검증
for (let i = 0; i < d; i++) {
  if (coords[i] < 1 || coords[i] > shape[i]) throw ...; // 연산 경로에 분기
  result += (coords[i] - 1) * weights[i];
}
```

### 5.2 shape/weights/entries 불변성을 깨지 않는다

shape 확정 후 weights는 `Object.freeze`된 배열이다. entries 확정 후 LabelRegistry는 불변 Map이다. 이 불변성이 캐시 안전성, 병렬 접근 안전성, FPGA configuration 안정성의 기반이다.

**규칙**: 런타임에 shape이나 entries를 변경하지 않는다. 변경이 필요하면 새 version을 생성한다.

### 5.3 정규화된 정수만 하위 레이어에 전달한다

문자열 → 정수 변환(Axis Normalize)은 스키마 레이어에서 완결한다. 수학 레이어는 정수 좌표만 받는다. 이 경계가 CPU/가속기 경계와 일치한다.

**규칙**: WeightedIndex, calc, bitmask 등 수학 유틸은 문자열 입력을 받지 않는다. 문자열 처리가 필요하면 상위 레이어(MetaCodec, LabelRegistry)에서 변환 후 전달한다.

### 5.4 packed key를 identity로 취급한다

packed key는 캐시 키, DB PK, 비교 연산의 기반이다. key의 결정론성(동일 입력 = 동일 key)이 깨지면 시스템 전체의 정합성이 무너진다.

**규칙**:
- encode 결과에 난수, 타임스탬프 등 비결정론적 요소를 혼합하지 않는다
- obfuscation은 별도 레이어(`obfuscate/`)에서 수행하며, encode 자체에 포함하지 않는다
- 동일 schema + 동일 coords는 반드시 동일 packed key를 생성해야 한다 (INV-1)
