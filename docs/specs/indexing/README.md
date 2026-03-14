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
│  │  calc · bitmask · obfuscate · uuid-layout · pack-format│  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

## 문서 체계

### 원리와 관례

개별 모듈 스펙보다 먼저 읽어야 하는 횡단 문서.

| 문서 | 성격 | 핵심 내용 |
|---|---|---|
| [foundation.md](foundation.md) | **근본 원리** | 닫힌 조합 공간, 전단사 보장, 버전화된 공간 계열, 레이어 분리 |
| [patterns.md](patterns.md) | **사용 패턴** | EntityId 기반 이동, cross-index 참조, 활성/비활성 책임 분리 |
| [conventions.md](conventions.md) | **프로젝트 관례** | ID 네이밍(`:` 금지), 예약 토큰(`_`, `~`, `?`), EntityId 정규화 |

### 모듈 스펙

각 모듈의 타입, API, 동작 규칙, 테스트 커버리지를 정의한다.

| 스펙 | 모듈 | 관심사 | 상태 |
|---|---|---|---|
| [weighted-index.spec.md](weighted-index.spec.md) | `weighted-index` 핵심 | 수학 엔진, 레이블/프리픽스 버전 관리, bitmask, 난독화 | implemented |
| [pack-format.spec.md](pack-format.spec.md) | `weighted-index` 포맷 | ID 컨테이너 포맷 정의·레지스트리·적합성 분석·shape 축소 | implemented |
| [index-meta.spec.md](index-meta.spec.md) | `index-meta` | MetaRegistry — 축·스냅샷·버전 스키마 + 활성 manifest | implemented |

## 관심사 흐름

```
shape 설계                  포맷 적합성                런타임 인코딩
──────────────              ──────────────             ──────────────
dim 정의                    PackFormat 선택            encode(coords)
  ↓                           ↓                         ↓
shape 배열 확정              fitLayout()               VersionedIndex
  ↓                           ↓                         ↓
WeightedIndex 생성           shape 축소 추천            serialize → DB
                              ↓
                           planLayout()
                              ↓
                           UUID/hex 레이아웃 확정
```

### 포맷 적합성이 분리된 이유

`WeightedIndex`는 순수 수학이다 — shape만 알면 동작하며, 결과가 몇 바이트로 직렬화되는지는 모른다.
`pack-format`은 직렬화 컨테이너(64-bit, UUID 등)에 대한 관심사다 — shape의 곱이 그 컨테이너에 들어가는지,
들어가지 않으면 어떻게 조정해야 하는지를 다룬다.

이 분리 덕분에:
- WeightedIndex는 포맷을 몰라도 동작한다
- 하나의 shape에 대해 여러 포맷의 적합성을 동시에 평가할 수 있다
- 커스텀 포맷을 추가해도 수학 레이어는 변경 없다
