---
def:
  id: task-infra-sql-adapters
  type: knowledge
  knowledge_kind: guide
  tier: component
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: operation
  svc: index-meta
  tags: [persistence, task-record]
  links:
    - target: index-meta-system
      type: traces_to
sources:
  - packages/index-meta/src/adapters/sql-version-lifecycle-store.ts
  - packages/index-meta/src/adapters/sql-migration-store.ts
  - packages/index-meta/src/adapters/sql-prefix-router.ts
  - packages/index-meta/src/version-lifecycle.test.ts
  - packages/index-meta/src/migration-store.test.ts
  - packages/index-meta/src/prefix-router.test.ts
---

# SQL 어댑터 보강

> Memory-only Store 인터페이스에 SQL 어댑터를 추가하여 프로덕션 영속성을 확보한다.

## 목적 ^purpose

index-meta SQL adapter task의 완료 위치를 추적한다. 구현된 어댑터와 contract test가 현재 SSOT다.

## 흐름 심볼

`[S4]` — Core DB 계층 보강.

## 현재 상태

| Store 인터페이스 | Memory | SQL | 영향 |
|---|---|---|---|
| IndexMetaStore | ✅ | ✅ `SqlIndexMetaStore` | 핵심 영속 계층 |
| EntryFlagStore | ✅ | ✅ `SqlEntryFlagStore` | entry 상태 이력 |
| AddressStateStore | ✅ | ✅ `SqlAddressStateStore` | gate 상태 캐시 |
| AddressRangeCache | ✅ | ✅ `SqlAddressRangeCache` | 범위 캐시 |
| VersionLifecycleStore | ✅ | ✅ `SqlVersionLifecycleStore` | gate-service 프로덕션 전제 |
| MigrationStore | ✅ | ✅ `SqlMigrationStore` | query-service 버전 횡단 전제 |
| PrefixRouter | ✅ | ✅ `SqlPrefixRouter` | decode-service 멀티 prefix |
| PrefixRegistry | ✅ | ✅ `SqlPrefixRegistry` | prefix 메타 영속화 |
| EntryMetadataStore | ✅ | ❌ | 직접 영향 낮음 |

## 선행 조건

없음. 기존 SQL 어댑터 패턴 (`SqlAddressStateStore` 등) 참조.

## spec.todo 매핑

H-1, H-2, H-3

## 작업 항목

| # | 작업 | 파일 | 우선순위 |
|---|---|---|---|
| H-1 | VersionLifecycleStore SQL | `index-meta/src/adapters/sql-version-lifecycle-store.ts` | 높 |
| H-2 | MigrationStore SQL | `index-meta/src/adapters/sql-migration-store.ts` | 중 |
| H-3 | PrefixRouter SQL | `index-meta/src/adapters/sql-prefix-router.ts` | 중 |

## 각 어댑터 구현 패턴

SqlDriver 위임 패턴 (Drizzle 아님 — 범용 SQL 인터페이스 직접 사용):

1. Store 인터페이스 구현 — SqlDriver의 `query`/`queryOne`/`execute` 메서드에 위임
2. DB row 타입 정의 + 변환 헬퍼 (`toRecord()`)
3. 단위 테스트 (`NodeSqliteDriver(":memory:")` 기반)
4. `index-meta/src/index.ts`에 export 추가

## 구현 완료 상세

### H-1: SqlVersionLifecycleStore

- `version_lifecycle` 테이블: prefix, version_id, status(CHECK: draft/released/active/deprecated), base_version_id, capacity, deactivation_mode, created_at, released_at
- `activate()`: 트랜잭션으로 이전 active → released + 대상 → active 원자적 전환
- `createDraft()`: deactivationMode 미지정 시 base 버전에서 상속, base 없으면 "strict"
- 인덱스: `(prefix, created_at)`, `(prefix, status, created_at)`

### H-2: SqlMigrationStore

- `migration_mapping` 테이블: prefix, from_version_id, to_version_id, position, change_type(CHECK: modified/deactivated), old_entity_id, new_entity_id, created_at
- `saveMappings()`: `batchExecute`로 일괄 삽입
- `resolveToLatest()`: BFS로 version 간 경로 탐색 → 경로 hop마다 position의 mapping 조회 → deactivated 발견 시 즉시 중단
- 인덱스: `(prefix, position, created_at)`, `(prefix, from_version_id, to_version_id, position)`

### H-3: SqlPrefixRouter

- `prefix_route` 테이블: prefix(PK), d1_database_id, routed_at
- `route()`: upsert (`ON CONFLICT DO UPDATE`)
- `listPrefixes()`: d1_database_id 기준 조회 (routed_at ASC, prefix ASC 정렬)
- 인덱스: `(d1_database_id, routed_at, prefix)`

## 산출물

- SQL 어댑터 7건 구현 완료 (H-1~H-3 + 기존 4건)
- NodeSqliteDriver에 전체 DDL 13개 테이블 통합
- gate-service / query-service 프로덕션 배포 blocker 해소

## 관련 소스

- `packages/index-meta/src/adapters/sql-version-lifecycle-store.ts`
- `packages/index-meta/src/adapters/sql-migration-store.ts`
- `packages/index-meta/src/adapters/sql-prefix-router.ts`
- `packages/index-meta/src/version-lifecycle.test.ts`
- `packages/index-meta/src/migration-store.test.ts`
- `packages/index-meta/src/prefix-router.test.ts`
