# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

*Add reusable patterns discovered during development here.*

- SQLite 서비스에서 drizzle 초기 마이그레이션을 재생성할 때는 기존 timestamp 폴더를 삭제한 뒤 `drizzle-kit generate`로 다시 만들고, 생성된 `migration.sql`에 모든 `CREATE TABLE/INDEX`의 `IF NOT EXISTS`와 drizzle 미지원 DDL(예: FTS5 virtual table)을 수동 후처리하는 패턴을 사용한다.
- tsup로 배포하는 Drizzle 패키지는 `publicDir` 대신 `onSuccess: "rm -rf dist/drizzle && cp -r drizzle dist/drizzle"`로 migration 폴더만 선적하고, 런타임 로더는 소스 `drizzle/`와 번들 `dist/drizzle`를 둘 다 탐색하게 해야 SCHEMA_DDL 같은 이중 소스 폴백 없이 단일 SSOT를 유지할 수 있다.
- `SqlDriver` 추상화 위에서 기존 raw CRUD를 유지해야 하는 SQLite 서비스는 `drizzle-orm/sqlite-proxy` + `sqlite-proxy/migrator`로 migration만 실행하고, Workers/D1 환경은 런타임 파일시스템이 없으므로 migration을 배포 시점에 선적용하는 하이브리드 패턴을 사용한다.
- `drizzle-kit@1.0.0-beta.20`에서 SQLite rename 프롬프트가 뜨는데도 migration 파일이 생성되지 않으면 `generate --custom`으로 새 folder/snapshot 체인을 먼저 만든 뒤 `ALTER TABLE ... RENAME COLUMN` SQL과 최신 컬럼명 snapshot을 수동으로 채워 drift를 막는 패턴이 안전하다.
- NestJS + better-sqlite3 서비스에서 Drizzle 전환을 점진 적용할 때는 같은 커넥션 위에 `RAW_DATABASE`와 Drizzle `DATABASE` 토큰을 함께 제공하면, 마이그레이션은 한 번만 실행하면서 raw SQL 서비스와 query builder 서비스를 병행 운영할 수 있다.
- SQLite text JSON 컬럼을 Drizzle query builder로 옮길 때는 먼저 `text(..., { mode: "json" }).$type<T>()`로 schema를 승격하고 `.$inferSelect` row 타입을 서비스 mapper에 재사용하면, 물리 스키마를 건드리지 않고도 `JSON.stringify/parse`를 제거하면서 raw SQL → Drizzle 전환을 안전하게 분할할 수 있다.
- Drizzle의 literal union 문자열 컬럼에서 read mapper가 `as Foo["bar"]` 캐스트에 기대면, column schema에 `.$type<Foo["bar"]>()`를 붙여 `$inferSelect`가 바로 좁은 타입을 내도록 만드는 편이 mapper와 호출부를 더 단순하게 유지한다.
- better-sqlite3 기반 Drizzle query builder로 unique 링크 테이블을 옮길 때는 `insert(...).values(...).onConflictDoNothing().run()` 뒤에 같은 unique key로 `select().where(and(eq(...), ...)).get()`을 한 번 더 수행해 idempotent insert와 반환값 확보를 함께 처리하고, row mapper는 raw SQL의 snake_case가 아니라 Drizzle schema property명(camelCase)을 기준으로 작성해야 한다.
- 샌드박스에서 pnpm 전역 store가 워크스페이스 밖에 있어 `EPERM .../.pnpm-store/.../projects/...`로 설치가 막히면, 워크스페이스 내부 `.pnpm-store`를 만들고 전역 store의 `files`/`v3`/메타데이터는 symlink로 붙인 뒤 `projects`만 로컬 디렉토리로 남겨 `pnpm install --offline --store-dir .pnpm-store`를 실행하면 lockfile 갱신과 모듈 재링크를 복구할 수 있다.

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

## [2026-03-29] - US-003
- What was implemented
- `decision-service`의 Drizzle schema/서비스 구현이 이미 `context`, `selections`, `outcome`, `gates`, `outcomes`, `meta` 컬럼명을 사용 중임을 확인했고, 새 migration folder `packages/decision-service/drizzle/20260328162408_rename_context_columns/`를 추가해 기존 `_json` 컬럼을 rename하는 SQL 6개를 채웠다.
- `drizzle-kit generate`의 SQLite rename 프롬프트는 정상 확인했지만 beta 버전에서 결과 파일이 생성되지 않아, `drizzle-kit generate --custom`으로 snapshot 체인을 만든 뒤 `migration.sql`과 `snapshot.json`을 현재 컬럼명 기준으로 보정했다.
- 임시 in-memory SQLite에서 초기 migration + rename migration을 순서대로 적용해 최종 컬럼명이 `context/selections/outcome` 및 `gates/outcomes/meta`로 바뀌는 것을 확인했다.
- Files changed
- `packages/decision-service/drizzle/20260328162408_rename_context_columns/migration.sql`
- `packages/decision-service/drizzle/20260328162408_rename_context_columns/snapshot.json`
- `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
  - `decision-service`는 서비스 코드(raw SQL, row parser, Drizzle schema)가 이미 새 컬럼 컨벤션으로 정리돼 있었고, 이번 스토리의 실질적 누락분은 rename migration artifact였다.
  - Gotchas encountered
- `drizzle-kit@1.0.0-beta.20`의 SQLite rename flow는 프롬프트 응답까지는 진행되지만 이 리포 환경에서는 migration folder를 남기지 않는 경우가 있어, `--custom` fallback과 snapshot 수동 보정이 필요했다.
- `pnpm --filter '...[origin/main]' build`는 `packages/weighted-wasm`의 `wasm-pack` 설치 단계에서 `Operation not permitted (os error 1)`로 실패했고, `pnpm --filter '...[origin/main]' test`는 `packages/rlsc`에 테스트 파일이 없어 `vitest run`이 exit 1로 끝났다. `@qa-sdk/decision-service` 단독 build는 통과했다.
---

## [2026-03-29] - US-004
- What was implemented
- `packages/decision-service/src/database.module.ts`에서 기존 raw `DATABASE` 토큰을 Drizzle `BetterSQLite3Database`로 전환하고, 같은 커넥션을 재사용하는 `RAW_DATABASE` 보조 토큰을 추가해 기존 raw SQL 서비스와 병행 가능하게 만들었다.
- `packages/decision-service/src/db/schema.ts`의 `flow_schemas.gates/outcomes/meta`를 `text(..., { mode: "json" })`로 바꿔 Drizzle이 JSON 직렬화/역직렬화를 담당하게 했고, `SchemasService`의 `register/get/list/delete`를 모두 query builder 기반으로 교체했다.
- `@qa-sdk/decision-service` 단독 build를 통과시켰고, `pnpm --filter '...[origin/main]' build/test`도 다시 실행해 현재 브랜치 공용 실패 원인을 재확인했다.
- Files changed
- `packages/decision-service/src/database.module.ts`
- `packages/decision-service/src/db/schema.ts`
- `packages/decision-service/src/modules/schemas/schemas.service.ts`
- `packages/decision-service/src/modules/instances/instances.service.ts`
- `packages/decision-service/src/modules/links/links.service.ts`
- `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
  - `text(..., { mode: "json" }).$type<T>()`를 쓰면 SQLite text 컬럼에서도 Drizzle가 `JSON.stringify/parse`를 직접 수행하므로, 서비스 계층에서는 typed object/array를 그대로 `insert/select`할 수 있다.
  - Gotchas encountered
  - `DATABASE` 토큰을 Drizzle DB로 바꾸면 아직 raw SQL을 쓰는 sibling 서비스가 바로 깨지므로, 이번 단계에서는 `RAW_DATABASE`를 별도 노출해 같은 better-sqlite3 커넥션을 공유하게 만드는 게 가장 안전했다.
- `pnpm --filter '...[origin/main]' build`는 이번 변경과 무관하게 `packages/weighted-wasm`의 `wasm-pack` 설치 단계에서 `Operation not permitted (os error 1)`로 실패했고, `pnpm --filter '...[origin/main]' test`는 `packages/rlsc`에 테스트 파일이 없어 `vitest run`이 exit 1로 끝났다. `@qa-sdk/decision-service` 단독 build는 통과했다.
---

## [2026-03-29] - US-005
- What was implemented
- `packages/decision-service/src/db/schema.ts`의 `flow_instances.context/selections/outcome`를 Drizzle JSON mode로 승격하고 `FlowInstanceSelection`, `FlowInstanceRow` 타입을 추가해 인스턴스 row를 typed select 결과로 다루게 했다.
- `InstancesService(save, get, findBySchema, findByStatus, list)`를 모두 Drizzle query builder로 전환했다. `save`는 `insert(...).values(...).onConflictDoUpdate(...)`, 조회 계열은 `select().from().where()/orderBy()/limit()/offset().get()/all()` 패턴으로 교체했다.
- 수동 `JSON.stringify/JSON.parse`를 제거하고, 완료 인스턴스 후처리(`triggerDocCreation`) 동작은 그대로 유지했다.
- Files changed
- `packages/decision-service/src/db/schema.ts`
- `packages/decision-service/src/modules/instances/instances.service.ts`
- `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
  - `flow_instances`처럼 SQLite에서 실제 저장 타입은 그대로 text여도, Drizzle schema만 JSON mode로 선언하면 migration 추가 없이 query builder 계층에서 typed object/array를 바로 주고받을 수 있다.
  - Gotchas encountered
  - `findBySchema/findByStatus/list`를 query builder로 옮길 때 기존 API 계약(limit/offset, startedAt DESC 정렬)을 유지해야 해서 acceptance criteria보다 한 단계 더 긴 체인(`where + orderBy + limit + offset`)으로 맞추는 편이 안전했다.
  - `pnpm --filter '...[origin/main]' build`는 이번 변경과 무관하게 `packages/weighted-wasm`의 `wasm-pack` 단계에서 `Operation not permitted (os error 1)`로 실패했고, `pnpm --filter '...[origin/main]' test`는 `packages/rlsc`에 테스트 파일이 없어 `vitest run`이 exit 1로 끝났다. `@qa-sdk/decision-service` 단독 build는 통과했다.
---

## [2026-03-29] - US-006
- What was implemented
- `LinksService`의 `link`, `findByInstance`, `findByDoc`, `unlink`를 raw SQL에서 Drizzle query builder로 전환했다.
- `link`는 `insert(flowLinks).values(...).onConflictDoNothing().run()` 뒤에 unique key 재조회로 반환 row를 확보하도록 바꿨고, 조회 메서드는 기존 정렬 의미를 유지한 채 `select().from().where(...).all()` 패턴으로 옮겼다.
- `flow_links` select 결과를 안정적으로 매핑하기 위해 `FlowLinkRow` 타입을 추가하고 mapper를 Drizzle의 camelCase row shape 기준으로 수정했다.
- Files changed
- `packages/decision-service/src/db/schema.ts`
- `packages/decision-service/src/modules/links/links.service.ts`
- `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
  - Drizzle의 `select().from(table)` 결과는 DB 컬럼명 snake_case가 아니라 schema property명(camelCase)으로 들어오므로, raw SQL mapper를 그대로 재사용하면 런타임에서 값이 비게 된다.
  - Gotchas encountered
- `onConflictDoNothing()`은 better-sqlite3 경로에서 삽입/기존 row를 직접 반환하지 않으므로, 이번처럼 API가 row payload를 반환해야 하는 경우 unique key 기반 후속 `select().get()`가 필요했다.
  - `pnpm --filter '...[origin/main]' build`는 이번 변경과 무관하게 `packages/weighted-wasm`의 `wasm-pack` 단계에서 `Operation not permitted (os error 1)`로 실패했고, `pnpm --filter '...[origin/main]' test`는 `packages/rlsc`에 테스트 파일이 없어 `vitest run`이 exit 1로 끝났다. `@qa-sdk/decision-service` 단독 build는 통과했다.
---

## [2026-03-29] - US-007
- What was implemented
- `packages/index-meta/tsup.config.ts`에 `onSuccess` 훅을 추가해 `drizzle/`를 `dist/drizzle`로 복사하도록 바꿨다.
- `packages/index-meta/src/adapters/node-sqlite-driver.ts`에서 167줄 `SCHEMA_DDL` 상수와 생성자 폴백 분기를 제거하고, 마이그레이션은 drizzle folder를 반드시 찾은 뒤 적용하도록 정리했다.
- `findMigrationsFolder()`가 소스 실행(`drizzle/`)과 tsup 번들 실행(`dist/drizzle`)을 모두 탐색하도록 보강했고, `index-meta` 단독 `typecheck/build/test`와 `@qa-sdk/registry-service` 소비자 테스트를 재검증했다.
- Files changed
- `packages/index-meta/tsup.config.ts`
- `packages/index-meta/src/adapters/node-sqlite-driver.ts`
- `packages/index-meta/src/adapters/sql-prefix-registry.ts`
- `packages/index-meta/src/meta-codec.ts`
- `packages/index-meta/tsconfig.json`
- `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
  - `index-meta`처럼 tsup DTS 번들이 workspace sibling 패키지의 선언 산출물 부재로 막히면, 로컬 `tsconfig`에서 `paths`로 sibling `src`를 가리키고 `rootDir`를 넓혀 타입만 참조하게 하면 패키지 단독 `typecheck/build`를 복구할 수 있다.
  - Gotchas encountered
  - `cp -r drizzle dist/drizzle`는 `dist/drizzle`가 이미 있을 때 중첩 복사가 생길 수 있어, watch/rebuild 안전성을 위해 `rm -rf dist/drizzle && cp -r drizzle dist/drizzle` 형태로 감싸는 편이 안전했다.
  - `pnpm --filter '...[origin/main]' build`는 이번 변경과 무관하게 `packages/weighted-wasm`의 `wasm-pack` 단계에서 `Operation not permitted (os error 1)`로 실패했고, `pnpm --filter '...[origin/main]' test`는 `packages/rlsc`에 테스트 파일이 없어 `vitest run`이 exit 1로 끝났다.
---

## [2026-03-29] - US-008
- What was implemented
- `packages/decision-service/package.json`과 `packages/definition-service/package.json`의 `better-sqlite3`를 모두 `^12.8.0`, `@types/better-sqlite3`를 `^7.6.13`으로 통일했다.
- 샌드박스에서 기본 pnpm store 경로가 막혀서, 워크스페이스 내부 `.pnpm-store`를 전역 store 캐시에 연결한 뒤 `pnpm install --lockfile-only --offline --store-dir .pnpm-store`와 `CI=true pnpm install --offline --store-dir .pnpm-store`로 lockfile과 node_modules를 재정렬했다.
- `packages/definition-catalog/tsconfig.json`에 `weighted-index` source path 매핑을 추가해 declaration build를 복구했고, 그 결과 `definition-catalog` 재빌드 후 `@qa-sdk/definition-service` build까지 통과시켰다.
- Files changed
- `packages/decision-service/package.json`
- `packages/definition-service/package.json`
- `packages/definition-catalog/tsconfig.json`
- `pnpm-lock.yaml`
- `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
  - 워크스페이스 밖 pnpm store 때문에 install이 막히는 샌드박스에서는, local store + 외부 cache symlink + 로컬 `projects/` 조합이 가장 적은 변경으로 오프라인 install을 복구하는 패턴이다.
  - Gotchas encountered
  - `pnpm --filter @qa-sdk/definition-service build` 실패 원인은 이번 SQLite 업그레이드가 아니라 `definition-catalog`의 declaration 산출물 부재였고, `weighted-index`도 dist d.ts가 비어 있어 sibling source를 직접 가리키는 tsconfig `paths`/`rootDir` 보강이 필요했다.
- `pnpm --filter '...[origin/main]' build`는 여전히 `packages/weighted-wasm`의 `wasm-pack` 단계에서 `Operation not permitted (os error 1)`로 실패했고, `pnpm --filter '...[origin/main]' test`와 `pnpm --filter @qa-sdk/definition-service test`는 각각 `packages/rlsc`, `packages/definition-service`에 테스트 파일이 없어 `vitest run`이 exit 1로 끝났다.
---

## [2026-03-29] - US-009
- What was implemented
- `packages/motion-workspace-service/src/sqlite-repository.ts`에서 미사용 `SQLITE_TIMESTAMP_SQL` 상수를 제거하고, `createDatabase()` 헬퍼를 없애 생성자에서 `getDatabaseSync()` 결과를 바로 인스턴스화하도록 정리했다.
- `packages/cli/src/db/schema.ts`의 `flow_instances.status`를 `.$type<FlowInstance["status"]>()`로 승격해 `packages/cli/src/stores/flow-sqlite-store.ts`의 `as FlowInstance["status"]` 캐스트를 제거했다.
- `packages/cli/src/db/schema.ts`의 `created_at` 기본값을 `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`로 통일하고, `packages/cli/drizzle/20260328165947_faulty_victor_mancha/` 초기 migration/snapshot을 재생성한 뒤 `IF NOT EXISTS`를 다시 보강했다.
- Files changed
- `packages/motion-workspace-service/src/sqlite-repository.ts`
- `packages/cli/src/db/schema.ts`
- `packages/cli/src/stores/flow-sqlite-store.ts`
- `packages/cli/drizzle/20260328165947_faulty_victor_mancha/migration.sql`
- `packages/cli/drizzle/20260328165947_faulty_victor_mancha/snapshot.json`
- `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
  - Drizzle schema의 `.$type<>()`만으로도 `$inferSelect` row 타입이 즉시 좁아지므로, literal union 컬럼은 저장소 mapper에서 후행 캐스트를 두기보다 schema 쪽에서 타입을 고정하는 편이 재사용성이 좋다.
  - Gotchas encountered
  - `drizzle-kit generate`로 재생성한 SQLite 초기 migration은 기본값 표현은 맞게 갱신되지만 `IF NOT EXISTS`가 빠져서, 기존 코드베이스의 idempotent migration 규칙에 맞추려면 생성 직후 수동 후처리가 필요했다.
  - `pnpm --filter '...[origin/main]' build`는 이번 변경과 무관하게 `packages/weighted-wasm`의 `wasm-pack` 단계에서 `Operation not permitted (os error 1)`로 실패했고, `pnpm --filter '...[origin/main]' test`는 이번에도 `packages/rlsc`에 테스트 파일이 없어 `vitest run`이 exit 1로 끝났다. 다만 `@qa-sdk/cli`의 `typecheck/build/test`와 `@qa-sdk/motion-workspace-service`의 `tsc --noEmit`/`build`/`test`는 모두 통과했다.
---
