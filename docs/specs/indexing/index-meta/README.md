# index-meta 패키지 스펙

> 가중진법 인덱스의 **스키마 메타 DB**.
> `WeightedIndex`가 정수 ↔ 좌표 변환을 담당한다면, `index-meta`는 "각 축이 무엇을 의미하는가", "각 위치에 어떤 엔티티가 있는가"를 정의하고 버전 간 변경 동선을 관리한다.

패키지: `@qa-sdk/index-meta`
의존: `weighted-index`

## 상태

implemented

## 문서 구조

| 문서 | 관심사 |
|---|---|
| [table-schema.spec.md](table-schema.spec.md) | TableDef / compileSchema — 테이블 단위 스키마 선언, capacity 버전 관리, diff |
| [store.spec.md](store.spec.md) | IndexMetaStore — schema_version / entry DB 저장 레이어 |
| [registry.spec.md](registry.spec.md) | MetaRegistry — 주소 게이트웨이 (스키마 관리 + 직렬화 + 코덱 생성) |
| [codec.spec.md](codec.spec.md) | MetaCodec — DecodeMap 기반 독립 encode/decode |
| [address.spec.md](address.spec.md) | Address 프로토콜 바인딩 — AddressConfig, PK 직렬화, 검증 |
| [resolver.spec.md](resolver.spec.md) | MetaResolver — DecodeMap, DimRange, IndexRange, MetaDataset |
| [scenarios.spec.md](scenarios.spec.md) | 유저 시나리오 테스트 커버리지 — E2E 워크플로우 검증 항목 |

## 횡단 문서

| 문서 | 설명 |
|---|---|
| [../foundation.md](../foundation.md) | 근본 원리 (닫힌 조합 공간, 전단사, 레이어 분리) |
| [../pipeline.md](../pipeline.md) | 인코딩/디코딩 파이프라인 전체 경로 |
| [../patterns.md](../patterns.md) | 사용 패턴 (EntityId 이동, cross-index, 활성/비활성) |
| [../conventions.md](../conventions.md) | 프로젝트 관례 (ID 네이밍, 예약 토큰) |

## 레이어 구조

```
defineTable / compileSchema   ← 스키마 선언 레이어 (table-schema.spec.md)
      ↓ capacity, refs
IndexMetaStore                ← DB 저장 레이어 (store.spec.md)
      ↓ entries
MetaRegistry                  ← 주소 게이트웨이 (registry.spec.md)
  ├── serialize/parse            스키마 관리 + 직렬화
  └── createCodec()
        ↓
MetaCodec                     ← 정보 해석 (codec.spec.md)
  ├── encode/decode              entity ID ↔ VersionedValue
  └── (내부) LabelRegistry + PrefixCodec  ← weighted-index에 위임
```

## 모듈 구조

```
src/
  table-def.ts           # TableDef 타입 + defineTable
  compile-schema.ts      # CompiledSchema + compileSchema
  index-meta-store.ts    # IndexMetaStore 인터페이스 + 레코드 타입
  adapters/
    memory-store.ts      # InMemoryIndexMetaStore
  types.ts               # MetaRegistry용 공개 타입
  errors.ts              # 에러 클래스 계층
  meta-registry.ts       # MetaRegistry — 주소 게이트웨이
  meta-codec.ts          # MetaCodec — 독립 encode/decode (LabelRegistry + PrefixCodec 위임)
  meta-resolver.ts       # MetaResolver — 외부 소비용 데이터 번들 생성
  index.ts               # 공개 API 재수출
```
