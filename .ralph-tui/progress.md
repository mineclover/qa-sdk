# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

*Add reusable patterns discovered during development here.*

- SQLite 서비스에서 drizzle 초기 마이그레이션을 재생성할 때는 기존 timestamp 폴더를 삭제한 뒤 `drizzle-kit generate`로 다시 만들고, 생성된 `migration.sql`에 모든 `CREATE TABLE/INDEX`의 `IF NOT EXISTS`와 drizzle 미지원 DDL(예: FTS5 virtual table)을 수동 후처리하는 패턴을 사용한다.
- `SqlDriver` 추상화 위에서 기존 raw CRUD를 유지해야 하는 SQLite 서비스는 `drizzle-orm/sqlite-proxy` + `sqlite-proxy/migrator`로 migration만 실행하고, Workers/D1 환경은 런타임 파일시스템이 없으므로 migration을 배포 시점에 선적용하는 하이브리드 패턴을 사용한다.

---

## [2026-03-29] - US-001
- What was implemented
- `packages/definition-service/drizzle/`의 기존 마이그레이션을 삭제 후 재생성했고, 새 `migration.sql`의 모든 `CREATE TABLE`/`CREATE INDEX`에 `IF NOT EXISTS`를 추가했다.
- `migration.sql` 끝에 `documents_fts` FTS5 virtual table DDL을 추가했고, `SearchService` 주석을 실제 동작에 맞게 동기화했다.
- Files changed
- `packages/definition-service/drizzle/20260328155250_melted_brood/migration.sql`
- `packages/definition-service/drizzle/20260328155250_melted_brood/snapshot.json`
- `packages/definition-service/src/modules/search/search.service.ts`
- `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
  - definition-service의 SQLite 초기 migration은 drizzle-kit 출력만으로는 idempotent하지 않아서, 재생성 직후 `IF NOT EXISTS` 보강과 FTS5 같은 custom DDL append가 필요하다.
  - Gotchas encountered
- FTS5를 migration에서 기본 tokenizer로 먼저 만들어버리면 `SearchService`의 trigram 우선 분기와 엇갈릴 수 있어, migration에는 trigram DDL을 두고 구버전 SQLite fallback은 기존 런타임 로직에 맡기는 편이 안전했다.
---

## [2026-03-29] - US-002
- What was implemented
- `query-service`에 `drizzle.config.ts`, `src/db/schema.ts`, `db:generate` 스크립트, `drizzle-kit` devDependency를 추가하고 `policy_rule` 스키마를 Drizzle SSOT로 이동했다.
- `SqlPolicyRuleStore`의 수동 DDL 배열 적용을 제거하고 `drizzle-orm/sqlite-proxy` 기반 migration 실행으로 교체했다. Node/Better SQLite에서는 런타임 migrate를 수행하고, D1은 배포 시점 migration 적용 전제로 no-op 처리했다.
- 초기 migration(`packages/query-service/drizzle/20260328160248_sparkling_raider/`)을 생성하고 모든 `CREATE TABLE/INDEX`에 `IF NOT EXISTS`를 추가했다.
- Files changed
- `packages/query-service/package.json`
- `packages/query-service/drizzle.config.ts`
- `packages/query-service/drizzle/20260328160248_sparkling_raider/migration.sql`
- `packages/query-service/drizzle/20260328160248_sparkling_raider/snapshot.json`
- `packages/query-service/src/db/schema.ts`
- `packages/query-service/src/stores/policy-rule.schema.ts`
- `packages/query-service/src/stores/sql-policy-rule-store.ts`
- `pnpm-lock.yaml`
- `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
  - `drizzle migrate()`를 바로 붙이기 어려운 `SqlDriver` 추상화 스토어는 `sqlite-proxy` 드라이버를 감싸서 migration만 Drizzle에 맡기고 CRUD는 기존 SQL 경로를 유지하는 방식이 가장 충돌이 적었다.
  - Gotchas encountered
  - 샌드박스에서 `pnpm install`은 pnpm store symlink 생성 단계에서 `EPERM`으로 막혀서, 이미 설치된 다른 패키지의 `drizzle-kit` 바이너리를 재사용해 migration을 생성해야 했다.
  - `pnpm --filter '...[origin/main]' build/test`는 현재 워크트리의 광범위한 기존 diff 때문에 `weighted-wasm` 빌드 권한 오류와 `rlsc`의 빈 테스트 셋 실패로 막혔고, `query-service` 자체 `typecheck/build/test`는 통과했다.
---
