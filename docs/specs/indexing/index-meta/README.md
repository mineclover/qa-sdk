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
| [scenarios.spec.md](scenarios.spec.md) | 유저 시나리오 — core 파이프라인 검증 (§1–16) |
| [sdk.spec.md](sdk.spec.md) | IndexSDK — 경량 소비 레이어 (constants, dimCapacity, 예약 토큰 필터링) |
| [dx-lifecycle.spec.md](dx-lifecycle.spec.md) | DX 라이프사이클 — CLI, 코드젠, 타입 추론, 와이어 포맷 |
| [scenarios.spec.md](scenarios.spec.md) | 유저 시나리오 — core 파이프라인 검증 (§1–16) |
| [../../../index-meta-system/address-scenarios-group.md](../../../index-meta-system/address-scenarios-group.md) | 유저 시나리오 — 외부 시스템 통합 (§17–19, AddressProtocolManager) |
| [scenarios-sdk.spec.md](scenarios-sdk.spec.md) | 유저 시나리오 — SDK 라이프사이클 운영 (§20–26) |
| [canonical-format.spec.md](canonical-format.spec.md) | Canonical C Format — 정규 텍스트(colon)/바이너리(layout) 포맷 지정 |
| [invariants.spec.md](invariants.spec.md) | 변환 불변조건 — 12개 invariant 명세 + 테스트 커버리지 맵 |
| [../../../gate/gate-api.spec.md](../../../gate/gate-api.spec.md) | GateEngine — 주소 상태 자동 재계산, cascade 전파, gate-aware-query 합성 API |
| [../../../index-meta-system/address-separation-group.md](../../../index-meta-system/address-separation-group.md) | ADR: AddressProtocolManager 분리 |
| [adr-merge-dedup.md](adr-merge-dedup.md) | ADR: 의미적 중복 제거 — D-1~D-5 식별, canonical 구현 지정, 의도적 분리 근거 |

## 횡단 문서

| 문서 | 설명 |
|---|---|
| [../foundation.md](../foundation.md) | 근본 원리 (닫힌 조합 공간, 전단사, 레이어 분리) |
| [../pipeline.md](../pipeline.md) | 인코딩/디코딩 파이프라인 전체 경로 |
| [../patterns.md](../patterns.md) | 사용 패턴 (EntityId 이동, cross-index, 활성/비활성) |
| [../../indexing-core-system/conventions-system.md](../../indexing-core-system/conventions-system.md) | 프로젝트 관례 (ID 네이밍, 예약 토큰) |

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
        ↓
IndexSDK                      ← 경량 소비 레이어 (sdk.spec.md)
  ├── client() → IndexClient     버전 고정 클라이언트
  │   ├── constants()              예약 토큰 + inactive 제외
  │   └── dimCapacity()            용량 headroom 확인
  └── CLI / codegen              DX 라이프사이클 (dx-lifecycle.spec.md)
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
  meta-registry.ts       # MetaRegistry — 주소 게이트웨이 (_buildShape로 shape 구성 단일화)
  address-protocol-manager.ts  # AddressProtocolManager — 독립 주소 직렬화
  gate-aware-query.ts    # Gate-Aware Query — relational + gate 합성 유틸리티
  meta-codec.ts          # MetaCodec — 독립 encode/decode (LabelRegistry + PrefixCodec 위임)
  meta-resolver.ts       # MetaResolver — 외부 소비용 데이터 번들 생성
  index-sdk.ts           # IndexSDK — 경량 소비 레이어 (constants, dimCapacity)
  index.ts               # 공개 API 재수출
  client.ts              # 브라우저/Edge 경량 진입점
```
