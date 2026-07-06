---
def:
  id: table-schema-spec
  tier: system
  address: def_document:v2:342206
  scope: data
  aspect: domain_data
  depth: overview
  svc: index-meta
  lifecycle: approved
  layer: domain
  tags: [data, structural, entry-point]
  links:
    - target: address-spec
      type: contains
    - target: canonical-format-spec
      type: contains
    - target: table-schema-types-spec
      type: contains
    - target: table-schema-api-spec
      type: contains
    - target: table-schema-compiled-spec
      type: contains
    - target: table-schema-usage-spec
      type: contains
    - target: index-meta-system
      type: depends_on
sources:
  - packages/index-meta/src/table-def.ts
  - packages/index-meta/src/table-def.test.ts
  - packages/index-meta/src/compile-schema.ts
  - packages/index-meta/src/compile-schema.test.ts
  - packages/index-meta/src/index.ts
  - packages/index-meta/package.json
---

# TableDef / compileSchema 스펙

## 목적 ^purpose

테이블 단위 스키마 선언 레이어.
`MetaRegistry`가 런타임 encode/decode를 담당한다면,
이 레이어는 **외부 DB의 주소 공간(address space)을 정의하고 버전을 관리**한다.

저장소 레이어: [store.spec.md](store.spec.md)

## 구성 ^overview

- **TableDef 이원 구조**: leaf(source + capacity 기반 독립 1D 주소 공간)와 composite(dims 참조로 nD → 1D 조합 주소 공간) 둘 중 하나
- **capacity/entries 분리**: capacity는 주소 공간 크기 선언(변경 시 새 버전), entries는 실제 채워진 값(버전 무관 추가 가능)
- **defineTable API**: id/source/dims/versions를 받아 TableDef를 생성하며, 14가지 ValidationError 검증 규칙 적용
- **compileSchema API**: TableDef 배열을 위상정렬 후 처리하여 CompiledSchema 반환 (composite capacity = dim capacity 곱 자동 계산)
- **CompiledSchema.diff**: capacity 변화만 감지 — added/removed/changed 테이블과 버전별 capacity 변경 추적
- **슬롯 마커 경계**: 현재 TableDef 타입 계약은 `capacity`와 `refs`만 소유한다. reserved token seeding은 store/registry convention의 후속 책임이며 이 스키마 레이어의 source-backed 필드가 아니다.
- **레이어 위치**: defineTable/compileSchema(스키마) → IndexMetaStore(저장) → MetaRegistry(런타임 encode/decode) → WeightedIndex(수학)

## source-backed 판정

이 문서는 `defineTable`/`compileSchema` 스키마 선언 레이어만 소유한다. 현재 구현이 증명하는 것은 leaf/composite 구분, capacity 검증, composite refs 검증, topological compile, composite capacity 계산, capacity-only diff다. marker token 자동 시드나 DB entry 생성은 `IndexMetaStore`와 registry convention 쪽 책임이다.

## 참조

패키지 인덱스: [README.md](README.md)

## 상태

implemented
