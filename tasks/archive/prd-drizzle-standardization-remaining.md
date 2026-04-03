# PRD: Drizzle 마이그레이션 표준화 잔여 작업

## Overview

모노레포 전체에 Drizzle ORM 스키마 + drizzle-kit 마이그레이션을 도입한 후, 아직 남아있는 불일치와 타입 안전성 이슈를 해결한다. definition-service의 IF NOT EXISTS 누락(기존 DB에서 migrate 실패 위험), query-service의 불완전한 drizzle 셋업, decision-service의 raw SQL 잔존, 그리고 index-meta SCHEMA_DDL 이중 소스 문제를 해결하여 모든 SQLite 서비스가 동일한 아키텍처 패턴을 따르도록 한다.

## Goals

- definition-service 마이그레이션 SQL의 IF NOT EXISTS 누락을 수정하여 기존 DB 안전성 확보
- query-service에 drizzle-kit 셋업을 완성하여 POLICY_RULE_SCHEMA_STATEMENTS 이중 관리 제거
- decision-service 3개 NestJS 서비스의 raw SQL을 drizzle query builder로 전환하여 타입 안전성 확보
- index-meta SCHEMA_DDL 폴백을 제거하고 drizzle/ 폴더를 tsup 번들에 포함
- better-sqlite3 버전을 ^12로 통일
- decision-service 컬럼명을 CLI 패턴(`context`, `selections`, `outcome`)으로 통일

## Quality Gates

변경된 패키지만 검증:
- `pnpm --filter ...[origin/main] build` — 빌드 통과
- `pnpm --filter ...[origin/main] test` — 테스트 통과

## User Stories

### US-001: definition-service 마이그레이션 SQL IF NOT EXISTS 추가

**Description:** 유지보수자로서, definition-service의 drizzle 마이그레이션 SQL에 IF NOT EXISTS가 누락된 문제를 수정하여 기존 데이터가 있는 DB에서도 안전하게 마이그레이션이 실행되도록 한다.

**Acceptance Criteria:**
- [ ] `packages/definition-service/drizzle/` 기존 마이그레이션 삭제 후 재생성
- [ ] 생성된 migration.sql의 모든 CREATE TABLE에 IF NOT EXISTS 추가
- [ ] 생성된 migration.sql의 모든 CREATE INDEX에 IF NOT EXISTS 추가
- [ ] FTS5 virtual table DDL이 migration.sql 끝에 포함됨
- [ ] `pnpm --filter @qa-sdk/definition-service build` 통과

### US-002: query-service drizzle-kit 셋업 완성

**Description:** 유지보수자로서, query-service에 drizzle-kit + drizzle.config.ts + 마이그레이션 폴더를 추가하여 POLICY_RULE_SCHEMA_STATEMENTS 이중 관리를 제거한다.

**Acceptance Criteria:**
- [ ] `packages/query-service/package.json`에 `drizzle-kit: 1.0.0-beta.20` devDependency 추가
- [ ] 기존 `policy-rule.schema.ts`의 스키마를 `src/db/schema.ts`로 이동
- [ ] `packages/query-service/drizzle.config.ts` 생성 (dialect: sqlite, schema: ./src/db/schema.ts)
- [ ] `POLICY_RULE_SCHEMA_STATEMENTS` 배열 제거
- [ ] `SqlPolicyRuleStore`의 `ensureSchema()` 를 drizzle migrate()로 대체
- [ ] `db:generate` 스크립트 추가
- [ ] 초기 마이그레이션 생성 + IF NOT EXISTS 추가
- [ ] `pnpm --filter query-service build && pnpm --filter query-service test` 통과

### US-003: decision-service 컬럼명 통일 (context_json → context)

**Description:** 유지보수자로서, decision-service의 컬럼명을 CLI 패턴(`context`, `selections`, `outcome`)으로 통일하여 같은 도메인 엔티티(FlowInstance)의 저장 컨벤션을 일치시킨다.

**Acceptance Criteria:**
- [ ] `packages/decision-service/src/db/schema.ts` 컬럼명 변경: `context_json→context`, `selections_json→selections`, `outcome_json→outcome`, `gates_json→gates`, `outcomes_json→outcomes`, `meta_json→meta`
- [ ] drizzle-kit generate로 ALTER TABLE RENAME COLUMN 마이그레이션 생성
- [ ] 생성된 SQL에 컬럼 리네임 구문 확인
- [ ] `instances.service.ts`, `schemas.service.ts`, `links.service.ts`의 raw SQL에서 old 컬럼명 → new 컬럼명 반영
- [ ] `pnpm --filter @qa-sdk/decision-service build` 통과

### US-004: decision-service raw SQL → drizzle query builder 전환

**Description:** 유지보수자로서, decision-service의 3개 NestJS 서비스(SchemasService, InstancesService, LinksService)의 raw SQL 쿼리를 drizzle query builder로 전환하여 타입 안전한 쿼리를 사용한다.

**Acceptance Criteria:**
- [ ] `database.module.ts`에서 drizzle DB 인스턴스를 DI 토큰으로 제공 (기존 raw `Database` 대신)
- [ ] `SchemasService` — register(upsert), get, list, delete를 drizzle query builder로 전환
- [ ] `InstancesService` — save(upsert), get, findBySchema, findByStatus, list를 drizzle query builder로 전환
- [ ] `LinksService` — link(INSERT OR IGNORE + SELECT), findByInstance, findByDoc, unlink을 drizzle query builder로 전환
- [ ] 각 서비스의 수동 `JSON.stringify`/`JSON.parse`가 drizzle 스키마의 text 타입으로 처리됨
- [ ] `pnpm --filter @qa-sdk/decision-service build` 통과

### US-005: index-meta SCHEMA_DDL 제거 + drizzle/ 폴더 tsup 번들 포함

**Description:** 유지보수자로서, index-meta의 167줄 SCHEMA_DDL 폴백을 제거하고 drizzle/ 폴더를 tsup 번들에 포함시켜 이중 소스 문제를 해결한다.

**Acceptance Criteria:**
- [ ] `packages/index-meta/tsup.config.ts`에 `onSuccess` 훅으로 `cp -r drizzle dist/drizzle` 추가
- [ ] `NodeSqliteDriver` constructor에서 SCHEMA_DDL 폴백 분기 제거
- [ ] `findMigrationsFolder()` 유틸이 dist/drizzle 경로도 탐색하도록 확인
- [ ] SCHEMA_DDL 상수 제거 (167줄)
- [ ] `pnpm --filter index-meta build` 후 dist/drizzle/ 폴더 존재 확인
- [ ] `pnpm --filter index-meta test` 922건 통과
- [ ] `pnpm --filter @qa-sdk/registry-service test` 212건 통과 (소비자 검증)

### US-006: better-sqlite3 ^12 통일

**Description:** 유지보수자로서, decision-service(^11.0.0)와 definition-service(^11.7.0)의 better-sqlite3를 ^12로 업그레이드하여 모노레포 전체 버전을 통일한다.

**Acceptance Criteria:**
- [ ] `packages/decision-service/package.json` better-sqlite3 → ^12.8.0
- [ ] `packages/definition-service/package.json` better-sqlite3 → ^12.8.0
- [ ] `@types/better-sqlite3` 도 ^7.6.13으로 통일
- [ ] `pnpm install` 후 lock 파일에 better-sqlite3 단일 버전
- [ ] `pnpm --filter @qa-sdk/decision-service build && pnpm --filter @qa-sdk/definition-service build` 통과

### US-007: 죽은 코드 + 타입 캐스트 정리

**Description:** 유지보수자로서, 이전 라운드에서 남은 죽은 코드와 불필요한 타입 캐스트를 정리하여 코드 품질을 개선한다.

**Acceptance Criteria:**
- [ ] `motion-workspace-service/src/sqlite-repository.ts`의 미사용 `SQLITE_TIMESTAMP_SQL` 상수 제거
- [ ] `motion-workspace-service/src/sqlite-repository.ts`의 `createDatabase` 헬퍼 인라인화
- [ ] `cli/src/stores/flow-sqlite-store.ts`의 `as FlowInstance["status"]` 캐스트를 스키마 `$type<>()` 어노테이션으로 대체
- [ ] 타임스탬프 기본값을 `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')` (ISO-8601)로 통일 — cli schema 수정 + 마이그레이션 재생성
- [ ] `pnpm --filter ...[origin/main] build` 통과

## Functional Requirements

- FR-1: 모든 SQLite 마이그레이션 SQL의 CREATE TABLE/INDEX에 IF NOT EXISTS 필수
- FR-2: 모든 SQLite 서비스는 `src/db/schema.ts` + `drizzle.config.ts` + `drizzle/` 폴더를 갖추어야 함
- FR-3: drizzle query builder를 사용하는 서비스에서 수동 RawRow 인터페이스 금지 — 스키마에서 타입 추론
- FR-4: index-meta tsup 번들에 drizzle/ 폴더가 포함되어 런타임에서 파일시스템 기반 마이그레이션 실행 가능
- FR-5: 동일 도메인 엔티티(FlowInstance)는 CLI와 서비스에서 동일한 컬럼 네이밍 컨벤션 사용

## Non-Goals

- definition-service의 5개 스토어(doc, prefix, intent, consumption, test) drizzle query builder 전환 (FTS5 + prepared statement 복잡도로 별도 스프린트)
- ingest-server D1 store의 drizzle query builder 전환 (Workers 환경 제약)
- spec-core DkgSqliteStore의 drizzle query builder 전환 (~25 메서드, 별도 작업)
- ingest-server `INGEST_D1_SCHEMA_DDL` 제거 (Workers 파일시스템 제약으로 유지 필요)

## Technical Considerations

- decision-service는 NestJS DI를 사용하므로, drizzle DB 인스턴스를 DI 토큰으로 제공해야 함. 기존 `DATABASE` 토큰의 타입을 `Database.Database`에서 drizzle `BetterSQLite3Database`로 변경
- index-meta tsup `publicDir`이 `drizzle/` 폴더만 복사하는지, 다른 assets도 영향받는지 확인 필요
- decision-service 컬럼 리네임은 SQLite의 ALTER TABLE RENAME COLUMN 지원(3.25.0+) 필요 — Node.js 내장 SQLite 버전 확인
- query-service는 `SqlDriver` 추상화를 사용하므로, drizzle migrate + 기존 SqlDriver 쿼리 패턴 공존 필요 (cli와 유사한 하이브리드 구조)

## Future Work

- definition-service 5개 스토어 drizzle query builder 전환 (FTS5 virtual table 포함)
- spec-core DkgSqliteStore drizzle query builder 전환 (~25 메서드)
- ingest-server D1 store drizzle query builder 전환 (Workers 환경 해결 시)

## Success Metrics

- 모노레포 내 모든 SQLite 서비스가 drizzle-kit 셋업 완료 (10/10)
- decision-service + cli + motion-workspace-service의 쿼리가 drizzle query builder 기반 (3/3)
- `as any` / `as unknown as` drizzle 관련 캐스트 0건
- SCHEMA_DDL 이중 소스 제거 (index-meta)
- better-sqlite3 단일 메이저 버전 (^12)

## Open Questions

~~tsup `publicDir`이 drizzle/ 폴더의 메타 파일까지 복사하는지~~ → **해결**: tsup publicDir은 하위 구조를 유지하여 복사. 다만 `publicDir: "."` 는 전체 파일 복사라 비효율적이므로, tsup `onSuccess` 훅에서 `cp -r drizzle dist/drizzle` 사용 권장.

~~SQLite ALTER TABLE RENAME COLUMN 지원 여부~~ → **해결**: Node.js 내장 SQLite 3.51.2에서 `ALTER TABLE RENAME COLUMN` 지원 확인. drizzle-kit generate의 자동 감지 여부는 US-003 구현 시 확인.
