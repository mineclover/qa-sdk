---
def:
  id: swc-next-qa-sdk-optimization-06-feature-cleanup-candidates
  type: knowledge
  knowledge_kind: proposal
  lifecycle: draft
  owner_system: apm-system
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: system
  depth: validation
  links:
    - target: swc-next-qa-sdk-optimization-readme
      type: depends_on
status: draft
date: 2026-10-29
part_of: swc-next-qa-sdk-optimization
role: audit
sources:
  - scripts/package-surfaces.mjs
  - scripts/ci-local.mjs
  - packages/gateway/server.ts
  - packages/gate-service/src/server.ts
  - packages/query-service/src/server.ts
  - packages/ingest-server/src/server.ts
  - packages/ingest-server/src/stores/runtime-stores.ts
---

# 기능 정리·안정화 후보군 (2026-10-29)

## 목적 ^purpose

[05-interface-map.md](./05-interface-map.md)가 이번 작업이 만든 인터페이스를 다뤘다면, 이 문서는 저장소 전체에서 정리하거나 안정화해야 할 기능을 후보로 모은다. 결정은 그룹 단위로 사람이 한다.

조사 기준은 네 가지다.
- 읽는 곳(호출자·의존 패키지)이 있는가
- 테스트가 있고 실제로 실행되는가
- 로컬 CI(`pnpm ci:local`)가 보호하는가
- 일괄 커밋(2026-10-20 deps, 2026-07-14 포맷)을 뺀 마지막 실질 변경이 언제인가

"(추정)"은 정적 분석만 했고 실제로 돌려 보지 않은 항목이다.

## 1. 결함 — 지금 고칠 가치가 큼 ^defines

| # | 대상 | 문제 | 근거 | 제안 |
|---|---|---|---|---|
| S-1 | gateway 프록시 strip | `/gate/`, `/decode/`, `/state/`, `/metrics`를 잘라 보내지만 서비스 경로는 접두사를 포함한다. 예: `/gate/check` → `/check`. gate-service에는 `/gate/check`만 있다 | `gateway/server.ts:179-200,402-404`, `worker.ts:142-186`, `registry-service/src/core/seed-config.ts:197-229` | 서비스 route 기준 테이블 하나에서 PATH_MAP을 파생하고, 프록시 경로 테스트 추가 |
| S-2 | gateway `server.ts` ↔ `worker.ts` | PATH_MAP이 다르다. worker에만 `/v1/insights`·`/v1/labels`, server에만 `/docs`·`/sync`·`/graph`·`/definitions`·`/decisions` | 같은 파일들 | S-1과 함께 단일 정의로 |
| S-3 | gateway 인증 | production wrangler 설정도 `AUTH_MODE="bypass"`. env를 zod 없이 `process.env`로 직접 읽음 | `gateway/wrangler.toml:19`, `server.ts:24-27,170-176` | **사람 결정** — 외부 노출 여부에 따라 기본값 결정. `config/env.ts` 규칙 적용 |
| S-4 | gate-service 엔진 | `gateEngine`을 어디서도 주입하지 않음 → `/gate/recompute`·`cascade-recompute`는 항상 204 no-op. state가 채워지지 않아 `checkGate`는 늘 fail-open `ACTIVE` (추정) | `gate-service/src/server.ts:21-29`, `worker.ts:18-21`, `lib/gate-service.ts:82-90` | 엔진을 배선하거나 recompute 라우트를 제거 |
| S-5 | query-service state | `stateStore`는 아무도 쓰지 않는 빈 InMemory이고 `transitionStore`·`transitionEngine`·`replay*`는 주입되지 않음 → `/state/:c/:r/history`, `/state?context_id`는 항상 501. 같은 라우트가 `/state`·`/transitions`에 이중 마운트 | `query-service/src/server.ts:58-107`, `routes/state.ts:62-74`, `app.ts:87-88` | 배선 또는 라우트 제거 (읽는 곳 없음 — §3) |
| S-6 | ingest SQLite 모드 영속 | `STORE_DRIVER=memory`(기본, 실제로는 sqlite `:memory:`)와 sqlite 모두 dlq·graph·scenarioSpec·transmission이 InMemory → 재시작하면 유실. `d1-*` 구현은 있지만 테스트에서만 사용 | `ingest-server/src/stores/runtime-stores.ts:94-129`, `worker.ts:159-162` | 있는 d1 구현을 runtime에 연결 |
| S-7 | ingest `/v1/labels*` | Node `server.ts`가 `sqlDriver`를 넘기지 않아 Node 모드에서는 라우트가 등록되지 않음 (CF worker에서만 동작). 테스트 없음 | `app.ts:158`, `routes/labels.ts:51`, `worker.ts:165` | 배선 또는 CF 전용으로 명시 |
| S-8 | decode-service decode-map | registry decode-map을 부팅 때 한 번만 가져옴 → catalog가 바뀌어도 갱신하지 않음 | `decode-service/src/server.ts:30-55,79` | registry snapshot digest(ADR-010) 기준 갱신 |
| S-9 | env 규칙 위반 | `GRPC_PORT`·`DEBUG_STORE_TTL_MS`(ingest), gateway 전체가 zod 밖에서 직접 읽음. registry `CONSTRAINT_GATE_DKG_PATH`는 정의만 있고 읽는 곳이 없음 | `ingest-server/src/server.ts:411-425`, `lib/debug-store.ts:30`, `registry-service/src/config/env.ts:32` | 스키마로 옮기거나 삭제 |

### 1.1 처리 결과 (2026-10-29)

| # | 처리 |
|---|---|
| S-1·S-2 | ✅ `gateway/lib/route-table.ts` 단일 테이블 — 세그먼트 경계·최장 접두사 매칭, strip은 별칭에만. server·worker 공유, registry seed의 gate·decode `stripPrefix` 제거. 경로 대응 19 case 테스트 (`scripts/route-table.test.ts`) |
| S-4 | 🟡 부분 — 엔진을 배선할 데이터 공급 경로가 없다 (prefix·entry·flag 데이터는 registry DB에 있고 gate-service DB와 분리, recompute 호출자 0). 성공을 가장하던 204를 `501 GATE_ENGINE_NOT_CONFIGURED`로 바꾸고 OpenAPI 오류 형태를 실제 응답에 맞춤. **엔진 데이터 공급(registry → gate) 설계는 사람 결정** |
| S-5 | ✅ 쓰는 곳 없는 빈 stateStore 제거 → 현재 상태 조회는 `{}` 대신 501. `/transitions`는 목록만 마운트 (`createTransitionRoutes`) |
| S-6 | ✅ SQLite 모드와 CF worker 모두 DLQ·graph·scenario spec·transmission을 D1 store로 저장 — 재시작 유지 테스트 |
| S-7 | ✅ SQLite 런타임 store가 `sqlDriver`를 노출하고 Node server가 `createApp`에 전달 → Node 모드에서도 `/v1/labels*` 등록. pg·InMemory 구성은 SQL 드라이버가 없어 미등록(명시) |
| S-8 | ✅ 문서보다 심각했다 — Node pool이 L2 캐시 TTL(`CACHE_TTL_MS`)을 함께 써서 부팅 60초 뒤 모든 decoder가 만료되고 다시 불러올 경로가 없었다. decoder는 만료하지 않고(`DecoderPool(0)`), `lib/decode-map-sync.ts`가 `DECODE_MAP_REFRESH_MS`마다 registry catalog digest를 보고 바뀌었을 때만 재로드. spec의 "TTL 만료 → 클라이언트 재요청" 계약을 갱신 |
| S-9 | ✅ ingest `GRPC_PORT`·`DEBUG_STORE_TTL_MS`를 zod 스키마로(InMemoryDebugStore는 `process.env`를 읽지 않음), gateway `config/env.ts` 신설(서비스 URL 키는 route-table에서 파생, 미지원 `AUTH_MODE`는 부팅 거부), registry 미사용 `CONSTRAINT_GATE_DKG_PATH` 삭제. 함께 발견: gateway 동적 라우트 조회 env가 `GATEWAY_ENV`가 아니라 `AUTH_MODE`에서 파생되던 것 수정 |
| S-3 | 대기 (사람 결정) |

## 2. stub·no-op·하드코딩

| # | 대상 | 상태 | 제안 |
|---|---|---|---|
| N-1 | ingest `INSIGHTS_DRIVER=app-hub` | `collect()`는 로그만 찍는 TODO, 조회 14개는 전부 빈 값을 돌려주는 stub. 테스트 없음 (`app-hub-insights-store.ts`) | 삭제 (App Hub 대체 검토가 재개되면 다시 설계) |
| N-2 | `DrizzleInsightsStore.collect()` | no-op (local 모드 설계상 의도). port 계약에는 의미 없는 메서드 | port에서 `collect`를 선택 메서드로 분리 |
| N-3 | convergence `OBS-PATTERN-*` → `CON-005` 엣지 | 하드코딩, 저장 실패를 조용히 무시 (`convergence-pipeline.ts:482-494`) | constraint id를 DKG 설정에서 파생하고, 실패는 warn 로그 |
| N-4 | ingest 부팅 | `DEMO_SCENARIOS`·`DEMO_CATALOG`·`DEMO_TRANSITION_SPECS`를 무조건 로드 (`server.ts:226-290`) | catalog·spec 소스를 설정으로 받기 (registry 기준) |
| N-5 | decision-service `triggerDocCreation` | 이름과 달리 로그만 남김 | §4 decision-service 판정과 함께 |
| N-6 | `STORE_DRIVER=clickhouse` | 스토어 삭제 후 enum 값만 남아 경고 뒤 SQLite로 동작 | 한 릴리스 뒤 enum에서 제거 |
| N-7 | registry `AnalysisModulePort` | `collectMetrics`·`metricsToObservations`를 선언하지만 dkg-enrichment는 둘 다 export하지 않음 (`types/spec-core-ports.ts:161`) | 실제로 쓰는 `bootstrapDkg`만 남기기 |

### 2.1 처리 결과 (2026-10-29)

| # | 처리 |
|---|---|
| N-2 | ✅ `InsightsStore.collect`를 선택 메서드로 — local 드라이버는 구현하지 않고, ingest는 `collect`가 없으면 요청마다 만들던 batch(전 record 매핑 + trace 집계)를 만들지 않는다 |
| N-3 | ✅ `CON-005` 하드코딩 제거 — `patternPromptEdges`가 DKG active constraint 중 `scope`가 observation `subjects`와 겹치는 것에 연결 (`pattern_anomaly` → CON-004·CON-005). 저장 실패는 warn 로그 |
| N-7 | ✅ registry `DkgBootstrapPort`(bootstrapDkg만) 분리 — activation gate가 `dkg-enrichment`를 `as unknown as`로 거짓 캐스트하던 것 제거. dev 대시보드용 `AnalysisModulePort`는 bootstrap + convergence metric 조합으로 유지. ingest의 미사용 동명 포트 삭제 |
| N-1·N-4·N-5·N-6 | 대기 (N-1 App Hub stub 삭제는 사람 결정, N-6은 한 릴리스 뒤) |

## 3. 읽는 곳 없는 HTTP 라우트

저장소 안 클라이언트(cli, *-web, *-ui, sdk, browser-sdk, registry-client, definition-client, e2e) 기준이다. 외부 운영 도구가 쓰고 있을 수 있으므로 **삭제 전에 사용 여부를 확인**해야 한다.

| 서비스 | 라우트 | 비고 |
|---|---|---|
| ingest | `/v1/insights/{services,event-keys,timeline,flows,sessions,coverage,permissions,errors,graph-retention}` | CLI는 summary·service-prefixes·correlations만 사용 |
| ingest | `/v1/traces/recent-diagrams`, `/v1/traces/:id/diagram`, `/v1/debug/*/recent`, `POST /v1/sessions/:id/close`, `POST /v1/traces/bulk-records` | trace-diagrams는 테스트도 없음 |
| gate | `/gate/check`, `/gate/recompute`, `/gate/cascade-recompute`, `/gate/filter-ranges` | 호출자는 CLI와 query gate-client의 state 조회뿐 |
| query | `/match-ranges`, `/compose-query`, `/query-across-versions`, `/resolve-relation`, `/rules/migrate`, `/state/*`, `/transitions/*` | CLI는 `/resolve`·`/rules`만 사용 |
| decode | `/decode/batch`, `/decode/deep`, `/decode/big*` | L2 캐시(`CACHE_DRIVER=redis`)는 단건 `/decode`에만 적용 |
| registry | `/dag/*`, `/workspace/{drafts,analyze,lock-all,release-all}`, `/resolve/manifest`, `/schema/diff` | `dag`·`metrics`·`schema` 모듈은 테스트 없음 |
| definition | `/intents/*`, `GET /consumption/*`, `/tests/*`, `/graph/:id/{impact,concerns}`, `/docs/:id/history*`, graphql | definition-client에 메서드는 있으나 부르는 곳 없음 |
| decision | `/instances`, `/links`, `/schemas` 전부 | HTTP 클라이언트 없음. CLI `decision`은 파일을 직접 읽음 |

## 4. 중복 구조

| # | 대상 | 상태 | 제안 |
|---|---|---|---|
| M-1 | dkg ↔ dkg-enrichment `skills/` 3개 (`converge-chain`·`coverage-audit`·`flow-trace`) | 같은 이름의 파일이 서로 다르게 갈라짐. CLI·서비스는 dkg 쪽만 쓰고, dkg-enrichment 쪽은 자기 테스트에서만 쓰임 | dkg를 정본으로 두고 enrichment 사본 삭제. enrichment 테스트에만 있는 케이스는 dkg로 이전 |
| M-2 | `AddressConverter`(weighted-index) ↔ `AddressProtocolManager`(index-meta) | APM이 converter를 감싸면서 프로토콜 레지스트리를 따로 또 들고 있음. APM은 index-meta 밖에서 쓰이지 않음 | APM은 수명 관리(write/read 전환, fallback)만 남기고 레지스트리는 converter에 위임 |
| M-3 | ingest `stores/pg/*` (Plan 07d) | runtime은 `@qa-sdk/store` Drizzle store를 씀. pg adapter 2개·factory·schema(747줄)와 테스트(812줄)는 runtime에서 도달하지 않음 | **사람 결정** — Plan 07d를 진행하지 않으면 삭제하고, RLS·cross-adapter 테스트를 Drizzle 경로 기준으로 다시 작성 |
| M-4 | gate·query 패키지 루트 `worker.ts` | wrangler `main`은 `src/worker.ts`. 루트 파일은 쓰이지 않는 사본 (gate 쪽은 예전 API) | 삭제 |
| M-5 | gate `routes/gate-openapi.ts` ↔ `gate.ts` | 같은 계약을 두 곳에서 정의 | 한쪽에서 다른 쪽을 파생 |
| M-6 | gate `services/{cache-invalidation,consistency}`, `memory-event-bus`, `event-bus.port` | 프로덕션 import 0 | S-4 판정과 함께 |

### 4.1 처리 결과 (2026-10-29)

| # | 처리 |
|---|---|
| M-4 | ✅ gate·query 루트 `worker.ts` 사본 삭제 (wrangler `main`은 `src/worker.ts`) |
| M-5 | ✅ `gate-openapi.ts`를 선언 전용으로 — 핸들러 사본 제거, `buildGateOpenAPIDocument()`. 사본이 실제와 갈라져 있던 것 2건 발견·수정: `/gate/filter-ranges`(실제 배열 ↔ 문서 `{ranges}`), `/gate/state`(실제 `AddressStateCacheRecord` ↔ 문서 `{reserved,inactive,open}`). `gate-openapi.test.ts`가 문서의 모든 경로를 실제 앱에 보내 status·본문 스키마를 대조 (예전 스키마로 되돌리면 실패하는 것 확인) |
| M-1 | 🟡 **결정 필요** — 아래 |
| M-2·M-3·M-6 | 대기 |

**M-1 조사 결과.** 두 사본은 이름만 같고 구현 수준이 다르다.

| skill | dkg (CLI·ingest가 사용) | dkg-enrichment (사용처 0, 자체 테스트만) |
|---|---|---|
| `convergeChain` | convergence에 의존할 수 없어 entry 단위 경험칙으로 직접 계산 — 근사치 | `@qa-sdk/convergence` 분석기(`scanAxisOverlaps`·`analyzeSimplification`·`discoverCausality`·`analyzeDeploymentSkew`) 위임 |
| `auditCoverage` | 자체 계산 | `analyzeEntryCoverage` 위임 |
| `traceFlows`·`validateDslInvariants` | 상위 집합 (`resolveRecoveredFlowObservations` 포함) | 부분 집합 |

enrichment 테스트를 dkg 구현으로 돌리면 `flow-trace`는 모두 통과하고, `convergeChain`은 2건이 실패한다 (usage에서 단일값 차원 단순화 0건 — dkg 구현에 차원 단위 분석이 없다). 권장: `traceFlows`는 dkg를 정본으로 두고 enrichment 사본 삭제. `convergeChain`·`auditCoverage`는 convergence 위임 구현(enrichment)을 정본으로 하고 dkg의 근사 구현을 삭제한 뒤 CLI import를 `dkg-enrichment`로 옮긴다 — CLI `dkg converge` 결과가 풍부해지는 **동작 변경**이다.

## 5. 패키지 그룹 (`conditional-keep`·consumer·의존 0)

| 판정 | 패키지 | 근거 |
|---|---|---|
| **삭제 후보** | `address-index`, `tag-search`, `weighted-wasm` | 코드 import 0, publish 목록 밖, spec만 있음. 지우면 spec deprecated 처리 |
| **삭제 후보** | `@qa-sdk/decision-service` | 의존자 0, 클라이언트 0, CI 밖, 실질 변경 없음 (§3 decision) |
| **삭제 후보** | `@qa-sdk/simulation-tests` | git에 없는 `synced/`가 없으면 항상 skip, 의존자 0 |
| **삭제 후보** | `weighted-index-explorer`, `@qa-sdk/authorization-monitor-web`, `@qa-sdk/operational-ontology-web`, `@qa-sdk/shop-web` | 의존자 0, 테스트 0~1. shop-web은 빌드 산출물(`public/`)만 있음. `e2e`·`arch:verify` 참조를 함께 정리해야 함 |
| **통합** | `decision-flow-store` → decision-flow, `canvas-viewport` → viz-core, `sim-decision-view`+`sim-outbox-view` → 하나, `provider-tokenizer-openai` → context provider 슬롯, `federated-connection-runtime` → connection 계열 | 소비처 1~2개, src 작음 |
| **유지·안정화** | dkg, dkg-enrichment, demo-dkg-config, decision-flow, operational-ontology, authorization-ontology, viz-core, viz-3d, platform-demo(-api), db-traffic-control, infra-engine, visbug-bridge | 소비처가 있거나 최근 활발. decision-flow·operational-ontology·viz-3d 테스트는 CI 밖 → §6. infra-engine은 platform-demo가 상대경로로 import → 정식 의존으로 |
| **동결** (CI 밖 유지, 신규 기능 금지) | motion-* 4개, browser-layout-inspector(+extension), sim-identifier-grammar·sim-internal-network·sim-service-catalog, registry-ui, roleplay-web, taxonomy-web, viz-web, viteplus-sdk-smoke, work-domain | 소비처가 cli나 데모뿐이고 실질 변경이 04~07월 |

## 6. 테스트가 돌지 않거나 보호되지 않는 곳

| # | 대상 | 상태 | 제안 |
|---|---|---|---|
| T-1 | `motion-content` | 테스트 파일 15개, test 스크립트 없음 → 한 번도 실행되지 않음 | 스크립트 추가 후 실행 결과 확인 (동결하더라도) |
| T-2 | `canvas-viewport`, `browser-layout-inspector-extension` | test 스크립트 없음 | 통합·동결 판정과 함께 |
| T-3 | `sim-outbox-view`, `demo-dkg-config` | 테스트 0 (데이터·계약 패키지) | 소비처 계약 테스트로 대체 가능한지 확인 |
| T-4 | ci-local 밖 유지 패키지 | decision-flow, operational-ontology, viz-3d 테스트 | `TEST_PACKAGES`에 추가 |
| T-5 | ingest-server | `typecheck` 스크립트 없음 | 추가 |
| T-6 | demo-tests | 기존 타입 오류 21건 → `codec-compat`만 타입 검사 | 오류 정리 후 전체 `tsc` |
| T-7 | 라우트·모듈 테스트 공백 | ingest `labels`·`trace-diagrams`·`session`·`streams`·`ws`, registry `dag`·`metrics`·`schema`, definition `consumption`·`intents`·`tests`·`graphql`, gateway 전체, decision 전체 | §3에서 남기기로 한 라우트만 테스트 추가 |

### 6.1 처리 결과 (2026-10-29)

| # | 처리 |
|---|---|
| T-1 | ✅ `motion-content` test 스크립트 추가 — 처음 실행한 145개 모두 통과 |
| T-2 | ✅ `canvas-viewport` test 스크립트 추가 (2개 통과). `browser-layout-inspector-extension`은 playwright `test:extension`이 이미 있어 유지 |
| T-4 | ✅ ci-local `TEST_PACKAGES`에 유지·안정화 7개 추가 (decision-flow, operational-ontology, viz-3d, viz-core, authorization-ontology, db-traffic-control, infra-engine). 대상 이름을 workspace와 먼저 대조하는 단계 추가 — `pnpm --filter`는 틀린 이름에도 exit 0이다. `typecheck` 그룹 신설 (스크립트 있는 대상 전부) |
| T-5 | ✅ ingest-server `typecheck` 스크립트 |
| T-6 | ✅ 16건 수정 (demo-snapshot 브리지 `DimKind`·`entries` 타입을 index-meta 입력과 일치, 테스트의 `PatternRule.id`·null 처리·`EntityId`), demo-tests 전체 `tsc` 검사 (`tsconfig.typecheck.json`). 죽은 registry skip 테스트 5개(45 case)는 `registry-service/src/e2e/`로 NestJS 이식 (`registry-test-app.ts`: 테스트마다 AppModule + 앱이 쓰는 store·RegistryService). 이식 중 **실제 결함 발견**: overflow composite draft(number 타입, product > 2^53)를 SQL store가 INTEGER로 읽다 node:sqlite RangeError → release가 OVERFLOW/NOT_READY 대신 500. capacity 계열 컬럼을 `CAST(... AS REAL)`로 읽도록 수정 (index-meta `realColumn`, 정밀도 테스트) |
| T-3·T-7 | 대기 |

## 7. 배포 계약

| # | 대상 | 상태 | 제안 |
|---|---|---|---|
| V-1 | publish 대상 14개 (`scripts/publish-local.sh`) | 이번 작업에서 breaking change(core `MetricRollup*` 제거, browser-codec strict 파싱, envelope 필드 추가)가 있었는데도 버전이 모두 0.1.0이고 changelog가 없음 | 버전·변경 기록 규칙 결정 (예: changesets). 05 §3.1 stable 등급과 연결 |

## 8. 이미 다른 곳으로 넘긴 것

- convergence scheduler 제거·worker 모드: D-9 ([02](./02-convergence-flush-review.md))
- transition metric·단발 분석: U-6·U-7 → G3 ([03](./03-unwired-spec-review.md))
- `entrySnapshot` 제거 시점(I-2), `catalog_snapshot` 영속(I-5 → #15): [05](./05-interface-map.md)

## 9. 권장 순서

1. **§1 결함 S-1·S-2·S-4·S-5·S-6** — 각각 작은 변경이고, 지금은 기능이 조용히 동작하지 않는다. S-3은 사람 결정이 먼저다.
2. **§6 T-1·T-4·T-5** — 테스트를 실제로 돌게 만들어야 그 뒤의 정리가 안전하다.
3. **§4 M-1·M-4·M-5** — 읽는 곳이 확인된 중복부터 정리.
4. **§5·§3 그룹 판정** — 삭제·통합·동결을 그룹별로 승인받아 1순위 정리와 같은 방식으로 실행.
5. **§2 stub, §7 배포 규칙.**
