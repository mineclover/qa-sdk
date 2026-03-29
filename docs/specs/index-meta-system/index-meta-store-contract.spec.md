---
def:
  id: index-meta-store-contract
  address: def_document:v2:343174
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: index-meta
  tags: []
  links:
    - target: table-schema-spec
      type: depends_on
    - target: index-meta-store
      type: refines
---

# Index Meta Store - 저장 계약

## 목적 ^purpose

index-meta 저장소의 설계 목적, 역할 분리, 저장 타입, 인터페이스와 동작 규칙을 정리해 persistence 레이어의 계약을 고정한다.

## 설계 목적

weighted-index는 각 차원의 최댓값(capacity)만 있으면 주소 범위를 즉시 계산한다. 따라서 DB는 3가지를 보장해야 한다:

| 요구사항 | 이유 |
|---------|------|
| capacity 빠른 반환 | WeightedIndex shape 결정의 선행 조건 |
| position 범위 조회 | 계산된 주소 범위로 entries 부분 조회 — 전체 로딩 불필요 |
| 실시간 확장 대응 | 새 entries 추가가 기존 조회를 방해하지 않아야 함 |

## 역할 분리

```
compileSchema  → 주소 공간 명세 (capacity, refs)  ─┐
                                                    ├→ IndexMetaStore
DB 클라이언트  → entries INSERT (언제든 가능)       ─┘
                                                    ↓
                                              schema_version 테이블
                                              entry 테이블
```

| 테이블 | 저장 내용 | 변경 시점 |
|--------|----------|----------|
| `schema_version` | 버전 메타 (capacity, 배포 시각) | capacity 변화 시 |
| `entry` | position별 실제 값과 등록 시각 | 언제든 추가 가능 |

## 저장 타입

```ts
interface SchemaVersionRecord {
  prefix: string;        // 테이블/prefix 식별자
  versionId: string;
  capacity: number;
  createdAt: string;     // ISO-8601
}

interface EntryRecord {
  prefix: string;
  versionId: string;
  position: number;      // 1-based, [1, capacity]
  value: EntityId;       // string | number
  createdAt: string;     // ISO-8601
}
```

## IndexMetaStore 인터페이스

```ts
interface IndexMetaStore {
  // ── schema_version ────────────────────────────────────
  insertSchemaVersion(record: SchemaVersionRecord): Promise<void>;
  getSchemaVersions(prefix: string): Promise<SchemaVersionRecord[]>;
  getSchemaVersion(prefix: string, versionId: string): Promise<SchemaVersionRecord | null>;
  getCapacity(prefix: string, versionId: string): Promise<number | null>;

  // ── entry ─────────────────────────────────────────────
  insertEntry(record: EntryRecord): Promise<void>;
  getEntries(prefix: string, versionId: string): Promise<EntryRecord[]>;
  getEntriesInRange(prefix: string, versionId: string, from: number, to: number): Promise<EntryRecord[]>;
  getEntry(prefix: string, versionId: string, position: number): Promise<EntryRecord | null>;
  getEntryByValue(prefix: string, versionId: string, value: EntityId): Promise<EntryRecord | null>;
  migrateEntries(prefix: string, fromVersion: string, toVersion: string, positionMap?: Record<number, number>): Promise<{ migrated: number; skipped: number }>;
}
```

## 동작 규칙

### insertSchemaVersion

- `(prefix, versionId)` 중복 시 에러.
- composite 테이블도 저장 가능 (capacity는 `compileSchema`에서 계산된 값).

### insertEntry

- 해당 `(prefix, versionId)`의 schema_version이 먼저 존재해야 한다. 없으면 에러.
- position이 `[1, capacity]` 범위를 벗어나면 에러.
- 같은 position에 중복 삽입 시 에러.
- schema_version이 있으면 버전 내 언제든 추가 가능.

### migrateEntries

- 대상 버전의 schema_version이 존재해야 한다.
- `positionMap`으로 position 재매핑 가능 (없으면 동일 position 유지).
- 이미 존재하는 position은 skip, 범위 초과 position은 에러.
- 트랜잭션으로 실행.

### 정렬 규칙

- `getSchemaVersions`: createdAt 오름차순.
- `getEntries`: position 오름차순.
- 비어있는 position은 결과에 포함되지 않음 (sparse).

## SQL 어댑터 구현체

### SqlDialect — DB별 기능 플래그

```ts
interface SqlDialect {
  readonly name: string;
  readonly supportsTransaction: boolean;
  readonly supportsReturning: boolean;
  readonly supportsJsonType: boolean;
  readonly supportsUpsert: boolean;
}
```

| DB | transaction | returning | jsonType | upsert |
|----|-------------|-----------|----------|--------|
| SQLite (better-sqlite3) | O | O (3.35+) | X | O |
| PostgreSQL | O | O | O (JSONB) | O |
| D1 (Workers) | X | O | X | O |

### SqlDriver — 범용 SQL 드라이버

DB 종류와 무관한 4종 메서드 인터페이스:

```ts
interface SqlDriver {
  readonly dialect: SqlDialect;
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  queryOne<T>(sql: string, params?: unknown[]): Promise<T | null>;
  execute(sql: string, params?: unknown[]): Promise<ExecuteResult>;
  transaction<T>(fn: (tx: SqlDriver) => Promise<T>): Promise<T>;
  batchExecute(sql: string, paramsList: unknown[][]): Promise<void>;
}
```

- 파라미터: 항상 `?` (positional) 스타일. 드라이버가 `$1/$2`로 내부 변환.
- `transaction()`: `dialect.supportsTransaction === false`인 DB에서는 순차 실행 (non-atomic).
- `batchExecute()`: 기본 for-loop. 드라이버가 네이티브 batch를 지원하면 오버라이드.

### 구현체 목록

| 구현체 | 위치 | 대상 DB |
|--------|------|---------|
| `SqlIndexMetaStore` | `adapters/sql-store.ts` | IndexMetaStore의 범용 SQL 구현 |
| `SqlEntryFlagStore` | `adapters/sql-entry-flag-store.ts` | entry_flag append-only 이력 |
| `SqlAddressStateStore` | `adapters/sql-address-state-store.ts` | address_state_cache upsert |
| `SqlAddressRangeCache` | `adapters/sql-address-range-cache.ts` | address_range_cache 저장 |
| `SqlVersionLifecycleStore` | `adapters/sql-version-lifecycle-store.ts` | 버전 상태 전이 |
| `SqlMigrationStore` | `adapters/sql-migration-store.ts` | 마이그레이션 매핑 이력 |
| `SqlPrefixRouter` | `adapters/sql-prefix-router.ts` | prefix → D1 database 라우팅 |
| `SqlPrefixRegistry` | `adapters/sql-prefix-registry.ts` | prefix registry 영속화 |

### NodeSqliteDriver

Node.js 내장 `node:sqlite` 기반 구현. 테스트와 개발에 사용.

```ts
const driver = new NodeSqliteDriver(":memory:");  // index-meta 전체 DDL 자동 적용
const store = new SqlIndexMetaStore(driver);
```

- 생성 시 전체 index-meta DDL(13개 테이블)을 자동 적용.
- `schema` 파라미터로 커스텀 DDL 또는 `null`(bare) 지정 가능.

## 구체 구현과 주소 해석

구체 구현과 주소 해석 흐름은 `index-meta-store-resolution`에서 다룬다.
