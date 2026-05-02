---
def:
  id: aspect-schema-hierarchy-00-design
  type: knowledge
  knowledge_kind: proposal
  lifecycle: review
  owner_system: definition-catalog
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: system
  depth: specification
  links:
    - target: aspect-schema-hierarchy-readme
      type: depends_on
status: under-review
date: 2026-04-21
part_of: aspect-schema-hierarchy
role: design
---

# Aspect Schema Hierarchy — 설계 개요

## 목적 ^purpose

Phase 5b B-0 에서 추가된 `ASPECT_PARENTS: Record<string, string>` 런타임 map 은 자식 aspect 의 부모를 코드 상수로 선언한다. 본 문서는 이 map 을 **definition-service SQLite 스키마로 승격** 하는 설계를 제시하며, 옵션 3 종 (C-1 / C-2 / C-3) 을 비교한다.

## 현재 상태 조사 (2026-04-21)

### 1. Aspect 가 저장되는 곳

- `packages/definition-service/src/db/schema.ts` §`documents` 테이블:
  ```
  scope: text("scope").notNull(),
  aspect: text("aspect").notNull(),  // ← 단일 문자열 컬럼
  depth: text("depth").notNull(),
  ```
- `documents.aspect` 는 **검증된 문자열값** — FK 없음, 인덱스 `idx_doc_scope (scope, aspect)` 만 존재.
- **aspect dimension 테이블은 현재 존재하지 않음**. axis entries 는 `AxisRegistry` (in-memory, registry-service fetch + DEF_ASPECT fallback) 에서만 관리.

### 2. Aspect 메타데이터가 선언되는 곳

- `packages/definition-catalog/src/vocabulary.ts` §`DEF_ASPECT` — entries 40, capacity 128, ko 한글명.
- `packages/definition-catalog/src/vocabulary.ts` §`ASPECT_PARENTS` — 자식 17 쌍 + `deriveAspectParent()` helper.
- `packages/definition-catalog/src/taxonomy.ts` §`DEFINITION_TAXONOMY` — scope 별 aspect description.
- `packages/definition-catalog/src/taxonomy.ts` §`VALID_SCOPE_ASPECTS` — scope-aspect 유효 조합 제약.

### 3. Aspect 가 조회되는 곳 (현재 런타임 경로)

- `packages/definition-service/src/core/axis-registry.ts` — registry fetch + DEF_ASPECT fallback → `isValidAspect(value)` 로 사용.
- `packages/definition-catalog/src/validate.ts` — `validateScopeAspect` (frontmatter 검증).
- `packages/definition-catalog/src/scope-registry.ts` — aspect entries 열거.
- `packages/definition-catalog/src/observe.ts` — duplicate-coordinate audit.

### 4. 핵심 결론

- 현재 **aspect 는 문자열 한 개로 저장**, 부모 관계는 코드 상수로만 존재.
- Phase C 는 **새 테이블 추가** 가 필요하다 (기존 "aspects 테이블 컬럼 확장" 시나리오는 해당 없음).
- 문서 `documents.aspect` 컬럼은 **변경 불필요** — 계층은 별도 lookup 으로 충분.

## 옵션 비교

### Option C-1 — `aspect_parents` metadata table (추천)

```sql
CREATE TABLE aspect_parents (
  child_id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL,
  description TEXT,
  registered_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_ap_parent ON aspect_parents (parent_id);
```

- **Populate**: Phase C-0 migration 이 `ASPECT_PARENTS` map 을 읽어 `INSERT` 17 rows.
- **Validator**: 부모 조회 시 DB 먼저 → 없으면 runtime map fallback (C-1 phase bridge).
- **Rollup**: `SELECT child_id FROM aspect_parents WHERE parent_id = ?` → 부모 → 자식 family.
- **문서 frontmatter**: 불변 (`aspect: codegen_func`).
- **SSOT**: `ASPECT_PARENTS` map 은 코드 SSOT, `aspect_parents` 테이블은 파생 복제본 (registry-service, 외부 도구 접근용).

**Pros**:
- 스키마 변경 1 개 테이블 → migration 작음.
- `documents` 테이블 touch 없음 → regression risk 낮음.
- Runtime map 과 DB 이중화지만 map 이 여전히 build-time SSOT 라 drift 위험 작음 (C-0 migration 이 map → DB 일방향 populate).

**Cons**:
- Aspect 전체 메타데이터 (display name, description, deprecated flag) 는 여전히 코드에만 존재 → 외부 도구가 한글명을 얻으려면 코드 참조 필요.
- Rollup family 질의는 JOIN 필요 (`documents d LEFT JOIN aspect_parents ap ON d.aspect = ap.child_id`). 단계 2 수준 JOIN 이라 성능 문제 없음.

### Option C-2 — Full aspects dimension table

```sql
CREATE TABLE aspects (
  id TEXT PRIMARY KEY,
  display_ko TEXT NOT NULL,
  description TEXT,
  scope_id TEXT NOT NULL,              -- FK to def_scope (미존재, 또한 문자열)
  parent_id TEXT REFERENCES aspects(id),
  deprecated_at TEXT,
  registered_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_aspects_parent ON aspects (parent_id);
CREATE INDEX idx_aspects_scope ON aspects (scope_id);
```

- **Populate**: `DEF_ASPECT.entries` + `DEF_ASPECT.ko` + `DEFINITION_TAXONOMY` + `ASPECT_PARENTS` 를 읽어 40 rows INSERT.
- **SSOT 이동**: `DEF_ASPECT` 코드 상수는 **codegen seed** 로 격하, DB 가 runtime SSOT.
- **외부 도구**: registry-service 가 aspects 테이블을 조회해 표준 응답 제공 가능.

**Pros**:
- Aspect 가 **1 st-class entity** 가 됨 — PR 없이 runtime aspect 추가 이론적으로 가능.
- Deprecation tracking (Phase B-4 soft-deprecation) 자연 수용.
- 다른 축 (`def_scope`, `def_depth` 등) 승격 시 재사용 가능한 패턴.

**Cons**:
- 코드/DB SSOT 이중화 — 동기화 규율 필요 (scope 검증 / codegen / `deriveAspectParent` 모두 코드 상수 의존).
- Migration 범위 크다 — `axis-registry.ts` / `validate.ts` / `scope-registry.ts` / `observe.ts` / DEF_ASPECT 의존 코드 전수 재작성.
- aspects 테이블이 먼저 존재해야 `documents.aspect` 에 FK 설정 가능 → FK 도입 시 cascade 정책 결정 필요.
- 코드베이스 규모 대비 과대 엔지니어링 (본 시점 aspect 수요 기준).

### Option C-3 — Minimal parent column

"기존 aspects 테이블에 `parent_id` 컬럼만 추가" — **기존 aspects 테이블이 없으므로 적용 불가**. C-2 의 축소판으로도 성립 안 됨.

### 비교 표

| 항목 | C-1 Metadata table | C-2 Full aspects dim | C-3 N/A |
|---|---|---|---|
| 스키마 변화 | 1 테이블 추가 | 1 테이블 추가 + documents FK | — |
| 코드 변화 | validator bridge + rollup API | axis-registry / validate / scope-registry 전면 | — |
| Populate 대상 | 17 쌍 | 40 rows | — |
| 가역성 | ✅ 완전 | △ FK 도입 후 부분 | — |
| Runtime map 관계 | fallback + 장기 공존 | 대체 (deprecation) | — |
| 외부 도구 |  일부 가능 (family 조회) | 전체 가능 (aspect 메타 전체) | — |
| 공수 | 4-6 일 | 8-12 일 | — |
| 본 RFC 채택 | ✅ | ❌ (Phase C-4 후보) | ❌ |

**Reasoning for C-1**: 본 RFC 의 목적은 "런타임 map 을 데이터로 승격" 이며, 부모-자식 쿼리 가용성만 확보되면 trigger 조건의 rollup 수요에 대응 가능하다. C-2 는 aspect 의 전체 생명주기를 DB 로 이관하지만, 그 필요성은 아직 실증되지 않았다 — YAGNI.

## Schema diff 요약

**Before (현재)**:
- `documents.aspect` text 컬럼 (FK 없음)
- `ASPECT_PARENTS` 는 코드 상수

**After (C-1 적용 후)**:
- `aspect_parents` 테이블 추가 (child_id PK, parent_id, description)
- `ASPECT_PARENTS` map 유지 (코드 SSOT + C-3 까지 validator fallback)
- `documents.aspect` 컬럼 **불변** (FK 미도입)

상세 DDL + drizzle 스키마 삽입 지점: [02-schema-diff.md](./02-schema-diff.md).

## Rollup API 설계 (Phase C-2)

### Signature

```
getAspectFamily(aspect: string): readonly string[]
```

- 입력이 부모 → `[parent, ...children]` 반환
- 입력이 자식 → `[aspect]` 만 반환 (자식의 자식은 없음, 2 레벨만)
- 입력이 최상위 (부모 아님, 자식 아님) → `[aspect]` 만 반환

### 구현 전략

- Phase C-2 (DB 조회 기반):
  ```
  const children = await db.select().from(aspectParents).where(eq(aspectParents.parentId, aspect));
  return [aspect, ...children.map(c => c.child_id)];
  ```
- Phase C-1 (bridge, DB 미존재 시):
  ```
  const children = Object.entries(ASPECT_PARENTS).filter(([_, p]) => p === aspect).map(([c]) => c);
  return [aspect, ...children];
  ```
- 2 단계 트리만 지원 (현재 트리는 모두 2-level). Deeper hierarchy 는 future work.

### CLI 노출

- `def list --aspect <x> --include-children` — 부모 aspect 입력 시 자식 문서까지 포함.
- `def audit --rollup-aspect <x>` — rollup family 전체의 dup-coord 를 집계 출력.

## 리스크

### R1 — Migration 과 문서 sync 의 레이스

Phase C-0 migration 스크립트와 `def sync` 가 동시 실행되면 `aspect_parents` 테이블 생성/populate 중인 상태에서 validator 가 빈 테이블을 조회해 fallback 이 무한히 작동할 수 있다.

**대응**:
- Migration 은 **atomic transaction** (SQLite `BEGIN IMMEDIATE`) 으로 실행.
- Validator bridge (C-1) 는 DB 미존재 / 테이블 없음 / 빈 상태 모두 fallback 경로로 처리 — fail-open.
- 전파 순서: migration 완료 → `def sync` 재실행 권장.

### R2 — 문서가 참조한 aspect 가 테이블에 없음

PR 로 신규 aspect 추가 시 vocabulary.ts 에는 있지만 `aspect_parents` 테이블에는 아직 없는 상태 발생.

**대응**:
- `aspect_parents` 는 **자식만 저장** — 최상위 aspect (부모 없음) 는 테이블에 없어도 정상.
- 신규 자식 aspect 추가 시 migration 재실행 필요. `def sync` 단계에서 runtime map 과 DB 비교 후 drift 탐지 warning.
- 대안: Insert-on-discovery — `def sync` 가 `ASPECT_PARENTS[aspect]` 존재 시 DB 에 없으면 UPSERT. **Phase C-1 에서 구현** 하여 drift 자가 치유.

### R3 — Cross-package 의존 방향

`definition-catalog` (vocabulary/validator 코드) 은 현재 **DB 에 의존하지 않는 순수 라이브러리**. Phase C-1 이 validator 가 DB 를 조회하게 만들면 의존 방향이 깨진다.

**대응**:
- **`ASPECT_PARENTS` map 은 vocabulary.ts 에 영속 유지** — catalog 패키지는 순수 유지.
- DB 조회는 `definition-service` 내부에서만 — catalog 의 `deriveAspectParent` 는 그대로, service 가 DB 우선 helper 를 별도 제공:
  ```
  // definition-service/src/core/aspect-registry.ts (신규)
  async function getAspectParent(child: string): Promise<string | null> {
    const row = await db.select().from(aspectParents).where(eq(aspectParents.childId, child)).get();
    return row?.parent_id ?? deriveAspectParent(child);  // DB → runtime map fallback
  }
  ```
- Catalog 레벨의 `validateScopeAspect` 등은 runtime map 기반 유지 → build-time 검증은 코드 상수만 사용 (regression 없음).

### R4 — 테스트가 하드코딩한 aspect 문자열

일부 테스트 (`taxonomy.test.ts`, `scope-registry.test.ts`, `validate-semantic.test.ts`) 는 aspect 문자열을 하드코딩하여 entries 개수를 검증한다.

**대응**:
- Phase C-0 은 entries 추가/제거 없음 → 기존 테스트 영향 無.
- Phase C-3 (runtime map deprecation) 시 `ASPECT_PARENTS` 참조 테스트가 JSDoc deprecation warning 을 트리거. ESLint/TS 설정으로 허용 처리.

### R5 — FK 미도입의 정합성 공백

`documents.aspect` 와 `aspect_parents.child_id` 사이 FK 가 없으므로 삭제된 aspect 를 참조하는 문서가 남을 수 있다.

**대응**:
- 현재 시점 aspect 삭제는 불가능 (DEF_ASPECT 상수 제거 금지 규칙) → 정합성 위반 경로 존재하지 않음.
- Phase C-4 (aspects dim 테이블) 에서 FK 정식 도입 가능.

## 오픈 질문

### Q1 — 테이블을 `catalog` 쪽 코드로 선언하나 `service` 쪽에서 선언하나

현재 `packages/definition-service/src/db/schema.ts` 가 drizzle 스키마의 SSOT. `definition-catalog` 는 DB 에 무관한 순수 라이브러리.

**권장**: **service 쪽에 신규 테이블 추가**. catalog 은 순수성 유지. service 가 catalog 의 `ASPECT_PARENTS` 를 build-time import 하여 populate.

### Q2 — 신규 aspect PR 의 migration 의무

신규 자식 aspect 가 PR 로 추가되면 `aspect_parents` 테이블 어떻게 갱신하나?

**제안**: `def sync` 를 **insert-on-discovery** 로 확장 — `ASPECT_PARENTS` 와 DB 를 비교해 누락분 자동 UPSERT. 별도 migration 커밋 불요. 단 Phase C-0 초기 populate 는 명시 migration 스크립트로 처리 (idempotent).

### Q3 — `scope` 도 동일 승격이 필요한가

`def_scope` 는 8 값 (ui / feature / flow / state / constraint / data / interface / meta) 이며 계층 없음. rollup 수요도 없음.

**답**: Phase C 에서는 scope 건드리지 않음. 만약 향후 `ui` 확장이 필요해지면 별도 RFC.

### Q4 — Rollup 쿼리 수요가 실제로 존재하는가

Phase C 개시 trigger 는 "rollup 요구 ≥ 5회". 현재까지 수집된 rollup 수요:

- `def audit --rollup-aspect func_def` (analysis) — 1 회
- DKG 브릿지 `getAspectFamily` (project_design-knowledge-graph) — 1 회
- dashboard filter (speculative) — 0 회

실증 3 건 미만. **Phase C-0~C-1 은 도입하고, C-2 (rollup API) 는 실제 3 번째 요구 발생 시점에 진행** 하는 것으로 단계 분리 권장. C-2 는 C-0/C-1 위에서 독립 공수.

### Q5 — Deeper hierarchy (2+ 레벨) 허용 여부

`ASPECT_PARENTS` 는 현재 모두 2 레벨 트리. 향후 `codegen_func > rust_codegen_func` 같은 3-level 시나리오가 생기면?

**답**: 본 RFC 는 2 레벨 전제. 3+ 레벨이 필요해지면 Phase C-4 (aspects dim + self-FK) 에서 재귀 CTE 로 지원. 본 RFC 의 rollup API 는 2 레벨에만 동작한다고 명시.

## 적용 후 예상 상태

### Phase C-0 완료 시
- `aspect_parents` 테이블 존재, 17 rows populated
- validator 로직 변경 없음 (runtime map 으로 계속 동작)
- errors / warnings / dup-coord 변화 없음

### Phase C-1 완료 시
- validator 가 DB 우선 조회 (미존재 시 fallback)
- drift 탐지 경로 가동
- 외부 도구 (registry-service fetch) 가 부모 관계 조회 가능

### Phase C-2 완료 시
- CLI `def list --include-children` 가용
- `def audit --rollup-aspect` 가용
- DKG 브릿지가 family 조회 사용 가능

### Phase C-3 완료 시
- `ASPECT_PARENTS` map `@deprecated` — 신규 코드는 service helper 사용
- Runtime map 자체는 1 릴리즈 cycle 동안 fallback 으로 유지

## 참조

- [README.md](./README.md) — 본 RFC 진입점
- [01-migration.md](./01-migration.md) — Phase C-0~C-4 실행 계획
- [02-schema-diff.md](./02-schema-diff.md) — DDL 차분 + populate 스크립트
- `packages/definition-catalog/src/vocabulary.ts` §`ASPECT_PARENTS`
- `packages/definition-service/src/db/schema.ts` — 신규 테이블 삽입 지점
- `packages/definition-service/src/core/axis-registry.ts` — validator 읽기 경로
- `docs/proposals/aspect-vocab-split/01-migration.md` § "Phase C" — 본 RFC 의 모태
