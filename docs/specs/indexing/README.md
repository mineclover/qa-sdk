---
sources:
  - packages/weighted-index/src/index.ts
  - packages/weighted-index/src/math/index.ts
  - packages/weighted-index/src/vocab/index.ts
  - packages/weighted-index/src/protocol/index.ts
  - packages/index-meta/src/index.ts
  - packages/index-meta/src/client.ts
  - packages/index-meta/src/decode.ts
  - packages/permission-engine/src/index.ts
  - packages/permission-engine/src/browser.ts
  - packages/weighted-index/package.json
  - packages/index-meta/package.json
  - packages/permission-engine/package.json
---

# 좌표 시스템 — 개념 맵

> **작은 세계를 수학적으로 정의하고 운용하는 원시 도구.**
>
> 유한한 개념 조합에 정수 주소를 부여하는 **좌표 시스템(Coordinate System)**.
> 가중진법 기반 다차원 인코딩, 레이블 버전 관리, 주소 공간 합성을 아우르는 관심사 루트 문서.
>
> **이 시스템은 데이터를 저장하지 않는다.** 좌표를 정의하고 주소를 할당/해석할 뿐이다.

---

## indexing 레이어의 경계

이 문서가 다루는 indexing 레이어는 **닫힌 세계 하나를 정의하고 운용하는 원시 도구**이다.
그 위에 구축되는 서비스, 관측, 구조 검증은 이 레이어의 범위 밖이다.

```
 indexing 레이어 (이 문서의 범위)
 ═══════════════════════════════════════════════════════

 ┌─ 수학 ──────────────────────────────────────────────┐
 │  encode/decode, stride, shape, calcWeights          │  weighted-index
 │  BitIndex, BitMaskSet, bitmask                      │  bit-index
 │  PermissionSet, TernaryMask, ScopedEngine           │  permission-engine
 └─────────────────────────────────────────────────────┘
 ┌─ 어휘 ──────────────────────────────────────────────┐
 │  VersionedAxis, entries, capacity, headroom         │  demo-snapshot
 │  LabelRegistry, PrefixCodec                         │  weighted-index
 │  DEMO_CATALOG (SSOT), resolve/decompose             │  demo-snapshot
 └─────────────────────────────────────────────────────┘
 ┌─ 버전 ──────────────────────────────────────────────┐
 │  draft/sealed, migration, GateEngine                │  index-meta
 │  EntryFlagStore, active/inactive                    │
 │  DraftWorkspace, cascade recompute                  │
 └─────────────────────────────────────────────────────┘
 ┌─ 프로토콜 ──────────────────────────────────────────┐
 │  PackFormat, AddressConverter, layout                │  weighted-index
 │  직렬화: "prefix:version:address"                   │
 │  SemanticAddress, colon/uri/compact/hex             │
 └─────────────────────────────────────────────────────┘

 ═══════════════════════════════════════════════════════
                     indexing 레이어 경계
 ═══════════════════════════════════════════════════════

 indexing 레이어가 하는 것:
   닫힌 세계의 shape를 정의한다
   세계 안에서 좌표를 부여/해석한다
   세계의 버전을 관리한다 (확장, 마이그레이션)
   좌표를 다양한 형식으로 직렬화한다

 indexing 레이어가 하지 않는 것:
   세계를 왜 이렇게 구성했는지                 → spec-engine
   세계 밖으로 뭘 보여줄지 (export surface)    → spec-engine
   세계에서 일어나는 일을 관측하는 것           → QA/observation
   여러 세계를 조합해서 서비스를 만드는 것      → application layer

 ═══════════════════════════════════════════════════════

 응용 레이어 (이 문서의 범위 밖)
 ───────────────────────────────────────────────────────

 구조 정의 (spec-engine)
 │  export surface — prefix가 외부에 노출하는 제목
 │  schema validation — 어떤 조합이 유효한지 (Layer 2)
 │  spec document — 설계 근거, 추적성
 │
 관측 (QA system)
 │  EventInstance — 발생한 이벤트 기록
 │  Edge — 이벤트 간 관계 (causal/temporal/resource/correlation)
 │  State — 이벤트 전/후 세계 상태
 │  수집 — 런타임 관측
 │
 서비스 (application)
    ingest-server, registry-service, CLI, ...
```

### 책임 경계 (indexing 레이어 내부)

| 계층 | 패키지 | 책임 | 하지 않는 것 |
|---|---|---|---|
| **수학** | weighted-index | 정수 ↔ 좌표 변환 | 의미 해석, 타입 이름 |
| **비트 인덱스** | bit-index | 차원별 O(1) 추출, BitMaskSet | 권한 규칙, 어휘 |
| **권한 수학** | permission-engine | bitmask grant/check, ternary 상속 | 서비스 로직, API |
| **스키마** | index-meta | 축 의미, 버전, 활성 영역 | 이벤트 정의, 데이터 저장 |
| **카탈로그** | demo-snapshot | 타입 통합 관리, encode/decode/resolve | 런타임 이벤트, 인스턴스 |

소스: `packages/weighted-index/src/index.ts`, `packages/index-meta/src/index.ts`, `packages/permission-engine/src/index.ts`

## 문서 체계

### 횡단 문서

개별 패키지 스펙보다 먼저 읽어야 하는 횡단 문서.

| 문서 | 성격 | 핵심 내용 |
|---|---|---|
| [architecture.md](architecture.md) | **전체 아키텍처** | 5-Layer 구조 (L0~L4), Document Spec 투영, 식별자 규약, 추적성 연결, 구현 순서 **(DRAFT)** |
| [foundation.md](foundation.md) | **근본 원리** | 좌표 시스템 정체성, 닫힌 조합 공간, stride 공식과 주소 안정성, 버전화된 공간 계열, 레이어 분리 |
| [coordinate-states.md](coordinate-states.md) | **좌표 상태 모델** | 인프라 타입 시스템 정체성, 활성 영역, draft/sealed, version diff, 하네스 원칙 **(DRAFT)** |
| [schema-layer.md](schema-layer.md) | **Schema Layer** | 4-Layer 아키텍처, 6 기본 스키마, fragment 조합, 구조적 제약, 검증 파이프라인 **(DRAFT)** |
| [event-schema.md](event-schema.md) | **이벤트 스키마** | EventSchema의 구체 예시, 3-slot 구조, table_ref 증명 **(DRAFT — PERIPHERAL)** |
| [behavioral-traversal.md](behavioral-traversal.md) | **행위 축 탐색** | 데이터 흐름 경로 추적, 4가지 관계, 탐색 DSL, 단일 원천 추적 **(DRAFT — QA 시스템 전제)** |
| [data-design.md](data-design.md) | **설계 구조** | 좌표 시스템 6단계 설계: 차원 압축, 편입, 의미 부여, 범위 연산, 캐싱, 통합 카탈로그 |
| [ontology-evaluation.md](ontology-evaluation.md) | **온톨로지 대응** | RDF/OWL 스키마 매핑 평가, 좌표 시스템의 경계와 데이터 저장 계층 출발점 |
| [version-operations.md](version-operations.md) | **버전 운영** | DraftWorkspace, 배포 워크플로우, 다중 버전 관리, 저장값 마이그레이션 |
| [pipeline.md](pipeline.md) | **파이프라인 레퍼런스** | entity ID ↔ PK 문자열 전체 인코딩/디코딩 경로 |
| [patterns.md](patterns.md) | **사용 패턴** | EntityId 기반 이동, cross-index 참조, 활성/비활성 책임 분리 |
| [../indexing-core-system/conventions-system.md](../indexing-core-system/conventions-system.md) | **프로젝트 관례** | ID 네이밍, 예약 토큰, EntityId 정규화, 커스텀 포맷 등록 |
| [../indexing-core-system/slot-marker-group.md](../indexing-core-system/slot-marker-group.md) | **슬롯 마커** | 닫힌 패턴에서 "선택하지 않음"을 표현하는 공식 메커니즘. 테스트 코드, 수집 전략, 용량 영향 |
| [../query-system/query-system.md](../query-system/query-system.md) | **좌표 질의** | 패턴 포함 관계(lattice), 정책 해소, cross-index 합성 질의, 버전 횡단 탐색, RelationalEngine |
| [dimension-operations.md](dimension-operations.md) | **차원 운영** | 축 교차 선택(BitMaskSet, ScopedEngine), 환경 주입(ServiceRef, PermCodeFactory), 배포 시점 해석(PartialBinder) |
| [table-system.md](table-system.md) | **테이블 시스템** | 좌표↔관계형 양방향 연결, DimRef table_ref, ColumnRef 4종, 이벤트 인코딩 분리, 그래프 탐색 |
| [dsl-bundle.md](dsl-bundle.md) | **DSL 번들** | prefix 묶음 + 서비스 바인딩 + 사용 패턴 정의, DslBundleNode, 커버리지 분석 |
| [signal-model.md](signal-model.md) | **Signal 모델** | 트래킹 상위 개념 — Signal = 의미있는 순간, 7가지 SignalRole, Signal 체인, 검증 |
| [../indexing-core-system/bigint-addressing-group.md](../indexing-core-system/bigint-addressing-group.md) | **BigInt 주소 체계** | Number.MAX_SAFE_INTEGER 한계, BigInt API (weighted-index + index-meta), 용량 가드, 성능 특성 |
| [../indexing-core-system/benchmark-system.md](../indexing-core-system/benchmark-system.md) | **벤치마크** | 차원 확장 한계, encode/decode 속도, cross-index 종단 탐사, 정보 디코딩 파이프라인 |
| [acceleration.md](acceleration.md) | **하드웨어 가속 비전** | FPGA/PCIe 가속 적합성, 파이프라인 경계, batch/binary 인터페이스 로드맵 |

### 패키지 스펙

패키지별로 계층화된 문서 구조. 각 패키지 README가 하위 문서의 인덱스 역할.

```
weighted-index/                    ← 수학 + canonical primitives + 포맷 + 프로토콜
├── README.md                      패키지 인덱스
├── core.spec.md                   WeightedIndex, LabelRegistry, PrefixCodec, calcWeights(canonical stride), bitmask
├── partial-binder.spec.md         PartialBinder, createBinder, 부분 차원 캐시, PrefixCodec 연동
├── pack-format.spec.md            PackFormat, SemanticAddress, AddressConverter, fitLayout
└── range-query.spec.md            calcAddressRanges — 부분 좌표 제약 주소 구간 계산

permission-engine/                 ← 비트마스크 권한 런타임 + scope 라우팅
├── README.md                      패키지 인덱스
├── core.spec.md                   PermissionSet, TernaryMask, ScopedEngine
├── codec.spec.md                  PermissionCodec — 3-tier protocol stack, 주소 호환성
├── resource.spec.md               resource/service-ref/permission-code — canonical text contract
└── migration.spec.md              migration.ts — shape 변경 시 grant 재배치

index-meta/                        ← 스키마 + 프로토콜 바인딩 + 외부 소비
├── README.md                      패키지 인덱스
├── table-schema.spec.md           TableDef / compileSchema (테이블 스키마 선언, capacity 버전 관리)
├── store.spec.md                  IndexMetaStore (schema_version / entry DB 저장 레이어)
├── registry.spec.md               MetaRegistry core (타입, API, 검증, 에러)
├── codec.spec.md                  MetaCodec (DecodeMap 기반 독립 encode/decode)
├── address.spec.md                Address 프로토콜 바인딩 (AddressConfig, PK 직렬화)
├── resolver.spec.md               MetaResolver (DecodeMap, DimRange, IndexRange)
├── sdk.spec.md                    IndexSDK (경량 소비 레이어, constants, dimCapacity)
├── dx-lifecycle.spec.md           DX 라이프사이클 (CLI, 코드젠, 타입 추론, 와이어 포맷)
├── scenarios.spec.md              유저 시나리오 (§1–16)
├── scenarios-address.spec.md      유저 시나리오 — 외부 시스템 통합 (§17–19)
├── scenarios-sdk.spec.md          유저 시나리오 — SDK 라이프사이클 운영 (§20–26)
└── adr-address-separation.md      ADR: AddressProtocolManager 분리
```

| 패키지 | 인덱스 | 관심사 | 상태 |
|---|---|---|---|
| [../weighted-index-system/wi-system.md](../weighted-index-system/wi-system.md) | 4 문서 | 수학 엔진, partial binder, 포맷 적합성, 범위탐색, 프로토콜 변환 | implemented |
| [../permission/permission-system.md](../permission/permission-system.md) | 4 문서 | 비트마스크 권한 엔진, 3-tier 코덱, external identity layer, ternary 상속, 외부 scope 라우팅, shape migration | implemented |
| [../index-meta-system/index-meta-system.md](../index-meta-system/index-meta-system.md) | 13 문서 | 스키마 선언, 저장소, 주소 게이트웨이, 코덱, Address, Resolver, SDK, DX, GateEngine, 시나리오, ADR | implemented / planned |

대표 하위 문서: [weighted-index/partial-binder.spec.md](weighted-index/partial-binder.spec.md) · [permission-engine/README.md](permission-engine/README.md)

## 좌표 시스템 관심사 흐름

```
좌표 체계 설계              포맷 적합성                주소 할당/해석
──────────────              ──────────────             ──────────────
dim 정의                    PackFormat 선택            encode(coords)
  ↓                           ↓                         ↓
shape 배열 확정              fitLayout()               SemanticAddress
  ↓                           ↓                    { schema, version, index }
WeightedIndex 생성           shape 축소 추천               ↓
  ↓                           ↓                     프로토콜 선택
통합 카탈로그               planLayout()                   ↓
(DEMO_CATALOG)                ↓               ┌──── colon: "perm:v1:42"
  ↓                        레이아웃 확정       ├──── uri:   "wi://perm/v1/42"
prefix_ref 참조                               ├──── compact: "perm-v1-42"
  ↓                                           └──── hex container (UUID 등)
resolveAddress
(재귀 의미 해석)                    ↑ 좌표 시스템 경계 ↑
```

## 데이터 카탈로그 (demo-snapshot)

모든 데모/테스트 데이터의 단일 출처(SSOT). `DEMO_CATALOG`가 축, prefix, table 정의를 통합 관리한다. 축/prefix/table 수는 `DEMO_CATALOG`에서 런타임에 파생하며, 이 문서에는 고정 숫자를 두지 않는다.

```
DEMO_CATALOG
├── axes: VersionedAxis (버전별 entries/capacity/ko)
│   └── role: { v1: [5개,cap:5], v2: [6개,cap:6], v3: [6개,cap:8], v4: [7개,cap:8] }
└── prefixes: PrefixDef (축 조합 + prefix_ref/table_ref 참조)
    └── permission: [perm_svc(→service), role] × 4 versions
```

### Prefix 주소 공간

| Prefix | 차원 (labels) | 특징 |
|--------|---------------|------|
| **service** | env × region × svc_name × namespace | 서비스 4D 주소 (인프라 중심) |
| **permission** | perm_svc(→service) × role | 권한 스코프 |
| **event** | evt_svc(→service) × event_name × initiator | 이벤트 컨텍스트 |
| **rbac** | role × action × resource | 역할 기반 접근 제어 |
| **content** | tag × category × status × locale × channel | 5D 콘텐츠 |
| **tracking** | trackAction × page × userType | 사용자 행동 추적 |
| **relational** | subjectKind × predicate × objectKind | 관계 모델 |
| **page_view** | svc_ref(→service) × page × locale × userType | 화면 관측 |
| **endpoint** | svc_ref(→service) × resource_type × http_method × api_version | 엔드포인트 관측 |
| **flow_point** | svc_ref(→service) × flow_name × flow_step × flow_variant | 흐름 관측 |
| **deploy_event** | svc_ref(→service) × deploy_action × actor(table_ref) | 배포 이벤트 |
| **health_event** | svc_ref(→service) × health_status | 헬스 이벤트 |
| **cart_event** | actor(table_ref) × action × target(table_ref) | 장바구니 이벤트 |
| **auth_event** | actor(table_ref) × action | 인증 이벤트 |
| **order_event** | service_ctx(→service) × actor(table_ref) × action × order(table_ref) | 주문 이벤트 |
| **engine_event** | svc_ref(→service) × constraint_op × verdict_result | 엔진 평가 이벤트 |
| **schema_event** | svc_ref(→service) × migration_pattern × deploy_action | 스키마 마이그레이션 이벤트 |
| **pipeline_point** | svc_ref(→service) × pipeline_phase × validation_mode × verdict_result × temporal_strategy | 파이프라인 관측 |
| **data_policy** | svc_ref(→service) × mask_mode | 데이터 정책 관측 |

### 선택적 접근 API (3단계)

```typescript
import { DEMO_CATALOG, getPrefixStructure, getPrefixShape, getPrefixEntries } from "demo-snapshot";

getPrefixStructure(DEMO_CATALOG, "permission")        // labels, dims, versions
getPrefixShape(DEMO_CATALOG, "permission", "v3")       // { shape: [10,8], capacity: 80 }
getPrefixEntries(DEMO_CATALOG, "permission", "v1")     // { entries: { perm_svc: [40,...], role: ["admin",...] } }
```

### 차원 합성·분해·의미 해석

```typescript
import { encodePrefixByValue, resolveAddress, decomposeAddress } from "demo-snapshot";

// 의미값 → 1D 주소
encodePrefixByValue(DEMO_CATALOG, "permission", "v1", { perm_svc: 42, role: "admin" })  // → 10

// 1D 주소 → 재귀 의미 해석 (prefix_ref → 참조 prefix까지 풀어냄)
resolveAddress(DEMO_CATALOG, "permission", "v1", 3)
// → { role: { value: "viewer", ko: "뷰어" }, perm_svc: { ref: { env: "prod", ... } } }

// 차원 분해 (prefix_ref의 하위 좌표 포함)
decomposeAddress(DEMO_CATALOG, "permission", "v1", 13)
// → { perm_svc: { refAddress: 42, refDims: { env: "prod", svc_name: "shopping-backend" } } }
```

### 하위 호환 (AXIS + DEMO_DOMAINS)

기존 `Axis("role") × Axis("action") → Domain("rbac")` 패턴은 `DEMO_CATALOG`에서 파생되어 그대로 유지된다.

```typescript
import { AXIS, DEMO_DOMAINS } from "demo-snapshot";

AXIS.role.entries     // ["admin", "editor", "viewer"]  (rbac_role → role 매핑)
AXIS.role.capacity    // 8
```

### 상위 스키마

| Export | 설명 |
|--------|------|
| `buildDemoRegistryInput()` | MetaRegistry 생성용 순수 데이터 객체 (DEMO_CATALOG에서 파생) |
| `catalogToPrefixCodecInput()` | PrefixCodec 생성에 필요한 입력 데이터 |
| `DEMO_SVC` | 사전 계산된 서비스 주소 상수 |
| `DEMO_FEATURES_V1/V2/V3/V4` | 기능 정의 (역할 매핑, 이벤트 값 포함) |
| `DEMO_SHOPPING_SERVICES` | 서비스별 리소스/액션 컨텍스트 |

### 좌표 시스템의 경계

좌표 시스템은 주소 공간을 정의하고 주소를 할당/해석한다. RDF/OWL 온톨로지의 스키마 영역까지 담을 수 있으나, **데이터를 저장하지 않는다.** 좌표에 값을 저장하고 질의하는 것은 데이터 저장 계층의 책임이다.

> 상세: [ontology-evaluation.md](ontology-evaluation.md)

## 통합 테스트 (demo-tests)

완성된 데이터 구조로 의도를 표현하고, cross-package 동작을 검증하는 테스트 패키지.

```
demo-tests/src/
├── index-meta/           21개 — MetaRegistry 시나리오, E2E, 정책, SDK, BigInt, gate/query 계약
├── permission-engine/     7개 — 시나리오, 코덱, 리소스, 서비스참조, 호환성 계약
├── registry-codec.test.ts       MetaRegistry 코덱 라운드트립
├── position-stability.test.ts   v1→v2 위치 안정성
├── permission-migration.test.ts 권한 마이그레이션 통합
└── schema-consistency.test.ts   스키마 일관성 검증
```

## 플랫폼 데모 (platform-demo)

13개 시트로 인덱스 체계를 시각화하는 인터랙티브 웹 도구.

```
platform-demo/src/pages/
├── overview.ts        개요
├── range.ts           범위탐색
├── access.ts          권한범위 시뮬레이터
├── service.ts         서비스 4D 인덱스 그리드
├── permission.ts      권한 2D 인덱스 그리드
├── event.ts           이벤트 3D 인덱스 그리드
├── scenario.ts        역할별 접근 제어 시뮬레이션
├── grant.ts           기능×역할 grant 매트릭스 편집
├── casbin.ts          Casbin RBAC/ABAC 해설
├── logging.ts         구조화 로그 주소 태깅
├── layout.ts          UUID 레이아웃 시뮬레이터
├── version.ts         MetaRegistry v1/v2 비교 (SSOT 기반)
└── perm-engine.ts     PermissionSet 비트마스크 v1→v2 마이그레이션 비교
```

### 좌표 연산과 포맷이 분리된 이유

`WeightedIndex`는 순수 수학이다 — shape만 알면 동작하며, 결과가 몇 바이트로 직렬화되는지는 모른다.
`pack-format`은 직렬화 컨테이너(64-bit, UUID 등)에 대한 관심사다.

이 분리 덕분에:
- WeightedIndex는 포맷을 몰라도 동작한다
- 하나의 shape에 대해 여러 포맷의 적합성을 동시에 평가할 수 있다
- 커스텀 포맷을 추가해도 수학 레이어는 변경 없다

**Number/BigInt 선택도 동일한 원칙을 따른다.**
`WeightedIndex`(Number)와 `WeightedIndexBig`(BigInt)은 모두 shape만으로 동작하는 순수 수학이다.
어느 엔진을 쓸지는 외부 어댑터가 shape product를 사후 분석하여 결정한다:

```
shape  ─→  shapeProduct(shape)  ─→  ≤ 2^53?  ─→  WeightedIndex (Number)
           maxProductBig(hex)       > 2^53?  ─→  WeightedIndexBig (BigInt)
```

엔진 선택 후에도 포맷 적합성은 별도 판단이다 — 패키지의 기존 유틸로 수행:
- `charsForMax(wi.size - 1)` → 몇 hex chars가 필요한가?
- `maxProductBig(hexBudget)` → hex 예산이 허용하는 최대 주소 공간
- `dimMaxForBudget(hex, othersProduct)` → 한 차원의 최대 크기
- `fitShape({ shape, maxProduct })` → 포맷에 맞게 shape 축소
- `planCapacity(...)` → 성장 여력까지 포함한 종합 분석

수학 엔진은 이 판단에 관여하지 않으며, 상위 레이어(`index-meta`의 Capacity Guard)가 스키마 정의 시점에 `numberType`을 확정하고 런타임 가드를 수행한다.

> **검증**: [`format-adapter.test.ts`](../../../packages/weighted-index/src/format-adapter.test.ts) — §1 구조적 격리, §2 사후 분석, §3 실시간 감지, §4 경계값 정밀도, §5 엔진 선택 분리, §6 다중 포맷 동시 평가, §7 포맷 변경 시 수학 불변

상세: [bigint-addressing.spec.md](bigint-addressing.spec.md)
