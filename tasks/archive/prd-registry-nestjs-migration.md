# PRD: registry-service NestJS 전환 + prefix SDK 자체 적용

## Overview

registry-service(port 3300)를 Hono에서 NestJS로 전환한다. definition-service에서 검증된 패턴(@Global DatabaseModule, 명시적 @Inject, core/ 분리)을 그대로 적용하고, @qa-sdk/definition-client를 import하여 자기 자신의 prefix/서비스 변경을 definition-service에 자동 보고하는 구조를 만든다.

Phase 1(core/ 분리)은 완료. 이 PRD는 Phase 2~4를 다룬다.

## Goals

- registry-service의 81개 라우트를 9개 NestJS 모듈로 분리
- 각 NestJS 모듈 = 1 definition-catalog 문서 (코드-문서 1:1 매핑)
- prefix 활성화/삭제/토폴로지 변경 시 definition-service에 자동 보고
- 기존 170건 테스트 유지 + NestJS TestingModule 테스트 병행
- WebSocket dev dashboard를 @nestjs/websockets Gateway로 전환

## Quality Gates

These commands must pass for every user story:
- `pnpm --filter @qa-sdk/registry-service exec tsc --noEmit` — 타입 체크
- `pnpm --filter @qa-sdk/registry-service exec vitest run` — 기존 170건 테스트
- `pnpm --filter definition-catalog exec vitest run` — definition-catalog 410건
- `pnpm --filter @qa-sdk/definition-client exec vitest run` — client 10건
- 서버 기동 스모크 테스트: health, prefixes, catalogs, versions, services, endpoints, event-schemas 확인

## User Stories

### US-001: DatabaseModule + AppModule 뼈대

**Description:** As a developer, I want NestJS 엔트리포인트(main.ts, app.module.ts, database.module.ts)를 생성하여 기존 Hono server.ts와 병행 기동할 수 있게 한다.

**Acceptance Criteria:**
- [ ] `src/main.ts` — NestJS bootstrap (FastifyAdapter, port env에서 파생)
- [ ] `src/app.module.ts` — 빈 루트 모듈 + DatabaseModule import
- [ ] `src/database.module.ts` — @Global SQLite provider (기존 createStores 패턴 재사용)
- [ ] `src/health.controller.ts` — GET /health 응답
- [ ] `PORT=3301 tsx src/main.ts` 로 기동 시 /health 응답 확인
- [ ] 기존 `server.ts` (Hono, 3300)는 그대로 유지

### US-002: PrefixesModule (definition-service 겹치는 패턴 우선)

**Description:** As a developer, I want /prefixes CRUD를 NestJS PrefixesModule로 옮겨서 definition-service와 동일한 패턴으로 관리한다.

**Acceptance Criteria:**
- [ ] `modules/prefixes/` — PrefixController, PrefixService, PrefixModule
- [ ] POST /prefixes, GET /prefixes, GET /prefixes/:prefix, PATCH /prefixes/:prefix, DELETE /prefixes/:prefix
- [ ] PrefixService는 core/의 registry-logic(또는 lib/registry-service.ts)를 래핑
- [ ] 기존 stores/prefix-owner-store 인터페이스 그대로 사용 (@Inject DATABASE로 Sql 구현 생성)
- [ ] 기존 Hono 라우트 테스트(prefix 관련)와 동일한 결과 반환

### US-003: CatalogModule

**Description:** As a developer, I want /catalogs CRUD + config API를 CatalogModule로 분리한다.

**Acceptance Criteria:**
- [ ] `modules/catalog/` — CatalogController, CatalogService, CatalogModule
- [ ] POST/GET/PUT/DELETE /catalogs, GET /catalogs/:id/prefixes
- [ ] GET/PUT /catalogs/:id/config, GET/PUT /catalogs/:id/pattern-rules, GET /catalogs/:id/configs
- [ ] CatalogStore + ConfigStore를 @Inject로 주입
- [ ] onCatalogChange 콜백을 NestJS EventEmitter 또는 단순 메서드 호출로 대체

### US-004: VersionsModule (드래프트 라이프사이클)

**Description:** As a developer, I want /prefixes/:prefix/versions 라이프사이클을 VersionsModule로 분리한다.

**Acceptance Criteria:**
- [ ] `modules/versions/` — VersionController, VersionService, VersionModule
- [ ] createDraft, getVersion, listVersions, patchDraft, lock/unlock, release, activate, deprecate
- [ ] ActivationGateService — optional dynamic import (@qa-sdk/spec-core), CONSTRAINT_GATE_ENABLED 환경변수
- [ ] PostActivationHookService — optional, POST_ACTIVATION_HOOK_ENABLED 환경변수
- [ ] DraftLockStore 주입
- [ ] capacity SSOT 규칙 유지 (prefixRegistry 우선, versionStore와 reconcile)

### US-005: AxesModule + ServiceModule + EventModule

**Description:** As a developer, I want 나머지 CRUD 모듈(axes, services/endpoints, event-schemas)을 분리한다.

**Acceptance Criteria:**
- [ ] `modules/axes/` — GET/POST/PATCH /catalogs/:catalogId/axes
- [ ] `modules/services/` — ServiceController (GET/POST/PATCH /api/services) + EndpointController (GET /api/endpoints, /api/endpoints/resolve)
- [ ] `modules/events/` — EventSchemaController + EventCatalogController
- [ ] 각 모듈이 해당 Store를 @Inject로 주입

### US-006: WorkspaceModule + DashboardModule

**Description:** As a developer, I want draft workspace 분석과 dev dashboard를 각각 모듈로 분리한다.

**Acceptance Criteria:**
- [ ] `modules/workspace/` — WorkspaceController (simulate, analyze), WorkspaceService (core/draft-workspace 래핑)
- [ ] `modules/dashboard/` — DiagramController, DashboardController, DevDashboardGateway
- [ ] DevDashboardGateway — @nestjs/websockets 기반 /dev/ws WebSocket 전환
- [ ] @nestjs/platform-fastify + @nestjs/websockets 의존 추가
- [ ] dashboard는 optional (DEV_DASHBOARD_ENABLED 환경변수)

### US-007: SeedModule (OnModuleInit)

**Description:** As a developer, I want 시작 시 seed 로직을 SeedModule의 OnModuleInit으로 이관한다.

**Acceptance Criteria:**
- [ ] `modules/seed/` — SeedService (OnModuleInit), SeedModule
- [ ] SeedService가 core/seed-catalog, seed-config, seed-endpoints, seed-events 호출
- [ ] 기존 hash 기반 auto-reseed 로직 유지
- [ ] CatalogStore, ConfigStore, ServiceEndpointStore, EventSchemaStore, AxisProfileStore 주입
- [ ] seed 완료 후 콘솔 로그 출력

### US-008: prefix SDK 자체 적용

**Description:** As a developer, I want registry-service가 @qa-sdk/definition-client를 사용하여 자기 자신의 변경을 definition-service에 보고한다.

**Acceptance Criteria:**
- [ ] DefinitionModule.forRoot({ baseUrl: getServiceDevUrl("definition-service") }) import
- [ ] VersionService.activate() 성공 시 → defClient.recordConsumption() 호출
- [ ] PrefixService.deletePrefix() 시 → 로그 기록 (definition-service에 lifecycle 변경 알림)
- [ ] ServiceTopologyService 변경 시 → defClient.getAffectedTests() 호출 + 로그
- [ ] SeedService 완료 시 → defClient.triggerSync() 호출 (문서 동기화 트리거)
- [ ] definition-service 미기동 시 fail-open (경고만, 동작 차단 없음)

### US-009: Hono 제거 + 테스트 병행

**Description:** As a developer, I want 모든 라우트가 NestJS로 전환된 후 Hono를 제거하고 테스트를 정리한다.

**Acceptance Criteria:**
- [ ] src/routes/ 디렉토리 삭제
- [ ] src/app.ts 삭제
- [ ] src/server.ts 삭제
- [ ] package.json에서 hono, @hono/node-server, @hono/node-ws 제거
- [ ] 기존 170건 Hono 테스트를 NestJS TestingModule 기반으로 전환
- [ ] 새 테스트도 170건 이상 통과
- [ ] 서버 기동 스모크 테스트 (health, prefixes, catalogs, versions 등) 통과

### US-010: NestJS 모듈별 definition-catalog 문서 생성

**Description:** As a developer, I want 각 NestJS 모듈에 대응하는 definition-catalog 문서를 생성한다.

**Acceptance Criteria:**
- [ ] docs/specs/registry-service/ 디렉토리에 9개 모듈 문서 생성
- [ ] 각 문서: frontmatter (scope, aspect, depth, layer, links) + ^purpose + ^intent + ^context
- [ ] 모듈 간 depends_on/contains 링크 설정
- [ ] scanAndBuild 시 정상 등록 확인
- [ ] definition-service sync 시 문서 반영 확인

## Functional Requirements

- FR-1: NestJS 모듈은 definition-service와 동일한 패턴을 따른다 (@Global DatabaseModule, @Inject(DATABASE), 명시적 @Inject)
- FR-2: tsx에서 emitDecoratorMetadata 미지원 → 모든 constructor에 명시적 @Inject() 필수
- FR-3: optional 기능(activation gate, post-activation hook, dev dashboard)은 환경변수로 제어, dynamic import 유지
- FR-4: core/ 계층은 NestJS에 의존하지 않는다 (프레임워크 무관 원칙)
- FR-5: prefix SDK 연동은 fail-open — definition-service 미기동 시 경고만 출력
- FR-6: 포트는 SERVICE_PORTS SSOT에서 파생 (getServicePort("registry-service"))

## Non-Goals

- gate-service, query-service, decode-service NestJS 전환 (별도 PRD)
- ingest-server NestJS 전환 (규모 크고 독립 동작 많음, 별도 검토)
- definition-service 자체 변경 (이미 NestJS, 안정)
- 프론트엔드/브라우저 SDK 변경

## Technical Considerations

- NestJS 11.x + Fastify adapter (definition-service와 동일)
- @nestjs/websockets for dev dashboard WebSocket
- better-sqlite3 (기존 index-meta의 NodeSqliteDriver 대신 직접 사용 검토, 또는 기존 유지)
- 기존 stores/ SQL 구현은 변경하지 않음 — NestJS Service가 래핑만

## Dependencies

- definition-service가 3700에서 기동 중이어야 prefix SDK 자체 적용 동작 (fail-open)
- @qa-sdk/core의 SERVICE_PORTS에 registry-service 등록 (이미 완료)
- definition-catalog 빌드 완료 (이미 완료)

## Success Metrics

- 기존 170건 Hono 테스트 → NestJS 테스트로 전환, 동일 커버리지
- 서버 기동 스모크 26+ 체크포인트 통과
- prefix 활성화 시 definition-service에 소비율 자동 기록 확인
- 각 NestJS 모듈에 대응하는 문서 9건 생성 + scanAndBuild 정상 등록

## Open Questions

- index-meta의 PrefixRegistry/VersionLifecycleStore를 NestJS provider로 감쌀 때 동기/비동기 인터페이스 호환 (better-sqlite3는 동기)
- dev dashboard WebSocket을 @nestjs/websockets Gateway로 전환 시 기존 클라이언트 호환
