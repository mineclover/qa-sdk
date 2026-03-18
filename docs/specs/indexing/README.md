# 인덱싱 시스템 — 개념 맵

> 가중진법 기반 다차원 인코딩, 레이블 버전 관리, ID 포맷 적합성 설계를 아우르는 관심사 루트 문서.

## 레이어 구조

```
┌──────────────────────────────────────────────────────────────┐
│  데이터 레이어  (사용자 구현)                                  │
│  DB 저장, versionId 추적, "perm:iv1:13" 문자열 관리           │
├──────────────────────────────────────────────────────────────┤
│  스키마 레이어  (index-meta)                                  │
│  축의 의미, 각 위치의 엔티티 정의, 활성 manifest               │
├──────────────────────────────────────────────────────────────┤
│  수학 레이어  (weighted-index)                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  PrefixCodec — 레이블 조합 + 버전 + encode/decode   │  │
│  │  LabelRegistry  — 레이블별 entity ID ↔ 1-based index  │  │
│  │  WeightedIndex  — 순수 수학 엔진 (shape → id ↔ coords)│  │
│  ├────────────────────────────────────────────────────────┤  │
│  │  독립 유틸 (인스턴스 불필요)                             │  │
│  │  calc · bitmask · obfuscate · uuid-layout              │  │
│  │  pack-format · semantic-address                        │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

## 문서 체계

### 횡단 문서

개별 패키지 스펙보다 먼저 읽어야 하는 횡단 문서.

| 문서 | 성격 | 핵심 내용 |
|---|---|---|
| [foundation.md](foundation.md) | **근본 원리** | 닫힌 조합 공간, 전단사 보장, 버전화된 공간 계열, 레이어 분리 |
| [pipeline.md](pipeline.md) | **파이프라인 레퍼런스** | entity ID ↔ PK 문자열 전체 인코딩/디코딩 경로 |
| [patterns.md](patterns.md) | **사용 패턴** | EntityId 기반 이동, cross-index 참조, 활성/비활성 책임 분리 |
| [conventions.md](conventions.md) | **프로젝트 관례** | ID 네이밍, 예약 토큰, EntityId 정규화, 커스텀 포맷 등록 |
| [slot-marker.spec.md](slot-marker.spec.md) | **슬롯 마커** | 닫힌 패턴에서 "선택하지 않음"을 표현하는 공식 메커니즘. 테스트 코드, 수집 전략, 용량 영향 |
| [data-design.md](data-design.md) | **데이터 설계** | 차원 압축, 차원 편입, 정보 저장, 범위 제어, 캐싱 전략 — 전체 설계 구조 |
| [coordinate-query.spec.md](coordinate-query.spec.md) | **좌표 질의** | 패턴 포함 관계(lattice), 정책 해소, cross-index 합성 질의, 버전 횡단 탐색, RelationalEngine |
| [bigint-addressing.spec.md](bigint-addressing.spec.md) | **BigInt 주소 체계** | Number.MAX_SAFE_INTEGER 한계, BigInt API (weighted-index + index-meta), 용량 가드, 성능 특성 |
| [benchmarks.md](benchmarks.md) | **벤치마크** | 차원 확장 한계, encode/decode 속도, cross-index 종단 탐사, 정보 디코딩 파이프라인 |
| [acceleration.md](acceleration.md) | **하드웨어 가속 비전** | FPGA/PCIe 가속 적합성, 파이프라인 경계, batch/binary 인터페이스 로드맵 |

### 패키지 스펙

패키지별로 계층화된 문서 구조. 각 패키지 README가 하위 문서의 인덱스 역할.

```
weighted-index/                    ← 수학 + canonical primitives + 포맷 + 프로토콜
├── README.md                      패키지 인덱스
├── core.spec.md                   WeightedIndex, LabelRegistry, PrefixCodec, calcWeights(canonical stride), bitmask
├── pack-format.spec.md            PackFormat, SemanticAddress, AddressConverter, fitLayout
└── range-query.spec.md            calcAddressRanges — 부분 좌표 제약 주소 구간 계산

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
| [weighted-index/](weighted-index/README.md) | 3 문서 | 수학 엔진, 포맷 적합성, 범위탐색, 프로토콜 변환 | implemented |
| [index-meta/](index-meta/README.md) | 13 문서 | 스키마 선언, 저장소, 주소 게이트웨이, 코덱, Address, Resolver, SDK, DX, GateEngine, 시나리오, ADR | implemented / planned |

## 관심사 흐름

```
shape 설계                  포맷 적합성                런타임 인코딩
──────────────              ──────────────             ──────────────
dim 정의                    PackFormat 선택            encode(coords)
  ↓                           ↓                         ↓
shape 배열 확정              fitLayout()               SemanticAddress
  ↓                           ↓                    { schema, version, index }
WeightedIndex 생성           shape 축소 추천               ↓
                              ↓                     프로토콜 선택
                           planLayout()                   ↓
                              ↓               ┌──── colon: "perm:v1:42"
                           레이아웃 확정       ├──── uri:   "wi://perm/v1/42"
                                              ├──── compact: "perm-v1-42"
                                              └──── hex container (UUID 등)
```

## 데이터 카탈로그 (demo-snapshot)

모든 데모/테스트 데이터의 단일 출처(SSOT). 기본 단위는 **1차원 축(Axis)**이며, 도메인은 축의 조합이다.

```
Axis("role") × Axis("action") × Axis("resource") → Domain("rbac")
```

### 축(Axis) 카탈로그 — 15개 축, 5개 도메인

| 도메인 | 축 조합 | 용도 |
|--------|---------|------|
| **Shopping** | DEMO_ENVS × DEMO_REGIONS × DEMO_SVCS × DEMO_NSS + ROLES + EVENTS | 쇼핑 플랫폼 인덱스 체계 |
| **RBAC** | role × action × resource | 역할 기반 접근 제어 |
| **Content** | tag × category × status × locale × channel | 콘텐츠 플랫폼 |
| **Tracking** | trackAction × page × userType | 사용자 행동 추적 |
| **Relational** | subjectKind × predicate × objectKind | 관계 모델 |

```typescript
import { AXIS } from "demo-snapshot";

AXIS.role.entries     // ["admin", "editor", "viewer"]
AXIS.role.capacity    // 8
AXIS.role.ko          // { admin: "관리자", ... }
```

### 상위 스키마

| Export | 설명 |
|--------|------|
| `buildDemoRegistryInput()` | MetaRegistry 생성용 순수 데이터 객체 |
| `DEMO_SVC` | 사전 계산된 서비스 주소 상수 |
| `DEMO_FEATURES_V1/V2` | 기능 정의 (역할 매핑, 이벤트 값 포함) |
| `DEMO_SHOPPING_SERVICES` | 서비스별 리소스/액션 컨텍스트 |

## 통합 테스트 (demo-tests)

완성된 데이터 구조로 의도를 표현하고, cross-package 동작을 검증하는 테스트 패키지.

```
demo-tests/src/
├── index-meta/           17개 — MetaRegistry 시나리오, E2E, 정책, SDK
├── permission-engine/     6개 — 시나리오, 코덱, 리소스, 서비스참조
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

### 포맷 적합성이 분리된 이유

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

> **검증**: [`format-adapter.test.ts`](../../packages/weighted-index/src/format-adapter.test.ts) — §1 구조적 격리, §2 사후 분석, §3 실시간 감지, §4 경계값 정밀도, §5 엔진 선택 분리, §6 다중 포맷 동시 평가, §7 포맷 변경 시 수학 불변

상세: [bigint-addressing.spec.md](bigint-addressing.spec.md)
