---
def:
  id: table-system-group
  tier: system
  address: def_document:v2:342034
  scope: data
  aspect: domain_data
  depth: overview
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [structural]
  links:
    - target: table-dimref-types
      type: contains
    - target: table-schema-def
      type: contains
    - target: table-accessor-api
      type: contains
sources:
  - packages/index-meta/src/table-def.ts
  - packages/index-meta/src/table-def.test.ts
  - packages/index-meta/src/compile-schema.ts
  - packages/index-meta/src/compile-schema.test.ts
  - packages/index-meta/src/schema-sync.ts
  - packages/index-meta/src/schema-sync.test.ts
  - packages/demo-snapshot/src/demo-catalog.ts
  - packages/demo-snapshot/src/demo-catalog.test.ts
  - packages/demo-snapshot/src/catalog-builder.ts
  - packages/demo-snapshot/src/demo-accessors.ts
  - packages/demo-snapshot/src/demo-bridge.ts
  - packages/demo-snapshot/src/event-schema.test.ts
  - packages/demo-snapshot/src/table-ref-guide.test.ts
  - packages/index-meta/src/meta-registry.ts
  - packages/index-meta/src/meta-registry.test.ts
  - packages/index-meta/src/meta-resolver.ts
  - packages/index-meta/src/meta-resolver.test.ts
  - packages/index-meta/src/meta-codec.ts
  - packages/index-meta/src/meta-codec.test.ts
  - packages/index-meta/src/address-protocol-manager.ts
  - packages/index-meta/src/address-protocol-manager.test.ts

---

# 테이블 시스템

## 목적 ^purpose

좌표 시스템에서 table_ref(외부 관계형 데이터)와 axis(닫힌 어휘)를 연결하는 테이블 시스템.

## 구성 ^overview

- `table-dimref-types`: 두 종류의 DimRef — axis(닫힌 어휘 참조)와 table_ref(외부 관계형 테이블 참조)의 차이와 사용 규칙.
- `table-schema-def`: TableDef — 관계형 세계의 구조 선언.
- `table-accessor-api`: accessor API에서 table_ref를 처리하는 방법.

| 문서 | 핵심 |
|------|------|
| [table-dimref-types](table-dimref-types.spec.md) | axis(닫힌 어휘)와 table_ref(외부 관계형 테이블)의 차이와 사용 규칙 |
| [table-schema-def](table-schema-def.spec.md) | TableDef — 컬럼, 타입, FK, 인덱스 정의와 양방향 그래프 탐색 |
| [table-accessor-api](table-accessor-api.spec.md) | accessor API에서 table_ref 처리 방법과 외부 전파 경로 |

## 기반 문서

- [foundation.md](foundation.md) — 좌표 시스템 근본 원리
- [event-schema.md](event-schema.md) — 이벤트 = 관계 정의, 3-slot 구조
- [schema-layer.md](schema-layer.md) — 4-Layer 아키텍처에서 table_ref의 위치
