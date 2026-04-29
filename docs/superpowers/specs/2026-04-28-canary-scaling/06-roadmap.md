# Enterprise-PM Canary & Scaling — Roadmap

> 본 문서는 00~05 spec에서 결정된 내용을 13단계 마이그레이션 시퀀스로 매핑하고, 단계별 의존성·검증 게이트·완료 기준을 명시한다.

## 1. 13단계 마이그레이션 시퀀스

각 단계는 단독 PR로 머지 가능하도록 범위를 한정한다. "단독 PR 가능"은 해당 단계의 산출물만으로 의미 있는 회귀 게이트를 통과할 수 있는지를 의미한다.

### 단계 1. 인프라 보강 — host.docker.internal 제거 + ingest 컨테이너화
- 목적: 다른 작업의 토대. macOS/Linux/CI 동일 동작 확보.
- 참조 spec: `04-scaling-infra.md` §6
- 산출물:
  - `docker-compose.sim.yaml` — `qa-sdk-ingest` 서비스 추가, `host.docker.internal` alias 제거
  - `.env.sim.example` 갱신 — INGEST_URL이 컨테이너 네트워크 주소를 가리키도록 수정
- 단독 PR 가능: yes

### 단계 2. identifier-grammar 패키지 + identifier-gate CI
- 목적: 이후 모든 신규 식별자가 이 위에서 합성됨.
- 참조 spec: `03-identifier-grammar.md` 전체
- 산출물:
  - `packages/sim-identifier-grammar/` 신규 패키지 (encode/decode/property 테스트 포함)
  - `.github/workflows/identifier-gate.yml`
  - `scripts/lint-identifiers.ts`
- 단독 PR 가능: yes

### 단계 3. catalog service version axis 등록 + sim-service-catalog 패키지
- 목적: 빌드 파이프라인이 catalog를 입력으로 사용하도록 전환.
- 참조 spec: `02-canary-topology.md` §2
- 산출물:
  - `contracts/service-version.catalog.ts`
  - `packages/sim-service-catalog/` — catalog 로더 + validator
- 단독 PR 가능: yes (단계 2 의존)

### 단계 4. db-bootstrap write/read 분리 + read replica 컨테이너 + replication slot
- 목적: read replica 토폴로지 도입. 기존 코드는 readUrl=writeUrl로 무중단 (BFF 라우팅은 단계 8에서 적용).
- 참조 spec: `04-scaling-infra.md` §4
- 산출물:
  - `db-bootstrap` 패키지 — write/read URL 분리 인터페이스
  - `qa-sdk-db-replica` compose entry
  - `infra/pg/init-primary.sql` — replication slot 초기화 스크립트
- 단독 PR 가능: yes

### 단계 5. outbox SKIP LOCKED + idempotency_key + outbox_consumer_log 테이블
- 목적: 다중 dispatcher 안전성 확보 (이전 평가 #1).
- 참조 spec: `04-scaling-infra.md` §2
- 산출물:
  - outbox dispatcher 코드 변경 — `SELECT ... FOR UPDATE SKIP LOCKED`
  - `sim.outbox_consumer_log` 테이블 마이그레이션
  - idempotency key builder 사용 확인 (단계 2의 grammar에서 파생)
- 단독 PR 가능: yes (단계 2 의존)

### 단계 6. bitmap cache TTL + version-check 3단계
- 목적: pub/sub 메시지 유실 시 정합성 회복 (이전 평가 #2).
- 참조 spec: `04-scaling-infra.md` §3
- 산출물:
  - `sim-bitmap-cache` 패키지 코드 변경 — TTL + version mismatch 시 재로드
  - `BitmapCacheEntry` 형태 확장 — version 필드 + lastCheckedAt
- 단독 PR 가능: yes

### 단계 7. gateway 변경 — routing table + sticky + version stamp + escape hatch
- 목적: 카나리 라우팅 단일 책임 도입.
- 참조 spec: `02-canary-topology.md` §3
- 산출물:
  - `services/gateway/src` 변경 — routing table 로딩, sticky 헤더, version stamp 주입
  - `/admin/routing` 내부 API — 컨트롤러가 라우팅을 갱신하는 진입점
- 단독 PR 가능: yes (단계 2, 3 의존)

### 단계 8. approval-api v1/v2 빌드 분리 + version stamp + DataSource 분리 (BFF/reporting → read)
- 목적: 카나리 대상 서비스를 v1/v2 동시 배포 가능 형태로 전환 + read replica 라우팅 적용.
- 참조 spec: `02-canary-topology.md` §1, §4 + `04-scaling-infra.md` §4.3
- 산출물:
  - `services/approval-api` 코드 변경 — version stamp emit
  - docker-compose entry 분리 — `approval-api-v1`, `approval-api-v2`
  - BFF/reporting 의존성 갱신 — read DataSource만 사용
- 단독 PR 가능: yes (단계 3, 4, 7 의존)

### 단계 9. sim-canary-controller 신규 서비스 — Pass 1 + Pass 2 + 사이클 + lag-injector
- 목적: 컨트롤 플레인 도입. 결정 자동화의 1차 자산.
- 참조 spec: `01-decision-model.md` 전체 + `04-scaling-infra.md` §4.4
- 산출물:
  - `services/canary-controller` 신규 서비스
  - `controller-config.yaml` — 사이클 주기/임계치/대상 서비스
  - advisory lock 체계 — 동시 컨트롤러 실행 방지
- 단독 PR 가능: yes (단계 4, 7, 8 의존)

### 단계 10. fault-injector 모듈 — schema break, audit anomaly, lag, dbPool 압박
- 목적: 시나리오 10·11·13·14가 의존하는 fault 주입 도구.
- 참조 spec: `04-scaling-infra.md` §4.4 + `05-error-and-scenarios.md` §3
- 산출물:
  - `scenarios/src/fault-injector/` — fault 종류별 모듈
  - controller fault module — controller가 fault를 트리거할 수 있는 진입점
- 단독 PR 가능: yes (단계 9 의존)

### 단계 11. 시나리오 9~17 추가 + assertion 빌더
- 목적: 결정 객체 단위 단언으로 17 시나리오 검증.
- 참조 spec: `05-error-and-scenarios.md` §3
- 산출물:
  - `scenarios/src/scenarios/scenario-9-*.ts` 등 9개 파일
  - assertion 헬퍼 — 결정 객체(Decision) 단위 단언
- 단독 PR 가능: yes (단계 9, 10 의존)

### 단계 12. break-glass CLI
- 목적: 운영자 escape hatch.
- 참조 spec: `05-error-and-scenarios.md` §2
- 산출물:
  - `scripts/sim-canary.ts` — commander 기반 CLI
  - `scripts/sim-scale.ts` — 스케일링 escape hatch
- 단독 PR 가능: yes (단계 9 의존)

### 단계 13. F.4 인프라 검증 게이트 활성화 + 기존 시나리오 1~8 회귀 확인
- 목적: 모든 검증 자산을 묶고 회귀 차단.
- 참조 spec: `05-error-and-scenarios.md` §4
- 산출물:
  - CI 워크플로 활성화 — 인프라 검증 6종 + 17 시나리오 묶음
  - 기존 시나리오 1~8 통과 확인 보고서
- 단독 PR 가능: yes (모든 이전 단계 의존)

## 2. 단계별 의존성 그래프

```
1 (host.docker.internal 제거)
└── 2 (identifier-grammar)
    ├── 3 (sim-service-catalog)
    │   └── 7 (gateway 변경)
    │       └── 8 (approval-api v1/v2)
    ├── 5 (outbox lock)
    └── 6 (bitmap TTL/version)
4 (read replica)
└── 8
9 (controller) ← 4, 7, 8
└── 10 (fault-injector)
    └── 11 (시나리오 9~17)
12 (break-glass) ← 9
13 (게이트 활성화) ← 1~12 모두
```

병렬 가능 단계:
- {2, 4} 동시 시작 가능 (단계 1 후)
- {5, 6} 단계 2 후 동시 가능
- {3, 5, 6} 단계 2 후 동시 가능
- {12} 단계 9 후 {10, 11}과 병렬

## 3. 단계별 검증 게이트

각 단계 PR이 머지되기 전에 통과해야 하는 게이트를 명시한다.

| 단계 | 필수 통과 게이트 |
|---|---|
| 1 | 기존 시나리오 1~8 무회귀, `sim:up` 동작 |
| 2 | identifier-gate CI 통과, 라운드트립 property test |
| 3 | `sim:catalog:validate` 4-way 정합성 |
| 4 | replication slot 부팅 확인, write/read 동시 연결 healthcheck |
| 5 | 단위 테스트 (락 경합 시나리오), 기존 outbox 회귀 무 |
| 6 | 단위 테스트 (TTL/version mismatch), 기존 시나리오 7·8 무회귀 |
| 7 | gateway 부팅 후 routing sync 동작 확인, 기존 시나리오 무회귀 |
| 8 | approval-api v1/v2 빌드 산출물 차이 검증 (단계 8에서는 v2=v1 동작), BFF lint rule 통과 |
| 9 | controller 부팅 + advisory lock 동작, Pass 1·2 단위 테스트 |
| 10 | fault module 단위 테스트 |
| 11 | 시나리오 9~17 모두 통과 |
| 12 | CLI dry-run 단위 테스트 |
| 13 | 17 시나리오 + 인프라 검증 모두 PASS, 1차 사이클 완료 보고 |

## 4. 후속 sub-project 분리

이전 평가에서 식별된 8개 항목 중 본 사이클에 자연 흡수되지 않는 것을 별도 sub-project로 분리한다.

| 항목 | 본 사이클 처리 | 후속 sub-project |
|---|---|---|
| #3 카오스 시나리오 일반화 | fault-injector 1차 토대 | 일반화된 카오스 매트릭스 |
| #4 HTTP retry 표준화 | controller 내부 retry만 | sim-otel-utils의 fetch-with-trace에 retry/backoff |
| #6 k6 부하 + SLO | 시나리오 12에 burst generator 1개 | k6 시나리오 매트릭스 + SLO 대시보드 |
| #7 BFF lint rule | read DataSource lint 1개 | outbox emit 금지 + path prefix 검증 등 일반화 |
| #8 README 명시 | 본 design 문서 군 자체가 부분 답 | README 내 MSA·DB·운영 모드 명시 단락 |
| #9 모노레포 build hygiene sweep | 단계 1.1 진행 위해 spec-core/viz-core/event-catalog/lockfile 4개 결함만 최소 처리(Dockerfile fix #1~4 + worktree-local lockfile sync) | spec-core 빌드(spec-transition/dkg/@qa-sdk/core import 미해결) source 차원 fix · core↔viz-core devDeps cycle 정리 · 27 의존 패키지의 누락 devDep sweep · main checkout uncommitted 작업과 lockfile 일관성 회복 |
| #10 monorepo-root .dockerignore | 단계 1 .dockerignore는 packages/ingest-server/ 안에 둠(현재 빌드 컨텍스트에서는 무시되지만 future packages-only 빌드용) | monorepo root에 `.dockerignore` 신설 — `**/node_modules`, `**/dist`, `.git`, `.worktrees/`, `**/.env`, `**/.env.local`, `**/.env.sim`(not `.example`), `coverage` 등 제외. **보안 사유**: sops 사용자가 `.env.sim`을 decrypt 한 상태에서 monorepo root context build 시 secret이 build cache로 누출될 수 있음 |
| #11 ingest-server 이미지 hardening | 단계 1 이미지는 sim-only/dev 용으로 설계됨. multistage가 부분적으로만 image size 절감, root 사용자, healthcheck wget 의존이 BusyBox 기본 포함에 의존 | (a) Stage 2 `COPY --from=builder` 를 dist 산출물만 선택적으로 복사하도록 수정 → 진짜 multistage prune. (b) Stage 2 apk 라인에 `wget` 명시 추가(BusyBox 의존 제거). (c) `USER nonroot` 추가. 운영(prod) 사용 후보 시 진행 |
| #12 qa-sdk-ingest compose entry 정리 | Task 1.2는 plan verbatim. 다음 3개 보강은 단계 1 외 처리 | (a) `<<: *nestjs-common` 미사용 사유 인라인 주석. (b) `container_name: qa-sdk-ingest` 추가 — 다른 sim-* 서비스들과 parity, `docker logs <name>` 사용성 회복. (c) `CORS_ORIGIN: "*"` narrowing 또는 `ports: 3200:3200` host publish 제거 — sim-only 컨테이너간 통신은 default network로 충분, host publish + wildcard CORS는 dev 환경에서도 unauthenticated ingest 노출 위험 |
| #13 .env.sim.example 정리 | Task 1.3은 plan verbatim 위치(observability 섹션)에 추가. 다음 보강은 후속 처리 | (a) `QA_PG_INGEST_PASSWORD`를 `# ── 데이터베이스 ──` 섹션으로 이동(실제로는 DB 비밀번호). (b) `qa-sdk-otel-collector` dangling reference에 inline 주석(telemetry profile에서만 기동, 비활성 시 무시). (c) `__from_sops__` 옆에 용도 주석 추가(qa-sdk-ingest 의 PG 사용자 비밀번호) |
| #14 sim-up.sh 동적 카운터 | Task 1.4는 services 배열 1줄만 갱신(spec verbatim). line 49의 "10/10 서비스" 하드코딩은 11 서비스 환경에서 misleading | sim-up.sh line 49 출력을 `${#SERVICES[@]}`로 동적 파생 — 추후 서비스 추가/제거 시 자동 동기화 |
| #15 sim-event-vocabulary 분리 | Task 2.6은 plan literal대로 `simulations/enterprise-pm/contracts/event-vocabulary.catalog.ts`를 그대로 사용. tsconfig에서 `rootDir` 제거로 build 통과시킴 | (a) catalog를 신규 패키지 `packages/sim-event-vocabulary/`(또는 `sim-domain-vocabulary`)로 이동 — packages/ → simulations/ 의존 방향 위반 정도. (b) sim-identifier-grammar가 새 패키지를 dependency로 import. (c) plan A-stage-2 + spec 03 §2.5 + Task 2.17 모두 갱신 |
| #16 sim-identifier-grammar typecheck cleanup | Task 2.2~2.16의 plan literal test fixture와 식별자 type shape 간 cross-section 불일치 발생 (예: schema-hash.test.ts의 eventName fixture는 `{ domain, entity, action }`인데 #5 event-name 정의는 `{ domain, aggregate, verbPast }`). vitest runtime은 esbuild라 모든 73 tests PASS, `tsc --noEmit`만 ~7건 typecheck error | (a) plan A-stage-2의 모든 test fixture를 식별자 정의와 동기화. (b) `pnpm --filter sim-identifier-grammar typecheck` PASS 확인. (c) CI gate에 typecheck 추가 |
| #17 plan B stage-3 drift check 정리 | Task 3.4의 plan-literal drift check (`parseVersionTag(entry.version).state !== entry.state`)는 retired entry의 `version: "v1"`을 `parseVersionTag` 가 `state: stable`로 반환해 자기 fixture를 false-positive로 잡음. implementer가 fix — drift check 제거, `entry.state`를 SSOT로 적용. plan B-stage-3 §Task 3.4 갱신 필요 | plan B-stage-3.md §Task 3.4의 drift check 단락을 implementer fix와 일치하도록 갱신 — `entry.state` SSOT 명시 + `version` 문자열은 image tag/url interpolation 용도로 분리 |
| #18 plan B stage-5 spec 결함 6종 정리 | Task 5.1~5.6 구현 중 plan literal에서 6개 결함 발견. implementer가 모두 fix하면서 정직 보고 | (a) import path: `@qa-sdk/sim-identifier-grammar` → `sim-identifier-grammar` (unscoped). (b) polling SQL: `WHERE status='pending'` → `WHERE status IN ('pending','failed')`. (c) consumer log INSERT 순서: claim-then-consume → consume-then-claim. (d) DLQ event idempotency_key: `dlq:${...}` 4-tier → `buildIdempotencyKey(...)` 3-tier. (e) event name grammar: `budget.created`/`expense.status_changed` 2-tier+underscore → `approval.{slice}.{verb}` 3-tier kebab. (f) entity ID grammar: `br_001`/`exp_1` underscore → `toGrammarSafeAggregateId(rawId)` helper로 canonicalize (idempotency key input only). plan B-stage-5.md 모든 SQL/TS 블록 갱신 필요 |
| #19 auth-api outbox idempotencyKey 누락 | Stage 5의 `feat(sim-approval-api): enforce buildIdempotencyKey at outbox publisher` (commit `73dfe469`)가 sim-domain-slice-kit outbox port 레벨에서 idempotencyKey를 강제했으나, auth-api의 4 use case(DepartmentUseCase, RoleUseCase, UserUseCase, RoleAssignmentUseCase)에는 적용 안 됨. Stage 7 `gateway/src/integration.test.ts` 에서 노출. PG/통합 검증 차단 | (a) auth-api 4 use case의 outbox publish 호출 site에 `buildIdempotencyKey({ aggregateId, eventName, occurredAt })` 적용. (b) `aggregateId` underscore → kebab canonicalize 동일 패턴(`toGrammarSafeAggregateId`). (c) event name 3-tier kebab 정합성 확인. (d) integration test 통과 확인. **(✅ commit `c606d855`에서 처리 완료)** |
| #21 controller ↔ gateway routing payload 정합 | Stage 9 Task 9.11 `ActionExecutor`가 plan literal대로 `{ revision, weight }`만 push. 실제 gateway `RoutingPushSchema`는 `{ services: { [svc]: { revision, stable, candidate, weight, stickyKey } } }` 요구. mock fetch tests는 통과하지만 실제 gateway integration 시 4xx | (a) ActionExecutor.executeSafety를 wrap해서 routing push body를 RoutingPushSchema 형태로 변환 (`stable`/`candidate` 정보를 catalog에서 조회하여 채움). (b) integration test (Stage 13)에서 실제 gateway 호출로 검증. (c) plan D-stage-9 §Task 9.11 갱신 |
| #22 plan D stage-10 4 plan defect | Task 10.1~10.6 구현 중 plan literal과 실제 구조 mismatch 발견 | (a) path: `packages/sim-controller/` → `simulations/enterprise-pm/services/canary-controller/`. (b) framework: Fastify plugin → NestJS `@Controller("admin/fault")`. (c) shutdown hook: `controller.start().finally` (없음) → `OnModuleDestroy + OnApplicationShutdown` lifecycle. (d) library `index.ts` re-export 미적용 (app). plan D-stage-10.md 갱신 필요 |
| #20 plan C stage-8 spec 결함 7종 정리 | Task 8.1~8.10 구현 중 plan literal에서 7개 결함 발견. implementer가 모두 fix하면서 정직 보고. plan C-stage-8.md 갱신 필요 | (a) Task 8.4 OutboxPort.publish → append (실제 contract `OutboxPort.append(record, scope)`). (b) Task 8.5 `BudgetReadModelQuery`는 Repository 추상화 위에 얇게 매핑하는 abstract class — direct Drizzle 가정 잘못. read query 마이그레이션은 token 와이어링 도입 + query 코드 마이그레이션 deferred. (c) Task 8.6 `eslint.config.mjs` 부재 → minimal flat config 신설. (d) Task 8.7 `simulations/enterprise-pm/test/` 디렉토리 부재 → 신설 + vitest.config.ts + test script 확장. (e) Task 8.9 approval-api `vitest.config.ts` `test/` include 확장. (f) Task 8.10 `runScenario({id, fixtures, ...})` API shape mismatch — 실제 `runScenario(Scenario)` + 정적 smoke로 대체. (g) env regex `/^v\d+(-stable\|-candidate)?$/` default 누락 → `SIM_SERVICE_VERSION` 미설정 시 fail-closed 발생. `.default("v0-stable")` 추가 (grammar #3 호환) |
| #23 plan E stage-11 plan defect 5종 정리 | Task 11.1~11.12 구현 중 plan literal과 실제 구조 mismatch 발견 | (a) controller import path: `@qa-sdk-sim/controller` → 실제 `@qa-sdk/sim-canary-controller` (Nest service, 라이브러리 export 없음). 헬퍼 모듈에 record view 타입을 직접 정의(SSOT는 controller `decision-builder.service.ts` `SafetyDecisionRecord`/`ResourceDecisionRecord`). (b) 타입명: `SafetyDecision`/`ResourceDecision` → 실제 `SafetyDecisionRecord`/`ResourceDecisionRecord`. (c) `parseDecisionId`/`parseCycleId`는 invalid 시 throw — `ok(parser(...))` 패턴 broken, try/catch로 wrapping. (d) §11.1.2 fixture decisionId `"sim.dec.safety.01HXYZ..."` 형식 — 실제 grammar는 `safety-decision-<ULID 26 chars>` (decision-id.ts §3 매핑). 테스트는 `buildDecisionId`로 동적 생성. (e) §11.3/§11.4 plan literal `action: { kind: "weight-update", weight: 0, revision: 1 }` deepEqual — `revisionCounter`는 module-level monotonic, 시나리오 간 격리 어려움. weight=0 invariant만 분리 단언. + scenarios 패키지에 `vitest.config.ts` 신설 (parent 가 scenarios/ 제외) + `sim-identifier-grammar` workspace dep 추가 |
| #24 sim-scenarios in-process bootstrap wiring | Stage 11 신규 9 시나리오는 `__simAuditFetcher`/`__simWaitForCycles`/`__simCatalogStore`/`__simFaultInjector`/`__simComposeHandle`/`__simBurstLoad`/`__simBffRead`/`__simOutboxClient`/`__simBitmapMetrics`/`__simBitmapVersionMutator`/`__simBitmapVersionCheck`/`__simGatewayStickyConsistency` 12개 globalThis 핸들에 의존. Stage 11은 시나리오 코드만 작성, runtime 부팅은 SKIP guard | (a) `simulations/enterprise-pm/scenarios/src/env/in-process-env.ts`에 canary-controller + fault-injector + audit-recorder + compose handle wiring 추가. (b) audit-recorder query API (`/v1/decisions?cycleIds=...`) 구현 — 현재 audit-browser-api에 decisions endpoint 없음. (c) waitForCycles signal 전달 — controller cycle write 후 emit. (d) 12 global handle initializer를 in-process-env가 globalThis에 바인딩. (e) SIM_SCENARIO_INPROC=1로 17 시나리오 PASS 검증 |
| #25 plan E stage-13 ESLint 구조 literal drift | Plan E §13.2~13.3은 `packages/sim-eslint-rules/` 별도 패키지 + `.eslintrc.cjs` legacy config + `sim/...` plugin namespace + RuleTester (`@typescript-eslint/rule-tester`) + 별도 read DataSource 모듈(`@qa-sdk-sim/approval-read-datasource`)을 가정. 실제로는 Plan C §8.6에서 정착된 구조: repo 루트 `eslint-rules/` + flat config `eslint.config.mjs` + `qa-sdk-sim/...` namespace + node:test 단위 테스트 + 동일 모듈 `READ_DATA_SOURCE`/`WRITE_DATA_SOURCE` 두 Symbol DI 토큰. Stage 13은 실제 구조 위에서 신규 rule (`no-write-call-on-read-datasource`)을 추가하고 18 unit tests PASS로 검증 | plan E-stage-13.md §13.2~13.3 literal 갱신 — `eslint-rules/`/`eslint.config.mjs`/`qa-sdk-sim/`/`node:test`/Symbol DI 토큰 기반 매칭 패턴으로 일관화. ESLint runtime 통합이 실제로 필요하면 root `pnpm exec eslint` 활성화 (현재 ESLint package 미설치, flat config dormant) |
| #26 image tag grammar lint env var 확장 비호환 | `simulations/enterprise-pm/docker-compose.sim.yaml:108,129`의 `qa-sdk/sim-approval-api:${APPROVAL_V1_TAG:-v3}`/`:${APPROVAL_V2_TAG:-v4-candidate}` 같은 env-var-based image tag를 `scripts/lint-identifiers.ts`의 `IMAGE_TAG_RE` 정규식이 reject. compose는 의도적으로 env-var 기반 카나리 토글을 위해 이 패턴 사용. `pnpm sim:smoke:full` Stage 2에서 노출됨 | (a) lint 정규식이 `${VAR:-default}` expansion을 인식하도록 보강 — default 값 추출 후 grammar 검증 또는 (b) compose env var 인터폴레이션 통과 후 검증으로 패턴 변경. plan A-stage-2b/Task 2.19의 lint 정의 갱신 |

각 후속 sub-project는 별도 brainstorming → spec → plan 사이클로 진행한다.

## 5. 완료 기준 (Definition of Done)

본 사이클이 "완료"되었다고 선언하려면 다음 모두를 충족해야 한다.

1. 13단계 모두 main 머지
2. 17 시나리오 모두 PASS (CI green)
3. 인프라 검증 6종 모두 통과 (`05-error-and-scenarios.md` §4)
4. break-glass CLI 4종 단위 테스트 통과
5. controller 30s 사이클 24시간 연속 무중단 동작 (스모크)
6. 본 6개 spec 문서가 코드와 일치 (drift 없음) — `def-doctor` 또는 동등 검증으로 확인
7. README + `00-overview.md`가 변경 영향을 명시
