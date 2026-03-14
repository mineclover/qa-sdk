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
│  │  PrefixRegistry — 레이블 조합 + 버전 + encode/decode   │  │
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

### 패키지 스펙

패키지별로 계층화된 문서 구조. 각 패키지 README가 하위 문서의 인덱스 역할.

```
weighted-index/                    ← 수학 + 포맷 + 프로토콜
├── README.md                      패키지 인덱스
├── core.spec.md                   WeightedIndex, LabelRegistry, PrefixRegistry, bitmask, obfuscate
└── pack-format.spec.md            PackFormat, SemanticAddress, AddressConverter, fitLayout

index-meta/                        ← 스키마 + 프로토콜 바인딩 + 외부 소비
├── README.md                      패키지 인덱스
├── registry.spec.md               MetaRegistry core (타입, API, 검증, 에러)
├── address.spec.md                Address 프로토콜 바인딩 (AddressConfig, PK 직렬화)
├── resolver.spec.md               MetaResolver (DecodeMap, DimRange, IndexRange)
└── scenarios.spec.md              유저 시나리오 테스트 커버리지 (E2E 워크플로우)
```

| 패키지 | 인덱스 | 관심사 | 상태 |
|---|---|---|---|
| [weighted-index/](weighted-index/README.md) | 2 문서 | 수학 엔진, 포맷 적합성, 프로토콜 변환 | implemented |
| [index-meta/](index-meta/README.md) | 4 문서 | 스키마 메타 DB, Address 바인딩, Resolver, 시나리오 | implemented |

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

## 탐색기 (weighted-index-explorer) 구조

weighted-index의 개념을 시각화하고 인터랙티브하게 탐색하는 웹 도구.

```
weighted-index-explorer/src/
├── main.ts              앱 진입점 + 라우팅
├── data.ts              4D 권한 모델 데이터
│
├── utils/               ── wi 해석 유틸 (재사용 가능) ──
│   ├── hex-bar.ts       hex 레이아웃 시각화 컴포넌트
│   ├── badge.ts         차원 값 배지
│   ├── encode-html.ts   인코딩 수식 시각화
│   └── colors.ts        차원 색상 팔레트
│
├── pages/               ── 탐색기 페이지 ──
│   ├── concept.ts       개념 설명
│   ├── philosophy.ts    설계 철학
│   ├── address.ts       주소 체계
│   ├── version.ts       버전 관리
│   ├── filter.ts        필터링
│   ├── obfuscate.ts     난독화
│   └── layout-planner.ts 레이아웃 플래너
│
├── ui/                  ── 탐색기 전용 UI ──
│   ├── grid.ts          격자 렌더러
│   ├── detail.ts        사이드 패널
│   └── list.ts          전체 목록
│
└── styles/
    └── main.css
```

### 포맷 적합성이 분리된 이유

`WeightedIndex`는 순수 수학이다 — shape만 알면 동작하며, 결과가 몇 바이트로 직렬화되는지는 모른다.
`pack-format`은 직렬화 컨테이너(64-bit, UUID 등)에 대한 관심사다.

이 분리 덕분에:
- WeightedIndex는 포맷을 몰라도 동작한다
- 하나의 shape에 대해 여러 포맷의 적합성을 동시에 평가할 수 있다
- 커스텀 포맷을 추가해도 수학 레이어는 변경 없다
