---
def:
  id: conv-reserved-entries
  address: def_document:v1:2137
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [tier-infra]
  links:
    - target: sdk-constants
      type: constrains
    - target: slot-marker-patterns
      type: constrains
    - target: wi-format-registry
      type: constrains
---
# conv-reserved-entries

## 목적 ^purpose

Reserved Entry 규칙. 시스템 예약 entry와 커스텀 PackFormat 등록 절차.

Reserved Entry 규칙. 시스템 예약 entry와 커스텀 PackFormat 등록 절차.

## 구성 ^overview

- **핵심 개념**: 슬롯 마커(slot marker)로 "값 없음/분류 불가/식별 불가" 같은 열린 상황을 닫힌 주소 공간 안에서 표현한다
- **표준 토큰 3종**: `"_"`(null, 값 없음), `"~"`(other, 해당 없음), `"?"`(unknown, 식별 불가) — 예약어이므로 도메인 값으로 사용 금지
- **선두 배치 규칙**: 마커는 entries 배열 앞쪽에 `_` → `~` → `?` → 커스텀 → 정규 엔티티 순서로 배치
- **코덱 투명성**: 코덱에 마커 특별 처리 로직을 삽입하지 않으며, 의미 해석은 도메인 레이어 책임
- **Snapshot Supply 4전략**: axis(index 안 인코딩), envelope(전송 메타 태깅), context(address_context 별도 키), implicit(추적 안 함)
- **axis 전략**: schema_version 축을 첫 번째 차원에 배치하여 자기 설명적 주소를 생성하고 네이티브 범위 쿼리 지원
- **주소 3세그먼트 형식**: `{prefix}:{v}:{index}` — 모든 전략에서 동일하며, v 세그먼트는 stride가 변경된 version ID
- **전략 선택 기준**: 크로스-버전 분석 → axis, 수집/감사 → envelope, 혼합 워크로드 → context, 개발/내부 → implicit

그룹: [conventions-system.md](conventions-system.md)
원본: `docs/specs/indexing/conventions.md` SS2, SS5

## 상태

implemented

## 1. 예약 항목(Reserved Entry)

> 상세 스펙: `slot-marker.spec.md` — 설계 원리, 테스트 코드, 수집 전략, 용량 영향.

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
2. **선두 배치**: 마커는 entries 배열 앞쪽에 배치. 순서: `"_"` -> `"~"` -> `"?"` -> 커스텀 -> 정규 엔티티.
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

## 2. Snapshot Supply — entry 버전 공급 전략

> 근거: `foundation.md` SS2-SS3, `version-operations.md`

### 2.1 문제

서비스가 배포되면 특정 시점의 entry set으로 주소를 인코딩한다. 이후 entry가 append되면 새 배포는 확장된 entry set을 사용한다. **"이 주소가 어느 시점의 entry set으로 만들어졌는가"**를 추적하는 것이 entry snapshot이다.

```
배포 시점 1 (s1): role entries = ["admin", "editor", "viewer"]
배포 시점 2 (s2): role entries = ["admin", "editor", "viewer", "auditor"]
                                                                 ^ append

stride 동일 (capacity headroom 내). v 세그먼트 변경 없음.
그러나 s1과 s2는 "유효한 entries 범위"가 다르다.
```

### 2.2 전략 정의

snapshot 정보를 **어디에 두느냐**는 prefix별로 선택 가능하다.

```typescript
type SnapshotSupply =
  | { type: "axis";     capacity: number }   // index 안에 축으로 인코딩
  | { type: "envelope" }                     // TransmissionEnvelope 메타에 태깅
  | { type: "context" }                      // address_context에 별도 키로
  | { type: "implicit" }                     // 추적 안 함, 항상 최신
```

### 2.3 전략별 상세

#### `axis` — index 안에 인코딩

`schema_version` 축을 composite의 **첫 번째 차원**에 추가한다. snapshot ID가 주소 정수 안에 포함되므로 자기 설명적이다.

```
dims = [schema_version, perm_svc, role]
capacity = [32, 10, 7]
stride = [70, 7, 1]

encode(s2, svc=5, role=3) = (2-1)*70 + (5-1)*7 + (3-1) = 100
주소: permission:v1:100
디코드: 100 -> [s2, svc5, role3]  <- snapshot 자동 복원
```

| 특성 | |
|---|---|
| calcAddressRanges 필터 | 네이티브 — `{ positions: [1, 2] }` 로 s1+s2 동시 쿼리 |
| 자기 설명적 | O 주소만으로 snapshot 복원 |
| address space 비용 | x capacity (예: x32) |
| 용도 | 크로스-버전 분석, 고빈도 축별 쿼리 |

**schema_version 축 규약:**
- 첫 번째 차원 (stride 최대 -> 같은 version 주소가 연속 범위 -> DB BETWEEN 유리)
- capacity 32 (32회 entry 변경까지 세대 교체 불필요)
- entry 네이밍: `"s1"`, `"s2"`, `"s3"`, ... (monotonic)

#### `envelope` — 엔벨로프 메타에 태깅

TransmissionEnvelope에 `entry_snapshot` 필드를 추가한다. 주소 자체에는 snapshot 정보가 없다.

| 특성 | |
|---|---|
| calcAddressRanges 필터 | 불가 — 별도 WHERE 조건 필요 |
| 자기 설명적 | X 엔벨로프 없이 snapshot 알 수 없음 |
| address space 비용 | 0 |
| 용도 | 수집/감사 로그, 이력 추적 |

#### `context` — address_context에 별도 키

주소와 함께 address_context에 `.snapshot` 접미 키로 저장한다.

| 특성 | |
|---|---|
| calcAddressRanges 필터 | 불가 — JSONB WHERE 필요 |
| 자기 설명적 | 부분적 — address_context 있으면 복원 가능 |
| address space 비용 | 0 |
| 용도 | 혼합 워크로드 (일부 레코드만 snapshot 추적) |

#### `implicit` — 추적 안 함

snapshot 정보를 어디에도 저장하지 않는다. 디코드 시 항상 최신 entries 기준.

| 특성 | |
|---|---|
| calcAddressRanges 필터 | 불가 |
| 자기 설명적 | X |
| address space 비용 | 0 |
| 용도 | 내부 도구, 개발 환경, snapshot 구분 불필요한 경우 |

### 2.4 전략 비교 요약

```
                  axis          envelope      context       implicit
-------------------------------------------------------------------
snapshot 위치     index 안       envelope      address_ctx    없음
stride 영향      x capacity     없음          없음           없음
Range Query      네이티브       별도 WHERE    별도 WHERE     불가
자기 설명적      O              X             부분적         X
wire 비용        address 증가   필드 1개      필드 1개       0
```

### 2.5 주소 형식 (공통)

모든 전략에서 주소 3세그먼트 형식은 동일하다:

```
{prefix} : {v} : {index}
   |        |      |
   |        |      └ 1D 정수 (axis 전략이면 schema_version 포함)
   |        └ stride를 확정한 version (v1, v3 등 — 기존 version ID)
   └ composite ID
```

`v` 세그먼트는 **stride가 변경된 version**이다. 별도 "generation ID"를 만들지 않고 기존 version ID를 그대로 사용한다.

### 2.6 prefix는 capacity/stride를 동반 저장

모든 전략에서 공통. prefix 등록 시 capacity/stride 배열이 함께 저장된다.

```typescript
{
  prefix: "perm",
  v: "v1",
  dims: ["perm_svc", "role"],
  capacity: [10, 7],
  stride: [7, 1],
  snapshotSupply: { type: "envelope" },
}
```

### 2.7 composite에 전략 설정

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

### 2.8 파이프라인 처리

```
Phase 1 ingest:
  snapshotSupply 확인 (prefix 메타) ->
    axis     : 이미 index에 포함, 추가 처리 없음
    envelope : envelope.entry_snapshot -> record 메타에 복사
    context  : address_context에서 .snapshot 키 검증
    implicit : skip

Query / Range Query:
    axis     : calcAddressRanges에 schema_version constraint 포함
    envelope : WHERE entry_snapshot = 's2' 별도 조건
    context  : WHERE address_context->>'prefix.snapshot' = 's2'
    implicit : snapshot 필터 불가
```

### 2.9 도입 시 체크리스트

| 단계 | axis | envelope | context | implicit |
|---|---|---|---|---|
| 1. capacity 산정 | schema_version(32) 포함 product < 2^53 | 변경 없음 | 변경 없음 | 변경 없음 |
| 2. dims 구성 | schema_version 첫 번째 | 변경 없음 | 변경 없음 | 변경 없음 |
| 3. codegen | PREFIXES에 schema_version 포함 stride | PREFIXES에 snapshotSupply 명시 | 동일 | 동일 |
| 4. PartialBinder | boot-time에 schema_version 고정 | boot-time에 entry_snapshot 설정 | — | — |
| 5. 쿼리 | calcAddressRanges constraint | 별도 WHERE 조건 | JSONB 조건 | — |
