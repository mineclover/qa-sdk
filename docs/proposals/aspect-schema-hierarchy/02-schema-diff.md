---
def:
  id: aspect-schema-hierarchy-02-schema-diff
  type: knowledge
  knowledge_kind: proposal
  lifecycle: review
  owner_system: definition-catalog
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: system
  depth: implementation
  links:
    - target: aspect-schema-hierarchy-readme
      type: depends_on
status: under-review
date: 2026-04-21
part_of: aspect-schema-hierarchy
role: schema-diff
---

# Aspect Schema Hierarchy — DDL Diff 및 Populate 스크립트

## 목적 ^purpose

[00-design.md](./00-design.md) 에서 선택한 Option C-1 의 **정확한 schema 차분** 과 **idempotent populate 스크립트 아웃라인** 을 제시한다. 본 문서의 SQL 은 레퍼런스이며 실제 적용은 [01-migration.md](./01-migration.md) Phase C-0 에서 수행한다.

## Before (현재 상태, 2026-04-21)

### Drizzle 스키마

`packages/definition-service/src/db/schema.ts` 의 현재 테이블 목록:

1. `prefix_registry`
2. `documents` — `aspect: text("aspect").notNull()` 컬럼만 존재, FK 없음
3. `document_links`
4. `document_history`
5. `code_references`
6. `slice_intents`
7. `consumption_snapshots`
8. `test_registry`
9. `test_results`

**Aspect 관련 관찰**:
- `documents.aspect` 는 단순 text 컬럼 — FK 없음, 정합성 DB 레벨 강제 없음
- `idx_doc_scope` 인덱스가 `(scope, aspect)` 2 컬럼을 커버 — scope-aspect 조합 조회 빠름
- **aspect dimension / parent 테이블 존재하지 않음**

### 코드 SSOT

- `packages/definition-catalog/src/vocabulary.ts` §`ASPECT_PARENTS` — 자식 17 개 → 부모 매핑
- `packages/definition-catalog/src/taxonomy.ts` §`DEFINITION_TAXONOMY` — aspect description

## After (Phase C-0 적용 후)

### 신규 Drizzle 스키마

`packages/definition-service/src/db/schema.ts` 에 다음 추가:

```
// ── aspect_parents ───────────────────────────────────────────────
// Phase C-0: Aspect 계층 구조 metadata.
// Source of truth: definition-catalog/src/vocabulary.ts §ASPECT_PARENTS (build-time).
// 본 테이블은 파생 복제본 — registry-service / 외부 도구 접근용.
export const aspectParents = sqliteTable(
  "aspect_parents",
  {
    childId: text("child_id").primaryKey(),
    parentId: text("parent_id").notNull(),
    description: text("description"),
    registeredAt: text("registered_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [index("idx_ap_parent").on(table.parentId)],
);

export type AspectParentRow = typeof aspectParents.$inferSelect;
```

### 신규 DDL

Migration 스크립트 생성 SQL:

```
-- Phase C-0 migration: aspect_parents
CREATE TABLE IF NOT EXISTS aspect_parents (
  child_id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL,
  description TEXT,
  registered_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ap_parent
  ON aspect_parents (parent_id);
```

### 변경되지 않는 것

- `documents` 테이블 — 컬럼 / 인덱스 / FK 모두 **불변**
- `DEF_ASPECT` / `ASPECT_PARENTS` / `DEFINITION_TAXONOMY` / `VALID_SCOPE_ASPECTS` 코드 상수 — 불변
- 기존 테스트 / 검증 로직 — 불변 (C-0 은 behavior 변경 없음)

## Populate 스크립트 (아웃라인)

### 위치

`packages/definition-service/src/sync/aspect-parents-sync.ts` (신규)

### 입력

- `ASPECT_PARENTS` — `import { ASPECT_PARENTS } from "definition-catalog"`
- `DEFINITION_TAXONOMY` — description 추출용 (선택)

### 로직 (pseudocode)

```
async function syncAspectParents(db: Database): Promise<SyncReport> {
  const descriptionByAspect = buildDescriptionMap(DEFINITION_TAXONOMY);
  const mapEntries = Object.entries(ASPECT_PARENTS); // 17 쌍
  const dbRows = await db.select().from(aspectParents);

  const report = { inserted: 0, updated: 0, driftOrphans: [] as string[] };

  // 1. Map → DB upsert (insert-on-discovery / self-heal)
  for (const [child, parent] of mapEntries) {
    const existing = dbRows.find(r => r.childId === child);
    if (!existing) {
      await db.insert(aspectParents).values({
        childId: child,
        parentId: parent,
        description: descriptionByAspect[child] ?? null,
      });
      report.inserted++;
    } else if (existing.parentId !== parent) {
      // Drift: DB 의 부모가 map 과 다름 → map 기준으로 갱신
      await db.update(aspectParents)
        .set({ parentId: parent })
        .where(eq(aspectParents.childId, child));
      report.updated++;
    }
  }

  // 2. Reverse drift: DB 에는 있는데 map 에는 없는 자식
  const mapChildren = new Set(mapEntries.map(([c]) => c));
  for (const row of dbRows) {
    if (!mapChildren.has(row.childId)) {
      report.driftOrphans.push(row.childId); // 삭제는 명시 migration 으로만
    }
  }

  return report;
}
```

### 실행 시점

- **초기 migration** — Phase C-0 migration SQL 실행 직후 1 회.
- **부팅 시** — definition-service 기동 후 1 회 (idempotent, fast).
- **`def sync` 시** — 수동 실행 경로에서도 1 회 (drift 탐지).

### Idempotency 보장

- `INSERT ... WHERE NOT EXISTS` 대신 pre-select + 분기 (위 pseudocode).
- Drift 의 자동 치유 범위: map 에 있는 것만. map 에 없는 것 삭제는 금지 — 수동 migration.

## 쿼리 예시 (Phase C-1 이후)

### 부모 조회

```
-- 자식의 부모 id
SELECT parent_id FROM aspect_parents WHERE child_id = 'codegen_func';
```

### 자식 목록 (rollup 기반)

```
-- 부모의 모든 자식
SELECT child_id FROM aspect_parents WHERE parent_id = 'func_def';
```

### Family 쿼리 (rollup API, Phase C-2)

```
-- 부모 + 모든 자식 (UNION)
WITH family AS (
  SELECT 'func_def' AS id
  UNION ALL
  SELECT child_id FROM aspect_parents WHERE parent_id = 'func_def'
)
SELECT d.*
FROM documents d
JOIN family f ON d.aspect = f.id;
```

### Dup-coord 집계 (rollup audit)

```
-- func_def family 내부의 scope-aspect-depth 충돌
WITH family AS (
  SELECT 'func_def' AS id
  UNION ALL
  SELECT child_id FROM aspect_parents WHERE parent_id = 'func_def'
)
SELECT d.scope, d.aspect, d.depth, COUNT(*) AS n
FROM documents d
JOIN family f ON d.aspect = f.id
GROUP BY d.scope, d.aspect, d.depth
HAVING n > 1;
```

## 롤백 (Phase C-0 revert)

```
-- revert migration
DROP TABLE IF EXISTS aspect_parents;
```

Drizzle 스키마에서 `aspectParents` export 제거 + `AspectParentRow` 타입 제거. 코드는 runtime map 만으로 계속 작동.

## 예상 row 수 (2026-04-21 기준)

- `ASPECT_PARENTS` keys = 17 → `aspect_parents` rows = **17**
- `parent_id` 분포:
  - `func_def`: 7 자식
  - `process_flow`: 5 자식
  - `api_contract`: 5 자식
  - `domain_data`: 2 자식 (`taxonomy_data`, `coordinate_model_data`)
- DISTINCT `parent_id` = 4
- 인덱스 `idx_ap_parent` 크기 작음 (< 1 KB 예상)

## Phase C-4 와의 호환성 (후속 RFC)

Phase C-4 (Option C-2) 로 승격 시:

```
-- C-4 에서 aspect_parents 를 aspects.parent_id 로 흡수
CREATE TABLE aspects (
  id TEXT PRIMARY KEY,
  display_ko TEXT NOT NULL,
  description TEXT,
  scope_id TEXT NOT NULL,
  parent_id TEXT REFERENCES aspects(id),
  deprecated_at TEXT,
  registered_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- aspect_parents 를 view 로 재정의 (쿼리 호환)
CREATE VIEW aspect_parents AS
SELECT
  id AS child_id,
  parent_id,
  description,
  registered_at
FROM aspects
WHERE parent_id IS NOT NULL;

-- 그 후 실제 테이블 drop
-- DROP TABLE aspect_parents_old;
```

C-2 에서 기록된 모든 쿼리는 view 뒤에서 그대로 작동.

## 참조

- [README.md](./README.md) — 본 RFC 진입점
- [00-design.md](./00-design.md) — 옵션 rationale
- [01-migration.md](./01-migration.md) — 실행 절차
- `packages/definition-service/src/db/schema.ts` — 삽입 지점
- `packages/definition-service/migrations/` — migration SQL 위치 (기존 패턴)
- `packages/definition-catalog/src/vocabulary.ts` §`ASPECT_PARENTS` — populate source
