# Meta-Semantic TODO

> 최종 업데이트: 2026-04-02

## 현황

- 스펙: 80개 문서 (6 패싯 폴더 분리, CON-MS-001~007 적용)
- 구현: 44개 파일 (+pipe-store-sqlite 패키지: store.ts, manifest-store.ts, schema.ts)
- 테스트: 729 tests 전부 통과 (core 729/43 + codegen-core 24/1 + pipe-store-sqlite 30/2)

---

## 완료

### Phase 1 — 기반

- [x] 9가지 원자 개념 정의 (concepts/ 9 leaf)
- [x] IR 구조 (ir/ 3 leaf: module, data, pipe)
- [x] ScopeRegistry — 경로 모델 + N:M + 버전 관리 (14 tests)
- [x] ManifestRegistry — prefix + manifest 라이프사이클 (16 tests)
- [x] ASPECT_TO_SCOPES (N:M) + compat 분리
- [x] ^method 마커 체계 추가 (C10)
- [x] def-* 스킬 6개에 meta-semantic 판단 원칙 추가
- [x] 데이터 패싯 → "역할 분리" 재명명 (확장 가능)
- [x] "5원 분리" → "데이터 패싯 (Data Facets)" 전환

### Phase 2 — PipeSpec + PipeGraph

- [x] PipeFlow 29종 타입 정의 (29종 확정)
- [x] ConnectionKind 8종 타입 정의 (N:M PipeConnection)
- [x] countPipePaths / countGraphPaths (38 tests)
- [x] validatePipeSpec / validatePipeGraph
- [x] 직렬화 — serialize/deserialize JSON (4 tests)
- [x] 저장 — PipeGraphStore/PipeSpecStore + 인메모리 (9 tests)
- [x] 분석 — complexity, bottleneck, coverage (6 tests)
- [x] Phase 2 시뮬레이션 — simulate() + resolver (81 tests)
- [x] Phase 2→3 브릿지 — extractLineage, validateStepContracts, constraintResultToEvent
- [x] PipeFlow 카탈로그 (flows/ 29 leaf, connections/ 8 leaf)

### Phase 3 — 런타임

- [x] ConditionEvaluator — parseCondition + evaluateCondition (10 tests)
- [x] CancellationToken — 협력적 취소 + child 전파 (5 tests)
- [x] PipeContext — get/set/clone + 중첩 경로 (4 tests)
- [x] ExecutorRegistry — facet별 실행기
- [x] PipeRunner — run() + 에러 전파 + 이벤트 체인 (10 tests)
- [x] 벤치마크 — 전부 서브밀리초 (11 tests)

### Semantic Folding

- [x] computeFoldedContract — 서브그래프 경계 계약 도출
- [x] foldSubgraph — 파이프 그룹 → 단일 노드 축소
- [x] unfoldNode — 접힌 노드 → 원본 복원
- [x] detectFoldRegions — scope 클러스터 / 선형 체인 / SCC 자동 탐지
- [x] 성능 벤치마크 — 200파이프 depth=12, 3단계 중첩 fold 전부 서브밀리초 (36 tests)

### 연산자 안정화 (29종 PipeFlow × 6모듈)

- [x] validate — 빈 from/to 배열 검증, 숫자 범위, correlation 자기참조 (+20 tests)
- [x] simulate — loop 반복, tap 에러 격리, dedup 상태 추적, 테스트 커버리지 확대 (+21 tests)
- [x] runtime — throttle 속도제한, debounce 대기, dedup 중복제거, filter skip 기록 (+10 tests)

### 데이터 계약

- [x] DataSchema — 컬럼 + 패싯 역할 (FacetRole)
- [x] DataRelation — 1:1/1:N/N:M + cascade
- [x] checkCompatibility — 스키마 호환 검증
- [x] LineageCollector — 10종 변환 + 원본/영향 추적
- [x] VersionCollector — 9종 변경 + backward/forward/breaking (36 tests)

### Constraint 엔진

- [x] ConstraintDef — subject × predicate × context × evidence
- [x] evaluatePredicate — 20종 op + and/or/not 중첩
- [x] executeConstraint → ConstraintResult + FailureTrace
- [x] ConstraintRegistry — 등록/조회/결과 수집/품질 지표 (24 tests)

### 표준 호환

- [x] CloudEvents — toCloudEvent/fromCloudEvent + 배치 + 직렬화 (14 tests)
- [x] AsyncAPI — generateAsyncApi + YAML/JSON 생성기 (4 tests)

### 테스트 추적 + 매칭

- [x] TestRegistry — 케이스/스위트/결과 수집 + 품질 지표 (24 tests)
- [x] PathMatcher — matchPath() + 판정 (pass/warn/fail) (8 tests)

### 레이어 2 — 해석 (PipeGraph 네이티브)

- [x] PipeConcern 8종 자동 추출 — extractPipeConcerns
- [x] 전파 규칙 테이블 — PIPE_PROPAGATION_RULES (ConnectionKind × PipeConcern × 방향)
- [x] concern 전파 BFS — propagatePipeConcerns (전이적 전파 축소 포함)
- [x] 변경 영향 분석 — analyzePipeImpact (blastRadius + byConcern)
- [x] 파이프 역할 분류 — classifyPipeRole (producer/consumer/transformer/router/observer)
- [x] 테스트 23건 통과
- [x] 퀄리티 게이트 — evaluateGate/evaluateGates + pass/fail/review 3종 판정 (17 tests)
- [x] 퀄리티 게이트 spec-tracker 연동 — pipe-interpret-gate (11 tests)

### 데이터 흐름 보정

- [x] matchHappyPath — 시뮬 결과 vs happy path 비교 (18 tests)
- [x] collectGraphEvents — PipeGraph에서 trigger/produces/emit 이벤트 자동 수집 (14 tests)
- [x] TestRegistry.compareWithSimulation — 시뮬 결과 드리프트 감지 (6 tests)
- [x] 스펙 6건 데이터 흐름 보정 (.todo → 구현 → .spec 흡수)
- [x] pipe-gate 적용 시점 분류 (정의 직후/분석 후/시뮬 후)
- [x] path-coverage-min 근사치 제거 (executedPathCount 필수)
- [x] __foldedContract 타입 캐스트 제거, version 비교 수정

### 줌 레벨 시각화

- [x] computeZoomView — PipeGraph → 줌 레벨별 뷰 계산 (group/module/leaf)
- [x] computeZoomLevels — 3단계 줌 레벨 맵 일괄 생성
- [x] computeLayout — 위상 정렬 기반 DAG 레이아웃 (barycenter 휴리스틱)
- [x] 타입 확실성 시각 인코딩 — strict→polygon/solid, flexible→cloud/dashed
- [x] 줌 레벨별 접기: group(전체), module(chain+SCC), leaf(없음)
- [x] 패싯 분할: pipe-zoom-view/layout/style 3개 테스트 + fixture 추출
- [x] 테스트 26건 통과

### SDK Track 코드 자동 생성

- [x] generateTrackCode — EventDef + EventMapping + PayloadGuide → TypeScript
- [x] 생성 파일 5종: event-keys, event-payloads, event-mappings, track-functions, index
- [x] EventKey 유니온 + 카테고리별 서브 유니온
- [x] 이벤트별 payload 인터페이스 + EventPayloadMap
- [x] 이벤트별 타입 안전 track 함수 + 제네릭 track<K>
- [x] EVENT_MAPPINGS typed const — 매핑 데이터 codegen 출력
- [x] 테스트 24건 통과

### CloudEvent ↔ EventRecord 타입 연결

- [x] toCloudEvent(EventRecord | EventRecordLike) — 두 타입 모두 허용
- [x] EventRecordLike에 address_context 필드 추가 (EventRecord 호환)
- [x] address_context → subject 변환 (coordinate보다 우선)
- [x] fromCloudEvent → address_context 복원
- [x] 기존 14 tests 보존 + address_context 라운드트립 4건 추가 (18 tests)

### VerdictReport v2

- [x] computeVerdictV2 — PathMatcher + PipeGate → pass/fail/review 3종 판정
- [x] PathMatcher verdict 직접 수용 (독자 pipeRate 재계산 제거)
- [x] 패싯 커버리지 — getChildFlows 재사용 (중복 getChildren 제거)
- [x] 게이트 오버레이: gate fail→fail, gate review→review
- [x] 테스트 13건 통과

### compat 제거

- [x] ASPECT_TO_SCOPE compat.ts 삭제 + index.ts export 제거
- [x] taxonomy.test.ts 하위 호환 테스트 제거 (32→31 tests)

### 스펙 마커 보강

- [x] MODULE ^method 추가: folding, spacetime-uid, extraction, ir
- [x] MODULE ^delegates 추가: pipe-impl (contains 자식 11개 → 16개)

### 코드 리뷰 이슈 수정

- [x] getChildren 3중 중복 제거 — verdict-v2에서 getChildFlows(pipe-analyze) import
- [x] verdict-v2 pipeRate 독자 재계산 제거 — PathMatcher verdict 직접 수용
- [x] codegen import 경로 버그 수정 — EventKey를 event-keys.js에서 import
- [x] codegen event-mappings.ts 추가 — 매핑 데이터를 typed const로 생성
- [x] pipe-zoom 미사용 import(computeFoldedContract) 제거
- [x] verdict-v2 미사용 import(allGatesPass, GateVerdict) 제거

### spec 구조 재편 (CON-MS-001~007)

- [x] 패싯 폴더 6개 분리: concepts, meta-semantic-ir, algorithm, pipe-impl, interface, migration
- [x] childless module → leaf 강등 8건 (spacetime-uid, scope, folding, extraction, data-contract, execution-semantics, test-tracking, v2-migration)
- [x] 다중 부모 제거: pipe-interpret, pipe-gate → system contains에서 제거
- [x] 고아 소속: cloud-event-bridge, compat-removal, verdict-v2, path-matcher-migration
- [x] lifecycle 갱신 5건 → approved (concepts, ir, folding, scope, data-contract)
- [x] scope/aspect 보정 3건 (ir-pipe→data/system_data, event-track-codegen→interface/event_contract, path-matcher-migration→flow/process_flow)
- [x] data-contract, test-tracking → pipe-impl 소속 이동 (algorithm/ 예외 해소)

### 테스트 재편 + 인프라

- [x] pipe-infra.test.ts → 4개 패싯별 파일 분리
  - pipe-serialize.test.ts (4 tests)
  - pipe-store.test.ts (9 tests)
  - pipe-validate.test.ts (20 tests)
  - pipe-analyze.test.ts (14 tests)
- [x] pipe-zoom.test.ts → 3개 패싯별 파일 분리
  - pipe-zoom-view.test.ts (16 tests)
  - pipe-zoom-layout.test.ts (4 tests)
  - pipe-zoom-style.test.ts (6 tests)
- [x] matchHappyPath → pipe-happy-path.test.ts 분리 (18 tests)
- [x] fixture 추출 — step()/simplePipe/simpleGraph → `__fixtures__/pipe-fixtures.ts` (20파일 교체)
- [x] fixture 추출 — pipe-zoom-fixtures.ts (makePipe, conn, 4개 그래프)
- [x] test-split 스킬 작성 (`skills/test-split/SKILL.md`)
- [x] @qa-sdk/pino 복원 + workspace 참조 간소화 (^9.9.4 → *)

### SQLite 영속화 (pipe-store-sqlite 패키지)

- [x] 패키지 생성 — drizzle-orm@1.0.0-beta.20 + node:sqlite, tsup dual format
- [x] 스키마 4테이블: pipe_graphs, pipe_specs, prefix_versions, service_manifests
- [x] SqlitePipeGraphStore — PipeGraphStore 포트 구현 (save/get/getLatest/listVersions/listAll/remove/findByPipeId/findByTriggerEvent)
- [x] SqlitePipeSpecStore — PipeSpecStore 포트 구현 (save/get/getLatest/listAll/remove)
- [x] SqliteManifestRegistry — ManifestRegistry 동일 API (가드 로직 내장, definition-catalog 비의존)
- [x] JSON 라운드트립: PipeFlow 29종 union, PipeConnection[], prefixes Record
- [x] 마이그레이션 IF NOT EXISTS 적용
- [x] 테스트 30건 통과 (PipeStore 14 + ManifestRegistry 16)

---

## 진행 중

(없음)

---

## 미완료

> 우선순위: P1(중간) → P2(보류) → P3(낮음). definition-catalog은 기술 부채 변경 대상이라 브릿지 보류.

### P1 — 중간

- [x] graph-matcher → PathMatcher 전환 (engine 패키지 어댑터, 18 tests)

### P2 — 보류 (인프라 / 기술 부채 대상)

- [x] PipeGraphStore + PipeSpecStore 영속화 — SqlitePipeGraphStore/SqlitePipeSpecStore (14 tests)
- [x] ManifestRegistry 영속화 — SqliteManifestRegistry (16 tests)
- [x] lifecycle — resolveLifecycles (DefinitionLookup 포트 기반)
- [x] layer 영향 전파 — analyzeLayerPropagation (canPropagate 내장)
- [x] tags — resolveTags (DefinitionLookup 포트 기반)
- [ ] registry-service 연동 — 매니페스트 API 노출 (NestJS 서비스 변경 필요)

### P3 — 낮음

- [x] PipeGraph → Mermaid 변환 — pipeGraphToMermaid / zoomViewToMermaid
- [x] PipeGraph → D3/SVG 변환 — pipeGraphToSvg / zoomViewToSvg / pipeGraphToD3 / zoomViewToD3 (15 tests)
