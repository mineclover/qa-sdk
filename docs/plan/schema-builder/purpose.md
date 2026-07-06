---
status: draft
sources:
  - packages/demo-snapshot/src/demo-catalog.ts
  - packages/demo-snapshot/src/event-schema.test.ts
  - packages/ingest-server/src/stores/d1-schema.sql.ts
  - packages/ingest-server/src/db/schema.ts
  - packages/registry-service/src/db/schema.ts
  - packages/index-meta/drizzle/20260328021248_initial/migration.sql
  - packages/store/src/db/schema.ts
  - packages/registry-service/src/core/seed-catalog.ts
---

# Schema Builder — 목적 정의

> Status: **설계 중**
> Package: `@qa-sdk/schema-builder` (신규)
> Created: 2026-03-24

---

## 0. 현행 판정

`@qa-sdk/schema-builder` 패키지는 아직 구현된 패키지가 아니다. 이 문서는 신규 패키지의 API가 존재한다고 주장하는 구현 문서가 아니라, 현재 소스에 존재하는 table schema/DDL drift를 근거로 한 계획 문서다.

현재 소스 기준으로 확정된 경계는 다음과 같다.

- `packages/demo-snapshot/src/demo-catalog.ts`의 `DEMO_CATALOG.tables`가 좌표 세계와 관계형 세계를 연결하는 `TableSchema`/`ColumnRef` 정의를 소유한다.
- `packages/demo-snapshot/src/event-schema.test.ts`가 `scalar`, `prefix_ref`, `table_ref`, `axis_ref` 4종 column reference와 event -> table -> prefix 경로를 검증한다.
- ingest D1 DDL은 `packages/ingest-server/src/stores/d1-schema.sql.ts`와 `packages/ingest-server/src/db/schema.ts`가 소유하며, store PG schema는 `packages/store/src/db/schema.ts`가 소유한다.
- registry DDL은 `packages/registry-service/src/db/schema.ts`가 소유하고, `packages/registry-service/src/core/seed-catalog.ts`가 `DEMO_CATALOG`를 registry catalog store로 seed한다.
- index-meta의 SQLite DDL은 `packages/index-meta/drizzle/20260328021248_initial/migration.sql`에 별도 소유권으로 존재한다.

따라서 이 계획의 보수적 결론은 "CATALOG.tables를 즉시 DDL SSOT로 승격한다"가 아니라, 기존 DDL 소유권을 유지한 채 schema-builder가 필요한지 판단할 수 있는 extractor/diff/migration 후보를 분리한다는 것이다.

## 1. 문제

### 현재 상태

```
DEMO_CATALOG.tables
  ├── columns: axis_ref, prefix_ref 등 좌표 참조 정의
  ├── event/table/prefix 경로 테스트
  └── 실제 DDL? → ingest/registry/index-meta/store 패키지별 수동 소유

결과:
  - 카탈로그에 테이블을 정의해도 DDL은 따로 손으로 씀
  - 카탈로그 테이블 정의와 실제 DDL/Drizzle 스키마가 drift할 수 있음
  - 어떤 테이블/컬럼이 실제로 쿼리되는지 schema-builder 관점에서는 아직 관측하지 않음
```

### Drift 후보 4곳

| 위치 | 정의 | 문제 |
|------|------|------|
| `packages/demo-snapshot/src/demo-catalog.ts` | `tables.*.columns`와 `ColumnRef` | 좌표/관계형 연결의 계획 SSOT |
| `packages/ingest-server/src/stores/d1-schema.sql.ts` | ingest D1 `CREATE TABLE` SQL | 수동 DDL |
| `packages/ingest-server/src/db/schema.ts` | ingest Drizzle schema | DDL과 1:1 대응 필요 |
| `packages/registry-service/src/db/schema.ts` | registry Drizzle schema | registry 자체 catalog/event/prefix DDL |

---

## 2. 목적

**장기적으로는 CATALOG.tables가 DDL의 유일한 입력 후보가 되어야 한다.**

단기적으로는 각 패키지가 이미 소유한 DDL을 유지하면서, 아래 기능이 실제 비용을 줄이는지 검증한다.

```
DEMO_CATALOG.tables
      │
      ▼
  schema-builder
      │
      ├── generateDDL(catalog) → SQL 문자열
      ├── diffSchema(catalog, actualSchema) → 변경 목록
      ├── migrate(catalog, driver) → 자동 마이그레이션
      └── trackUsage(driver) → 쿼리 이벤트 수집
```

---

## 3. 핵심 기능 (Tier 구분)

### Tier 1: DDL 생성 (CATALOG → SQL)

```typescript
import { generateDDL } from '@qa-sdk/schema-builder';

const ddl = generateDDL(DEMO_CATALOG.tables, {
  dialect: 'd1',           // d1 | pg | sqlite
  includeIndexes: true,
  includeConstraints: true,
});

// 결과:
// CREATE TABLE IF NOT EXISTS members (
//   id TEXT PRIMARY KEY,
//   role TEXT NOT NULL,          -- axis_ref → role (7 entries)
//   created_at TEXT NOT NULL
// );
// CREATE INDEX idx_members_role ON members(role);
```

**column → axis_ref 매핑 규칙:**

| column 타입 | SQL 타입 | 비고 |
|-------------|----------|------|
| `axis_ref` | `TEXT NOT NULL` | 축 entry 값 (문자열) |
| `prefix_ref` | `TEXT` | prefix 주소 (정수 → 문자열) |
| `text` | `TEXT` | 일반 문자열 |
| `integer` | `INTEGER` | 정수 |
| `timestamp` | `TEXT` (D1) / `TIMESTAMP` (PG) | 방언별 분기 |
| `boolean` | `INTEGER` (D1) / `BOOLEAN` (PG) | 방언별 분기 |
| `json` | `TEXT` (D1) / `JSONB` (PG) | 방언별 분기 |

### Tier 2: 스키마 Diff + 마이그레이션

```typescript
import { diffSchema, migrate } from '@qa-sdk/schema-builder';

// 실제 D1 스키마와 카탈로그 정의 비교
const diff = await diffSchema(DEMO_CATALOG.tables, driver);
// → { added: ['insight_labels'], modified: ['event_records: +actor_id'], removed: [] }

// 자동 마이그레이션 (안전한 변경만)
const result = await migrate(DEMO_CATALOG.tables, driver, { dryRun: true });
// → ALTER TABLE event_records ADD COLUMN actor_id TEXT;
```

**안전 규칙:**
- `ADD COLUMN` → 자동 실행
- `DROP COLUMN` → dryRun에서만 표시, 수동 확인 필요
- `RENAME` → 불가 (D1 제약)
- `TYPE CHANGE` → 불가 (새 컬럼 추가 + 데이터 복사)

### Tier 3: 테이블 사용 추적

```typescript
import { trackUsage } from '@qa-sdk/schema-builder';

// SqlDriver를 래핑하여 쿼리 이벤트 수집
const trackedDriver = trackUsage(driver, {
  ingestUrl: 'https://gateway/v1/ingest',
  service: 'registry-service',
});

// 사용 시 자동으로 이벤트 전송:
// event_key: "table.query"
// address_context: { service: "...", endpoint: "..." }
// payload: { table: "members", operation: "SELECT", duration_ms: 12 }
```

---

## 4. prefix 도달점으로서의 table

현재 좌표계에서 table의 위치:

```
axis (85개) ← 값의 정의
  ↓ composes
prefix (51개) ← 축의 조합 = 주소 공간
  ↓ table_ref (dim)
table (19개) ← 데이터 저장소 = 물리적 도달점
  ↓ DDL
D1/PostgreSQL ← 실제 데이터
  ↓ query
사용 이벤트 ← 관측 피드백
```

**table은 prefix의 "물리적 구현체"**:
- `members.role` = `role` 축의 물리적 저장
- `orders.service_addr` = `service` prefix의 물리적 참조
- DDL = "이 좌표 공간의 데이터를 어떤 형태로 저장할 것인가"

---

## 5. 식별자 충돌 전략 — namespace 기반 이스케이프

### 문제

table ID는 `entry`, `order` 같은 일반 단어를 사용하므로 외부 도구와 충돌한다.

| 대상 | 예약어 예시 | 충돌 테이블 |
|------|-----------|-----------|
| Mermaid erDiagram | `entry`, `order`, `type`, `key` | `entry`, `orders` |
| SQL (D1/PG) | `order`, `group`, `index`, `table` | `orders` |
| TypeScript | `type`, `string`, `number` | — |

### 비교한 접근법

| 방식 | 설명 | 채택 |
|------|------|------|
| A. 카탈로그 ID 변경 | `entry` → `tbl_entry` | ❌ 기존 코드 대규모 마이그레이션 |
| B. 출력 레이어 이스케이프 | `safeId()`에서 예약어 감지 | △ 현재 임시 적용 중 |
| **C. schema-builder가 dialect별 처리** | 원본 ID 유지 + 출력 대상별 자동 변환 | **✅ 채택** |

### 결정: C — schema-builder의 dialect가 책임진다

```
CATALOG.tables.entry (원본 — 변경 없음)
      │
      ▼
  schema-builder.resolve(tableId, dialect)
      │
      ├── dialect: "d1"      → "entry"         (SQL에서는 따옴표로 해결)
      ├── dialect: "pg"      → "entry"         (PG도 따옴표)
      ├── dialect: "mermaid" → "tbl_entry"     (Mermaid 예약어 회피)
      └── dialect: "ts"      → "EntryTable"    (TypeScript 타입명)
```

**원칙:**
- 카탈로그 원본 ID는 절대 변경하지 않는다
- 외부 도구의 제약은 schema-builder가 흡수한다
- 각 dialect는 자신의 예약어 목록을 가지고, 충돌 시 변환 규칙을 적용한다
- prefix 시스템의 고유 ID 보장은 table 레이어에서도 동일하게 적용되어야 하지만, **물리적 이름 변환은 schema-builder의 영역**

### 현재 임시 대응 (B)

`mermaid-gen.ts`의 `safeId()`에서 Mermaid 예약어를 `tbl_` 접두사로 변환 중. schema-builder 패키지 구현 시 이 로직을 `dialect/mermaid.ts`로 이관한다.

---

## 6. 다른 스키마 빌더와의 차별점

| 기존 도구 | 접근 | 한계 |
|-----------|------|------|
| Drizzle/Prisma | 코드 → DDL (ORM 중심) | 좌표 시스템 모름 |
| typeorm migration | diff → SQL | 자동이지만 의미 없는 컬럼명 |
| liquibase/flyway | XML/YAML → SQL | Java 생태계 |

**schema-builder 차별점:**
- **입력이 CATALOG** — 좌표 시스템의 의미를 반영
- **axis_ref/prefix_ref 인식** — 컬럼이 어떤 축/prefix를 참조하는지 알고 인덱스/제약 자동 생성
- **사용 추적 내장** — DDL 생성 + 쿼리 관측이 한 패키지

---

## 6. 레퍼런스 축적이 필요한 이유

### 지금 구현하면 안 되는 것

1. **방언(dialect) 분기 복잡도** — D1, PG, SQLite 각각의 타입 매핑, 제약 문법, 마이그레이션 전략이 다름. 현재는 D1만 사용하므로 PG 지원은 레퍼런스 부족.

2. **table 정의 확장** — 현재 `DEMO_CATALOG.tables`는 `columns + columnRef` 정도. FK 관계, 복합 인덱스, 파티셔닝 같은 스키마 요소가 정의 안 됨. 실 서비스에서 필요한 패턴이 더 쌓여야 함.

3. **마이그레이션 안전성** — "이 ALTER TABLE을 실행해도 되는가"를 판단하려면 실 서비스의 데이터 볼륨, 다운타임 허용치, 롤백 전략 등이 필요. 아직 운영 경험 부족.

### 지금 할 수 있는 것

1. **DDL 생성기 프로토타입** — D1 전용, `DEMO_CATALOG.tables` → `CREATE TABLE` SQL
2. **diff 체커** — 카탈로그 정의 vs 실제 D1 `sqlite_master` 비교
3. **목적 문서 + 타입 설계** — 패키지 구조, 인터페이스 확정

---

## 7. 패키지 구조 (예정)

```
packages/schema-builder/
  src/
    index.ts            — public API
    generator.ts        — CATALOG.tables → DDL SQL
    dialect/
      d1.ts             — D1/SQLite 방언
      pg.ts             — PostgreSQL 방언 (향후)
    diff.ts             — 스키마 비교
    migrate.ts          — 안전 마이그레이션
    tracker.ts          — 쿼리 사용 추적
    types.ts            — TableDef, ColumnRef 타입
  package.json
  tsconfig.json
```

**의존 방향:**
```
schema-builder → @qa-sdk/core (Catalog 타입)
              → index-meta (SqlDriver 타입)
```

---

## 8. 성공 기준

| # | 기준 | 측정 |
|---|------|------|
| S1 | `generateDDL(DEMO_CATALOG.tables)` 결과가 현재 `d1-schema.sql.ts`와 동등 | DDL diff = 0 |
| S2 | `diffSchema()`가 실제 D1과 카탈로그 정의의 drift를 감지 | event_schema 누락 → 발견 |
| S3 | 새 테이블을 카탈로그에 추가하면 DDL이 자동 생성 | 수동 SQL 작성 0 |
| S4 | 테이블 쿼리 이벤트가 insights에서 조회 가능 | event_key: "table.query" |

## 9. 검증 경로

현재 문서가 기대는 최소 검증 경로는 다음이다.

```bash
corepack pnpm --filter demo-snapshot test -- event-schema
node scripts/design-usefulness-audit.mjs --format json --all
corepack pnpm def:check
corepack pnpm arch:feedback
```

`@qa-sdk/schema-builder` 패키지가 생기기 전까지 `generateDDL`, `diffSchema`, `migrate`, `trackUsage`는 구현 완료 API가 아니라 성공 기준을 표현하는 후보 이름이다.
