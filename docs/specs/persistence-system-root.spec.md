---
def:
  id: persistence-system-root
  type: spec
  tier: system
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [persistence, structural]
  links:
    - target: storage-system
      type: depends_on
    - target: storage-adapters-spec
      type: depends_on
    - target: storage-schema-spec
      type: depends_on
    - target: index-meta-store-group
      type: depends_on
    - target: dkg-state-store
      type: depends_on
    - target: decision-flow-store
      type: depends_on
    - target: definition-data-source
      type: depends_on
    - target: store-driver-selection
      type: refs
  sources:
    - packages/store/src/index.ts
    - packages/store/src/adapters/memory/record.adapter.test.ts
    - packages/index-meta/src/index-meta-store.ts
    - packages/index-meta-store/src/adapters/sql-store.test.ts
    - packages/definition-data-source/src/factory.test.ts
    - packages/dkg-store/src/dkg-sqlite-store.test.ts
    - packages/ingest-server/src/stores/runtime-stores.ts
---
# Persistence System Root

## 목적 ^purpose

다양한 데이터 저장소(SQLite, Memory, Store)에 대한 공통 영속성 인터페이스 및 구현을 관리한다.

## 구성 ^overview

- `storage-system`: 이벤트/시나리오/판정/그래프 데이터 저장의 core system.
- `storage-adapters-spec`: Drizzle/PostgreSQL 및 In-Memory store adapter 구현 패턴.
- `storage-schema-spec`: PostgreSQL/Drizzle 기반 저장 스키마.
- `index-meta-store-group`: index-meta registry/store 계약과 resolution.
- `dkg-state-store`: DKG 상태 그래프 저장 계약.
- `decision-flow-store`: decision-flow 실행 상태 저장 계약.
- `definition-data-source`: definition catalog 문서/DB source 경계.
- `store-driver-selection`: 런타임별 store driver 선택 기준.
