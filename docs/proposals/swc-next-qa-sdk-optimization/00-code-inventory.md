---
def:
  id: swc-next-qa-sdk-optimization-00-code-inventory
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
date: 2026-10-28
part_of: swc-next-qa-sdk-optimization
role: audit
---

# 코드 인벤토리와 정리 대장 (Phase 0 입력)

## 목적 ^purpose

원본 계획 Phase 0의 "현재 SemanticAddress 생성·파싱·decode 경로 목록화"와 "의존 그래프 작성"을 코드 기준으로 수행한 결과다. 각 트랙 계획은 이 문서의 경로·라인을 진입점으로 쓴다.

**표기:** ✅ = 이 세션에서 직접 실행·열람해 확인. 표기 없음 = 정적 탐색 결과이며 트랙 착수 Task 0에서 다시 확인한다. 라인 번호는 HEAD `24cbafbb` 기준이다.

## 1. 좌표 주소·codec 경로

### 1.1 Mixed-radix 구현 (5벌)

| 구현 | 위치 | shape 기준 | 실패 동작 |
|---|---|---|---|
| core runtime (canonical) ✅ | `packages/core/src/catalog/runtime.ts` — `encodePrefix` :342, `decodePrefix` :378, `getPrefixShape` :155, `resolveAxisCap` :94 | `capacity ?? entries.length` | 일반 `Error` throw |
| weighted-index | `packages/weighted-index/src/math/weighted-index.ts:44`, `vocab/prefix-registry.ts:96` | 생성자 입력 | `ShapeError`/`CoordError`/`IndexRangeError` 등 typed |
| browser-codec | `packages/browser-codec/src/browser-codec.ts` — `encode` :56, `decode` :108, `track` :165 | capacity | 모든 실패에서 `null` |
| codec dim-wire / typed-sdk | `packages/codec/src/dim-wire.ts:48`, `typed-sdk.ts:107` | capacity | 혼재 |
| DecodeMap 빌더 2벌 ✅ | `packages/registry-service/src/modules/catalog/decode-map.service.ts:118`, `packages/decode-service/src/worker.ts:151` | **`entries.length`** | `validateDecodeMap`(`index-meta/src/meta-codec.ts:96`)이 `shape === entries.length` 요구 |

✅ **layout 미정의 실측 (R-11):** DEMO_CATALOG 84개 prefix-version 중 `build_event@v1`, `test_event@v1`, `pattern_anomaly@v1`는 `getPrefixShape`가 `Unknown axis version: <label>@undefined`로 실패한다. v2에서 추가된 dim(`qa_module`, `anomaly_kind`·`anomaly_severity`)이 버전 공통 `labels`에 들어가 v1 `axisVersions`에 대응 항목이 없다. README 결정 D-8.

✅ **shape 불일치 실측:** DEMO_CATALOG 68개 prefix 모두 capacity shape ≠ entries shape. `service` prefix의 entries shape는 `[5, 2, 16, 2]`이고 capacity는 이보다 크다. positions `{env:1, region:1, svc_name:1, namespace:1}`를 core runtime으로 encode하면 `33825`, entries shape로 decode하면 `env=528`이 된다(범위 밖). README 결정 D-1.

### 1.2 `prefix:version:address` 파서 (9벌 이상)

| 파서 | 위치 | 실패 | 숫자 검증 | 4-part 해석 |
|---|---|---|---|---|
| `parseSerializedAddress` | `core/src/lib/address-parser.ts:31` | throw | `Number()`+`isNaN` (`"1.5"`, `"0x1f"`, `""` 통과) | `catalogId:prefix:ver:addr` |
| `parsePackedAddress` | `core/src/coordinates/address-context-schema.ts:28` | `null` | `\d+` | catalogId 선두 |
| `colonProtocol.parse` | `weighted-index/src/protocol/semantic-address.ts:119` | `SyntaxError` | `^\d+$` | 3-part만 |
| `PrefixCodec.parse` | `weighted-index/src/vocab/prefix-registry.ts:235` | `SerializeError` | `^\d+$` | 마지막 콜론 2개 기준 |
| `parseAddressValue` | `address-index/src/types.ts:85` | `null` | 실수 통과 | prefix = `"catalogId:prefix"` (core와 반대) |
| browser-codec `decode` | `browser-codec/src/browser-codec.ts:113` | `null` | `^\d+$` | catalogId 무시 |
| browser-sdk 로컬 파서 | `browser-sdk/src/monitor.ts:33` | `undefined` | `^\d+$` | address만 |
| index-meta prefix registry | `index-meta/src/adapters/sql-prefix-registry.ts:212`, `memory-prefix-registry.ts:96` | `null` | `Number()`+isInteger | 마지막 콜론 2개 |
| `decodeRelationType` | `dkg/src/relational-instance.ts:67` | 없음 (NaN 통과) | `Number()` | – |

조용한 skip 지점: `event-catalog/src/auto-track.ts:144`, `ingest-server/src/lib/decode-client.ts:36,63`, `address-index` `parseAddressContext` :105, `browser-codec` `decodeContext` :193.

### 1.3 기존 version·hash 개념 (재사용 후보)

| 개념 | 위치 | 한계 |
|---|---|---|
| `latestPrefixVersion` ✅ | `core/src/catalog/runtime.ts:134` | `context/src/catalog-provider.ts:82,119`, `dkg/src/resolve.ts:48`, `core/src/catalog/browser-flatten.ts:57`에 재구현 (전부 교체됨 — X-5) |
| `computeCatalogHash` ✅ | `codegen-core/src/catalog-typescript.ts:43` | 12 hex, `localeCompare` 정렬, dims·refEntries·tables 제외 → **Track D에서 삭제, T0 digest로 교체 (X-7)** |
| codegen 헤더 timestamp ✅ | `codegen-core/src/catalog-typescript.ts:76,92` | 실행마다 출력이 달라짐 → **Track D에서 제거, `codegen-core@<version>` 기록** |
| registry `catalogHash` | `registry-service/src/health.controller.ts:49` | 원본 JSON 문자열 해시. codegen 해시와 알고리즘 다름 |
| SDK generation 비교 | `context/src/qa-context.ts:161-172, 358-380` | warn만 (fail-open), 사실상 항상 불일치 |
| `CatalogStore` | `registry-service/src/stores/catalog-store.ts:4-19` | id당 가변 blob 1개, 이력·parent 없음 |
| canonical JSON | `sim-identifier-grammar/src/schema-hash.ts:21` (private), `context-runtime/src/handoff.ts` `canonicalize`/`stableDigest` | T0 구현 전 공용 helper 없음. T0 `canonicalJson`으로 통합 후보 |
| `TransmissionEnvelope.entry_snapshot` ✅ | `core/src/types/envelope.ts:55` | 선언만 존재 |
| error 계층 | `weighted-index/src/math/errors.ts`, `index-meta/src/errors.ts` | `code` 필드 없음, 패키지 간 매핑 없음 |

✅ `@qa-sdk/core`는 `node:crypto`를 쓰지 않고, `browser-sdk`가 core에 의존한다. core에 둘 digest는 WebCrypto(`globalThis.crypto.subtle`)여야 한다.

### 1.4 cross-implementation 테스트 현황

- parity 테스트: `packages/demo-tests/src/merge-contract/` (label-map, shape, capacity, stride, error parity)
- **공백:** core runtime ↔ DecodeMap/decode-service ↔ browser-codec가 같은 catalog에서 같은 결과를 내는지 검증하는 테스트가 없다. R-1이 통과한 이유다.
- codec golden fixture 디렉토리 없음.

## 2. Emit → ingest → store 경로

| 단계 | 위치 | 현재 동작 |
|---|---|---|
| browser emit | `browser-sdk/src/monitor.ts` — `emitWithCoords` :187, `emit` :235 | encode 실패 시 좌표 없이 emit. shutdown 후 drop은 `console.warn`만 |
| batching | `logger/src/logger.ts` — `flush` :233, `addRecord` :300, `buildEnvelope` :337. 기본값 `logger/src/config.ts:55-58` (50건 / 5s / 500건) | drop은 `onError`만, counter 없음 |
| 중복 batching | `logger/src/transport/ingest-forwarder.ts:188` | 같은 상수 재선언, `ForwarderStats`는 여기만 존재 |
| transport | `browser-sdk/src/transport.ts:10-41` `BeaconTransport` | 64KB beacon 한도 검사 없음 |
| envelope 타입 ✅ | `core/src/types/envelope.ts:45`, zod `core/src/schema/envelope.schema.ts:36` | version/snapshot/codec 필드 없음 |
| wire 디코드 | `ingest-server/src/routes/ingest.ts` `deserializeEnvelope` :87 | proto3 경로는 zod 검증을 건너뜀. proto 실패 시 JSON fallback |
| 저장 | `routes/ingest.ts` `storeEnvelope` :209, `persistTrace` :375 | SQLite 경로는 레코드당 INSERT 1회, 트랜잭션 없음 |
| Phase 2 inline | `ingest-server/src/lib/phase-two-worker.ts` `processPendingPhaseTwo` :116 | 매 요청마다 미재구성 trace 전체 scan. transition 결과는 로그만 |
| Phase 2 queue | 같은 파일 `processPhaseTwoTask` :77 | verdict까지만. transition·convergence·metric 미실행 |
| convergence | `ingest-server/src/lib/convergence-pipeline.ts:202`, `convergence-scheduler.ts:28` | timer 2개 |
| store 생성 | `ingest-server/src/server.ts` `createRuntimeStores` :506 | `clickhouse`는 조용히 SQLite로 대체 |
| 미사용 factory | `ingest-server/src/stores/store-factory.ts` | 런타임 import 0건 |
| readiness | `ingest-server/src/routes/health.ts:35-58` | pg 모드에서만 `SELECT 1`. 그 외 항상 ready |
| metrics | `ingest-server/src/lib/metrics-collector.ts:16`, `routes/metrics.ts` | counter 2개(`ingest_requests_total`, `ingest_records_total`)만 |
| raw 테이블 | `ingest-server/src/db/schema.ts:59` `event_records` | `metric_*` 컬럼 없음 → metric 필드가 모든 SQL store에서 유실 |
| DDL 출처 | drizzle schema, `stores/d1-schema.sql.ts`, `stores/clickhouse-schema.sql.ts`, `drizzle/` migration, pg schema | 4~5벌, 런타임 migration은 7개 테이블만 |
| benchmark | `packages/bench/src/runner.ts:12` (p50/p95/p99), `benchmarks/*.js` | codec microbench 없음, CI 미연결 |

✅ `server.ts:232-246` `_transitionFns`/`_transitionCatalog`는 생성 후 어디에도 전달되지 않는다. `TRANSITION_ENGINE_ENABLED=true`로 server 모드를 띄우면 "enabled" 로그만 남고 inline Phase 2.5는 실행되지 않는다(배선 누락, Track E D-5).

## 3. 분석(convergence·DKG)·codegen 경로

| 영역 | 위치 | 현재 동작 |
|---|---|---|
| convergence 진입 | `convergence/src/index.ts`, `convergence-runner.ts:50` | 항상 full 재계산, digest·cache 없음 |
| 숨은 시계 | `convergence/src/metric-registry.ts:166,418,452`, `convergence-runner.ts:57` | `new Date()` 직접 호출 → 비결정 |
| metric dispatch | `metric-registry.ts:160` | `METRIC_DEFS.find(id)` 하드코딩, `measureFn` 미사용, transition metric 3종 미계산 |
| observation 타입 | 정본 `dkg/src/dkg.types.ts:149`; 사본 `convergence/src/dkg-types.ts:12`, `registry-service/src/types/spec-core-ports.ts:124` | provenance·inputDigest·producerVersion 없음 |
| DKG store | `dkg/src/store/dkg-sqlite-store.ts:168` | `dkg_nodes` PK가 `id` 단독 (catalog 간 덮어쓰기 위험), raw DDL이 drizzle과 중복 |
| CON-005 | `ingest-server/src/lib/convergence-pipeline.ts:474-487` | `'CON-005'` 문자열 하드코딩, 오류 삼킴 |
| PolicyCandidate | `decision-flow/src/policy-learning.ts:31,85` | `extends FlowPolicy`, in-memory Map, 영속화 없음 |
| TransitionRegistry | `spec-transition/src/transition.registry.ts:13` | 유일한 version-aware 레지스트리 |
| BROWSER_CATALOG 생성 | `viz-3d/scripts/generate-browser-catalog.ts` (viz-3d `prebuild`) | `core/src/catalog/browser-flatten.ts`를 import하지 않고 재구현. `BrowserCatalog` 타입 3벌 → **Track D: core import로 교체, drift는 `pnpm codegen:check`·`.github/workflows/codegen-drift.yml` (X-8)** |
| codegen CLI | `cli/src/commands/codegen.ts:124-201` | `maybeWriteCodegenArtifactRegistryRecords` provenance hook 존재 (재사용 후보) |
| drift 검사 | `scripts/tax-codegen-drift.mjs` (`pnpm tax:ci`) | taxonomy 전용. workflow 미연결. Catalog drift 검사 템플릿으로 재사용 가능 |
| ADR | `docs/architecture-decisions.md` | ADR-009가 마지막. 다음 번호 ADR-010 |

IR 이름 충돌 (G3 착수 시 회피): `TransitionRecord`(`definition-catalog/src/state-model.ts:47`), `ObservationRecord`(`context-runtime/src/types.ts:561`, `operational-ontology/src/persistence.ts:15`), `DecisionVerdictRecord`(`decision-flow/src/types.ts:179`).

## 4. 의존 그래프 (Phase 0 대상 경로)

```text
weighted-index ──► index-meta ──► decode-service / registry-service(DecodeMap)
      │
      └──(calcWeights 인라인 복제)──► @qa-sdk/core catalog/runtime.ts ──► context(QaContext.track)
                                              │                         ──► sdk
                                              │                         ──► dkg/resolve.ts
                                              ├──► browser-sdk ──► browser-codec (독자 encode/decode)
                                              └──► ingest-server ──► engine(verdict) ──► spec-transition
                                                                   └─► convergence ──► dkg(store)
codegen-core ──► cli codegen ──► demo-types (생성물 커밋)
viz-3d/scripts ──► browser-codec/src/demo-catalog-browser.ts (생성물 커밋)
```

## 5. 중복·dead code 대장

| # | 항목 | 처리 | 담당 |
|---|---|---|---|
| X-1 | CLI 로더 사본 `cli/src/catalog-loader.ts`, `cli/src/dkg-config-loader.ts` (import 0건, `config-loader`와 `@def` 헤더 외 동일) ✅ | **정리 완료** (삭제) | – |
| X-2 | `convergence/src/dkg-types.ts` 헤더가 존재하지 않는 `spec-core/src/dkg/dkg.types.ts`를 원본으로 표기 ✅ | **정리 완료** (주석 정정) | – |
| X-3 | DecodeMap 빌더 2벌 + shape 기준 불일치 | ✅ **Track A 처리**: core `layoutToDecodeMap` 단일화, registry·worker 위임 (R-1 해소) | A |
| X-4 | 주소 파서 9벌 | core 2벌은 ✅ 단일화(`parsePackedAddress` → `parseSerializedAddress`). weighted-index·address-index·browser-sdk·index-meta 파서는 남음 | A (후속) |
| X-5 | `latestPrefixVersion` 재구현 4곳 | ✅ context·dkg 교체. ✅ `core/catalog/browser-flatten.ts`도 Track D에서 runtime `latestPrefixVersion` 사용으로 교체 | A, D |
| X-6 | QAPB 프레임 구현 2벌 + proto 필드 레이아웃 3벌 | 필드 번호 정본 결정 후 정합 | B |
| X-7 | `computeCatalogHash` 불완전·비결정 + registry 해시 별도 알고리즘 | ✅ **Track D 처리 (codegen)**: `computeCatalogHash` 삭제, `generateCatalogTypes`(async)가 `catalogDigest = computeCatalogDigest(catalog)`, `contentHash`·`GENERATION` = `shortDigest(catalogDigest)`, drift용 `sourceDigest = digestCanonical({catalog, dkgConfig, generator, options})`를 헤더(전체 64 hex)·`VERSION_META`·CLI provenance metadata에 기록. 헤더 시각 제거, `localeCompare` 정렬 제거 → 같은 입력이면 같은 바이트. **남은 일 (B)**: registry `health.controller.ts:49`는 아직 `sha256(catalog.data)` 12 hex라 `GENERATION`과 다름 — B Task 4에서 `shortDigest(computeCatalogDigest)`로 교체해야 SDK 비교가 일치 | D (codegen) ✅, B (registry) |
| X-8 | browser catalog 생성기 재구현 + `BrowserCatalog` 타입 3벌 | ✅ **Track D 처리 (생성기·core)**: viz-3d 생성기의 재구현·로컬 타입 삭제, `@qa-sdk/core` `flattenForBrowser`·`browserCatalogSnapshotOf` import (viz-3d devDependency 추가). core `flattenForBrowser`는 버전 labels(D-8) 순서로 차원을 고정. 생성물은 `BROWSER_CATALOG_SNAPSHOT`(`catalog_id`·전체 `digest`·`codec_version`)과 `generate-browser-catalog@<viz-3d version>` 헤더를 가짐. 착수 시점 커밋본 `BROWSER_CATALOG`는 `flattenForBrowser(DEMO_CATALOG)`와 이미 동치였다(drift 없음, 테스트로 고정). **남은 일 (A)**: `browser-codec/src/browser-codec.ts:33`의 `BrowserCatalog` 사본 교체 — 단 browser-codec은 의존성 0인 패키지라 core import 대신 구조 동치 테스트로 고정하는 방안도 검토 | D ✅, A (browser-codec 타입) |
| X-9 | `stores/store-factory.ts` 미사용 | D-3 | E |
| X-10 | `server.ts` 미전달 transition 초기화 | D-5 (배선 or 제거) | E |
| X-11 | convergence timer 2개 | D-4 | E |
| X-12 | 미사용 env key `QA_PG_SCHEMA`, `TRANSITION_VIOLATION_MODE`, `TRANSITION_STATE_PATH` | 소비처 연결 또는 제거 | E |
| X-13 | `QaLogger` ↔ `IngestForwarder` batching 중복 | G2에서 공용 buffer로 통합 | G2 |
| X-14 | `convergence/src/dkg-types.ts` 타입 사본(`metadata` 누락으로 drift) | **Track F 처리**: `metadata`·`provenance` 동기화, `dkg-enrichment/src/type-drift.test.ts`가 `toEqualTypeOf`로 고정 (`test` 스크립트에 `tsc --noEmit`) | F |
| X-15 | `scaffoldDecision` 2벌 (`dkg`, `convergence`), dkg ↔ dkg-enrichment skills 근사 중복 | **판정 완료 (§5.1)**: `scaffoldDecision` 정본 = `dkg`, skills 정본 = `dkg-enrichment`. 이동·삭제는 G3 | F → G3 |
| X-16 | `data-object-codegen` 패키지 소비처 0건, `event-catalog/src/track-codegen.ts` ↔ `codegen-core` 중복 | ✅ **판정 기록 (§5.2)**: 둘 다 제거 후보. 삭제는 사람 결정 대기 | D → 결정 대기 |
| X-17 | `runConvergenceAnalysis`, `transitionFlushToMetrics`, `aggregateTransitionResults` 프로덕션 호출 0건 | G3에서 incremental 진입점으로 흡수 또는 제거. `runConvergenceAnalysis`는 Track F에서 `clock` 옵션을 받으므로 흡수 시 그대로 재사용 가능 | G3 |

X-1, X-2 외 항목은 동작이나 공개 API를 바꾸므로 담당 트랙에서 테스트와 함께 처리한다.

### 5.1 X-15 소유 판정 (Track F Task 4, HEAD `05b46396` 기준)

판정 기준: 프로덕션 호출 경로 + 의존 방향(`convergence`는 `dkg`를 import하지 않음, `dkg`는 `convergence` 런타임에 정적 의존하지 않음, `dkg-enrichment`는 둘 다 의존하는 logic tier).

| 대상 | 현재 상태 | 프로덕션 호출 경로 | 판정 | G3 Task |
|---|---|---|---|---|
| `scaffoldDecision` | `dkg/src/decision-scaffold.ts` ↔ `convergence/src/decision-scaffold.ts` 본문 동일 (`@def` 헤더·타입 import 경로만 다름). `dkg/src/skills/decision-scaffold.ts`는 이미 re-export shim | `dkg` 판: CLI `commands/dkg.ts`, `dkg/src/skills/{converge-chain,record-operation,skill-chain}`, `dkg-enrichment/src/skills/converge-chain`. `convergence` 판: `headroom-advisor`, `separation-record` (convergence 내부 전용) | **정본 = `dkg`**. `convergence` 사본은 의존 방향 때문에 유지하되 동작 drift를 막는다 | 둘 다 의존 가능한 하위 계층(후보: `spec-schema` — DKG node 타입 부분집합과 `weighted-index` 의존 수용 여부 확인)으로 이동하거나, 이동 전까지 `dkg-enrichment`에 DecisionType 6종 parity 테스트 추가 |
| skills `converge-chain`, `coverage-audit`, `flow-trace` | `dkg` 판은 convergence 분석기를 import하지 않고 로컬 근사 재구현 (헤더에 명시). `dkg-enrichment` 판은 `@qa-sdk/convergence` 분석기(`scanAxisOverlaps`, `analyzeSimplification`, `discoverCausality`, `analyzeDeploymentSkew`, `analyzeEntryCoverage`)를 호출. `resolveRecoveredFlowObservations`는 `dkg` 판에만 있음 | **`dkg` 판만 프로덕션 사용**: CLI `commands/dkg.ts`가 `from 'dkg'`로 import, ingest-server는 `@qa-sdk/spec-core/dkg`(= `export * from 'dkg'`) 경유 `traceFlows`·`resolveRecoveredFlowObservations`. `dkg-enrichment` 판은 자체 테스트(`operational-loop`, `converge-review`, `converge-chain`)에서만 호출. 외부 패키지는 `dkg-enrichment`에서 `bootstrapDkg`만 import | **정본 = `dkg-enrichment`** (분석 로직은 convergence 단일 구현을 써야 G3 cache key·differential test가 의미를 가짐. `dkg`는 graph·store tier로 남김). `dkg` 판은 deprecated 후보 | ① `resolveRecoveredFlowObservations`를 `dkg-enrichment`로 이식 ② `dkg` 판 vs `dkg-enrichment` 판 differential test(같은 graph·usage fixture)로 출력 차이 목록화 ③ CLI·ingest-server import를 `dkg-enrichment`로 전환 (ingest-server·cli·spec-core는 이미 `dkg-enrichment` 의존 선언) ④ `dkg/src/skills/{converge-chain,coverage-audit,flow-trace}.ts`와 `dkg/src/index.ts` export 제거 |

Track F에서는 코드를 옮기지 않았다.

### 5.2 X-16 제거 판정 (Track D Task 5, HEAD `d4f9b650` 기준)

조사: `grep -rn "data-object-codegen\|track-codegen" packages apps scripts` (`*.ts`·`*.tsx`·`*.mjs`·`package.json`, node_modules·dist 제외), `generateTrackCode`·`summarizeMappings` import 탐색, `scripts/publish-local.sh` `PACKAGES` 목록.

| 대상 | 코드 소비처 | 문자열 참조 (코드 아님) | 외부 배포 | 중복 관계 | 판정 |
|---|---|---|---|---|---|
| `packages/data-object-codegen` (`generateDataObjectBindings`, 688줄) | **0건** — 어떤 `package.json`도 의존하지 않음. CLI `codegen data-objects`는 `codegen-core`의 같은 이름 함수(167줄, 다른 구현)를 쓴다 | `demo-snapshot` axis entry·`demo-types` 생성물(정의 ID `'data-object-codegen'`), CLI `ownerDefinitionId` 기본값, `scripts/package-surfaces.mjs:237` (`spec-analysis-kernel` 그룹, verdict `keep`), `verify-analysis-os.ts`의 spec 경로 | Verdaccio `publish-local.sh` 목록에 없음 → 외부 npm 소비 없음 | 같은 이름·다른 출력의 구현 2벌. 정본은 CLI가 쓰는 `codegen-core` | **제거 후보**. 삭제 시 `package-surfaces.mjs`에서 항목 제거, 정의 ID 문자열은 개념(definition) 이름이라 유지. 688줄 판의 추가 기능이 필요하면 `codegen-core`로 이식 후 삭제 |
| `event-catalog/src/track-codegen.ts` (`generateTrackCode`, `summarizeMappings`, 141줄) | **0건** — `@qa-sdk/event-catalog` 의존 8개 패키지 중 두 함수를 import하는 곳 없음 (자체 테스트만) | `docs/specs/meta-semantic/interface/event-track-codegen.spec.md` (`verify-analysis-os.ts`가 경로 참조) | `@qa-sdk/event-catalog`도 `publish-local.sh` 목록에 없음 | `codegen-core/src/event-track-typescript.ts`(445줄)에 같은 이름 `generateTrackCode`가 있고 `codegen-core` index에서 공개 | **제거 후보**. `@qa-sdk/event-catalog` index의 공개 export 3개(`generateTrackCode`, `summarizeMappings`, `TrackCodegenOptions`)가 사라지는 breaking change이나 workspace 내 소비처 0건 |

Track D에서는 삭제하지 않았다. 삭제 여부는 사람이 결정한다.

## 6. 정리 완료 내역

| 변경 | 검증 |
|---|---|
| `packages/cli/src/catalog-loader.ts`, `packages/cli/src/dkg-config-loader.ts` 삭제 | 저장소 전체 참조 0건 확인, `@qa-sdk/cli` build 성공, vitest 68 files / 673 passed / 1 skipped |
| `packages/convergence/src/dkg-types.ts` 원본 경로 주석 정정 | `spec-core/src/dkg/index.ts`가 `export * from 'dkg'`임을 확인 |
