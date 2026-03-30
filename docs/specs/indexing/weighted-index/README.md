# weighted-index 패키지 스펙

> 가중진법 기반 다차원 인코딩 수학 엔진 + ID 포맷 적합성 설계 + 프로토콜 독립 주소 체계.

패키지: `@qa-sdk/weighted-index`

## 상태

implemented

## 문서 구조

| 문서 | 관심사 |
|---|---|
| [core.spec.md](core.spec.md) | WeightedIndex 수학 엔진, LabelRegistry, PrefixCodec, bitmask, obfuscate |
| [../../weighted-index-system/wi-trace-group.md](../../weighted-index-system/wi-trace-group.md) | 변경 전파 추적성 — 3-tier 핀 구조, 변경 유형별 전파 경로, DKG·qa-sdk 계약 |
| [partial-binder.spec.md](partial-binder.spec.md) | PartialBinder, createBinder, 부분 차원 캐시, PrefixCodec 기반 curried encoder |
| [../../weighted-index-system/wi-pack-format-system.md](../../weighted-index-system/wi-pack-format-system.md) | PackFormat, FormatRegistry, SemanticAddress, AddressConverter, fitLayout |
| [range-query.spec.md](range-query.spec.md) | calcAddressRanges — 부분 좌표 제약 기반 주소 구간 계산, OR/AND 조합, Graph-DB 패턴 |

## 횡단 문서

| 문서 | 설명 |
|---|---|
| [../foundation.md](../foundation.md) | 근본 원리 (닫힌 조합 공간, 전단사, 레이어 분리) |
| [../pipeline.md](../pipeline.md) | 인코딩/디코딩 파이프라인 전체 경로 |
| [../patterns.md](../patterns.md) | 사용 패턴 |
| [../../indexing-core-system/conventions-system.md](../../indexing-core-system/conventions-system.md) | 프로젝트 관례 |

## 외부 소비자

- `index-meta` — MetaRegistry가 WeightedIndex + AddressConverter를 내부적으로 사용. [../index-meta/](../index-meta/README.md) 참조.
